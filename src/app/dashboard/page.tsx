import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

export const metadata = {
  title: "Dashboard",
  description: "View your financial overview, spending trends, budget progress, and recent activity.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch expenses for current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user!.id)
    .gte("date", startOfMonth)
    .order("date", { ascending: false });

  const { data: budgets } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", user!.id);

  // Fetch last 6 months for trends
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    .toISOString()
    .split("T")[0];

  const { data: allExpenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user!.id)
    .gte("date", sixMonthsAgo)
    .order("date", { ascending: false });

  return (
    <DashboardClient
      expenses={expenses || []}
      budgets={budgets || []}
      allExpenses={allExpenses || []}
    />
  );
}
