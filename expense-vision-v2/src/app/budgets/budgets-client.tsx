"use client";

import { useState } from "react";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertTriangle,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { BudgetFormDialog } from "@/components/budgets/budget-form-dialog";
import { CATEGORY_COLORS } from "@/lib/constants";
import { useCurrency } from "@/components/currency-provider";

import type { Budget, Category } from "@/lib/types";

interface BudgetsClientProps {
  initialBudgets: Budget[];
  spendingByCategory: Record<string, number>;
}

export function BudgetsClient({
  initialBudgets,
  spendingByCategory,
}: BudgetsClientProps) {
  const { format: formatCurrency } = useCurrency();
  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets);
  const spending = spendingByCategory;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const totalLimit = budgets.reduce((sum, b) => sum + b.monthly_limit, 0);
  const totalSpent = budgets.reduce(
    (sum, b) => sum + (spending[b.category] || 0),
    0
  );
  const totalRemaining = totalLimit - totalSpent;
  const totalPercentage = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

  const existingCategories = budgets.map((b) => b.category);

  function getProgressColor(percentage: number) {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  }

  async function handleAddBudget(data: {
    category: string;
    monthly_limit: number;
  }) {
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create budget");
      }
      const newBudget: Budget = (await res.json()).budget;
      setBudgets((prev) => [newBudget, ...prev]);
      setDialogOpen(false);
      toast.success("Budget created successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create budget"
      );
    }
  }

  async function handleEditBudget(data: {
    category: string;
    monthly_limit: number;
  }) {
    if (!editingBudget) return;
    try {
      const res = await fetch(`/api/budgets/${editingBudget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update budget");
      }
      const updated: Budget = (await res.json()).budget;
      setBudgets((prev) =>
        prev.map((b) => (b.id === updated.id ? updated : b))
      );
      setEditingBudget(null);
      toast.success("Budget updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update budget"
      );
    }
  }

  async function handleDeleteBudget() {
    if (!deletingBudget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/budgets/${deletingBudget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete budget");
      }
      setBudgets((prev) => prev.filter((b) => b.id !== deletingBudget.id));
      setDeleteDialogOpen(false);
      setDeletingBudget(null);
      toast.success("Budget deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete budget"
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
            <p className="text-muted-foreground">
              Set monthly spending limits and track your progress.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingBudget(null);
              setDialogOpen(true);
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/80"
          >
            <Plus className="mr-2 size-4" />
            Add Budget
          </Button>
        </div>

        {/* Summary Card */}
        <Card className="border-border bg-card/80 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                  <Target className="size-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Budget</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(totalLimit)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-accent/10">
                  <TrendingUp className="size-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(totalSpent)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div
                  className={`flex size-12 items-center justify-center rounded-xl ${
                    totalRemaining >= 0
                      ? "bg-emerald-500/10"
                      : "bg-red-500/10"
                  }`}
                >
                  <Wallet
                    className={`size-6 ${
                      totalRemaining >= 0
                        ? "text-emerald-500"
                        : "text-red-500"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Remaining</p>
                  <p
                    className={`text-2xl font-bold ${
                      totalRemaining < 0 ? "text-red-500" : ""
                    }`}
                  >
                    {formatCurrency(totalRemaining)}
                  </p>
                </div>
              </div>
            </div>
            {totalLimit > 0 && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Overall progress
                  </span>
                  <span className="font-medium">
                    {Math.min(totalPercentage, 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={Math.min(totalPercentage, 100)}>
                  <ProgressTrack className="h-2 bg-muted/50">
                    <ProgressIndicator
                      className={getProgressColor(totalPercentage)}
                    />
                  </ProgressTrack>
                </Progress>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget Cards Grid */}
        {budgets.length === 0 ? (
          <Card className="border-border bg-card/80 backdrop-blur-xl">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <Target className="size-8 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No budgets yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first budget to start tracking spending limits.
              </p>
              <Button
                onClick={() => {
                  setEditingBudget(null);
                  setDialogOpen(true);
                }}
                className="mt-4 bg-primary text-primary-foreground hover:bg-primary/80"
              >
                <Plus className="mr-2 size-4" />
                Add Budget
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {budgets.map((budget) => {
              const spent = spending[budget.category] || 0;
              const percentage =
                budget.monthly_limit > 0
                  ? (spent / budget.monthly_limit) * 100
                  : 0;
              const isOverBudget = percentage > 100;
              const categoryColor =
                CATEGORY_COLORS[budget.category] || "#64748B";

              return (
                <Card
                  key={budget.id}
                  className="border-border bg-card/80 backdrop-blur-xl transition-colors hover:bg-muted/40"
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex size-10 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${categoryColor}20` }}
                      >
                        <span
                          className="text-lg"
                          style={{ color: categoryColor }}
                        >
                          {getCategoryIconEmoji(budget.category)}
                        </span>
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          {budget.category}
                        </CardTitle>
                        {isOverBudget && (
                          <Badge
                            variant="destructive"
                            className="mt-1 gap-1 text-xs"
                          >
                            <AlertTriangle className="size-3" />
                            Over budget
                          </Badge>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingBudget(budget);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            setDeletingBudget(budget);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {formatCurrency(spent)} /{" "}
                          {formatCurrency(budget.monthly_limit)}
                        </span>
                        <Tooltip>
                          <TooltipTrigger render={
                            <span
                              className={`font-semibold ${
                                isOverBudget
                                  ? "text-red-500"
                                  : percentage >= 70
                                    ? "text-amber-500"
                                    : "text-emerald-500"
                              }`}
                            />
                          }>
                              {Math.min(percentage, 999).toFixed(0)}%
                          </TooltipTrigger>
                          <TooltipContent>
                            {isOverBudget
                              ? `Over by ${formatCurrency(spent - budget.monthly_limit)}`
                              : `${formatCurrency(budget.monthly_limit - spent)} remaining`}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Progress value={Math.min(percentage, 100)}>
                        <ProgressTrack className="h-2 bg-muted/50">
                          <ProgressIndicator
                            className={getProgressColor(percentage)}
                          />
                        </ProgressTrack>
                      </Progress>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add / Edit Dialog */}
        <BudgetFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingBudget(null);
          }}
          budget={editingBudget}
          onSubmit={editingBudget ? handleEditBudget : handleAddBudget}
          existingCategories={existingCategories}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setDeletingBudget(null);
          }}
        >
          <DialogContent className="border-border bg-card backdrop-blur-xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Budget</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the budget for{" "}
                <span className="font-semibold text-foreground">
                  {deletingBudget?.category}
                </span>
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeletingBudget(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteBudget}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

/** Simple category → emoji helper to avoid dynamic Lucide imports */
function getCategoryIconEmoji(category: Category): string {
  const map: Record<Category, string> = {
    "Food & Dining": "🍽️",
    Transportation: "🚗",
    Shopping: "🛒",
    Entertainment: "🎬",
    "Bills & Utilities": "🧾",
    Healthcare: "❤️",
    Education: "🎓",
    Travel: "✈️",
    Groceries: "🍎",
    Other: "📦",
  };
  return map[category] || "📦";
}
