"use client";

import { AppShell } from "@/components/app-shell";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell user={null} isDemo>
      {children}
    </AppShell>
  );
}
