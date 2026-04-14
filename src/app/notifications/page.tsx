import type { Metadata } from "next";
import { NotificationsClient } from "@/components/notifications/notifications-client";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Budget alerts, spending summaries, and app notifications.",
};

export default function NotificationsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <NotificationsClient />
    </div>
  );
}
