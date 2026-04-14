import { describe, it, expect } from "vitest";
import { expenseSchema, budgetSchema } from "@/lib/validations";

describe("expenseSchema", () => {
  const validExpense = {
    amount: 42.5,
    category: "Food & Dining",
    description: "Lunch at cafe",
    vendor: "Coffee House",
    date: "2024-06-15",
    is_recurring: false,
  };

  it("accepts a valid expense", () => {
    const result = expenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
  });

  it("rejects negative amount", () => {
    const result = expenseSchema.safeParse({ ...validExpense, amount: -10 });
    expect(result.success).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = expenseSchema.safeParse({ ...validExpense, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", () => {
    const result = expenseSchema.safeParse({ ...validExpense, category: "InvalidCat" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const result = expenseSchema.safeParse({ ...validExpense, date: "15/06/2024" });
    expect(result.success).toBe(false);
  });

  it("strips HTML from description", () => {
    const result = expenseSchema.safeParse({
      ...validExpense,
      description: "<script>alert('xss')</script>Lunch",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("alert('xss')Lunch");
    }
  });

  it("accepts receipt_url as optional", () => {
    const result = expenseSchema.safeParse({
      ...validExpense,
      receipt_url: "user123/1234567890.jpg",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.receipt_url).toBe("user123/1234567890.jpg");
    }
  });

  it("accepts expense without receipt_url", () => {
    const result = expenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.receipt_url).toBeUndefined();
    }
  });

  it("defaults tags to empty array", () => {
    const result = expenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });

  it("defaults is_recurring to false", () => {
    const withoutRecurring = { ...validExpense } as Partial<typeof validExpense>;
    delete withoutRecurring.is_recurring;
    const result = expenseSchema.safeParse(withoutRecurring);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_recurring).toBe(false);
    }
  });
});

describe("budgetSchema", () => {
  it("accepts a valid budget", () => {
    const result = budgetSchema.safeParse({
      category: "Shopping",
      monthly_limit: 500,
    });
    expect(result.success).toBe(true);
  });

  it("rejects zero monthly_limit", () => {
    const result = budgetSchema.safeParse({
      category: "Shopping",
      monthly_limit: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", () => {
    const result = budgetSchema.safeParse({
      category: "Crypto",
      monthly_limit: 100,
    });
    expect(result.success).toBe(false);
  });
});
