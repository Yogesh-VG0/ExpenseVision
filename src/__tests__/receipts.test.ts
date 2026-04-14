import { describe, expect, it } from "vitest";
import {
  buildReceiptHistoryItem,
  inferReceiptMimeType,
  isReceiptStoragePath,
  validateReceiptFile,
} from "@/lib/receipts";
import type { Expense } from "@/lib/types";

const baseExpense: Expense = {
  id: "expense-1",
  user_id: "user-1",
  amount: 24.5,
  category: "Food & Dining",
  description: "Lunch",
  vendor: "Cafe",
  date: "2026-04-14",
  tags: [],
  is_recurring: false,
  receipt_url: "user-1/receipt.jpg",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("receipt helpers", () => {
  it("treats non-http receipt values as storage paths", () => {
    expect(isReceiptStoragePath("user-1/receipt.jpg")).toBe(true);
    expect(isReceiptStoragePath("https://example.com/receipt.jpg")).toBe(false);
    expect(isReceiptStoragePath(null)).toBe(false);
  });

  it("builds history items without exposing raw storage paths as access URLs", () => {
    const item = buildReceiptHistoryItem(baseExpense, { accessState: "missing" });

    expect(item.receipt_storage_path).toBe("user-1/receipt.jpg");
    expect(item.receipt_access_url).toBeNull();
    expect(item.receipt_url).toBeNull();
    expect(item.receipt_access_state).toBe("missing");
  });

  it("keeps direct receipt URLs available when already public", () => {
    const expense = {
      ...baseExpense,
      receipt_url: "https://cdn.example.com/receipt.jpg",
    };
    const item = buildReceiptHistoryItem(expense, { accessState: "available" });

    expect(item.receipt_storage_path).toBeNull();
    expect(item.receipt_access_url).toBe("https://cdn.example.com/receipt.jpg");
    expect(item.receipt_access_state).toBe("available");
  });

  it("validates supported receipt files", () => {
    const file = new File(["hello"], "receipt.png", { type: "image/png" });
    expect(validateReceiptFile(file)).toBeNull();
  });

  it("rejects unsupported receipt files", () => {
    const file = new File(["hello"], "receipt.txt", { type: "text/plain" });
    expect(validateReceiptFile(file)).toBe("Unsupported file type");
  });

  it("infers MIME types from file names", () => {
    expect(inferReceiptMimeType("sample.pdf")).toBe("application/pdf");
    expect(inferReceiptMimeType("sample.webp")).toBe("image/webp");
    expect(inferReceiptMimeType("sample.unknown")).toBe("image/jpeg");
  });
});
