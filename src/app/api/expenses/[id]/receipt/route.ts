import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 });
    }

    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .update({ receipt_url: null })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (expenseError || !expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    await supabase
      .from("receipts")
      .update({ expense_id: null })
      .eq("user_id", user.id)
      .eq("expense_id", id);

    return NextResponse.json({ expense });
  } catch (error) {
    console.error("DELETE /api/expenses/[id]/receipt error:", error);
    return NextResponse.json({ error: "Failed to remove receipt reference" }, { status: 500 });
  }
}
