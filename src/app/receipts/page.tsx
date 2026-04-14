import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReceiptsClient } from "./receipts-client";
import { buildReceiptHistoryItem, isReceiptStoragePath } from "@/lib/receipts";
import type { Expense, ReceiptHistoryItem } from "@/lib/types";

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

  const receiptsWithUrls = await Promise.all(
    ((receipts as Expense[]) ?? []).map(async (expense) => {
      if (!expense.receipt_url) {
        return buildReceiptHistoryItem(expense, {
          accessState: "unavailable",
        });
      }

      if (!isReceiptStoragePath(expense.receipt_url)) {
        return buildReceiptHistoryItem(expense, {
          signedUrl: expense.receipt_url,
          accessState: "available",
        });
      }

      const { data, error } = await supabase.storage
        .from("receipts")
        .createSignedUrl(expense.receipt_url, 3600);

      return buildReceiptHistoryItem(expense, {
        signedUrl: data?.signedUrl ?? null,
        accessState: error || !data?.signedUrl ? "missing" : "available",
      });
    })
  );

  return <ReceiptsClient initialReceipts={receiptsWithUrls as ReceiptHistoryItem[]} />;
}
