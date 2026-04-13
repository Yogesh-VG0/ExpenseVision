"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES } from "@/lib/types";
import type { Budget } from "@/lib/types";

interface BudgetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: Budget | null;
  onSubmit: (data: { category: string; monthly_limit: number }) => Promise<void>;
  existingCategories: string[];
}

export function BudgetFormDialog({
  open,
  onOpenChange,
  budget,
  onSubmit,
  existingCategories,
}: BudgetFormDialogProps) {
  const isEditing = !!budget;
  const [category, setCategory] = useState<string>("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ category?: string; monthly_limit?: string }>({});

  // Reset form when dialog opens/closes or budget changes
  useEffect(() => {
    if (open) {
      setCategory(budget?.category || "");
      setMonthlyLimit(budget ? String(budget.monthly_limit) : "");
      setErrors({});
    }
  }, [open, budget]);

  // Available categories: all minus already budgeted (except current when editing)
  const availableCategories = CATEGORIES.filter((c) => {
    if (isEditing) return true;
    return !existingCategories.includes(c.name);
  });

  function validate(): boolean {
    const newErrors: typeof errors = {};

    if (!category) {
      newErrors.category = "Please select a category";
    }

    const limit = parseFloat(monthlyLimit);
    if (!monthlyLimit || isNaN(limit)) {
      newErrors.monthly_limit = "Please enter a valid amount";
    } else if (limit <= 0) {
      newErrors.monthly_limit = "Budget must be positive";
    } else if (limit > 999999.99) {
      newErrors.monthly_limit = "Budget too large";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        category,
        monthly_limit: parseFloat(monthlyLimit),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card backdrop-blur-xl sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Budget" : "Create Budget"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the monthly spending limit for this category."
                : "Set a monthly spending limit for a category."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Category Select */}
            <div className="space-y-2">
              <Label>Category</Label>
              {isEditing ? (
                <Input
                  value={budget.category}
                  disabled
                  className="border-border bg-muted/30"
                />
              ) : (
                <Select
                  value={category}
                  onValueChange={(val) => {
                    setCategory(val as string);
                    setErrors((prev) => ({ ...prev, category: undefined }));
                  }}
                >
                  <SelectTrigger className="w-full border-border bg-muted/30">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat.name} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                    {availableCategories.length === 0 && (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        All categories have budgets
                      </div>
                    )}
                  </SelectContent>
                </Select>
              )}
              {errors.category && (
                <p className="text-xs text-red-500">{errors.category}</p>
              )}
            </div>

            {/* Monthly Limit Input */}
            <div className="space-y-2">
              <Label>Monthly Limit ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="999999.99"
                placeholder="e.g. 500.00"
                value={monthlyLimit}
                onChange={(e) => {
                  setMonthlyLimit(e.target.value);
                  setErrors((prev) => ({ ...prev, monthly_limit: undefined }));
                }}
                className="border-border bg-muted/30"
              />
              {errors.monthly_limit && (
                <p className="text-xs text-red-500">{errors.monthly_limit}</p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/80"
            >
              {isSubmitting
                ? isEditing
                  ? "Saving…"
                  : "Creating…"
                : isEditing
                  ? "Save Changes"
                  : "Create Budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
