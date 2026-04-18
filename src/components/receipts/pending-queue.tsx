"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  Loader2,
  RefreshCw,
  Trash2,
  WifiOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAllPendingUploads,
  removePendingUpload,
  isOfflineQueueAvailable,
  type PendingUploadEntry,
} from "@/lib/offline-queue";
import { processQueue, onQueueChange } from "@/lib/offline-retry";
import { trackEvent } from "@/lib/telemetry";

const STATUS_CONFIG: Record<
  PendingUploadEntry["status"],
  { label: string; icon: typeof Clock; className: string }
> = {
  queued: {
    label: "Waiting",
    icon: Clock,
    className:
      "border-amber-600/35 bg-amber-500/15 text-amber-900 dark:border-amber-500/30 dark:text-amber-300",
  },
  retrying: {
    label: "Retrying",
    icon: Loader2,
    className:
      "border-blue-600/35 bg-blue-500/15 text-blue-900 dark:border-blue-500/30 dark:text-blue-300",
  },
  succeeded: {
    label: "Saved",
    icon: CheckCircle,
    className:
      "border-emerald-600/35 bg-emerald-500/15 text-emerald-900 dark:border-emerald-500/30 dark:text-emerald-300",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "border-red-600/35 bg-red-500/15 text-red-900 dark:border-red-500/30 dark:text-red-300",
  },
};

export function PendingQueuePanel() {
  const [items, setItems] = useState<PendingUploadEntry[]>([]);
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(async () => {
    if (!isOfflineQueueAvailable()) return;
    try {
      const all = await getAllPendingUploads();
      setItems(all);
    } catch {
      // IDB may be unavailable
    }
  }, []);

  useEffect(() => {
    void refresh();
    const unsub = onQueueChange(() => void refresh());
    return unsub;
  }, [refresh]);

  const handleRetryAll = useCallback(async () => {
    setRetrying(true);
    await trackEvent("offline_queue_retry", { count: items.length });
    try {
      await processQueue();
    } catch {
      toast.error("Retry failed — please check your connection");
    } finally {
      setRetrying(false);
      await refresh();
    }
  }, [items.length, refresh]);

  const handleRemove = useCallback(
    async (id: string) => {
      await removePendingUpload(id);
      await trackEvent("offline_queue_cancel");
      toast.success("Queued expense removed");
      await refresh();
    },
    [refresh]
  );

  if (items.length === 0) return null;

  const isOnline =
    typeof navigator !== "undefined" ? navigator.onLine : true;

  return (
    <Card className="border-amber-600/25 bg-amber-500/[0.06] backdrop-blur-sm dark:border-amber-500/20 dark:bg-amber-500/5">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15">
            <WifiOff className="h-4 w-4 text-amber-800 dark:text-amber-300" />
          </div>
          <CardTitle className="text-base">
            Pending uploads
            <Badge variant="secondary" className="ml-2 text-xs">
              {items.length}
            </Badge>
          </CardTitle>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetryAll}
          disabled={retrying || !isOnline}
          className="h-8 text-xs"
        >
          {retrying ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Retry all
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {!isOnline && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-600/25 bg-amber-500/10 p-2.5 text-xs text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            You&apos;re offline. Expenses will upload when your connection returns.
          </div>
        )}
        {items.map((item) => {
          const config = STATUS_CONFIG[item.status];
          const StatusIcon = config.icon;

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {item.formValues.vendor || "Unknown"}
                  </p>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs ${config.className}`}
                  >
                    <StatusIcon
                      className={`mr-1 h-3 w-3 ${item.status === "retrying" ? "animate-spin" : ""}`}
                    />
                    {config.label}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.formValues.amount
                    ? `${item.formValues.category} · ${item.formValues.amount}`
                    : item.formValues.category}{" "}
                  · {item.formValues.date}
                </p>
                {item.lastError && (
                  <p className="mt-1 text-xs text-red-400/90">
                    {item.lastError}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => void handleRemove(item.id)}
                aria-label="Remove queued expense"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
