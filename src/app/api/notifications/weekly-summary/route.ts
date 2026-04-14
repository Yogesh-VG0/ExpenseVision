import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST — generate a weekly spending summary notification.
 * Designed to be triggered by a cron job or external scheduler.
 * In this first version, it creates an in-app notification row.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Last 7 days of expenses
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDate = weekAgo.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];

    const { data: expenses } = await supabase
      .from("expenses")
      .select("amount, category")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate);

    const total = (expenses ?? []).reduce(
      (sum, e) => sum + Number(e.amount),
      0
    );
    const count = expenses?.length ?? 0;

    // Category breakdown
    const byCategory: Record<string, number> = {};
    for (const e of expenses ?? []) {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
    }

    const topCategory = Object.entries(byCategory).sort(
      (a, b) => b[1] - a[1]
    )[0];

    const body =
      count === 0
        ? "No expenses recorded this week. Great job keeping track!"
        : `You spent a total of ${total.toFixed(2)} across ${count} expense${count === 1 ? "" : "s"} this week.${topCategory ? ` Top category: ${topCategory[0]} (${topCategory[1].toFixed(2)}).` : ""}`;

    const { error } = await supabase.from("notifications").insert({
      user_id: user.id,
      type: "weekly_summary",
      title: "Your weekly spending summary",
      body,
      data: { total, count, byCategory, startDate, endDate },
    });

    if (error) throw error;

    return NextResponse.json({ success: true, total, count });
  } catch (error) {
    console.error("POST /api/notifications/weekly-summary error:", error);
    return NextResponse.json(
      { error: "Failed to generate weekly summary" },
      { status: 500 }
    );
  }
}
