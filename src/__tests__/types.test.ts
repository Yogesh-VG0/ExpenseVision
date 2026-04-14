import { describe, it, expect } from "vitest";
import { CATEGORIES } from "@/lib/types";
import type { OCRResult, Expense } from "@/lib/types";

describe("CATEGORIES", () => {
  it("has 10 categories", () => {
    expect(CATEGORIES).toHaveLength(10);
  });

  it("each category has name, icon, and color", () => {
    for (const cat of CATEGORIES) {
      expect(cat.name).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("includes expected categories", () => {
    const names = CATEGORIES.map((c) => c.name);
    expect(names).toContain("Food & Dining");
    expect(names).toContain("Transportation");
    expect(names).toContain("Other");
  });
});

describe("OCRResult type", () => {
  it("can construct a valid OCRResult", () => {
    const result: OCRResult = {
      amount: 25.99,
      vendor: "Store",
      date: "2024-01-15",
      category: "Shopping",
      description: "Clothes",
      line_items: [{ description: "Shirt", amount: 25.99 }],
      confidence: 0.9,
      raw_text: "Receipt text",
      receipt_path: "user/123.jpg",
    };
    expect(result.receipt_path).toBe("user/123.jpg");
    expect(result.line_items).toHaveLength(1);
  });
});

describe("Expense type", () => {
  it("receipt_url is nullable", () => {
    const expense: Expense = {
      id: "test-id",
      user_id: "user-id",
      amount: 10,
      category: "Other",
      description: "Test",
      vendor: null,
      date: "2024-01-01",
      tags: [],
      is_recurring: false,
      receipt_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(expense.receipt_url).toBeNull();
  });
});
