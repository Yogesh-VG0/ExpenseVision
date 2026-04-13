"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Receipt,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { CURRENCY_FORMATTER, DATE_FORMATTER, CATEGORY_COLORS } from "@/lib/constants";
import { CATEGORIES } from "@/lib/types";
import { DEMO_EXPENSES } from "@/lib/demo-data";
import type { Expense } from "@/lib/types";

type SortOption = "newest" | "oldest" | "highest" | "lowest";

const DEMO_TOAST_TITLE = "Sign up to save changes!";
const DEMO_TOAST_DESC = "Create a free account to track your expenses.";

function showDemoToast() {
  toast(DEMO_TOAST_TITLE, { description: DEMO_TOAST_DESC });
}

export default function DemoExpensesPage() {
  const expenses = DEMO_EXPENSES as unknown as Expense[];

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");

  const filtered = useMemo(() => {
    let list = [...expenses];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.vendor?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== "all") {
      list = list.filter((e) => e.category === categoryFilter);
    }

    if (dateFrom) list = list.filter((e) => e.date >= dateFrom);
    if (dateTo) list = list.filter((e) => e.date <= dateTo);

    switch (sort) {
      case "newest":
        list.sort((a, b) => b.date.localeCompare(a.date));
        break;
      case "oldest":
        list.sort((a, b) => a.date.localeCompare(b.date));
        break;
      case "highest":
        list.sort((a, b) => b.amount - a.amount);
        break;
      case "lowest":
        list.sort((a, b) => a.amount - b.amount);
        break;
    }

    return list;
  }, [expenses, search, categoryFilter, dateFrom, dateTo, sort]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, e) => s + e.amount, 0);
    return {
      count: filtered.length,
      total,
      average: filtered.length > 0 ? total / filtered.length : 0,
    };
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
            <Badge variant="outline" className="text-amber-400 border-amber-400/40 animate-pulse-glow">
              Demo
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Track and manage all your expenses
          </p>
        </div>
        <Button onClick={showDemoToast} className="gap-2">
          <Plus className="size-4" />
          Add Expense
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-border/50 bg-muted/30 backdrop-blur-md">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search vendor, description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-muted/30 border-border/50"
              />
            </div>

            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
              <SelectTrigger className="bg-muted/30 border-border/50">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="demo-date-from" className="text-xs text-muted-foreground">From</Label>
                <Input
                  id="demo-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-muted/30 border-border/50"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="demo-date-to" className="text-xs text-muted-foreground">To</Label>
                <Input
                  id="demo-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-muted/30 border-border/50"
                />
              </div>
            </div>

            <Select value={sort} onValueChange={(v) => v && setSort(v as SortOption)}>
              <SelectTrigger className="bg-muted/30 border-border/50">
                <ArrowUpDown className="mr-2 size-4 text-muted-foreground" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="highest">Highest Amount</SelectItem>
                <SelectItem value="lowest">Lowest Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-border/50 bg-muted/30 backdrop-blur-md">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total Expenses
            </p>
            <p className="text-2xl font-bold mt-1">{stats.count}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-muted/30 backdrop-blur-md">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total Amount
            </p>
            <p className="text-2xl font-bold mt-1 text-primary">
              {CURRENCY_FORMATTER.format(stats.total)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-muted/30 backdrop-blur-md">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Average
            </p>
            <p className="text-2xl font-bold mt-1">
              {CURRENCY_FORMATTER.format(stats.average)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table / Cards */}
      {filtered.length === 0 ? (
        <Card className="border-border/50 bg-muted/30 backdrop-blur-md">
          <CardContent className="py-16 text-center">
            <Receipt className="mx-auto size-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-semibold">No expenses found</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Try adjusting your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block border-border/50 bg-muted/30 backdrop-blur-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-muted/30">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Vendor</TableHead>
                  <TableHead className="text-muted-foreground">Category</TableHead>
                  <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                  <TableHead className="text-muted-foreground w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((expense) => (
                  <TableRow key={expense.id} className="border-border/50 hover:bg-muted/30">
                    <TableCell className="whitespace-nowrap text-sm">
                      {DATE_FORMATTER.format(new Date(expense.date))}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{expense.vendor || "—"}</p>
                        {expense.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {expense.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{
                          borderColor: CATEGORY_COLORS[expense.category] ?? "#64748B",
                          color: CATEGORY_COLORS[expense.category] ?? "#64748B",
                        }}
                      >
                        {expense.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {CURRENCY_FORMATTER.format(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
                            <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={showDemoToast}>
                            <Pencil className="mr-2 size-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={showDemoToast}
                          >
                            <Trash2 className="mr-2 size-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((expense) => (
              <Card key={expense.id} className="border-border/50 bg-muted/30 backdrop-blur-md">
                <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0"
                        style={{
                          borderColor: CATEGORY_COLORS[expense.category] ?? "#64748B",
                          color: CATEGORY_COLORS[expense.category] ?? "#64748B",
                        }}
                      >
                        {expense.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {DATE_FORMATTER.format(new Date(expense.date))}
                      </span>
                    </div>
                    <p className="font-medium text-sm mt-1 truncate">
                      {expense.vendor || "—"}
                    </p>
                    {expense.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {expense.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold tabular-nums">
                      {CURRENCY_FORMATTER.format(expense.amount)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
                          <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={showDemoToast}>
                          <Pencil className="mr-2 size-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={showDemoToast}
                        >
                          <Trash2 className="mr-2 size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
