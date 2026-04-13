"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  MoreHorizontal,
  Receipt,
  ArrowUpDown,
  Loader2,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { DATE_FORMATTER, CATEGORY_COLORS } from "@/lib/constants";
import { useCurrency } from "@/components/currency-provider";
import { CATEGORIES } from "@/lib/types";
import type { Expense } from "@/lib/types";

type SortOption = "newest" | "oldest" | "highest" | "lowest";

interface ExpensesClientProps {
  initialExpenses: Expense[];
}

export function ExpensesClient({ initialExpenses }: ExpensesClientProps) {
  const { format: formatCurrency } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------- filtering & sorting ----------
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

    if (dateFrom) {
      list = list.filter((e) => e.date >= dateFrom);
    }
    if (dateTo) {
      list = list.filter((e) => e.date <= dateTo);
    }

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

  // ---------- stats ----------
  const stats = useMemo(() => {
    const total = filtered.reduce((s, e) => s + e.amount, 0);
    return {
      count: filtered.length,
      total,
      average: filtered.length > 0 ? total / filtered.length : 0,
    };
  }, [filtered]);

  // ---------- CRUD helpers ----------
  async function handleSubmit(data: Record<string, unknown>) {
    try {
      if (editingExpense) {
        const res = await fetch(`/api/expenses/${editingExpense.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to update expense");
        const { expense: updated }: { expense: Expense } = await res.json();
        setExpenses((prev) =>
          prev.map((e) => (e.id === updated.id ? updated : e))
        );
        toast.success("Expense updated");
      } else {
        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to add expense");
        const { expense: created }: { expense: Expense } = await res.json();
        setExpenses((prev) => [created, ...prev]);
        toast.success("Expense added");
      }
      setFormOpen(false);
      setEditingExpense(null);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setExpenses((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      toast.success("Expense deleted");
    } catch {
      toast.error("Failed to delete expense");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense);
    setFormOpen(true);
  }

  function openAdd() {
    setEditingExpense(null);
    setFormOpen(true);
  }

  // ---------- render ----------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground text-sm">
            Track and manage all your expenses
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="size-4" />
          Add Expense
        </Button>
      </div>

      {/* Filters */}
      <Card className="border border-border bg-card/80 backdrop-blur-md">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search vendor, description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-muted/30 border-border"
              />
            </div>

            {/* Category */}
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
              <SelectTrigger className="bg-muted/30 border-border">
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

            {/* Date range */}
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-muted/30 border-border"
                placeholder="From"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-muted/30 border-border"
                placeholder="To"
              />
            </div>

            {/* Sort */}
            <Select
              value={sort}
              onValueChange={(v) => v && setSort(v as SortOption)}
            >
              <SelectTrigger className="bg-muted/30 border-border">
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
        <Card className="border-border bg-card/80 backdrop-blur-md">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total Expenses
            </p>
            <p className="text-2xl font-bold mt-1">{stats.count}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/80 backdrop-blur-md">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total Amount
            </p>
            <p className="text-2xl font-bold mt-1 text-primary">
              {formatCurrency(stats.total)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/80 backdrop-blur-md">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Average
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(stats.average)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table (md+) */}
      {filtered.length === 0 ? (
        <Card className="border-border bg-card/80 backdrop-blur-md">
          <CardContent className="py-16 text-center">
            <Receipt className="mx-auto size-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-semibold">No expenses found</h3>
            <p className="text-muted-foreground text-sm mt-1">
              {expenses.length === 0
                ? "Add your first expense to get started."
                : "Try adjusting your filters."}
            </p>
            {expenses.length === 0 && (
              <Button onClick={openAdd} className="mt-4 gap-2">
                <Plus className="size-4" /> Add Expense
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block border-border bg-card/80 backdrop-blur-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/30">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">
                    Vendor
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Category
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right">
                    Amount
                  </TableHead>
                  <TableHead className="text-muted-foreground w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((expense) => (
                  <TableRow
                    key={expense.id}
                    className="border-border hover:bg-muted/30"
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {DATE_FORMATTER.format(new Date(expense.date))}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">
                          {expense.vendor || "—"}
                        </p>
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
                          borderColor:
                            CATEGORY_COLORS[expense.category] ?? "#64748B",
                          color:
                            CATEGORY_COLORS[expense.category] ?? "#64748B",
                        }}
                      >
                        {expense.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
                            <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(expense)}>
                            <Pencil className="mr-2 size-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(expense)}
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
              <Card
                key={expense.id}
                className="border-border bg-card/80 backdrop-blur-md"
              >
                <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0"
                        style={{
                          borderColor:
                            CATEGORY_COLORS[expense.category] ?? "#64748B",
                          color:
                            CATEGORY_COLORS[expense.category] ?? "#64748B",
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
                      {formatCurrency(expense.amount)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
                          <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(expense)}>
                          <Pencil className="mr-2 size-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(expense)}
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

      {/* Add / Edit dialog */}
      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingExpense(null);
        }}
        expense={editingExpense}
        onSubmit={handleSubmit}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense
              {deleteTarget?.vendor ? ` from ${deleteTarget.vendor}` : ""}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
