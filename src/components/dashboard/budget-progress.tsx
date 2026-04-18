"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CATEGORY_COLORS } from "@/lib/constants";
import { useCurrency } from "@/components/currency-provider";
import type { AnalyticsData } from "@/lib/types";

interface BudgetProgressProps {
  data: AnalyticsData;
}

export function BudgetProgress({ data }: BudgetProgressProps) {
  const { format } = useCurrency();
  const { budget_status } = data;
  const shouldScroll = budget_status.length > 5;

  return (
    <Card className="border border-border bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
      <CardHeader>
        <CardTitle className="text-base">Budget Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {budget_status.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No budgets set. Create a budget to track your spending.
          </p>
        ) : (
          <div
            className={
              shouldScroll
                ? "space-y-4 md:max-h-[15.5rem] md:overflow-y-auto md:pr-2"
                : "space-y-4"
            }
          >
            {budget_status.map((budget) => (
              <div key={budget.category} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          CATEGORY_COLORS[budget.category] || "#64748B",
                      }}
                    />
                    <span className="truncate font-medium">{budget.category}</span>
                  </div>
                  <span className="shrink-0 text-muted-foreground">
                    {format(budget.spent)} /{" "}
                    {format(budget.limit)}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={Math.min(budget.percentage, 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(budget.percentage, 100)}%`,
                      backgroundColor:
                        budget.percentage > 90
                          ? "hsl(0 84% 60%)"
                          : budget.percentage > 70
                            ? "hsl(43 96% 56%)"
                            : "hsl(142 71% 45%)",
                    }}
                  />
                </div>
                {budget.percentage > 90 && (
                  <p className="text-xs text-red-500">
                    {budget.percentage >= 100
                      ? `Over budget by ${format(budget.spent - budget.limit)}`
                      : `${100 - budget.percentage}% remaining`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
