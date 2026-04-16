import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InsightsClient } from "./insights-client";
import type { Expense } from "@/lib/types";

export const metadata = {
  title: "AI Insights",
  description: "Get AI-powered spending analysis, savings recommendations, and financial insights.",
};

export default async function InsightsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Current month boundaries
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const [{ data: currentMonthExpenses }, { data: savedInsights }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", startOfMonth)
        .lte("date", endOfMonth)
        .order("date", { ascending: false }),
      supabase
        .from("ai_insights")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  const validTypes = [
    "spending_summary",
    "savings_tip",
    "budget_alert",
    "trend_analysis",
  ] as const;

  type InsightType = (typeof validTypes)[number];

  const initialInsights = (savedInsights ?? [])
    .filter((row: { insight_type: string }) =>
      validTypes.includes(row.insight_type as InsightType)
    )
    .map(
      (row: {
        insight_type: string;
        content: string;
        data: Record<string, unknown> | null;
        created_at: string;
      }) => ({
        type: row.insight_type as InsightType,
        title: (row.data?.title as string) ?? row.insight_type.replace(/_/g, " "),
        content: row.data?.title
          ? row.content.replace(`${row.data.title}: `, "")
          : row.content,
        created_at: row.created_at,
      })
    );

  return (
    <InsightsClient
      currentMonthExpenses={(currentMonthExpenses as Expense[]) ?? []}
      initialInsights={initialInsights}
    />
  );
}
