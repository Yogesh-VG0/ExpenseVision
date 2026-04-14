/**
 * Client-side retry manager for the offline pending-upload queue.
 *
 * Listens for `online`, `visibilitychange`, and `focus` events to trigger
 * automatic retries. Background Sync is registered as progressive
 * enhancement when available.
 */

import {
  getAllPendingUploads,
  updatePendingUpload,
  MAX_RETRY_COUNT,
  type PendingUploadEntry,
} from "@/lib/offline-queue";
import { trackEvent } from "@/lib/telemetry";

export const BACKGROUND_SYNC_TAG = "pending-expense-upload";

let processingQueue = false;
let retryListenersRegistered = false;

type QueueChangeListener = () => void;
const changeListeners: Set<QueueChangeListener> = new Set();

export function onQueueChange(listener: QueueChangeListener): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

function notifyQueueChange() {
  changeListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore listener errors
    }
  });
}

async function submitQueuedExpense(
  entry: PendingUploadEntry
): Promise<boolean> {
  const body: Record<string, unknown> = {
    amount: Number.parseFloat(entry.formValues.amount),
    vendor: entry.formValues.vendor || undefined,
    category: entry.formValues.category,
    description: entry.formValues.description || "",
    date: entry.formValues.date,
    is_recurring: false,
    receipt_url: entry.receiptPath ?? null,
    idempotency_key: entry.idempotencyKey,
  };

  const res = await fetch("/api/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.ok || res.status === 200 || res.status === 201) {
    return true;
  }

  // 409 means the idempotency_key already matched — treat as success
  if (res.status === 409) {
    return true;
  }

  const data = await res.json().catch(() => null);
  throw new Error(data?.error || `Server responded with ${res.status}`);
}

export async function processQueue(): Promise<void> {
  if (processingQueue) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  processingQueue = true;

  try {
    const items = await getAllPendingUploads();
    const actionable = items.filter(
      (e) =>
        (e.status === "queued" || e.status === "retrying") &&
        e.retryCount < MAX_RETRY_COUNT
    );

    for (const entry of actionable) {
      await updatePendingUpload(entry.id, { status: "retrying" });
      notifyQueueChange();

      try {
        await submitQueuedExpense(entry);
        await updatePendingUpload(entry.id, { status: "succeeded" });
        await trackEvent("expense_save_success", {
          source: "offline_queue_retry",
          idempotency_key: entry.idempotencyKey,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        const nextRetry = entry.retryCount + 1;
        await updatePendingUpload(entry.id, {
          status: nextRetry >= MAX_RETRY_COUNT ? "failed" : "queued",
          retryCount: nextRetry,
          lastError: message,
        });
        await trackEvent("expense_save_failure", {
          source: "offline_queue_retry",
          error: message,
          retry_count: nextRetry,
        });
      }

      notifyQueueChange();
    }
  } finally {
    processingQueue = false;
  }
}

export function registerRetryListeners(): () => void {
  if (typeof window === "undefined" || retryListenersRegistered) {
    return () => {};
  }

  retryListenersRegistered = true;

  const onOnline = () => void processQueue();
  const onFocus = () => void processQueue();
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void processQueue();
    }
  };

  window.addEventListener("online", onOnline);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    retryListenersRegistered = false;
  };
}

export async function registerBackgroundSync(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if ("sync" in registration) {
      await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register(BACKGROUND_SYNC_TAG);
      return true;
    }
  } catch {
    // Background Sync not supported — fall back silently
  }

  return false;
}
