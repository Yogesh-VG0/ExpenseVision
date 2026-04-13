"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Camera,
  Check,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { DATE_FORMATTER } from "@/lib/constants";
import { useCurrency } from "@/components/currency-provider";
import type { Expense, OCRResult } from "@/lib/types";

interface ReceiptsClientProps {
  initialReceipts: Expense[];
}

export function ReceiptsClient({ initialReceipts }: ReceiptsClientProps) {
  const { format: formatCurrency } = useCurrency();
  const [receipts, setReceipts] = useState<Expense[]>(initialReceipts);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<Expense | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Please upload an image or PDF file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10 MB");
      return;
    }

    // Show preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    setUploading(true);
    setOcrResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("OCR processing failed");

      const data: OCRResult = await res.json();
      setOcrResult(data);
      toast.success("Receipt scanned successfully");
    } catch {
      toast.error("Failed to scan receipt. Please try again.");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const saveAsExpense = async () => {
    if (!ocrResult) return;
    setSaving(true);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: ocrResult.amount ?? 0,
          vendor: ocrResult.vendor ?? "Unknown",
          category: ocrResult.category ?? "Other",
          description: ocrResult.description ?? "",
          date: ocrResult.date ?? new Date().toISOString().split("T")[0],
          is_recurring: false,
        }),
      });

      if (!res.ok) throw new Error("Failed to save expense");

      const { expense: newExpense }: { expense: Expense } = await res.json();
      setReceipts((prev) => [newExpense, ...prev]);
      setOcrResult(null);
      setPreview(null);
      toast.success("Expense saved from receipt!");
    } catch {
      toast.error("Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const clearScan = () => {
    setOcrResult(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          <Camera className="mr-2 inline-block h-6 w-6 text-primary" />
          Receipt Scanner
        </h1>
        <p className="mt-1 text-muted-foreground">
          Upload receipts to automatically extract expense data with OCR
        </p>
      </div>

      {/* Upload Area */}
      <Card className="border-border bg-card/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/10"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleInputChange}
              className="hidden"
            />
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="mt-4 text-lg font-medium">
              Drop receipt or click to upload
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Supports JPG, PNG, GIF, WebP, and PDF up to 10 MB
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Scanning / OCR Result */}
      {(uploading || ocrResult || preview) && (
        <Card className="border-border bg-card/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>
                {uploading ? "Scanning Receipt..." : "Scan Result"}
              </CardTitle>
              <CardDescription>
                {uploading
                  ? "Extracting data from your receipt"
                  : "Review extracted data and save as expense"}
              </CardDescription>
            </div>
            {!uploading && (
              <Button variant="ghost" size="icon" onClick={clearScan}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {uploading ? (
              <div className="space-y-4">
                <Skeleton className="h-48 w-full rounded-lg" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {/* Preview */}
                {preview && (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <Image
                      src={preview}
                      alt="Receipt preview"
                      width={400}
                      height={288}
                      className="h-full max-h-72 w-full object-contain"
                      unoptimized
                    />
                  </div>
                )}

                {/* Extracted Data */}
                {ocrResult && (
                  <div className="space-y-4">
                    <div className="space-y-3 rounded-lg border border-accent/20 bg-accent/5 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Vendor
                        </span>
                        <span className="font-medium">
                          {ocrResult.vendor ?? "—"}
                        </span>
                      </div>
                      <Separator className="bg-muted/50" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Amount
                        </span>
                        <span className="text-lg font-bold text-primary">
                          {ocrResult.amount != null
                            ? formatCurrency(ocrResult.amount)
                            : "—"}
                        </span>
                      </div>
                      <Separator className="bg-muted/50" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Date
                        </span>
                        <span className="font-medium">
                          {ocrResult.date ?? "—"}
                        </span>
                      </div>
                      <Separator className="bg-muted/50" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Category
                        </span>
                        <Badge variant="secondary">
                          {ocrResult.category ?? "Other"}
                        </Badge>
                      </div>
                      <Separator className="bg-muted/50" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Confidence
                        </span>
                        <Badge
                          variant={
                            ocrResult.confidence >= 0.8
                              ? "default"
                              : "secondary"
                          }
                          className={
                            ocrResult.confidence >= 0.8
                              ? "bg-green-500/20 text-green-500"
                              : ""
                          }
                        >
                          {Math.round(ocrResult.confidence * 100)}%
                        </Badge>
                      </div>
                    </div>

                    <Button
                      onClick={saveAsExpense}
                      disabled={saving}
                      className="w-full bg-gradient-to-r from-primary to-accent text-white hover:opacity-90"
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Save as Expense
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Past Receipts */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Past Receipts</h2>
        {receipts.length === 0 ? (
          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-lg font-medium">No receipts yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload your first receipt to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {receipts.map((receipt) => (
              <Card
                key={receipt.id}
                onClick={() => setViewReceipt(receipt)}
                className="cursor-pointer border-border bg-card/80 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <CardContent className="p-4">
                  <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
                    {receipt.receipt_url ? (
                      <Image
                        src={receipt.receipt_url}
                        alt="Receipt"
                        width={300}
                        height={128}
                        className="h-full w-full object-cover"
                        unoptimized
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (
                            e.target as HTMLImageElement
                          ).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <FileText className={`h-10 w-10 text-muted-foreground ${receipt.receipt_url ? "hidden" : ""}`} />
                  </div>
                  <p className="truncate font-medium">
                    {receipt.vendor ?? "Unknown"}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-primary">
                      {formatCurrency(receipt.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {DATE_FORMATTER.format(new Date(receipt.date))}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Full Receipt Dialog */}
      <Dialog
        open={!!viewReceipt}
        onOpenChange={(open) => !open && setViewReceipt(null)}
      >
        <DialogContent className="border-border bg-card/95 backdrop-blur-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewReceipt?.vendor ?? "Receipt"}</DialogTitle>
            <DialogDescription>
              {viewReceipt &&
                `${formatCurrency(viewReceipt.amount)} • ${DATE_FORMATTER.format(new Date(viewReceipt.date))}`}
            </DialogDescription>
          </DialogHeader>
          {viewReceipt?.receipt_url && (
            <div className="overflow-hidden rounded-lg border border-border">
              <Image
                src={viewReceipt.receipt_url}
                alt="Full receipt"
                width={480}
                height={640}
                className="w-full object-contain"
                unoptimized
              />
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{viewReceipt?.category}</Badge>
            {viewReceipt?.description && (
              <span className="truncate">{viewReceipt.description}</span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
