"use client";

import { useMemo } from "react";
import {
  Sparkles,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Brain,
  DollarSign,
  Calendar,
  Repeat,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCurrency } from "@/components/currency-provider";
import { localizeCurrencyMentions } from "@/lib/localize-currency-text";

import { getDemoAIInsights, getDemoExpenses } from "@/lib/demo-data";
import { useHydrated } from "@/lib/use-hydrated";
import type { Expense } from "@/lib/types";

const DEMO_TOAST_TITLE = "Sign up for AI insights!";
const DEMO_TOAST_DESC = "Create a free account to get personalized AI-powered financial insights.";

function showDemoToast() {
  toast(DEMO_TOAST_TITLE, { description: DEMO_TOAST_DESC });
}

const DEMO_INSIGHTS = [
  {
    type: "spending_summary" as const,
    title: "Monthly Spending Overview",
    content: "You've spent $2,067.22 across 20 transactions this month. Food & Dining is your top category at $163.97, and overall budget adherence is strong at 78%.",
    icon: BarChart3,
    color: "text-primary",
    gradient: "from-primary/20 to-primary/5",
  },
  {
    type: "savings_tip" as const,
    title: "Streaming Consolidation",
    content: "Consolidating Netflix ($12.99) + Spotify ($15.99) into a bundle plan could save approximately $13/month — that's $156 per year!",
    icon: Lightbulb,
    color: "text-green-500",
    gradient: "from-green-500/20 to-green-500/5",
  },
  {
    type: "budget_alert" as const,
    title: "Shopping Budget Warning",
    content: "Shopping spending is at 97% of your $300 budget ($289.98 spent). Consider holding off on non-essential purchases for the rest of the month.",
    icon: AlertTriangle,
    color: "text-amber-700 dark:text-amber-400",
    gradient: "from-amber-500/20 to-amber-500/5",
  },
  {
    type: "trend_analysis" as const,
    title: "Grocery Savings Opportunity",
    content: "Your grocery spending at Whole Foods is premium. Switching some items to Costco could save 20-30%. You already shop there — consider buying more staples in bulk.",
    icon: TrendingUp,
    color: "text-accent",
    gradient: "from-accent/20 to-accent/5",
  },
  {
    type: "savings_tip" as const,
    title: "Transportation Optimization",
    content: "The Uber ride to the airport was $35. Airport shuttles average $15 — saving $20 per trip. With 2-3 airport trips per month, that's up to $60 in savings.",
    icon: Lightbulb,
    color: "text-green-500",
    gradient: "from-green-500/20 to-green-500/5",
  },
  {
    type: "spending_summary" as const,
    title: "Recurring Expense Audit",
    content: "You have $534.97/month in recurring expenses (Netflix, Spotify, gym, metro, groceries, utilities). This accounts for 26% of your total monthly spending.",
    icon: BarChart3,
    color: "text-primary",
    gradient: "from-primary/20 to-primary/5",
  },
];

export default function DemoInsightsPage() {
  const { format } = useCurrency();
  const hydrated = useHydrated();

  const expenses = useMemo(
    () => (hydrated ? (getDemoExpenses() as unknown as Expense[]) : []),
    [hydrated]
  );
  const demoInsights = useMemo(() => (hydrated ? getDemoAIInsights() : []), [hydrated]);

  /* Quick Stats computed from demo data */
  const quickStats = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    expenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
    });
    const topCategory = Object.entries(categoryTotals).sort(
      (a, b) => b[1] - a[1]
    )[0];

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayTotals: Record<string, number> = {};
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
      topCategory: topCategory ? { name: topCategory[0], amount: topCategory[1] } : null,
      topDay: topDay ? { name: topDay[0], amount: topDay[1] } : null,
      avgDaily,
      recurring: recurring.reduce((s, e) => s + e.amount, 0),
      oneTime: oneTime.reduce((s, e) => s + e.amount, 0),
      recurringCount: recurring.length,
      oneTimeCount: oneTime.length,
      totalSpent,
      transactionCount: expenses.length,
    };
  }, [expenses]);

  if (!hydrated) {
    return <div className="min-h-[60vh]" />;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              <Sparkles className="mr-2 inline-block h-8 w-8 text-accent" />
              AI Insights
            </h1>
            <Badge
            variant="outline"
            className="animate-pulse-glow border-amber-600/45 text-amber-800 dark:border-amber-400/40 dark:text-amber-400"
          >
              Demo
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            Personalized spending analysis powered by AI
          </p>
        </div>
        <Button
          onClick={showDemoToast}
          className="bg-gradient-to-r from-accent to-primary text-white hover:opacity-90"
        >
          <Brain className="mr-2 h-4 w-4" />
          Generate New Insights
        </Button>
      </div>

      {/* Quick Stats */}
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
                      ? format(quickStats.topCategory.amount)
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
                      ? format(quickStats.topDay.amount)
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
                    {format(quickStats.avgDaily)}
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
                    {format(quickStats.recurring)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {quickStats.recurringCount} subscriptions
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator className="bg-muted/50" />

      {/* AI Insights Grid */}
      <div>
        <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5 text-accent" />
          AI-Generated Insights
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_INSIGHTS.map((insight, idx) => {
            const Icon = insight.icon;
            return (
              <div
                key={idx}
                className="group relative flex rounded-xl p-[1px] transition-all duration-300"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                {/* Gradient border */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent/40 via-primary/20 to-transparent opacity-40 transition-opacity duration-300 group-hover:opacity-100" />
                <Card className="relative flex flex-col border-0 bg-card/80 backdrop-blur-sm w-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${insight.gradient}`}
                      >
                        <Icon className={`h-4 w-4 ${insight.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{insight.title}</CardTitle>
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          {insight.type.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {localizeCurrencyMentions(insight.content, format)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      <Separator className="bg-muted/50" />

      {/* Full AI Report */}
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
            {demoInsights.map((insight) => (
              <div
                key={insight.id}
                className="rounded-lg border border-accent/20 bg-accent/5 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {insight.insight_type.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {localizeCurrencyMentions(insight.content, format)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
