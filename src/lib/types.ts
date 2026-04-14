export type Category = 
  | "Food & Dining"
  | "Transportation"
  | "Shopping"
  | "Entertainment"
  | "Bills & Utilities"
  | "Healthcare"
  | "Education"
  | "Travel"
  | "Groceries"
  | "Other";

export const CATEGORIES: { name: Category; icon: string; color: string }[] = [
  { name: "Food & Dining", icon: "UtensilsCrossed", color: "#F59E0B" },
  { name: "Transportation", icon: "Car", color: "#3B82F6" },
  { name: "Shopping", icon: "ShoppingCart", color: "#EC4899" },
  { name: "Entertainment", icon: "Film", color: "#8B5CF6" },
  { name: "Bills & Utilities", icon: "Receipt", color: "#EF4444" },
  { name: "Healthcare", icon: "Heart", color: "#10B981" },
  { name: "Education", icon: "GraduationCap", color: "#6366F1" },
  { name: "Travel", icon: "Plane", color: "#06B6D4" },
  { name: "Groceries", icon: "Apple", color: "#84CC16" },
  { name: "Other", icon: "Package", color: "#64748B" },
];

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category: Category;
  description: string;
  vendor: string | null;
  date: string;
  tags: string[];
  is_recurring: boolean;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category: Category;
  monthly_limit: number;
  spent: number;
  created_at: string;
}

export interface AIInsight {
  id: string;
  user_id: string;
  insight_type: "spending_summary" | "savings_tip" | "budget_alert" | "trend_analysis";
  content: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  currency: string;
  created_at: string;
}

export interface AnalyticsData {
  by_category: { category: string; total: number; count: number }[];
  by_month: { month: string; total: number }[];
  by_day: { date: string; total: number }[];
  stats: { total: number; count: number; average: number };
  budget_status: { category: string; spent: number; limit: number; percentage: number }[];
  top_merchants: { vendor: string; total: number; count: number }[];
}

export interface OCRResult {
  amount: number | null;
  vendor: string | null;
  date: string | null;
  category: Category | null;
  description: string | null;
  line_items: { description: string; amount: number }[];
  confidence: number;
  raw_text: string;
  receipt_path: string | null;
}

export type ReceiptAccessState = "available" | "missing" | "unavailable";

export type ReceiptProcessingStatus = "success" | "partial" | "error";

export type ReceiptLifecycleStatus = "succeeded" | "failed" | "skipped";

export type ReceiptRecoveryAction =
  | "retry_ocr"
  | "retry_upload"
  | "save_manually"
  | "remove_broken_receipt_reference";

export interface ReceiptProcessingResult extends OCRResult {
  status: ReceiptProcessingStatus;
  upload_status: ReceiptLifecycleStatus;
  ocr_status: ReceiptLifecycleStatus;
  warning: string | null;
  error: string | null;
  recovery_actions: ReceiptRecoveryAction[];
}

export interface ReceiptHistoryItem extends Expense {
  receipt_storage_path: string | null;
  receipt_access_url: string | null;
  receipt_access_state: ReceiptAccessState;
}
