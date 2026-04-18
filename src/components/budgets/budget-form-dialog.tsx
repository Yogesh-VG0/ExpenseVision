"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useCurrency } from "@/components/currency-provider";
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
  const { currency } = useCurrency();
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
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="max-h-[min(90dvh,32rem)] overflow-y-auto border-border bg-card backdrop-blur-xl sm:max-w-md">
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
                <>
                  {/* Native picker on small screens avoids dialog + portaled select glitches (scrollbar, slide-up). */}
                  <div className="relative md:hidden">
                    <select
                      className={cn(
                        "h-11 w-full cursor-pointer appearance-none rounded-lg border border-border bg-muted/30 py-2 pr-10 pl-3 text-sm text-foreground shadow-sm outline-none transition-colors",
                        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
                        "disabled:cursor-not-allowed disabled:opacity-50"
                      )}
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setErrors((prev) => ({ ...prev, category: undefined }));
                      }}
                      disabled={availableCategories.length === 0}
                      aria-invalid={errors.category ? true : undefined}
                    >
                      <option value="">Select category</option>
                      {availableCategories.map((cat) => (
                        <option key={cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                  <div className="hidden md:block">
                    <Select
                      value={category}
                      onValueChange={(val) => {
                        setCategory(val as string);
                        setErrors((prev) => ({ ...prev, category: undefined }));
                      }}
                    >
                      <SelectTrigger className="h-10 w-full border-border bg-muted/30">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent
                        className="max-h-60 border-border bg-card"
                        alignItemWithTrigger={false}
                        positionerClassName="z-[100]"
                      >
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
                  </div>
                </>
              )}
              {errors.category && (
                <p className="text-xs text-red-500">{errors.category}</p>
              )}
            </div>

            {/* Monthly Limit Input */}
            <div className="space-y-2">
              <Label>{`Monthly Limit (${currency})`}</Label>
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
