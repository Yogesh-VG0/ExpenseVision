import { createClient } from "@/lib/supabase/server";
import { isReceiptStoragePath } from "@/lib/receipts";
import type { Expense } from "@/lib/types";
import { expenseSchema } from "@/lib/validations";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export class ExpenseMutationError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "ExpenseMutationError";
    this.status = status;
    this.details = details;
  }
}

function getIdempotencyKey(body: unknown) {
  return typeof body === "object" && body !== null && typeof (body as { idempotency_key?: unknown }).idempotency_key === "string"
    ? (body as { idempotency_key: string }).idempotency_key.trim() || null
    : null;
}

export async function createExpenseRecord(
  supabase: ServerSupabaseClient,
  userId: string,
  body: unknown
): Promise<{ expense: Expense; status: 200 | 201; idempotent: boolean }> {
  const idempotencyKey = getIdempotencyKey(body);
  const parsed = expenseSchema.safeParse(body);

  if (!parsed.success) {
    throw new ExpenseMutationError(
      "Validation failed",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  if (idempotencyKey) {
    const { data: existingByKey, error: existingByKeyError } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingByKeyError) {
      throw existingByKeyError;
    }

    if (existingByKey) {
      return { expense: existingByKey as Expense, status: 200, idempotent: true };
    }
  }

  if (isReceiptStoragePath(parsed.data.receipt_url)) {
    const { data: existingReceipt, error: receiptLookupError } = await supabase
      .from("receipts")
      .select("id, expense_id")
      .eq("user_id", userId)
      .eq("file_url", parsed.data.receipt_url)
      .maybeSingle();

    if (receiptLookupError) {
      throw receiptLookupError;
    }

    if (existingReceipt?.expense_id) {
      throw new ExpenseMutationError(
        "This receipt is already linked to an existing expense.",
        409
      );
    }
  }

  const insertPayload: Record<string, unknown> = { ...parsed.data, user_id: userId };
  if (idempotencyKey) {
    insertPayload.idempotency_key = idempotencyKey;
  }

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    if (idempotencyKey) {
      const { data: existingByKey } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", userId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingByKey) {
        return { expense: existingByKey as Expense, status: 200, idempotent: true };
      }
    }

    throw error;
  }

  if (isReceiptStoragePath(expense.receipt_url)) {
    const { data: linkedRows } = await supabase
      .from("receipts")
      .update({ expense_id: expense.id })
      .eq("user_id", userId)
      .eq("file_url", expense.receipt_url)
      .is("expense_id", null)
      .select("id");

    if (!linkedRows || linkedRows.length === 0) {
      await supabase.from("receipts").insert({
        user_id: userId,
        expense_id: expense.id,
        file_url: expense.receipt_url,
      });
    }
  }

  return { expense: expense as Expense, status: 201, idempotent: false };
}