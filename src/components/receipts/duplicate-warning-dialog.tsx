"use client";

import {
  AlertTriangle,
  Calendar,
  DollarSign,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { DuplicateMatch } from "@/lib/duplicate-detection";

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: DuplicateMatch | null;
  onSaveAnyway: () => void;
  onCancel: () => void;
  saving?: boolean;
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  match,
  onSaveAnyway,
  onCancel,
  saving,
}: DuplicateWarningDialogProps) {
  if (!match?.matchDetails) return null;

  const confidencePct = Math.round(match.confidence * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-amber-500/30 bg-background/95 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            Possible duplicate detected
          </DialogTitle>
          <DialogDescription>
            This expense looks similar to one you&apos;ve already saved.
            Review the details below before deciding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Match confidence</span>
            <Badge
              variant="outline"
              className={
                confidencePct >= 90
                  ? "border-red-600/35 text-red-800 dark:border-red-500/30 dark:text-red-400"
                  : "border-amber-600/35 text-amber-800 dark:border-amber-500/30 dark:text-amber-400"
              }
            >
              {confidencePct}%
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Store className="h-4 w-4 text-muted-foreground" />
            <span>{match.matchDetails.vendor || "Unknown vendor"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span>{match.matchDetails.amount.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{match.matchDetails.date}</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={onSaveAnyway}
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Save anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
