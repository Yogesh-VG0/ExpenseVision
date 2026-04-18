"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CATEGORY_COLORS } from "@/lib/constants";
import { useCurrency } from "@/components/currency-provider";
import type { AnalyticsData } from "@/lib/types";

interface CategoryBreakdownProps {
  data: AnalyticsData;
}

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  const { format } = useCurrency();
  const chartData = data.by_category.map((c) => ({
    name: c.category,
    value: Math.round(c.total * 100) / 100,
    fill: CATEGORY_COLORS[c.category] || "#64748B",
  }));

  return (
    <Card className="border border-border bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
      <CardHeader>
        <CardTitle className="text-base">By Category</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
              <PieChartIcon className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              No spending data yet. Add expenses to see category breakdown.
            </p>
          </div>
        ) : (
        <div className="space-y-4">
          <div className="h-[240px] w-full min-w-0 sm:h-[300px]">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={{ width: 320, height: 300 }}
            >
            <PieChart accessibilityLayer={false}>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="56%"
                outerRadius="84%"
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--foreground)",
                }}
                formatter={(val) => [
                  format(Number(val)),
                  "Spent",
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {chartData.map((entry) => (
              <div
                key={entry.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.fill }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm text-muted-foreground">
                    {entry.name}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-medium">{format(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
