import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReceiptsClient } from "./receipts-client";
import type { Expense } from "@/lib/types";

export const metadata = {
  title: "Receipts",
  description: "Upload and scan receipts with AI to automatically extract expense data.",
};

export default async function ReceiptsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: receipts } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user.id)
    .not("receipt_url", "is", null)
    .order("date", { ascending: false });

  return <ReceiptsClient initialReceipts={(receipts as Expense[]) ?? []} />;
}
