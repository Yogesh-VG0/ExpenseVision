import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Import",
    template: "%s | ExpenseVision",
  },
};

export default function ImportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
