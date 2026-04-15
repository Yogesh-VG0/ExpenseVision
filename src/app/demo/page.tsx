"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { BudgetProgress } from "@/components/dashboard/budget-progress";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { getDemoAnalytics, DEMO_EXPENSES } from "@/lib/demo-data";
import type { Expense } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const ExpenseChart = dynamic(
  () => import("@/components/dashboard/expense-chart").then((mod) => mod.ExpenseChart),
  { ssr: false }
);
const CategoryBreakdown = dynamic(
  () => import("@/components/dashboard/category-breakdown").then((mod) => mod.CategoryBreakdown),
  { ssr: false }
);

export default function DemoDashboardPage() {
  const analytics = useMemo(() => getDemoAnalytics(), []);
  const expenses = DEMO_EXPENSES as unknown as Expense[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your financial overview at a glance
          </p>
        </div>
        <Badge variant="outline" className="text-amber-400 border-amber-400/40 animate-pulse-glow">
          Demo
        </Badge>
      </div>

      <div className="animate-fade-up" style={{ animationDelay: "150ms" }}>
        <OverviewCards data={analytics} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5 animate-fade-up" style={{ animationDelay: "300ms" }}>
        <div className="lg:col-span-3">
          <ExpenseChart data={analytics} />
        </div>
        <div className="lg:col-span-2">
          <CategoryBreakdown data={analytics} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5 animate-fade-up" style={{ animationDelay: "450ms" }}>
        <div className="lg:col-span-3">
          <RecentActivity expenses={expenses} />
        </div>
        <div className="lg:col-span-2">
          <BudgetProgress data={analytics} />
        </div>
      </div>
    </div>
  );
}
