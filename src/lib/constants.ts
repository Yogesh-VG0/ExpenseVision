import { getAppUrl } from "@/lib/app-url";

export const APP_NAME = "ExpenseVision";
export const APP_DESCRIPTION = "AI-powered expense tracking with smart receipt scanning, budget management, and financial insights.";
export const APP_URL = getAppUrl();

export const MAX_EXPENSE_AMOUNT = 9_999_999.99;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_USERNAME_LENGTH = 30;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];

export const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function createCurrencyFormatter(currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  });
}

export const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export const CATEGORY_COLORS: Record<string, string> = {
  "Food & Dining": "#F59E0B",
  "Transportation": "#3B82F6",
  "Shopping": "#EC4899",
  "Entertainment": "#8B5CF6",
  "Bills & Utilities": "#EF4444",
  "Healthcare": "#10B981",
  "Education": "#6366F1",
  "Travel": "#06B6D4",
  "Groceries": "#84CC16",
  "Other": "#64748B",
};
