"use client";

import { useMemo } from "react";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { ExpenseChart } from "@/components/dashboard/expense-chart";
import { BudgetProgress } from "@/components/dashboard/budget-progress";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { CategoryBreakdown } from "@/components/dashboard/category-breakdown";
import type { Expense, Budget, AnalyticsData } from "@/lib/types";

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
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your financial overview at a glance
        </p>
      </div>

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
