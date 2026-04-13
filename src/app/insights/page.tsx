import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InsightsClient } from "./insights-client";
import type { Expense, Budget } from "@/lib/types";

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

  // 6 months ago
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    .toISOString()
    .split("T")[0];

  const [
    { data: currentMonthExpenses },
    { data: budgets },
    { data: recentExpenses },
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth)
      .order("date", { ascending: false }),
    supabase.from("budgets").select("*").eq("user_id", user.id),
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", sixMonthsAgo)
      .order("date", { ascending: false }),
  ]);

  return (
    <InsightsClient
      currentMonthExpenses={(currentMonthExpenses as Expense[]) ?? []}
      budgets={(budgets as Budget[]) ?? []}
      recentExpenses={(recentExpenses as Expense[]) ?? []}
    />
  );
}
