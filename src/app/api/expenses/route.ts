import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { expenseSchema } from "@/lib/validations";
import { isReceiptStoragePath } from "@/lib/receipts";
import { checkBudgetAlerts } from "@/lib/budget-alerts";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const category = searchParams.get("category");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort");

    let query = supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id);

    if (category) {
      query = query.eq("category", category);
    }
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }
    if (search) {
      // Strip PostgREST filter operators to prevent filter injection
      const sanitized = search.replace(/[(),."\\]/g, "").slice(0, 200);
      if (sanitized) {
        query = query.or(`vendor.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
      }
    }

    switch (sort) {
      case "date_asc":
        query = query.order("date", { ascending: true });
        break;
      case "amount_asc":
        query = query.order("amount", { ascending: true });
        break;
      case "amount_desc":
        query = query.order("amount", { ascending: false });
        break;
      default:
        query = query.order("date", { ascending: false });
        break;
    }

    const { data: expenses, error } = await query;
    if (error) throw error;

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const idempotencyKey: string | null =
      typeof body?.idempotency_key === "string" && body.idempotency_key.length > 0
        ? body.idempotency_key
        : null;

    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Idempotency guard — return existing expense if this key was already used
    if (idempotencyKey) {
      const { data: existingByKey } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingByKey) {
        return NextResponse.json({ expense: existingByKey }, { status: 200 });
      }
    }

    if (isReceiptStoragePath(parsed.data.receipt_url)) {
      const { data: existingReceipt, error: receiptLookupError } = await supabase
        .from("receipts")
        .select("id, expense_id")
        .eq("user_id", user.id)
        .eq("file_url", parsed.data.receipt_url)
        .maybeSingle();

      if (receiptLookupError) {
        throw receiptLookupError;
      }

      if (existingReceipt?.expense_id) {
        return NextResponse.json(
          { error: "This receipt is already linked to an existing expense." },
          { status: 409 }
        );
      }
    }

    const insertPayload: Record<string, unknown> = { ...parsed.data, user_id: user.id };
    if (idempotencyKey) {
      insertPayload.idempotency_key = idempotencyKey;
    }

    const { data: expense, error } = await supabase
      .from("expenses")
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;

    if (isReceiptStoragePath(expense.receipt_url)) {
      const { data: linkedRows } = await supabase
        .from("receipts")
        .update({ expense_id: expense.id })
        .eq("user_id", user.id)
        .eq("file_url", expense.receipt_url)
        .is("expense_id", null)
        .select("id");

      if (!linkedRows || linkedRows.length === 0) {
        await supabase.from("receipts").insert({
          user_id: user.id,
          expense_id: expense.id,
          file_url: expense.receipt_url,
        });
      }
    }

    // Fire-and-forget budget alert check
    checkBudgetAlerts(supabase, user.id, expense.category).catch((err) =>
      console.error("Budget alert check failed:", err)
    );

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
