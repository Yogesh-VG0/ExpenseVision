"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { BudgetProgress } from "@/components/dashboard/budget-progress";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { getDemoAnalytics, getDemoExpenses } from "@/lib/demo-data";
import { useHydrated } from "@/lib/use-hydrated";
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
  const hydrated = useHydrated();

  const analytics = useMemo(() => (hydrated ? getDemoAnalytics() : null), [hydrated]);
  const expenses = useMemo(
    () => (hydrated ? (getDemoExpenses() as unknown as Expense[]) : []),
    [hydrated]
  );

  if (!hydrated || !analytics) {
    return <div className="min-h-[60vh]" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your financial overview at a glance
          </p>
        </div>
        <Badge
          variant="outline"
          className="animate-pulse-glow border-amber-600/45 text-amber-800 dark:border-amber-400/40 dark:text-amber-400"
        >
          Demo
        </Badge>
      </div>

      <div className="animate-fade-up" style={{ animationDelay: "150ms" }}>
        <OverviewCards data={analytics} />
      </div>

      <div
        className="grid gap-6 lg:grid-cols-5 lg:items-start animate-fade-up"
        style={{ animationDelay: "300ms" }}
      >
        <div className="space-y-6 lg:col-span-3">
          <ExpenseChart data={analytics} isDemo />
          <RecentActivity expenses={expenses} />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <CategoryBreakdown data={analytics} />
          <BudgetProgress data={analytics} />
        </div>
      </div>
    </div>
  );
}
