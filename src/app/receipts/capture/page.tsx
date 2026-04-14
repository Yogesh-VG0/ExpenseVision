import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ReceiptWorkspace } from "@/components/receipts/receipt-workspace";
import { parseReceiptShareDraft, RECEIPT_SHARE_COOKIE_NAME } from "@/lib/receipt-share";

export const metadata: Metadata = {
  title: "Capture Receipt",
  description: "Use the mobile-first receipt capture flow to take a photo or resume a shared receipt, review OCR results, and save an expense.",
};

export default async function ReceiptCapturePage() {
  const cookieStore = await cookies();
  const initialShareDraft = parseReceiptShareDraft(
    cookieStore.get(RECEIPT_SHARE_COOKIE_NAME)?.value
  );

  return <ReceiptWorkspace initialReceipts={[]} mode="capture" initialShareDraft={initialShareDraft} />;
}
