import type { Expense, ReceiptAccessState, ReceiptHistoryItem } from "@/lib/types";

export const RECEIPT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export const RECEIPT_MAX_FILE_BYTES = 10 * 1024 * 1024;

export function buildReceiptHistoryItem(
  expense: Expense,
  options?: {
    signedUrl?: string | null;
    accessState?: ReceiptAccessState;
  }
): ReceiptHistoryItem {
  const storagePath = isReceiptStoragePath(expense.receipt_url)
    ? expense.receipt_url
    : null;
  const accessUrl = options?.signedUrl ?? (storagePath ? null : expense.receipt_url);

  return {
    ...expense,
    receipt_url: accessUrl,
    receipt_storage_path: storagePath,
    receipt_access_url: accessUrl,
    receipt_access_state: options?.accessState ?? (storagePath ? "available" : "unavailable"),
  };
}

export function isReceiptStoragePath(value: string | null | undefined): boolean {
  return Boolean(value) && !String(value).startsWith("http");
}

export function validateReceiptFile(file: File) {
  if (!RECEIPT_ALLOWED_TYPES.includes(file.type as (typeof RECEIPT_ALLOWED_TYPES)[number])) {
    return "Unsupported file type";
  }

  if (file.size > RECEIPT_MAX_FILE_BYTES) {
    return "File must be under 10 MB";
  }

  return null;
}

export function buildReceiptStoragePath(userId: string, fileName: string) {
  const rawExt = fileName.split(".").pop() || "jpg";
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "jpg";
  return `${userId}/${Date.now()}.${ext}`;
}

export function inferReceiptMimeType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "pdf":
      return "application/pdf";
    default:
      return "image/jpeg";
  }
}
