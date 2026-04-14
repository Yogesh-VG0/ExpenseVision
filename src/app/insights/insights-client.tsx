"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Brain,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useCurrency } from "@/components/currency-provider";
import type { Expense } from "@/lib/types";

/* ---------- Insight type from AI endpoint ---------- */
interface InsightItem {
  type: "spending_summary" | "savings_tip" | "budget_alert" | "trend_analysis";
  title: string;
  content: string;
  data?: Record<string, unknown>;
  created_at?: string;
}

const INSIGHT_META: Record<
  InsightItem["type"],
  { icon: typeof Sparkles; color: string; gradient: string }
> = {
  spending_summary: {
    icon: BarChart3,
    color: "text-primary",
    gradient: "from-primary/20 to-primary/5",
  },
  savings_tip: {
    icon: Lightbulb,
    color: "text-green-500",
    gradient: "from-green-500/20 to-green-500/5",
  },
  budget_alert: {
    icon: AlertTriangle,
    color: "text-amber-400",
    gradient: "from-amber-500/20 to-amber-500/5",
  },
  trend_analysis: {
    icon: TrendingUp,
    color: "text-accent",
    gradient: "from-accent/20 to-accent/5",
  },
};

/* ---------- Props ---------- */
interface InsightsClientProps {
  currentMonthExpenses: Expense[];
}

export function InsightsClient({
  currentMonthExpenses,
}: InsightsClientProps) {
  const { format: formatCurrency } = useCurrency();
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(false);

  /* ---------- Quick Stats (computed client-side) ---------- */
  const quickStats = useMemo(() => {
    const expenses = currentMonthExpenses;
    if (expenses.length === 0) return null;

    // Highest spending category
    const categoryTotals: Record<string, number> = {};
    expenses.forEach((e) => {
      categoryTotals[e.category] =
        (categoryTotals[e.category] ?? 0) + e.amount;
    });
    const topCategory = Object.entries(categoryTotals).sort(
      (a, b) => b[1] - a[1]
    )[0];

    // Day of week with most spending
    const dayTotals: Record<string, number> = {};
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    expenses.forEach((e) => {
      const day = dayNames[new Date(e.date).getDay()];
      dayTotals[day] = (dayTotals[day] ?? 0) + e.amount;
    });
    const topDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0];

    // Average daily spend
    const uniqueDays = new Set(expenses.map((e) => e.date)).size;
    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
    const avgDaily = uniqueDays > 0 ? totalSpent / uniqueDays : 0;

    // Recurring vs one-time
    const recurring = expenses.filter((e) => e.is_recurring);
    const oneTime = expenses.filter((e) => !e.is_recurring);

    return {
      topCategory: topCategory
        ? { name: topCategory[0], amount: topCategory[1] }
        : null,
      topDay: topDay ? { name: topDay[0], amount: topDay[1] } : null,
      avgDaily,
      recurring: recurring.reduce((s, e) => s + e.amount, 0),
      oneTime: oneTime.reduce((s, e) => s + e.amount, 0),
      recurringCount: recurring.length,
      oneTimeCount: oneTime.length,
    };
  }, [currentMonthExpenses]);

  /* ---------- Generate Insights ---------- */
  const generateInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error("Failed to generate insights");

      const data = await res.json();
      setInsights(data.insights ?? []);
      toast.success("Insights generated!");
    } catch {
      toast.error("Failed to generate insights. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <Sparkles className="mr-2 inline-block h-6 w-6 text-accent" />
            AI Insights
          </h1>
          <p className="mt-1 text-muted-foreground">
            Personalized spending analysis powered by AI
          </p>
        </div>
        <Button
          onClick={generateInsights}
          disabled={loading}
          className="bg-gradient-to-r from-accent to-primary text-white hover:opacity-90"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Generate Insights
        </Button>
      </div>

      {/* Quick Stats */}
      {quickStats && (
        <div>
          <h2 className="mb-4 text-xl font-semibold">Quick Stats</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Top Category */}
            <Card className="border-border bg-card/80 backdrop-blur-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Top Category
                </p>
                <p className="mt-2 text-lg font-bold">
                  {quickStats.topCategory?.name ?? "—"}
                </p>
                <p className="text-sm text-primary">
                  {quickStats.topCategory
                    ? formatCurrency(quickStats.topCategory.amount)
                    : "—"}
                </p>
              </CardContent>
            </Card>

            {/* Busiest Day */}
            <Card className="border-border bg-card/80 backdrop-blur-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Busiest Day
                </p>
                <p className="mt-2 text-lg font-bold">
                  {quickStats.topDay?.name ?? "—"}
                </p>
                <p className="text-sm text-accent">
                  {quickStats.topDay
                    ? formatCurrency(quickStats.topDay.amount)
                    : "—"}
                </p>
              </CardContent>
            </Card>

            {/* Average Daily */}
            <Card className="border-border bg-card/80 backdrop-blur-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Avg Daily Spend
                </p>
                <p className="mt-2 text-lg font-bold">
                  {formatCurrency(quickStats.avgDaily)}
                </p>
                <p className="text-sm text-muted-foreground">this month</p>
              </CardContent>
            </Card>

            {/* Recurring vs One-time */}
            <Card className="border-border bg-card/80 backdrop-blur-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Recurring vs One-time
                </p>
                <p className="mt-2 text-lg font-bold">
                  {formatCurrency(quickStats.recurring)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    ({quickStats.recurringCount})
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(quickStats.oneTime)} one-time (
                  {quickStats.oneTimeCount})
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Separator className="bg-muted/50" />

      {/* AI Insights */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">AI-Generated Insights</h2>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card
                key={i}
                className="border-border bg-card/80 backdrop-blur-sm"
              >
                <CardContent className="space-y-3 p-6">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : insights.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {insights.map((insight, idx) => {
              const meta = INSIGHT_META[insight.type] ?? INSIGHT_META.spending_summary;
              const Icon = meta.icon;
              return (
                <div key={idx} className="group relative flex rounded-xl p-[1px]">
                  {/* Gradient border */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent/40 via-primary/20 to-transparent opacity-60 transition-opacity group-hover:opacity-100" />
                  <Card className="relative flex flex-col border-0 bg-card/80 backdrop-blur-sm w-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${meta.gradient}`}
                        >
                          <Icon className={`h-4 w-4 ${meta.color}`} />
                        </div>
                        <div>
                          <CardTitle className="text-sm">
                            {insight.title}
                          </CardTitle>
                          <Badge
                            variant="secondary"
                            className="mt-1 text-[10px]"
                          >
                            {insight.type.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 pt-0">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {insight.content}
                      </p>
                      {insight.created_at && (
                        <p className="mt-3 text-[11px] text-muted-foreground/60">
                          {new Date(insight.created_at).toLocaleString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-primary/20">
                <Brain className="h-8 w-8 text-accent" />
              </div>
              <p className="mt-4 text-lg font-medium">No insights yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Click &quot;Generate Insights&quot; to get AI-powered spending
                analysis
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
