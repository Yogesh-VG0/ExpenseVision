import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser, isPushConfigured } from "@/lib/push-sender";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Cron-triggered endpoint that generates weekly spending summaries
 * for all users who have opted in.
 *
 * Protected by CRON_SECRET header instead of user auth.
 * Add to render.yaml as a cron job hitting this endpoint weekly.
 */
export async function POST(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 503 }
    );
  }

  try {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, notification_preferences");

    const eligible = (profiles ?? []).filter((p) => {
      const prefs = p.notification_preferences as Record<string, boolean> | null;
      return prefs?.weekly_summary !== false;
    });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDate = weekAgo.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];

    let created = 0;
    let skipped = 0;
    let pushSent = 0;

    for (const profile of eligible) {
      const { data: expenses } = await admin
        .from("expenses")
        .select("amount, category")
        .eq("user_id", profile.id)
        .gte("date", startDate)
        .lte("date", endDate);

      const total = (expenses ?? []).reduce(
        (sum, e) => sum + Number(e.amount),
        0
      );
      const count = expenses?.length ?? 0;

      if (count === 0) {
        skipped++;
        continue;
      }

      const byCategory: Record<string, number> = {};
      for (const e of expenses ?? []) {
        byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
      }
      const topCategory = Object.entries(byCategory).sort(
        (a, b) => b[1] - a[1]
      )[0];

      const title = "Your weekly spending summary";
      const body = `You spent $${total.toFixed(2)} across ${count} expense${count === 1 ? "" : "s"} this week.${topCategory ? ` Top category: ${topCategory[0]} ($${topCategory[1].toFixed(2)}).` : ""}`;

      await admin.from("notifications").insert({
        user_id: profile.id,
        type: "weekly_summary",
        title,
        body,
        data: { total, count, byCategory, startDate, endDate },
      });

      created++;

      if (isPushConfigured()) {
        try {
          const result = await sendPushToUser(admin, profile.id, {
            title,
            body,
            tag: `weekly-summary-${endDate}`,
          });
          pushSent += result.sent;
        } catch {
          // non-critical
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: eligible.length,
      created,
      skipped,
      pushSent,
    });
  } catch (error) {
    console.error("Cron weekly-summary error:", error);
    return NextResponse.json(
      { error: "Failed to process weekly summaries" },
      { status: 500 }
    );
  }
}
