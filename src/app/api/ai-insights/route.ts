import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiRateLimit } from "@/lib/redis";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Gemini direct models (current GA stable — 2.5-flash is Google's recommended workhorse)
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

// OpenRouter free text models (fallback)
const OPENROUTER_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
];

interface InsightItem {
  type: "spending_summary" | "savings_tip" | "budget_alert" | "trend_analysis";
  title: string;
  content: string;
  data?: Record<string, unknown>;
}

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting (skipped if Upstash not configured)
    if (aiRateLimit) {
      const { success } = await aiRateLimit.limit(user.id);
      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again shortly." },
          { status: 429 }
        );
      }
    }

    if (!GEMINI_API_KEY && !OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "AI service not configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY." },
        { status: 503 }
      );
    }

    // Fetch the user's actual data server-side for authoritative insights
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const [expensesRes, budgetsRes, recentRes] = await Promise.all([
      supabase
        .from("expenses")
        .select("amount,category,vendor,date,is_recurring")
        .eq("user_id", user.id)
        .gte("date", startOfMonth)
        .order("date", { ascending: false }),
      supabase
        .from("budgets")
        .select("category,monthly_limit")
        .eq("user_id", user.id),
      supabase
        .from("expenses")
        .select("amount,category,vendor,date")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(10),
    ]);

    const currentMonthExpenses = expensesRes.data ?? [];
    const budgets = budgetsRes.data ?? [];
    const recentExpenses = recentRes.data ?? [];

    // Build a concise financial summary for the AI
    const totalSpent = currentMonthExpenses.reduce(
      (s: number, e: { amount: number }) => s + e.amount,
      0
    );
    const categoryTotals: Record<string, number> = {};
    for (const e of currentMonthExpenses) {
      categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
    }

    const budgetSummary = budgets.map(
      (b: { category: string; monthly_limit: number }) => ({
        category: b.category,
        limit: b.monthly_limit,
        spent: categoryTotals[b.category] ?? 0,
        percentage:
          b.monthly_limit > 0
            ? Math.round(
                ((categoryTotals[b.category] ?? 0) / b.monthly_limit) * 100
              )
            : 0,
      })
    );

    const prompt = `You are a personal finance advisor. Analyze this spending data and provide actionable insights.

Current month spending: $${totalSpent.toFixed(2)} across ${currentMonthExpenses.length} transactions.

Spending by category:
${Object.entries(categoryTotals)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .map(([cat, total]) => `- ${cat}: $${(total as number).toFixed(2)}`)
  .join("\n")}

Budget status:
${
  budgetSummary.length > 0
    ? budgetSummary
        .map(
          (b: { category: string; spent: number; limit: number; percentage: number }) =>
            `- ${b.category}: $${b.spent.toFixed(2)} / $${b.limit.toFixed(2)} (${b.percentage}%)`
        )
        .join("\n")
    : "No budgets set."
}

Recent transactions (last 10):
${recentExpenses
  .slice(0, 10)
  .map(
    (e: { date: string; vendor: string | null; category: string; amount: number }) =>
      `- ${e.date}: ${e.vendor ?? "Unknown"} (${e.category}) $${e.amount.toFixed(2)}`
  )
  .join("\n")}

Generate 3-5 personalized financial insights. Return ONLY valid JSON array (no markdown, no code fences):
[
  {
    "type": "spending_summary" | "savings_tip" | "budget_alert" | "trend_analysis",
    "title": "<short title>",
    "content": "<2-3 sentence actionable insight>"
  }
]

Rules:
- If any budget is over 80%, include a budget_alert
- Always include at least one savings_tip
- Be specific with dollar amounts and percentages
- Be encouraging but honest`;

    const validTypes = [
      "spending_summary",
      "savings_tip",
      "budget_alert",
      "trend_analysis",
    ];

    let insights: InsightItem[] = [];
    let lastError: string | null = null;

    // --- Try Gemini first (direct API) ---
    if (GEMINI_API_KEY) {
      for (const model of GEMINI_MODELS) {
        try {
          const res = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
                responseMimeType: "application/json",
              },
            }),
            signal: AbortSignal.timeout(60_000),
          });

          if (!res.ok) {
            const err = await res.text();
            lastError = `Gemini ${model}: ${res.status} ${err.slice(0, 200)}`;
            if (res.status === 429) break; // Rate limited — try OpenRouter instead
            continue;
          }

          const data = await res.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!content) {
            lastError = `Gemini ${model}: Empty response`;
            continue;
          }

          const jsonStr = content.replace(/```json?\n?|```/g, "").trim();
          const parsed = JSON.parse(jsonStr);
          if (!Array.isArray(parsed)) {
            lastError = `Gemini ${model}: Response is not an array`;
            continue;
          }

          insights = parsed
            .filter(
              (item: Record<string, unknown>) =>
                typeof item.title === "string" &&
                typeof item.content === "string" &&
                typeof item.type === "string" &&
                validTypes.includes(item.type as string)
            )
            .slice(0, 6)
            .map((item: Record<string, unknown>) => ({
              type: item.type as InsightItem["type"],
              title: (item.title as string).slice(0, 200),
              content: (item.content as string).slice(0, 1000),
              created_at: new Date().toISOString(),
            }));

          if (insights.length > 0) break;
          lastError = `Gemini ${model}: No valid insights parsed`;
        } catch (e) {
          lastError = `Gemini ${model}: ${e instanceof Error ? e.message : "Unknown error"}`;
          continue;
        }
      }
    }

    // --- Fallback to OpenRouter ---
    if (insights.length === 0 && OPENROUTER_API_KEY) {
      for (const model of OPENROUTER_MODELS) {
        try {
          const res = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer":
                process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
              "X-Title": "ExpenseVision AI Insights",
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: prompt }],
              max_tokens: 1024,
              temperature: 0.7,
            }),
            signal: AbortSignal.timeout(60_000),
          });

          if (!res.ok) {
            const err = await res.text();
            lastError = `${model}: ${res.status} ${err.slice(0, 200)}`;
            continue;
          }

          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (!content) {
            lastError = `${model}: Empty response`;
            continue;
          }

          const jsonStr = content.replace(/```json?\n?|```/g, "").trim();
          const parsed = JSON.parse(jsonStr);
          if (!Array.isArray(parsed)) {
            lastError = `${model}: Response is not an array`;
            continue;
          }

          insights = parsed
            .filter(
              (item: Record<string, unknown>) =>
                typeof item.title === "string" &&
                typeof item.content === "string" &&
                typeof item.type === "string" &&
                validTypes.includes(item.type as string)
            )
            .slice(0, 6)
            .map((item: Record<string, unknown>) => ({
              type: item.type as InsightItem["type"],
              title: (item.title as string).slice(0, 200),
              content: (item.content as string).slice(0, 1000),
              created_at: new Date().toISOString(),
            }));

          if (insights.length > 0) break;
          lastError = `${model}: No valid insights parsed`;
        } catch (e) {
          lastError = `${model}: ${e instanceof Error ? e.message : "Unknown error"}`;
          continue;
        }
      }
    }

    if (insights.length === 0) {
      console.error("AI insights failed with all providers:", lastError);
      return NextResponse.json(
        { error: "Failed to generate insights. Please try again." },
        { status: 502 }
      );
    }

    // Optionally persist insights to DB
    try {
      const insightsToStore = insights.map((insight) => ({
        user_id: user.id,
        insight_type: insight.type,
        content: `${insight.title}: ${insight.content}`,
        data: { title: insight.title },
      }));
      await supabase.from("ai_insights").insert(insightsToStore);
    } catch {
      // Non-critical — don't fail the response
    }

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("POST /api/ai-insights error:", error);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    );
  }
}
