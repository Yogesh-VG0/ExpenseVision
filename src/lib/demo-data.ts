import { format as formatDate } from "date-fns";
import type { Expense, Budget, AnalyticsData, AIInsight } from "./types";

function createDateStr(baseDate: Date, daysAgo: number): string {
  const d = new Date(baseDate);
  d.setDate(d.getDate() - daysAgo);
  return formatDate(d, "yyyy-MM-dd");
}

export function getDemoExpenses(baseDate = new Date()): Omit<Expense, "user_id">[] {
  const dateStr = (daysAgo: number) => createDateStr(baseDate, daysAgo);

  return [
    { id: "demo-1", amount: 45.99, category: "Food & Dining", description: "Dinner at Olive Garden", vendor: "Olive Garden", date: dateStr(0), tags: ["dinner", "restaurant"], is_recurring: false, receipt_url: null, created_at: dateStr(0), updated_at: dateStr(0) },
    { id: "demo-2", amount: 156.30, category: "Groceries", description: "Weekly grocery shopping", vendor: "Whole Foods", date: dateStr(1), tags: ["groceries", "weekly"], is_recurring: true, receipt_url: null, created_at: dateStr(1), updated_at: dateStr(1) },
    { id: "demo-3", amount: 35.00, category: "Transportation", description: "Uber ride to airport", vendor: "Uber", date: dateStr(2), tags: ["ride", "airport"], is_recurring: false, receipt_url: null, created_at: dateStr(2), updated_at: dateStr(2) },
    { id: "demo-4", amount: 12.99, category: "Entertainment", description: "Netflix subscription", vendor: "Netflix", date: dateStr(3), tags: ["streaming", "subscription"], is_recurring: true, receipt_url: null, created_at: dateStr(3), updated_at: dateStr(3) },
    { id: "demo-5", amount: 89.99, category: "Shopping", description: "New running shoes", vendor: "Nike", date: dateStr(4), tags: ["shoes", "fitness"], is_recurring: false, receipt_url: null, created_at: dateStr(4), updated_at: dateStr(4) },
    { id: "demo-6", amount: 120.00, category: "Bills & Utilities", description: "Electric bill", vendor: "ConEdison", date: dateStr(5), tags: ["electric", "monthly"], is_recurring: true, receipt_url: null, created_at: dateStr(5), updated_at: dateStr(5) },
    { id: "demo-7", amount: 250.00, category: "Healthcare", description: "Dentist checkup", vendor: "Bright Smile Dental", date: dateStr(7), tags: ["dental", "health"], is_recurring: false, receipt_url: null, created_at: dateStr(7), updated_at: dateStr(7) },
    { id: "demo-8", amount: 49.99, category: "Education", description: "Udemy course - React Advanced", vendor: "Udemy", date: dateStr(8), tags: ["course", "programming"], is_recurring: false, receipt_url: null, created_at: dateStr(8), updated_at: dateStr(8) },
    { id: "demo-9", amount: 340.00, category: "Travel", description: "Flight to San Francisco", vendor: "United Airlines", date: dateStr(10), tags: ["flight", "business"], is_recurring: false, receipt_url: null, created_at: dateStr(10), updated_at: dateStr(10) },
    { id: "demo-10", amount: 8.50, category: "Food & Dining", description: "Morning coffee & pastry", vendor: "Starbucks", date: dateStr(1), tags: ["coffee", "breakfast"], is_recurring: false, receipt_url: null, created_at: dateStr(1), updated_at: dateStr(1) },
    { id: "demo-11", amount: 65.00, category: "Transportation", description: "Monthly metro pass", vendor: "Metro Transit", date: dateStr(12), tags: ["metro", "commute"], is_recurring: true, receipt_url: null, created_at: dateStr(12), updated_at: dateStr(12) },
    { id: "demo-12", amount: 22.50, category: "Food & Dining", description: "Lunch with colleagues", vendor: "Chipotle", date: dateStr(3), tags: ["lunch", "work"], is_recurring: false, receipt_url: null, created_at: dateStr(3), updated_at: dateStr(3) },
    { id: "demo-13", amount: 199.99, category: "Shopping", description: "Wireless headphones", vendor: "Amazon", date: dateStr(14), tags: ["electronics", "audio"], is_recurring: false, receipt_url: null, created_at: dateStr(14), updated_at: dateStr(14) },
    { id: "demo-14", amount: 85.00, category: "Bills & Utilities", description: "Internet service", vendor: "Comcast", date: dateStr(15), tags: ["internet", "monthly"], is_recurring: true, receipt_url: null, created_at: dateStr(15), updated_at: dateStr(15) },
    { id: "demo-15", amount: 15.99, category: "Entertainment", description: "Spotify Premium", vendor: "Spotify", date: dateStr(16), tags: ["music", "subscription"], is_recurring: true, receipt_url: null, created_at: dateStr(16), updated_at: dateStr(16) },
    { id: "demo-16", amount: 42.00, category: "Food & Dining", description: "Thai food delivery", vendor: "DoorDash", date: dateStr(5), tags: ["delivery", "dinner"], is_recurring: false, receipt_url: null, created_at: dateStr(5), updated_at: dateStr(5) },
    { id: "demo-17", amount: 75.00, category: "Healthcare", description: "Gym membership", vendor: "Planet Fitness", date: dateStr(18), tags: ["gym", "fitness"], is_recurring: true, receipt_url: null, created_at: dateStr(18), updated_at: dateStr(18) },
    { id: "demo-18", amount: 130.00, category: "Groceries", description: "Costco bulk shopping", vendor: "Costco", date: dateStr(8), tags: ["bulk", "groceries"], is_recurring: false, receipt_url: null, created_at: dateStr(8), updated_at: dateStr(8) },
    { id: "demo-19", amount: 55.00, category: "Entertainment", description: "Concert tickets", vendor: "Ticketmaster", date: dateStr(20), tags: ["concert", "entertainment"], is_recurring: false, receipt_url: null, created_at: dateStr(20), updated_at: dateStr(20) },
    { id: "demo-20", amount: 28.99, category: "Food & Dining", description: "Pizza night", vendor: "Dominos", date: dateStr(6), tags: ["pizza", "dinner"], is_recurring: false, receipt_url: null, created_at: dateStr(6), updated_at: dateStr(6) },
  ];
}

export function getDemoBudgets(baseDate = new Date()): Omit<Budget, "user_id">[] {
  const dateStr = (daysAgo: number) => createDateStr(baseDate, daysAgo);
  const spendingByCategory = getDemoExpenses(baseDate).reduce<Record<string, number>>(
    (totals, expense) => {
      totals[expense.category] = (totals[expense.category] ?? 0) + expense.amount;
      return totals;
    },
    {}
  );

  return [
    { id: "bud-1", category: "Food & Dining", monthly_limit: 500, spent: Math.round((spendingByCategory["Food & Dining"] ?? 0) * 100) / 100, created_at: dateStr(30) },
    { id: "bud-2", category: "Transportation", monthly_limit: 200, spent: Math.round((spendingByCategory.Transportation ?? 0) * 100) / 100, created_at: dateStr(30) },
    { id: "bud-3", category: "Shopping", monthly_limit: 300, spent: Math.round((spendingByCategory.Shopping ?? 0) * 100) / 100, created_at: dateStr(30) },
    { id: "bud-4", category: "Entertainment", monthly_limit: 150, spent: Math.round((spendingByCategory.Entertainment ?? 0) * 100) / 100, created_at: dateStr(30) },
    { id: "bud-5", category: "Bills & Utilities", monthly_limit: 350, spent: Math.round((spendingByCategory["Bills & Utilities"] ?? 0) * 100) / 100, created_at: dateStr(30) },
    { id: "bud-6", category: "Groceries", monthly_limit: 400, spent: Math.round((spendingByCategory.Groceries ?? 0) * 100) / 100, created_at: dateStr(30) },
    { id: "bud-7", category: "Healthcare", monthly_limit: 500, spent: Math.round((spendingByCategory.Healthcare ?? 0) * 100) / 100, created_at: dateStr(30) },
  ];
}

export function getDemoAIInsights(baseDate = new Date()): AIInsight[] {
  const dateStr = (daysAgo: number) => createDateStr(baseDate, daysAgo);

  return [
    {
      id: "insight-1",
      user_id: "demo",
      insight_type: "spending_summary",
      content: "You've spent $2,067.22 across 20 transactions this month. Food & Dining is your largest category at $163.97 (8% of total), well within your $500 budget.",
      data: { total: 2067.22, transactions: 20, top_category: "Food & Dining" },
      created_at: dateStr(0),
    },
    {
      id: "insight-2",
      user_id: "demo",
      insight_type: "budget_alert",
      content: "Shopping is at 97% of budget ($289.98 of $300). Consider holding off on non-essential purchases for the rest of the month to stay within limits.",
      data: { category: "Shopping", spent: 289.98, limit: 300, percentage: 97 },
      created_at: dateStr(0),
    },
    {
      id: "insight-3",
      user_id: "demo",
      insight_type: "savings_tip",
      content: "Consolidating streaming services could save ~$13/month. Switching some grocery items from Whole Foods to Costco could save 20-30% on your $286.30 monthly grocery bill.",
      data: { potential_savings: 70 },
      created_at: dateStr(0),
    },
    {
      id: "insight-4",
      user_id: "demo",
      insight_type: "trend_analysis",
      content: "Your recurring expenses total $534.97/month across Netflix, Spotify, gym, metro pass, groceries, and utilities. Budget adherence is strong at 78% average across all categories.",
      data: { recurring_total: 534.97, avg_adherence: 78 },
      created_at: dateStr(0),
    },
  ];
}

export function getDemoAnalytics(baseDate = new Date()): AnalyticsData {
  const expenses = getDemoExpenses(baseDate);
  const budgets = getDemoBudgets(baseDate);
  const thisMonth = baseDate.getMonth();
  const thisYear = baseDate.getFullYear();
  const dateStr = (daysAgo: number) => createDateStr(baseDate, daysAgo);
  
  const byCategory = Object.entries(
    expenses.reduce((acc, e) => {
      if (!acc[e.category]) acc[e.category] = { total: 0, count: 0 };
      acc[e.category].total += e.amount;
      acc[e.category].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>)
  ).map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.total - a.total);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const monthMultipliers = [0.82, 0.91, 1.05, 0.78, 0.95, 1.0];
  const byMonth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(thisYear, thisMonth - i, 1);
    const month = d.toISOString().slice(0, 7);
    const monthTotal = i === 0 ? total : total * monthMultipliers[i];
    return { month, total: Math.round(monthTotal * 100) / 100 };
  }).reverse();

  const byDay = Array.from({ length: 30 }, (_, i) => {
    const dayKey = dateStr(29 - i);
    const dayExpenses = expenses.filter((e) => e.date === dayKey);
    const dayTotal = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
    return { date: dayKey, total: dayTotal };
  });

  const budgetStatus = budgets.map(b => ({
    category: b.category,
    spent: b.spent,
    limit: b.monthly_limit,
    percentage: Math.round((b.spent / b.monthly_limit) * 100),
  }));

  const topMerchants = Object.entries(
    expenses.reduce((acc, e) => {
      const v = e.vendor || "Unknown";
      if (!acc[v]) acc[v] = { total: 0, count: 0 };
      acc[v].total += e.amount;
      acc[v].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>)
  ).map(([vendor, data]) => ({ vendor, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    by_category: byCategory,
    by_month: byMonth,
    by_day: byDay,
    stats: { total, count: expenses.length, average: Math.round((total / expenses.length) * 100) / 100 },
    budget_status: budgetStatus,
    top_merchants: topMerchants,
  };
}

export const DEMO_EXPENSES = getDemoExpenses();
export const DEMO_BUDGETS = getDemoBudgets();
export const DEMO_AI_INSIGHTS = getDemoAIInsights();
