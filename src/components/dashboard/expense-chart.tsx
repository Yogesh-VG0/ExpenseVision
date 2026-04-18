"use client";

import { useMemo, useState } from "react";
import { eachDayOfInterval, format as formatDate, startOfDay, subDays } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { useCurrency } from "@/components/currency-provider";
import type { AnalyticsData } from "@/lib/types";

type ChartView = "monthly" | "weekly";

interface ExpenseChartProps {
  data: AnalyticsData;
  isDemo?: boolean;
}

type ChartDatum = {
  label: string;
  fullLabel: string;
  total: number;
  /** Weekly only: day of month for narrow x-axis labels */
  compactLabel?: string;
};

function getLocalDateKey(date: Date) {
  return formatDate(date, "yyyy-MM-dd");
}

function getNiceStep(value: number) {
  if (value <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 2.5) return 2.5 * magnitude;
  if (normalized <= 5) return 5 * magnitude;

  return 10 * magnitude;
}

export function ExpenseChart({ data, isDemo = false }: ExpenseChartProps) {
  const { format } = useCurrency();
  const [view, setView] = useState<ChartView>("monthly");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const monthlyData = useMemo(
    () =>
      data.by_month.map((month) => ({
        label: new Date(`${month.month}-01T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
        }),
        fullLabel: new Date(`${month.month}-01T00:00:00`).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        total: Math.round(month.total * 100) / 100,
      } satisfies ChartDatum)),
    [data.by_month]
  );

  const weeklyData = useMemo(() => {
    const today = startOfDay(new Date());
    const dayTotals = new Map(
      data.by_day.map((entry) => [entry.date, Math.round(entry.total * 100) / 100])
    );

    return eachDayOfInterval({
      start: subDays(today, 6),
      end: today,
    }).map((day) => {
      const key = getLocalDateKey(day);

      return {
        label: formatDate(day, "MMM d"),
        compactLabel: formatDate(day, "d"),
        fullLabel: formatDate(day, "EEE, MMM d"),
        total: dayTotals.get(key) ?? 0,
      } satisfies ChartDatum;
    });
  }, [data.by_day]);

  const weeklyDisplayData = useMemo(() => {
    if (!isDemo || weeklyData.some((item) => item.total > 0)) {
      return weeklyData;
    }

    const fallbackSource = data.by_day
      .filter((item) => item.total > 0)
      .slice(-7)
      .map((item) => Math.round(item.total * 100) / 100);

    const seededTotals = [45.99, 164.5, 98.2, 222.4, 136.75, 189.4, 154.1];
    const source = fallbackSource.length > 0 ? fallbackSource : seededTotals;
    const paddedTotals = Array.from({ length: 7 }, (_, index) => {
      const startIndex = Math.max(source.length - 7, 0);
      return source[startIndex + index] ?? 0;
    });

    return eachDayOfInterval({
      start: subDays(startOfDay(new Date()), 6),
      end: startOfDay(new Date()),
    }).map((day, index) => ({
      label: formatDate(day, "MMM d"),
      compactLabel: formatDate(day, "d"),
      fullLabel: formatDate(day, "EEE, MMM d"),
      total: paddedTotals[index] ?? 0,
    } satisfies ChartDatum));
  }, [data.by_day, isDemo, weeklyData]);

  const chartData: ChartDatum[] = view === "monthly" ? monthlyData : weeklyDisplayData;
  const hasAnyData = monthlyData.some((item) => item.total > 0) || weeklyDisplayData.some((item) => item.total > 0);
  const hasVisibleData = chartData.some((item) => item.total > 0);

  const chartMetrics = useMemo(() => {
    const maxValue = Math.max(...chartData.map((item) => item.total), 0);
    const step = getNiceStep(maxValue / 4 || 1);
    const max = Math.max(step * 4, step);
    const ticks = Array.from({ length: 5 }, (_, index) => step * index).reverse();

    return { max, ticks };
  }, [chartData]);

  const n = chartData.length;

  return (
    <Card className="overflow-visible border border-border bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Spending</CardTitle>
        {hasAnyData && (
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setView("monthly");
                setActiveIndex(null);
              }}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                view === "monthly"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => {
                setView("weekly");
                setActiveIndex(null);
              }}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                view === "weekly"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Weekly
            </button>
          </div>
        )}
      </CardHeader>

      <CardContent className="overflow-visible">
        {!hasVisibleData ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
              <BarChart3 className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {view === "weekly"
                ? "No spending recorded in the last 7 days. Switch to Monthly or add expenses."
                : "No spending data yet. Add expenses to see your chart."}
            </p>
          </div>
        ) : (
          <div className="grid w-full min-w-0 grid-cols-[68px_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[78px_minmax(0,1fr)] sm:gap-4">
            <div className="relative h-[240px] shrink-0 pr-1.5 text-right sm:h-[260px] sm:pr-2">
              {chartMetrics.ticks.map((tick, index) => {
                const bottom = chartMetrics.max === 0 ? 0 : (tick / chartMetrics.max) * 100;

                return (
                  <div
                    key={`${tick}-${index}`}
                    className="absolute right-0 -translate-y-1/2 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground sm:text-xs"
                    style={{ bottom: `${bottom}%` }}
                  >
                    {format(tick)}
                  </div>
                );
              })}
            </div>

            <div className="min-w-0 space-y-3 overflow-visible">
              <div className="relative h-[240px] w-full min-w-0 overflow-visible sm:h-[260px]">
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                  {chartMetrics.ticks.map((tick, index) => (
                    <div
                      key={`grid-${tick}-${index}`}
                      className="border-t border-dashed border-border/70"
                    />
                  ))}
                </div>

                <div className="absolute inset-0 flex items-end gap-3 overflow-visible sm:gap-4">
                  {chartData.map((point, index) => {
                    const height = chartMetrics.max === 0 ? 0 : (point.total / chartMetrics.max) * 100;
                    const isActive = activeIndex === index;
                    const isFirst = index === 0;
                    const isLast = index === n - 1;

                    return (
                      <div key={point.fullLabel} className="relative flex h-full min-w-0 flex-1 items-end justify-center overflow-visible">
                        <div className="relative flex h-full w-full max-w-[46px] flex-col items-stretch justify-end overflow-visible">
                          {isActive && point.total > 0 && (
                            <div
                              className={`pointer-events-none absolute bottom-full z-30 mb-2 w-max max-w-[min(16rem,calc(100vw-2.25rem))] rounded-lg border border-border bg-card px-3 py-2 text-left shadow-xl ${
                                isFirst
                                  ? "left-0"
                                  : isLast
                                    ? "right-0 left-auto"
                                    : "left-1/2 -translate-x-1/2"
                              }`}
                            >
                              <p className="text-xs font-medium leading-snug text-foreground">{point.fullLabel}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Spent:{" "}
                                <span className="font-semibold tabular-nums text-foreground">
                                  {format(point.total)}
                                </span>
                              </p>
                            </div>
                          )}

                          <div
                            role="img"
                            aria-label={`${point.fullLabel}: ${format(point.total)}`}
                            className={`w-full shrink-0 rounded-t-[10px] transition-all duration-200 ${
                              point.total > 0
                                ? "cursor-pointer opacity-100 hover:brightness-110"
                                : isDemo && view === "weekly"
                                  ? "opacity-50"
                                  : "opacity-25"
                            } ${view === "weekly" ? "bg-accent" : "bg-primary"}`}
                            style={{
                              height: `${Math.max(height, point.total > 0 ? 6 : isDemo && view === "weekly" ? 4 : 0)}%`,
                            }}
                            onMouseEnter={() => point.total > 0 && setActiveIndex(index)}
                            onMouseLeave={() => activeIndex === index && setActiveIndex(null)}
                            onClick={() => point.total > 0 && setActiveIndex(activeIndex === index ? null : index)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 sm:gap-4">
                {chartData.map((point) => (
                  <div
                    key={`label-${point.fullLabel}`}
                    className="min-w-0 flex-1 text-center text-[11px] text-muted-foreground sm:text-sm"
                    title={view === "weekly" ? point.fullLabel : undefined}
                    aria-label={view === "weekly" ? point.fullLabel : undefined}
                  >
                    {view === "weekly" && point.compactLabel ? (
                      <>
                        <span aria-hidden className="block font-medium tabular-nums sm:hidden">
                          {point.compactLabel}
                        </span>
                        <span aria-hidden className="hidden truncate sm:block">
                          {point.label}
                        </span>
                      </>
                    ) : (
                      <span className="block truncate">{point.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
