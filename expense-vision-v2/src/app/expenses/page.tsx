import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExpensesClient } from "./expenses-client";
import type { Expense } from "@/lib/types";

export const metadata = {
  title: "Expenses",
  description: "Track, filter, and manage all your expenses in one place.",
};

export default async function ExpensesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  return <ExpensesClient initialExpenses={(expenses as Expense[]) ?? []} />;
}
