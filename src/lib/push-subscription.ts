/**
 * Push notification subscription management.
 *
 * Capability-gated: if the browser doesn't support push or VAPID keys
 * aren't configured, the helpers report state cleanly instead of erroring.
 */

export type PushCapabilityState =
  | "unsupported"         // browser doesn't have PushManager / Notification API
  | "unconfigured"        // VAPID public key missing from env
  | "permission-default"  // not yet asked
  | "permission-denied"   // user said no
  | "unsubscribed"        // can subscribe but hasn't yet
  | "subscribed";         // fully active

export function getVapidPublicKey(): string | null {
  return typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null)
    : null;
}

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPushCapabilityState(): Promise<PushCapabilityState> {
  if (!isPushSupported()) return "unsupported";

  const vapidKey = getVapidPublicKey();
  if (!vapidKey) return "unconfigured";

  const permission = Notification.permission;
  if (permission === "denied") return "permission-denied";

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) return "subscribed";
  } catch {
    return "unsupported";
  }

  if (permission === "default") return "permission-default";
  return "unsubscribed";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const vapidKey = getVapidPublicKey();
  if (!vapidKey) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });

    // Store on server
    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(
            String.fromCharCode(
              ...new Uint8Array(subscription.getKey("p256dh")!)
            )
          ),
          auth: btoa(
            String.fromCharCode(
              ...new Uint8Array(subscription.getKey("auth")!)
            )
          ),
        },
      }),
    });

    return subscription;
  } catch {
    return null;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      // Remove from server
      await fetch("/api/notifications/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      return true;
    }
  } catch {
    // Ignore errors
  }

  return false;
}
