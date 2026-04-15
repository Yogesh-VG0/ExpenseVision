import { describe, expect, it } from "vitest";
import {
  buildReceiptHistoryItem,
  inferReceiptMimeType,
  isReceiptStoragePath,
  validateReceiptFile,
  validateReceiptFileBytes,
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

  it("rejects unsupported receipt files by MIME type", () => {
    const file = new File(["hello"], "receipt.txt", { type: "text/plain" });
    const result = validateReceiptFile(file);
    expect(result).toContain("Unsupported file type");
  });

  it("rejects files with unsupported extensions", () => {
    const file = new File(["hello"], "receipt.bmp", { type: "image/png" });
    const result = validateReceiptFile(file);
    expect(result).toContain("Unsupported file extension");
  });

  it("infers MIME types from file names", () => {
    expect(inferReceiptMimeType("sample.pdf")).toBe("application/pdf");
    expect(inferReceiptMimeType("sample.webp")).toBe("image/webp");
    expect(inferReceiptMimeType("sample.unknown")).toBe("image/jpeg");
  });

  it("validates magic bytes for JPEG files", () => {
    const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x00, 0x00, 0x00]);
    expect(validateReceiptFileBytes(jpegHeader.buffer, "image/jpeg")).toBeNull();
  });

  it("validates magic bytes for PNG files", () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    expect(validateReceiptFileBytes(pngHeader.buffer, "image/png")).toBeNull();
  });

  it("validates magic bytes for PDF files", () => {
    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
    expect(validateReceiptFileBytes(pdfHeader.buffer, "application/pdf")).toBeNull();
  });

  it("rejects mismatched magic bytes", () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const result = validateReceiptFileBytes(pngHeader.buffer, "image/jpeg");
    expect(result).toContain("does not match");
  });

  it("rejects files with unrecognized magic bytes", () => {
    const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    const result = validateReceiptFileBytes(garbage.buffer, "image/jpeg");
    expect(result).toContain("does not match any supported");
  });

  it("rejects files that are too small", () => {
    const tiny = new Uint8Array([0x00, 0x01]);
    const result = validateReceiptFileBytes(tiny.buffer, "image/jpeg");
    expect(result).toContain("too small");
  });
});
