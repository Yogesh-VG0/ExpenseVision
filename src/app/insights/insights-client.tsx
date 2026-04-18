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
  DollarSign,
  Calendar,
  Repeat,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useCurrency } from "@/components/currency-provider";
import { localizeCurrencyMentions } from "@/lib/localize-currency-text";
import type { Expense } from "@/lib/types";

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
    color: "text-amber-700 dark:text-amber-400",
    gradient: "from-amber-500/20 to-amber-500/5",
  },
  trend_analysis: {
    icon: TrendingUp,
    color: "text-accent",
    gradient: "from-accent/20 to-accent/5",
  },
};

interface InsightsClientProps {
  currentMonthExpenses: Expense[];
  initialInsights?: InsightItem[];
}

export function InsightsClient({
  currentMonthExpenses,
  initialInsights = [],
}: InsightsClientProps) {
  const { format: formatCurrency } = useCurrency();
  const [insights, setInsights] = useState<InsightItem[]>(initialInsights);
  const [loading, setLoading] = useState(false);

  const quickStats = useMemo(() => {
    const expenses = currentMonthExpenses;
    if (expenses.length === 0) return null;

    const categoryTotals: Record<string, number> = {};
    expenses.forEach((e) => {
      categoryTotals[e.category] =
        (categoryTotals[e.category] ?? 0) + e.amount;
    });
    const topCategory = Object.entries(categoryTotals).sort(
      (a, b) => b[1] - a[1]
    )[0];

    const dayTotals: Record<string, number> = {};
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    expenses.forEach((e) => {
      const day = dayNames[new Date(e.date).getDay()];
      dayTotals[day] = (dayTotals[day] ?? 0) + e.amount;
    });
    const topDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0];

    const uniqueDays = new Set(expenses.map((e) => e.date)).size;
    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
    const avgDaily = uniqueDays > 0 ? totalSpent / uniqueDays : 0;

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
      totalSpent,
      transactionCount: expenses.length,
    };
  }, [currentMonthExpenses]);

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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <Sparkles className="mr-2 inline-block h-8 w-8 text-accent" />
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
          Generate New Insights
        </Button>
      </div>

      {/* Quick Stats */}
      {quickStats && (
        <div>
          <h2 className="mb-4 text-xl font-semibold">Quick Stats</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:bg-muted/40">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Top Category
                    </p>
                    <p className="text-lg font-bold">
                      {quickStats.topCategory?.name ?? "—"}
                    </p>
                    <p className="text-sm text-primary">
                      {quickStats.topCategory
                        ? formatCurrency(quickStats.topCategory.amount)
                        : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:bg-muted/40">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <Calendar className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Busiest Day
                    </p>
                    <p className="text-lg font-bold">
                      {quickStats.topDay?.name ?? "—"}
                    </p>
                    <p className="text-sm text-accent">
                      {quickStats.topDay
                        ? formatCurrency(quickStats.topDay.amount)
                        : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:bg-muted/40">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <DollarSign className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Avg Daily Spend
                    </p>
                    <p className="text-lg font-bold">
                      {formatCurrency(quickStats.avgDaily)}
                    </p>
                    <p className="text-sm text-muted-foreground">this month</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:bg-muted/40">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Repeat className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Recurring
                    </p>
                    <p className="text-lg font-bold">
                      {formatCurrency(quickStats.recurring)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {quickStats.recurringCount} subscription{quickStats.recurringCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Separator className="bg-muted/50" />

      {/* AI Insights Grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-accent" />
            AI-Generated Insights
          </h2>
          {!loading && insights.length > 0 && insights[0].created_at && (
            <p className="text-xs text-muted-foreground/60">
              Generated{" "}
              {new Date(insights[0].created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card
                key={i}
                className="border-border/50 bg-card/50 backdrop-blur-sm"
              >
                <CardContent className="space-y-3 p-6">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : insights.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {insights.map((insight, idx) => {
                const meta = INSIGHT_META[insight.type] ?? INSIGHT_META.spending_summary;
                const Icon = meta.icon;
                return (
                  <div
                    key={idx}
                    className="group relative flex rounded-xl p-[1px] transition-all duration-300"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent/40 via-primary/20 to-transparent opacity-40 transition-opacity duration-300 group-hover:opacity-100" />
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
                          {localizeCurrencyMentions(insight.content, formatCurrency)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>

            {/* Full AI Analysis Report */}
            {insights.length >= 3 && (
              <>
                <Separator className="my-6 bg-muted/50" />
                <Card className="border-accent/20 bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-primary">
                        <Brain className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle>Full AI Analysis Report</CardTitle>
                        <CardDescription>
                          Comprehensive analysis of your spending patterns
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {insights.map((insight, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-accent/20 bg-accent/5 p-4"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {insight.type.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {localizeCurrencyMentions(insight.content, formatCurrency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        ) : (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
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
