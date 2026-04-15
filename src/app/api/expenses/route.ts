import { NextRequest, NextResponse } from "next/server";
import { checkBudgetAlerts } from "@/lib/budget-alerts";
import {
  createExpenseRecord,
  ExpenseMutationError,
} from "@/lib/expense-mutations";
import { expenseMutationRateLimit } from "@/lib/redis";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

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
    const rateLimitResponse = await enforceRateLimit(
      expenseMutationRateLimit,
      user.id,
      "Too many expense changes. Please wait a moment and try again."
    );

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { expense, status } = await createExpenseRecord(supabase, user.id, body);

    // Fire-and-forget budget alert check
    checkBudgetAlerts(supabase, user.id, expense.category).catch((err) =>
      console.error("Budget alert check failed:", err)
    );

    return NextResponse.json({ expense }, { status });
  } catch (error) {
    if (error instanceof ExpenseMutationError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.status }
      );
    }

    console.error("POST /api/expenses error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
