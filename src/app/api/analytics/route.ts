import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AnalyticsData, Expense } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const now = new Date();
    const startDate = searchParams.get("start_date") ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const endDate = searchParams.get("end_date") ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

    // Fetch expenses in date range
    const { data: expenses, error: expError } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (expError) throw expError;

    const items: Expense[] = expenses ?? [];

    // Fetch budgets
    const { data: budgets, error: budError } = await supabase
      .from("budgets")
      .select("*")
      .eq("user_id", user.id);

    if (budError) throw budError;

    // Stats
    const total = items.reduce((sum, e) => sum + e.amount, 0);
    const count = items.length;
    const average = count > 0 ? total / count : 0;

    // By category
    const catMap = new Map<string, { total: number; count: number }>();
    for (const e of items) {
      const cur = catMap.get(e.category) ?? { total: 0, count: 0 };
      cur.total += e.amount;
      cur.count += 1;
      catMap.set(e.category, cur);
    }
    const by_category = Array.from(catMap.entries()).map(([category, v]) => ({
      category,
      total: Math.round(v.total * 100) / 100,
      count: v.count,
    }));

    // By month
    const monthMap = new Map<string, number>();
    for (const e of items) {
      const month = e.date.slice(0, 7); // YYYY-MM
      monthMap.set(month, (monthMap.get(month) ?? 0) + e.amount);
    }
    const by_month = Array.from(monthMap.entries()).map(([month, t]) => ({
      month,
      total: Math.round(t * 100) / 100,
    }));

    // By day
    const dayMap = new Map<string, number>();
    for (const e of items) {
      dayMap.set(e.date, (dayMap.get(e.date) ?? 0) + e.amount);
    }
    const by_day = Array.from(dayMap.entries()).map(([date, t]) => ({
      date,
      total: Math.round(t * 100) / 100,
    }));

    // Budget status
    const budget_status = (budgets ?? []).map((b) => {
      const spent = catMap.get(b.category)?.total ?? 0;
      return {
        category: b.category,
        spent: Math.round(spent * 100) / 100,
        limit: b.monthly_limit,
        percentage: b.monthly_limit > 0 ? Math.round((spent / b.monthly_limit) * 10000) / 100 : 0,
      };
    });

    // Top merchants
    const merchantMap = new Map<string, { total: number; count: number }>();
    for (const e of items) {
      const vendor = e.vendor ?? "Unknown";
      const cur = merchantMap.get(vendor) ?? { total: 0, count: 0 };
      cur.total += e.amount;
      cur.count += 1;
      merchantMap.set(vendor, cur);
    }
    const top_merchants = Array.from(merchantMap.entries())
      .map(([vendor, v]) => ({
        vendor,
        total: Math.round(v.total * 100) / 100,
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const analytics: AnalyticsData = {
      stats: {
        total: Math.round(total * 100) / 100,
        count,
        average: Math.round(average * 100) / 100,
      },
      by_category,
      by_month,
      by_day,
      budget_status,
      top_merchants,
    };

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return NextResponse.json({ error: "Failed to calculate analytics" }, { status: 500 });
  }
}
