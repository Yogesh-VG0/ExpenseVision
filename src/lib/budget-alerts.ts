/**
 * Budget alert engine.
 *
 * Called after each expense save to check whether the user has crossed
 * 80% or 100% of any category budget this month. Creates in-app notifications
 * and avoids duplicate alerts within the same calendar month.
 */

import { createClient } from "@/lib/supabase/server";
import { sendPushToUser, isPushConfigured } from "@/lib/push-sender";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

interface BudgetAlertResult {
  alerts: Array<{
    category: string;
    type: "budget_warning" | "budget_exceeded";
    percentage: number;
    spent: number;
    limit: number;
  }>;
}

export async function checkBudgetAlerts(
  supabase: ServerSupabase,
  userId: string,
  expenseCategory: string
): Promise<BudgetAlertResult> {
  const alerts: BudgetAlertResult["alerts"] = [];

  // Respect user notification preferences — skip if budget_alerts is explicitly disabled
  const { data: profile } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", userId)
    .maybeSingle();

  const prefs = profile?.notification_preferences as Record<string, boolean> | null;
  if (prefs?.budget_alerts === false) {
    return { alerts };
  }

  // Get budget for this category
  const { data: budget } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .eq("category", expenseCategory)
    .maybeSingle();

  if (!budget) return { alerts };

  // Compute current month's spend in this category
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", userId)
    .eq("category", expenseCategory)
    .gte("date", startOfMonth)
    .lte("date", endOfMonth);

  const totalSpent = (expenses ?? []).reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );

  const percentage = (totalSpent / Number(budget.monthly_limit)) * 100;
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (percentage >= 100) {
    // Check if already notified this month
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "budget_exceeded")
      .gte("created_at", `${monthKey}-01T00:00:00Z`)
      .ilike("title", `%${expenseCategory}%`)
      .maybeSingle();

    if (!existing) {
      const title = `${expenseCategory} budget exceeded`;
      const body = `You've spent ${Math.round(percentage)}% of your ${expenseCategory} budget this month. Consider reviewing recent expenses.`;

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "budget_exceeded",
        title,
        body,
        data: {
          category: expenseCategory,
          spent: totalSpent,
          limit: Number(budget.monthly_limit),
          percentage,
          month: monthKey,
        },
      });

      if (isPushConfigured()) {
        sendPushToUser(supabase, userId, {
          title,
          body,
          tag: `budget-exceeded-${expenseCategory}-${monthKey}`,
        }).catch((err) => console.error("Push delivery failed:", err));
      }

      alerts.push({
        category: expenseCategory,
        type: "budget_exceeded",
        percentage,
        spent: totalSpent,
        limit: Number(budget.monthly_limit),
      });
    }
  } else if (percentage >= 80) {
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "budget_warning")
      .gte("created_at", `${monthKey}-01T00:00:00Z`)
      .ilike("title", `%${expenseCategory}%`)
      .maybeSingle();

    if (!existing) {
      const title = `${expenseCategory} budget at ${Math.round(percentage)}%`;
      const body = `You're approaching your ${expenseCategory} budget limit. ${Math.round(Number(budget.monthly_limit) - totalSpent)} remaining this month.`;

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "budget_warning",
        title,
        body,
        data: {
          category: expenseCategory,
          spent: totalSpent,
          limit: Number(budget.monthly_limit),
          percentage,
          month: monthKey,
        },
      });

      if (isPushConfigured()) {
        sendPushToUser(supabase, userId, {
          title,
          body,
          tag: `budget-warning-${expenseCategory}-${monthKey}`,
        }).catch((err) => console.error("Push delivery failed:", err));
      }

      alerts.push({
        category: expenseCategory,
        type: "budget_warning",
        percentage,
        spent: totalSpent,
        limit: Number(budget.monthly_limit),
      });
    }
  }

  return { alerts };
}
