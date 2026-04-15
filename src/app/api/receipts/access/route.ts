import { NextRequest, NextResponse } from "next/server";
import { apiRateLimit } from "@/lib/redis";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isReceiptStoragePath } from "@/lib/receipts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      apiRateLimit,
      user.id,
      "Too many receipt access refreshes. Please wait a moment and try again."
    );

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const expenseId = typeof body?.expenseId === "string" ? body.expenseId : "";
    const receiptPath = typeof body?.receiptPath === "string" ? body.receiptPath : "";

    if (receiptPath) {
      if (!isReceiptStoragePath(receiptPath)) {
        return NextResponse.json({ error: "Invalid receipt path" }, { status: 400 });
      }

      const { data: receipt, error: receiptError } = await supabase
        .from("receipts")
        .select("id")
        .eq("user_id", user.id)
        .eq("file_url", receiptPath)
        .maybeSingle();

      if (receiptError || !receipt) {
        return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
      }

      const { data, error: signError } = await supabase.storage
        .from("receipts")
        .createSignedUrl(receiptPath, 3600);

      if (signError || !data?.signedUrl) {
        return NextResponse.json({
          access_url: null,
          access_state: "missing",
          receipt_storage_path: receiptPath,
        });
      }

      return NextResponse.json({
        access_url: data.signedUrl,
        access_state: "available",
        receipt_storage_path: receiptPath,
      });
    }

    if (!UUID_RE.test(expenseId)) {
      return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 });
    }

    const { data: expense, error } = await supabase
      .from("expenses")
      .select("id, receipt_url")
      .eq("id", expenseId)
      .eq("user_id", user.id)
      .single();

    if (error || !expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (!expense.receipt_url) {
      return NextResponse.json({ access_url: null, access_state: "unavailable" });
    }

    if (!isReceiptStoragePath(expense.receipt_url)) {
      return NextResponse.json({
        access_url: expense.receipt_url,
        access_state: "available",
      });
    }

    const { data, error: signError } = await supabase.storage
      .from("receipts")
      .createSignedUrl(expense.receipt_url, 3600);

    if (signError || !data?.signedUrl) {
      return NextResponse.json({
        access_url: null,
        access_state: "missing",
        receipt_storage_path: expense.receipt_url,
      });
    }

    return NextResponse.json({
      access_url: data.signedUrl,
      access_state: "available",
      receipt_storage_path: expense.receipt_url,
    });
  } catch (error) {
    console.error("POST /api/receipts/access error:", error);
    return NextResponse.json({ error: "Failed to refresh receipt access" }, { status: 500 });
  }
}
