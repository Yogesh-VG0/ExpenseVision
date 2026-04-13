import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { expenseSchema } from "@/lib/validations";

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
    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { data: expense, error } = await supabase
      .from("expenses")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
