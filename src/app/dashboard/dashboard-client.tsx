"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { Camera } from "lucide-react";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { BudgetProgress } from "@/components/dashboard/budget-progress";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import type { Expense, Budget, AnalyticsData } from "@/lib/types";

const ExpenseChart = dynamic(
  () => import("@/components/dashboard/expense-chart").then((mod) => mod.ExpenseChart),
  { ssr: false }
);
const CategoryBreakdown = dynamic(
  () => import("@/components/dashboard/category-breakdown").then((mod) => mod.CategoryBreakdown),
  { ssr: false }
);

interface DashboardClientProps {
  expenses: Expense[];
  budgets: Budget[];
  allExpenses: Expense[];
}

function buildAnalytics(
  expenses: Expense[],
  budgets: Budget[],
  allExpenses: Expense[]
): AnalyticsData {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const count = expenses.length;
  const average = count > 0 ? Math.round((total / count) * 100) / 100 : 0;

  // By category
  const catMap: Record<string, { total: number; count: number }> = {};
  expenses.forEach((e) => {
    if (!catMap[e.category]) catMap[e.category] = { total: 0, count: 0 };
    catMap[e.category].total += e.amount;
    catMap[e.category].count += 1;
  });
  const by_category = Object.entries(catMap)
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.total - a.total);

  // By month (from allExpenses)
  const monthMap: Record<string, number> = {};
  allExpenses.forEach((e) => {
    const month = e.date.slice(0, 7);
    monthMap[month] = (monthMap[month] || 0) + e.amount;
  });
  const by_month = Object.entries(monthMap)
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // By day
  const dayMap: Record<string, number> = {};
  expenses.forEach((e) => {
    dayMap[e.date] = (dayMap[e.date] || 0) + e.amount;
  });
  const by_day = Object.entries(dayMap)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Budget status
  const budget_status = budgets.map((b) => {
    const catSpent = catMap[b.category]?.total || 0;
    return {
      category: b.category,
      spent: catSpent,
      limit: b.monthly_limit,
      percentage: Math.round((catSpent / b.monthly_limit) * 100),
    };
  });

  // Top merchants
  const vendorMap: Record<string, { total: number; count: number }> = {};
  expenses.forEach((e) => {
    const v = e.vendor || "Unknown";
    if (!vendorMap[v]) vendorMap[v] = { total: 0, count: 0 };
    vendorMap[v].total += e.amount;
    vendorMap[v].count += 1;
  });
  const top_merchants = Object.entries(vendorMap)
    .map(([vendor, data]) => ({ vendor, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    by_category,
    by_month,
    by_day,
    stats: { total, count, average },
    budget_status,
    top_merchants,
  };
}

export function DashboardClient({
  expenses,
  budgets,
  allExpenses,
}: DashboardClientProps) {
  const analytics = useMemo(
    () => buildAnalytics(expenses, budgets, allExpenses),
    [expenses, budgets, allExpenses]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your financial overview at a glance
          </p>
        </div>

        {/* Desktop-compact scan shortcut */}
        <Link
          href="/receipts/capture"
          className="hidden items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 sm:inline-flex"
        >
          <Camera className="h-4 w-4" />
          Scan Receipt
        </Link>
      </div>

      {/* Mobile Quick Scan — prominent CTA */}
      <Link
        href="/receipts/capture"
        className="group flex items-center gap-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-accent/5 to-transparent p-4 transition-all hover:border-primary/40 hover:shadow-md sm:hidden"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg transition-transform group-hover:scale-105">
          <Camera className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Quick Scan Receipt</p>
          <p className="text-sm text-muted-foreground">
            Snap a photo to log an expense instantly
          </p>
        </div>
      </Link>

      <OverviewCards data={analytics} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ExpenseChart data={analytics} />
        </div>
        <div className="lg:col-span-2">
          <CategoryBreakdown data={analytics} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
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
