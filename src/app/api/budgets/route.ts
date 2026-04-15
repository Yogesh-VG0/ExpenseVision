import { NextRequest, NextResponse } from "next/server";
import { budgetMutationRateLimit } from "@/lib/redis";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { budgetSchema } from "@/lib/validations";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: budgets, error } = await supabase
      .from("budgets")
      .select("*")
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ budgets });
  } catch (error) {
    console.error("GET /api/budgets error:", error);
    return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit(
      budgetMutationRateLimit,
      user.id,
      "Too many budget changes. Please wait a moment and try again."
    );

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const parsed = budgetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Check for existing budget in this category
    const { data: existing } = await supabase
      .from("budgets")
      .select("id")
      .eq("user_id", user.id)
      .eq("category", parsed.data.category)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `Budget for "${parsed.data.category}" already exists` },
        { status: 409 }
      );
    }

    const { data: budget, error } = await supabase
      .from("budgets")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ budget }, { status: 201 });
  } catch (error) {
    console.error("POST /api/budgets error:", error);
    return NextResponse.json({ error: "Failed to create budget" }, { status: 500 });
  }
}
