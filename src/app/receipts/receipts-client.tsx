"use client";

import { ReceiptWorkspace } from "@/components/receipts/receipt-workspace";
import type { ReceiptHistoryItem } from "@/lib/types";

interface ReceiptsClientProps {
  initialReceipts: ReceiptHistoryItem[];
}

export function ReceiptsClient({ initialReceipts }: ReceiptsClientProps) {
  return <ReceiptWorkspace initialReceipts={initialReceipts} />;
}
