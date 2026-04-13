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
                className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-lg"
                    style={{
                      backgroundColor:
                        (CATEGORY_COLORS[expense.category] || "#64748B") + "20",
                    }}
                  >
                    <div
                      className="flex h-full w-full items-center justify-center text-xs font-bold"
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
                  <div>
                    <p className="text-sm font-medium">{expense.description || expense.vendor || expense.category}</p>
                    <div className="flex items-center gap-2">
                      {expense.vendor && (
                        <span className="text-xs text-muted-foreground">
                          {expense.vendor}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(expense.date), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {expense.is_recurring && (
                    <Badge
                      variant="outline"
                      className="border-accent/30 text-[10px] text-accent"
                    >
                      Recurring
                    </Badge>
                  )}
                  <span className="text-sm font-semibold">
                    -{format(expense.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
