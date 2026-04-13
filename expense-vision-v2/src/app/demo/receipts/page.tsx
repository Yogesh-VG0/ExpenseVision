"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  Camera,
  FileText,
  Check,
  Receipt,
  Sparkles,
  Eye,
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
import { Separator } from "@/components/ui/separator";
import { CURRENCY_FORMATTER, CATEGORY_COLORS } from "@/lib/constants";
import { DEMO_EXPENSES } from "@/lib/demo-data";

const DEMO_TOAST_TITLE = "Sign up to scan receipts!";
const DEMO_TOAST_DESC = "Create a free account to use AI receipt scanning.";

function showDemoToast() {
  toast(DEMO_TOAST_TITLE, { description: DEMO_TOAST_DESC });
}

// Simulate some "scanned" receipts from demo data
const DEMO_RECEIPTS = DEMO_EXPENSES.slice(0, 8).map((e, i) => ({
  ...e,
  confidence: [0.95, 0.88, 0.92, 0.97, 0.85, 0.91, 0.94, 0.89][i],
  scannedAt: new Date(Date.now() - i * 86400000).toLocaleDateString(),
}));

export default function DemoReceiptsPage() {
  const [selectedReceipt, setSelectedReceipt] = useState<(typeof DEMO_RECEIPTS)[0] | null>(null);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              <Camera className="mr-2 inline-block h-8 w-8 text-primary" />
              Receipt Scanner
            </h1>
            <Badge variant="outline" className="text-amber-400 border-amber-400/40 animate-pulse-glow">
              Demo
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            Upload receipts to automatically extract expense data with AI-powered OCR
          </p>
        </div>
      </div>

      {/* Upload Area */}
      <Card className="group border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-6">
          <div
            onClick={showDemoToast}
            className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-12 transition-all duration-300 hover:border-primary/50 hover:bg-muted/10"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 transition-transform duration-300 group-hover:scale-110">
              <Upload className="h-10 w-10 text-primary" />
            </div>
            <p className="mt-5 text-lg font-medium">
              Drop receipt or click to upload
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Supports JPG, PNG, GIF, WebP, and PDF up to 10 MB
            </p>
            <div className="mt-4 flex gap-2">
              <Badge variant="secondary" className="gap-1">
                <Camera className="h-3 w-3" />
                Camera
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <FileText className="h-3 w-3" />
                PDF
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                AI-Powered
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            step: "1",
            icon: Upload,
            title: "Upload Receipt",
            desc: "Take a photo or upload an image/PDF of your receipt",
          },
          {
            step: "2",
            icon: Sparkles,
            title: "AI Extracts Data",
            desc: "Our AI reads and extracts vendor, amount, date, and category",
          },
          {
            step: "3",
            icon: Check,
            title: "Save as Expense",
            desc: "Review the extracted data and save it as an expense with one click",
          },
        ].map((item, i) => (
          <Card
            key={item.step}
            className="border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:bg-muted/40"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator className="bg-muted/50" />

      {/* Recent Scanned Receipts */}
      <div>
        <h2 className="mb-4 text-xl font-semibold flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          Recently Scanned Receipts
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_RECEIPTS.map((receipt) => {
            const categoryColor = CATEGORY_COLORS[receipt.category] || "#64748B";
            return (
              <Card
                key={receipt.id}
                className="group/card border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:bg-muted/40 cursor-pointer"
                onClick={() => setSelectedReceipt(receipt)}
              >
                <CardContent className="p-5">
                  {/* Mock receipt thumbnail */}
                  <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-gradient-to-br from-white/5 to-white/[0.02] border border-border/50">
                    <FileText className="h-10 w-10 text-muted-foreground/40" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm truncate">
                        {receipt.vendor}
                      </p>
                      <Badge
                        variant="secondary"
                        className="text-[10px] shrink-0"
                        style={{ color: categoryColor }}
                      >
                        {receipt.category}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-lg font-bold text-primary">
                        {CURRENCY_FORMATTER.format(receipt.amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{receipt.date}</span>
                      <span className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-500" />
                        {Math.round(receipt.confidence * 100)}% match
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Selected Receipt Detail */}
      {selectedReceipt && (
        <Card className="border-accent/20 bg-card/50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Receipt Details</CardTitle>
              <CardDescription>
                Scanned from {selectedReceipt.vendor}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedReceipt(null)}>
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-accent/20 bg-accent/5 p-4">
                {[
                  { label: "Vendor", value: selectedReceipt.vendor },
                  { label: "Amount", value: CURRENCY_FORMATTER.format(selectedReceipt.amount), highlight: true },
                  { label: "Date", value: selectedReceipt.date },
                  { label: "Category", value: selectedReceipt.category },
                  { label: "Description", value: selectedReceipt.description },
                  { label: "Confidence", value: `${Math.round(selectedReceipt.confidence * 100)}%` },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className={`font-medium ${item.highlight ? "text-primary text-lg" : ""}`}>
                        {item.value}
                      </span>
                    </div>
                    {i < 5 && <Separator className="mt-3 bg-muted/50" />}
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border/50 bg-muted/10 p-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10">
                  <Eye className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Receipt image preview available in full version
                </p>
                <Button onClick={showDemoToast} size="sm">
                  Sign up to scan receipts
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
