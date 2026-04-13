import { createClient } from "@/lib/supabase/server";
import { BudgetsClient } from "./budgets-client";

export const metadata = {
  title: "Budgets",
  description: "Set and monitor category budgets to keep your spending on track.",
};

export default async function BudgetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: budgets } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  // Get current month's expenses to calculate spent per category
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount, category")
    .eq("user_id", user!.id)
    .gte("date", startOfMonth)
    .lte("date", endOfMonth);

  // Aggregate spent per category
  const spendingByCategory: Record<string, number> = {};
  for (const expense of expenses || []) {
    spendingByCategory[expense.category] =
      (spendingByCategory[expense.category] || 0) + expense.amount;
  }

  return (
    <BudgetsClient
      initialBudgets={budgets || []}
      spendingByCategory={spendingByCategory}
    />
  );
}
