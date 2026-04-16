"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { useCurrency } from "@/components/currency-provider";
import type { AnalyticsData } from "@/lib/types";

type ChartView = "monthly" | "weekly";

interface ExpenseChartProps {
  data: AnalyticsData;
}

function getISOWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86_400_000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `W${week}`;
}

export function ExpenseChart({ data }: ExpenseChartProps) {
  const { format } = useCurrency();
  const [view, setView] = useState<ChartView>("monthly");

  const monthlyData = useMemo(
    () =>
      data.by_month.map((m) => ({
        label: new Date(m.month + "-01").toLocaleDateString("en-US", {
          month: "short",
        }),
        total: Math.round(m.total),
      })),
    [data.by_month]
  );

  const weeklyData = useMemo(() => {
    const weekMap: Record<string, number> = {};
    for (const d of data.by_day) {
      const key = getISOWeekLabel(d.date);
      weekMap[key] = (weekMap[key] ?? 0) + d.total;
    }
    return Object.entries(weekMap)
      .map(([label, total]) => ({ label, total: Math.round(total) }))
      .slice(-12);
  }, [data.by_day]);

  const chartData = view === "monthly" ? monthlyData : weeklyData;
  const hasData = monthlyData.length > 0 || weeklyData.length > 0;

  return (
    <Card className="border border-border bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Spending</CardTitle>
        {hasData && (
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
            <button
              onClick={() => setView("monthly")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                view === "monthly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setView("weekly")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                view === "weekly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Weekly
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
              <BarChart3 className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {view === "weekly"
                ? "No weekly data this month. Switch to Monthly or add expenses."
                : "No spending data yet. Add expenses to see your chart."}
            </p>
          </div>
        ) : (
        <div className="h-[300px] w-full min-w-0 overflow-x-auto">
          <div className={`h-full ${chartData.length > 8 ? "min-w-[500px]" : "w-full"}`}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                interval={0}
                angle={chartData.length > 8 ? -45 : 0}
                textAnchor={chartData.length > 8 ? "end" : "middle"}
                height={chartData.length > 8 ? 50 : 30}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickFormatter={(val) => format(val)}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--foreground)",
                }}
                cursor={{ fill: "var(--primary)", opacity: 0.15 }}
                formatter={(val) => [format(Number(val)), "Spent"]}
                labelFormatter={(label) =>
                  view === "weekly" ? `Week ${String(label).replace("W", "")}` : String(label)
                }
              />
              <Bar
                dataKey="total"
                fill={view === "weekly" ? "var(--accent)" : "var(--primary)"}
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
