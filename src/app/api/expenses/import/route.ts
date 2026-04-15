import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkBudgetAlerts } from "@/lib/budget-alerts";
import { suggestCategory } from "@/lib/category-suggest";
import { detectDuplicate } from "@/lib/duplicate-detection";
import {
  createExpenseRecord,
  ExpenseMutationError,
} from "@/lib/expense-mutations";
import { importBatchRateLimit } from "@/lib/redis";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

const CHUNK_MAX_ROWS = 50;
const VALID_CATEGORIES = new Set<Category>([
  "Food & Dining",
  "Transportation",
  "Shopping",
  "Entertainment",
  "Bills & Utilities",
  "Healthcare",
  "Education",
  "Travel",
  "Groceries",
  "Other",
]);

const importRowSchema = z.object({
  source_row: z.number().int().positive().optional(),
  amount: z.number().positive(),
  vendor: z.string().max(200).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  description: z.string().max(500).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  idempotency_key: z.string().min(1).max(200),
});

const importRequestSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(CHUNK_MAX_ROWS),
});

function addDays(date: string, amount: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

function resolveCategory(row: z.infer<typeof importRowSchema>): Category {
  const trimmedCategory = row.category?.trim() ?? "";

  if (VALID_CATEGORIES.has(trimmedCategory as Category) && trimmedCategory !== "Other") {
    return trimmedCategory as Category;
  }

  return suggestCategory(row.vendor?.trim() ?? "", row.description.trim()).category;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit(
      importBatchRateLimit,
      user.id,
      "Too many import batches. Please wait a moment and try again."
    );

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const parsedBody = importRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsedBody.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const rows = parsedBody.data.rows;
    const dates = rows.map((row) => row.date).sort();
    const startDate = addDays(dates[0], -3);
    const endDate = addDays(dates[dates.length - 1], 3);

    const { data: recentExpenses, error: recentExpensesError } = await supabase
      .from("expenses")
      .select("id, vendor, amount, date")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false })
      .limit(500);

    if (recentExpensesError) {
      throw recentExpensesError;
    }

    const knownExpenses = [...(recentExpenses ?? [])];
    const categoriesTouched = new Set<Category>();
    const result = {
      total: rows.length,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    for (const row of rows) {
      const sourceRow = row.source_row ?? 0;
      const category = resolveCategory(row);
      const normalizedVendor = row.vendor?.trim() || undefined;
      const normalizedDescription = row.description.trim();

      const duplicateMatch = detectDuplicate(
        {
          vendor: normalizedVendor || normalizedDescription || "Imported expense",
          amount: row.amount,
          date: row.date,
        },
        knownExpenses
      );

      if (duplicateMatch.isDuplicate) {
        result.failed += 1;
        result.errors.push({
          row: sourceRow,
          error: "Possible duplicate of an existing expense. Review and import it manually if needed.",
        });
        continue;
      }

      try {
        const { expense } = await createExpenseRecord(supabase, user.id, {
          amount: row.amount,
          vendor: normalizedVendor,
          category,
          description: normalizedDescription,
          date: row.date,
          is_recurring: false,
          idempotency_key: row.idempotency_key,
        });

        result.succeeded += 1;
        categoriesTouched.add(expense.category);
        knownExpenses.unshift({
          id: expense.id,
          vendor: expense.vendor,
          amount: expense.amount,
          date: expense.date,
        });
      } catch (error) {
        result.failed += 1;

        if (error instanceof ExpenseMutationError) {
          result.errors.push({ row: sourceRow, error: error.message });
          continue;
        }

        result.errors.push({
          row: sourceRow,
          error: error instanceof Error ? error.message : "Failed to import row",
        });
      }
    }

    await Promise.allSettled(
      Array.from(categoriesTouched).map((category) =>
        checkBudgetAlerts(supabase, user.id, category)
      )
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/expenses/import error:", error);
    return NextResponse.json(
      { error: "Failed to import expenses" },
      { status: 500 }
    );
  }
}