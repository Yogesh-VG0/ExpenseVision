import { z } from "zod";
import { MAX_EXPENSE_AMOUNT } from "./constants";

const VALID_CATEGORIES = [
  "Food & Dining", "Transportation", "Shopping", "Entertainment",
  "Bills & Utilities", "Healthcare", "Education", "Travel", "Groceries", "Other",
] as const;

export const expenseSchema = z.object({
  amount: z.number().positive("Amount must be positive").max(MAX_EXPENSE_AMOUNT, "Amount too large"),
  category: z.enum(VALID_CATEGORIES),
  description: z.string().max(500, "Description too long").transform(s => s.replace(/<[^>]+>/g, "").trim()),
  vendor: z.string().max(200, "Vendor name too long").optional().transform(s => s?.replace(/<[^>]+>/g, "").trim()),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
  is_recurring: z.boolean().optional().default(false),
  receipt_url: z.string().max(1000).optional().nullable(),
});

export const budgetSchema = z.object({
  category: z.enum(VALID_CATEGORIES),
  monthly_limit: z.number().positive("Budget must be positive").max(MAX_EXPENSE_AMOUNT, "Budget too large"),
});

export const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  full_name: z.string().min(1, "Name is required").max(100),
});

export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;
export type BudgetFormData = z.infer<typeof budgetSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignInFormData = z.infer<typeof signInSchema>;
