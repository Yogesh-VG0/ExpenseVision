"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  BellOff,
  CheckCheck,
  AlertTriangle,
  BarChart3,
  Wallet,
  FileText,
  Info,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  budget_warning: AlertTriangle,
  budget_exceeded: Wallet,
  weekly_summary: BarChart3,
  import_complete: FileText,
  system: Info,
};

const TYPE_STYLES: Record<string, string> = {
  budget_warning: "text-amber-700 dark:text-amber-400",
  budget_exceeded: "text-red-400",
  weekly_summary: "text-blue-400",
  import_complete: "text-emerald-400",
  system: "text-muted-foreground",
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function NotificationsClient() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch {
      // Ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // Ignore
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      // Ignore
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
              : "You\u2019re all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="h-8 text-xs"
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="border-border bg-background/60 backdrop-blur-xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-4">
              <BellOff className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No notifications yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              You&apos;ll receive alerts here when your spending reaches budget thresholds, or when automated insights are generated.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-background/60 backdrop-blur-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {notifications.map((n, idx) => {
              const Icon = TYPE_ICONS[n.type] || Bell;
              const iconStyle = TYPE_STYLES[n.type] || "text-muted-foreground";

              return (
                <div key={n.id}>
                  {idx > 0 && <Separator />}
                  <button
                    type="button"
                    className={`w-full text-left px-6 py-4 transition-colors hover:bg-muted/30 ${!n.read ? "bg-primary/5" : ""}`}
                    onClick={() => !n.read && void handleMarkRead(n.id)}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0">
                        <Icon className={`h-5 w-5 ${iconStyle}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${!n.read ? "" : "text-muted-foreground"}`}>
                            {n.title}
                          </span>
                          {!n.read && (
                            <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-primary/15 text-primary">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                          {n.body}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          {formatRelativeTime(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
