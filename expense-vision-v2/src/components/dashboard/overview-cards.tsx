"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, TrendingDown, TrendingUp, Receipt, Wallet } from "lucide-react";
import { useCurrency } from "@/components/currency-provider";
import type { AnalyticsData } from "@/lib/types";

interface OverviewCardsProps {
  data: AnalyticsData;
}

export function OverviewCards({ data }: OverviewCardsProps) {
  const { format } = useCurrency();
  const { stats, budget_status } = data;
  const avgBudgetPct =
    budget_status.length > 0
      ? Math.round(
          budget_status.reduce((sum, b) => sum + b.percentage, 0) /
            budget_status.length
        )
      : 0;
  const overBudget = budget_status.filter((b) => b.percentage > 100).length;

  const cards = [
    {
      title: "Total Spent",
      value: format(stats.total),
      description: `${stats.count} transactions this month`,
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Average Per Txn",
      value: format(stats.average),
      description: "Per transaction average",
      icon: Receipt,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Budget Usage",
      value: `${avgBudgetPct}%`,
      description:
        overBudget > 0
          ? `${overBudget} categor${overBudget > 1 ? "ies" : "y"} over budget`
          : "All budgets on track",
      icon: Wallet,
      color: avgBudgetPct > 90 ? "text-red-500" : "text-green-500",
      bgColor: avgBudgetPct > 90 ? "bg-red-500/10" : "bg-green-500/10",
    },
    {
      title: "Trend",
      value:
        data.by_month.length >= 2
          ? (() => {
              const curr = data.by_month[data.by_month.length - 1].total;
              const prev = data.by_month[data.by_month.length - 2].total;
              const change = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
              return `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`;
            })()
          : "---",
      description: "vs last month",
      icon:
        data.by_month.length >= 2 &&
        data.by_month[data.by_month.length - 1].total <
          data.by_month[data.by_month.length - 2].total
          ? TrendingDown
          : TrendingUp,
      color:
        data.by_month.length >= 2 &&
        data.by_month[data.by_month.length - 1].total <
          data.by_month[data.by_month.length - 2].total
          ? "text-green-500"
          : "text-red-500",
      bgColor:
        data.by_month.length >= 2 &&
        data.by_month[data.by_month.length - 1].total <
          data.by_month[data.by_month.length - 2].total
          ? "bg-green-500/10"
          : "bg-red-500/10",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <Card
          key={card.title}
          className="group border border-border bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bgColor} transition-transform duration-300 group-hover:scale-110`}
            >
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
