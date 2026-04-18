"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_COLORS } from "@/lib/constants";
import { useCurrency } from "@/components/currency-provider";
import type { Expense } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

interface RecentActivityProps {
  expenses: Omit<Expense, "user_id">[];
}

export function RecentActivity({ expenses }: RecentActivityProps) {
  const { format } = useCurrency();
  const recent = expenses.slice(0, 8);

  return (
    <Card className="border border-border bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No expenses yet. Add your first expense to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {recent.map((expense) => (
              <div
                key={expense.id}
                className="rounded-lg p-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex gap-3">
                  <div
                    className="h-10 w-10 shrink-0 rounded-lg sm:h-9 sm:w-9"
                    style={{
                      backgroundColor:
                        (CATEGORY_COLORS[expense.category] || "#64748B") + "20",
                    }}
                  >
                    <div
                      className="flex h-full w-full items-center justify-center text-[11px] font-bold sm:text-xs"
                      style={{
                        color:
                          CATEGORY_COLORS[expense.category] || "#64748B",
                      }}
                    >
                      {expense.category
                        .split(" ")[0]
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-sm font-medium leading-snug break-words">
                        {expense.description || expense.vendor || expense.category}
                      </p>
                      <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                        -{format(expense.amount)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-col gap-1.5 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        {expense.vendor ? (
                          <span className="min-w-0 break-words">{expense.vendor}</span>
                        ) : null}
                        {expense.vendor ? (
                          <span className="hidden text-muted-foreground/60 sm:inline" aria-hidden>
                            ·
                          </span>
                        ) : null}
                        <span className="shrink-0 whitespace-nowrap">
                          {formatDistanceToNow(new Date(expense.date), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      {expense.is_recurring ? (
                        <Badge
                          variant="outline"
                          className="w-fit shrink-0 border-accent/35 text-[10px] text-accent"
                        >
                          Recurring
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
