import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.NEXT_PUBLIC_APP_URL
  ? `mailto:noreply@${new URL(process.env.NEXT_PUBLIC_APP_URL).hostname}`
  : "mailto:noreply@expensevision.tech";

let vapidConfigured = false;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
  } catch (err) {
    console.error("Failed to configure VAPID:", err);
  }
}

export function isPushConfigured(): boolean {
  return vapidConfigured;
}

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, unknown>;
}

/**
 * Send push notifications to all active subscriptions for a user.
 * Cleans up expired/invalid subscriptions automatically.
 */
export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; cleaned: number }> {
  if (!vapidConfigured) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .eq("user_id", userId);

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag ?? "expensevision-notification",
    data: { url: "/notifications", ...payload.data },
  });

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys as { p256dh: string; auth: string },
          },
          message,
          { TTL: 86400 }
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(sub.id);
        }
      }
    })
  );

  let cleaned = 0;
  if (expiredIds.length > 0) {
    const { count } = await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", expiredIds);
    cleaned = count ?? expiredIds.length;
  }

  return { sent, failed, cleaned };
}
