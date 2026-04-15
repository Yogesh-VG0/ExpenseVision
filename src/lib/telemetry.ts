export const TELEMETRY_EVENTS = [
  "ocr_start",
  "ocr_success",
  "ocr_failure",
  "expense_save_success",
  "expense_save_failure",
  "share_import_start",
  "share_import_success",
  "share_import_failure",
  "install_prompt_accepted",
  "install_prompt_dismissed",
  "install_manual_instructions_shown",
  "push_subscription_accepted",
  "push_subscription_failed",
  "offline_queue_enqueue",
  "offline_queue_retry",
  "offline_queue_cancel",
  "notification_received",
  "notification_clicked",
  "budget_alert_triggered",
  "csv_import_start",
  "csv_import_success",
  "csv_import_failure",
  "duplicate_detected",
  "duplicate_override",
] as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENTS)[number];

export type TelemetryPayload = Record<string, string | number | boolean | null | undefined>;

type TelemetryAdapter = (event: TelemetryEventName, payload?: TelemetryPayload) => void | Promise<void>;

const adapters: TelemetryAdapter[] = [];

export function registerTelemetryAdapter(adapter: TelemetryAdapter) {
  adapters.push(adapter);
}

async function postToTelemetryEndpoint(event: TelemetryEventName, payload?: TelemetryPayload) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, payload }),
      keepalive: true,
    });
  } catch {
  }
}

export async function trackEvent(event: TelemetryEventName, payload?: TelemetryPayload) {
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    console.info("[telemetry]", event, payload ?? {});
  }

  await Promise.allSettled([
    postToTelemetryEndpoint(event, payload),
    ...adapters.map((adapter) => Promise.resolve(adapter(event, payload))),
  ]);
}
