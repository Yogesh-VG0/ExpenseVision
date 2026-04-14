import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Notifications",
    template: "%s | ExpenseVision",
  },
};

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
