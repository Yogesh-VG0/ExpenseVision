"use client";

import { useMemo } from "react";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertTriangle,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useCurrency } from "@/components/currency-provider";
import { CATEGORY_COLORS } from "@/lib/constants";
import { getDemoBudgets, getDemoExpenses } from "@/lib/demo-data";
import { useHydrated } from "@/lib/use-hydrated";

const DEMO_TOAST_TITLE = "Sign up to save changes!";
const DEMO_TOAST_DESC = "Create a free account to manage your budgets.";

function showDemoToast() {
  toast(DEMO_TOAST_TITLE, { description: DEMO_TOAST_DESC });
}

export default function DemoBudgetsPage() {
  const { format } = useCurrency();
  const hydrated = useHydrated();

  const budgets = useMemo(() => (hydrated ? getDemoBudgets() : []), [hydrated]);
  const demoExpenses = useMemo(() => (hydrated ? getDemoExpenses() : []), [hydrated]);

  const spending = useMemo(() => {
    const map: Record<string, number> = {};
    demoExpenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return map;
  }, [demoExpenses]);

  const totalLimit = budgets.reduce((sum, b) => sum + b.monthly_limit, 0);
  const totalSpent = budgets.reduce(
    (sum, b) => sum + (spending[b.category] || 0),
    0
  );
  const totalRemaining = totalLimit - totalSpent;
  const totalPercentage = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

  function getProgressColor(percentage: number) {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  }

  if (!hydrated) {
    return <div className="min-h-[60vh]" />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-up">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
            <Badge
            variant="outline"
            className="animate-pulse-glow border-amber-600/45 text-amber-800 dark:border-amber-400/40 dark:text-amber-400"
          >
              Demo
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Set monthly spending limits and track your progress.
          </p>
        </div>
        <Button
          onClick={showDemoToast}
          className="bg-primary text-primary-foreground hover:bg-primary/80"
        >
          <Plus className="mr-2 size-4" />
          Add Budget
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="border-border/50 bg-muted/30 backdrop-blur-xl">
        <CardContent className="p-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <Target className="size-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold">
                  {format(totalLimit)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-accent/10">
                <TrendingUp className="size-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold">
                  {format(totalSpent)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={`flex size-12 items-center justify-center rounded-xl ${
                  totalRemaining >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"
                }`}
              >
                <Wallet
                  className={`size-6 ${
                    totalRemaining >= 0 ? "text-emerald-500" : "text-red-500"
                  }`}
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p
                  className={`text-2xl font-bold ${
                    totalRemaining < 0 ? "text-red-500" : ""
                  }`}
                >
                  {format(totalRemaining)}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall progress</span>
              <span className="font-medium">
                {Math.min(totalPercentage, 100).toFixed(0)}%
              </span>
            </div>
            <Progress value={Math.min(totalPercentage, 100)}>
              <ProgressTrack className="h-2 bg-muted/50">
                <ProgressIndicator className={getProgressColor(totalPercentage)} />
              </ProgressTrack>
            </Progress>
          </div>
        </CardContent>
      </Card>

      {/* Budget Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {budgets.map((budget) => {
          const spent = spending[budget.category] || 0;
          const percentage =
            budget.monthly_limit > 0 ? (spent / budget.monthly_limit) * 100 : 0;
          const isOverBudget = percentage > 100;
          const categoryColor = CATEGORY_COLORS[budget.category] || "#64748B";

          return (
            <Card
              key={budget.id}
              className="border-border/50 bg-muted/30 backdrop-blur-xl transition-colors hover:bg-muted/40"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${categoryColor}20` }}
                  >
                    <span
                      className="text-sm font-bold"
                      style={{ color: categoryColor }}
                    >
                      {budget.category.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      {budget.category}
                    </CardTitle>
                    {isOverBudget && (
                      <Badge variant="destructive" className="mt-1 gap-1 text-xs">
                        <AlertTriangle className="size-3" />
                        Over budget
                      </Badge>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Actions</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={showDemoToast}>
                      <Pencil className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={showDemoToast}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {format(spent)} /{" "}
                      {format(budget.monthly_limit)}
                    </span>
                    <span
                      className={`font-semibold ${
                        isOverBudget
                          ? "text-red-500"
                          : percentage >= 70
                            ? "text-amber-500"
                            : "text-emerald-500"
                      }`}
                    >
                      {Math.min(percentage, 999).toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={Math.min(percentage, 100)}>
                    <ProgressTrack className="h-2 bg-muted/50">
                      <ProgressIndicator
                        className={getProgressColor(percentage)}
                        style={
                          percentage < 70
                            ? { backgroundColor: categoryColor }
                            : undefined
                        }
                      />
                    </ProgressTrack>
                  </Progress>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {isOverBudget
                      ? `Over by ${format(spent - budget.monthly_limit)}`
                      : `${format(budget.monthly_limit - spent)} remaining`}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
