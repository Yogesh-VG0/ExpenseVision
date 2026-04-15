import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { endpoint, keys } = await request.json();

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "Missing subscription data" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) throw error;

    // Merge push_enabled into existing notification preferences (preserve user choices)
    const { data: profile } = await supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", user.id)
      .maybeSingle();

    const existing = (profile?.notification_preferences as Record<string, boolean> | null) ?? {};
    await supabase
      .from("profiles")
      .update({
        notification_preferences: {
          budget_alerts: existing.budget_alerts ?? true,
          weekly_summary: existing.weekly_summary ?? false,
          push_enabled: true,
        },
      })
      .eq("id", user.id);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/notifications/subscribe error:", error);
    return NextResponse.json(
      { error: "Failed to store subscription" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { endpoint } = await request.json();
    if (!endpoint) {
      return NextResponse.json(
        { error: "Missing endpoint" },
        { status: 400 }
      );
    }

    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/notifications/subscribe error:", error);
    return NextResponse.json(
      { error: "Failed to remove subscription" },
      { status: 500 }
    );
  }
}
