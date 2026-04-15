import { NextResponse } from "next/server";
import { accountMutationRateLimit } from "@/lib/redis";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isReceiptStoragePath } from "@/lib/receipts";

export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit(
      accountMutationRateLimit,
      user.id,
      "Too many account deletion attempts. Please contact support or try again later."
    );

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const userId = user.id;
    const admin = createAdminClient();

    if (!admin) {
      return NextResponse.json(
        { error: "Account deletion is not configured. Set SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 }
      );
    }

    const [{ data: receiptRows, error: receiptsError }, { data: expenses, error: expensesError }] = await Promise.all([
      supabase.from("receipts").select("file_url").eq("user_id", userId),
      supabase.from("expenses").select("receipt_url").eq("user_id", userId).not("receipt_url", "is", null),
    ]);

    if (receiptsError || expensesError) {
      throw receiptsError ?? expensesError;
    }

    const storagePaths = Array.from(
      new Set(
        [...(receiptRows ?? []).map((row) => row.file_url), ...(expenses ?? []).map((expense) => expense.receipt_url)]
          .filter(isReceiptStoragePath)
      )
    );

    if (storagePaths.length > 0) {
      const { error: removeStorageError } = await admin.storage
        .from("receipts")
        .remove(storagePaths);

      if (removeStorageError) {
        throw removeStorageError;
      }
    }

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      throw deleteAuthError;
    }

    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/account error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
