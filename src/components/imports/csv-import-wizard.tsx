"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Upload,
  AlertTriangle,
  X,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  parseCSVString,
  mapAndValidateRows,
  autoDetectMapping,
  type ColumnMapping,
  type ParsedRow,
} from "@/lib/csv-parser";
import { trackEvent } from "@/lib/telemetry";

type WizardStep = "upload" | "mapping" | "preview" | "importing" | "results";

const CSV_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const CSV_MAX_ROWS = 5000;

interface ImportResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export function CSVImportWizard() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [validatedRows, setValidatedRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Step 1: Upload ─────────────────────────────────────────────────
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
        toast.error("Please select a CSV file");
        return;
      }

      if (file.size > CSV_MAX_FILE_BYTES) {
        toast.error(`CSV file is too large. Maximum size is ${CSV_MAX_FILE_BYTES / (1024 * 1024)} MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const { headers: h, rows: r } = parseCSVString(text);

        if (h.length === 0 || r.length === 0) {
          toast.error("CSV appears to be empty or invalid");
          return;
        }

        if (r.length > CSV_MAX_ROWS) {
          toast.error(`CSV has ${r.length.toLocaleString()} rows. Maximum is ${CSV_MAX_ROWS.toLocaleString()} rows per import.`);
          return;
        }

        setHeaders(h);
        setRawRows(r);
        setMapping(autoDetectMapping(h));
        setStep("mapping");
        void trackEvent("csv_import_start", { rows: r.length, columns: h.length });
      };
      reader.onerror = () => toast.error("Failed to read file");
      reader.readAsText(file);
    },
    []
  );

  // ── Step 2: Mapping ────────────────────────────────────────────────
  const updateMapping = (field: keyof ColumnMapping, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value }));
  };

  const isMappingComplete =
    mapping.date && mapping.amount && mapping.description;

  const handleConfirmMapping = () => {
    const fullMapping: ColumnMapping = {
      date: mapping.date!,
      amount: mapping.amount!,
      description: mapping.description ?? "",
      vendor: mapping.vendor ?? "",
      category: mapping.category ?? "",
    };

    const validated = mapAndValidateRows(rawRows, fullMapping);
    setValidatedRows(validated);
    setStep("preview");
  };

  // ── Step 3: Preview ────────────────────────────────────────────────
  const validRows = useMemo(
    () => validatedRows.filter((r) => r.errors.length === 0),
    [validatedRows]
  );
  const errorRows = useMemo(
    () => validatedRows.filter((r) => r.errors.length > 0),
    [validatedRows]
  );

  // ── Step 4: Import ─────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    setStep("importing");
    setProgress(0);

    const results: ImportResult = {
      total: validRows.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      if (!row.mapped) continue;

      try {
        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: row.mapped.amount,
            vendor: row.mapped.vendor || undefined,
            category: row.mapped.category || "Other",
            description: row.mapped.description || "",
            date: row.mapped.date,
            is_recurring: false,
            idempotency_key: `csv-import-${row.rowIndex}-${row.mapped.date}-${row.mapped.amount}`,
          }),
        });

        if (res.ok || res.status === 200 || res.status === 201) {
          results.succeeded++;
        } else {
          const data = await res.json().catch(() => ({}));
          results.failed++;
          results.errors.push({
            row: row.rowIndex + 1,
            error: data.error || `Status ${res.status}`,
          });
        }
      } catch (err) {
        results.failed++;
        results.errors.push({
          row: row.rowIndex + 1,
          error: err instanceof Error ? err.message : "Network error",
        });
      }

      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setImportResult(results);
    setStep("results");

    void trackEvent(
      results.failed === 0 ? "csv_import_success" : "csv_import_failure",
      {
        total: results.total,
        succeeded: results.succeeded,
        failed: results.failed,
      }
    );
  }, [validRows]);

  // ── Reset ──────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep("upload");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setValidatedRows([]);
    setImportResult(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Expenses</h1>
        <p className="text-muted-foreground">
          Upload a CSV file from your bank or financial app
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "mapping", "preview", "importing", "results"] as const).map(
          (s, idx) => (
            <div key={s} className="flex items-center gap-2">
              {idx > 0 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              )}
              <Badge
                variant={step === s ? "default" : "outline"}
                className={step === s ? "" : "text-muted-foreground"}
              >
                {idx + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </Badge>
            </div>
          )
        )}
      </div>

      {/* ── Upload Step ──────────────────────────────────────────────── */}
      {step === "upload" && (
        <Card className="border-border bg-background/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload CSV
            </CardTitle>
            <CardDescription>
              Select a CSV file containing your expense data. The first row
              should contain column headers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              htmlFor="csv_upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-12 transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-sm font-medium">
                Drop your CSV here or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Supports CSV exports from most banks and financial apps
              </p>
              <input
                id="csv_upload"
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={handleFileSelect}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* ── Mapping Step ─────────────────────────────────────────────── */}
      {step === "mapping" && (
        <Card className="border-border bg-background/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <CardDescription>
              Match your CSV columns to expense fields. We&apos;ve auto-detected
              what we could.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {([
                { field: "date" as const, label: "Date *", required: true },
                { field: "amount" as const, label: "Amount *", required: true },
                { field: "description" as const, label: "Description *", required: true },
                { field: "vendor" as const, label: "Vendor", required: false },
                { field: "category" as const, label: "Category", required: false },
              ]).map(({ field, label }) => (
              <div key={field} className="space-y-1.5">
                <Label>{label}</Label>
                <Select
                  value={mapping[field] || ""}
                  onValueChange={(v: string | null) => v && updateMapping(field, v)}
                >
                  <SelectTrigger className="border-border bg-muted/30">
                    <SelectValue placeholder={`Select ${field} column...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleReset}>
                <ChevronLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleConfirmMapping}
                disabled={!isMappingComplete}
              >
                Preview data
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Preview Step ─────────────────────────────────────────────── */}
      {step === "preview" && (
        <div className="space-y-4">
          <Card className="border-border bg-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Preview & Validate</CardTitle>
              <CardDescription>
                {validRows.length} valid row{validRows.length === 1 ? "" : "s"} ready to import
                {errorRows.length > 0 && (
                  <span className="text-destructive">
                    {" · "}{errorRows.length} row{errorRows.length === 1 ? "" : "s"} with errors
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Valid rows preview (first 10) */}
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Amount</th>
                      <th className="px-3 py-2 text-left font-medium">Vendor</th>
                      <th className="px-3 py-2 text-left font-medium">Category</th>
                      <th className="px-3 py-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 10).map((row) => (
                      <tr key={row.rowIndex} className="border-b border-border/50">
                        <td className="px-3 py-2 whitespace-nowrap">{row.mapped!.date}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.mapped!.amount.toFixed(2)}</td>
                        <td className="px-3 py-2 truncate max-w-[150px]">{row.mapped!.vendor || "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs">
                            {row.mapped!.category}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 truncate max-w-[200px]">{row.mapped!.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validRows.length > 10 && (
                  <div className="border-t border-border bg-muted/20 px-3 py-2 text-center text-xs text-muted-foreground">
                    ...and {validRows.length - 10} more rows
                  </div>
                )}
              </div>

              {/* Error rows */}
              {errorRows.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Rows with errors (will be skipped)
                  </p>
                  <div className="space-y-1.5">
                    {errorRows.slice(0, 5).map((row) => (
                      <div
                        key={row.rowIndex}
                        className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs"
                      >
                        <X className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <span>
                          Row {row.rowIndex + 1}: {row.errors.join(", ")}
                        </span>
                      </div>
                    ))}
                    {errorRows.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        ...and {errorRows.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Separator className="my-4" />

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  <ChevronLeft className="mr-1.5 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleImport} disabled={validRows.length === 0}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Import {validRows.length} expense{validRows.length === 1 ? "" : "s"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Importing Step ───────────────────────────────────────────── */}
      {step === "importing" && (
        <Card className="border-border bg-background/60 backdrop-blur-xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
            <h3 className="text-lg font-semibold">Importing expenses...</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {progress}% complete
            </p>
            <Progress value={progress} className="mt-4 w-64" />
          </CardContent>
        </Card>
      )}

      {/* ── Results Step ─────────────────────────────────────────────── */}
      {step === "results" && importResult && (
        <Card className="border-border bg-background/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-400" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-muted/20 p-4 text-center">
                <p className="text-2xl font-bold">{importResult.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">
                  {importResult.succeeded}
                </p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
                <p className="text-2xl font-bold text-red-400">
                  {importResult.failed}
                </p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-1.5">
                {importResult.errors.slice(0, 5).map((err, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    Row {err.row}: {err.error}
                  </div>
                ))}
              </div>
            )}

            <Button onClick={handleReset} className="w-full">
              Import another file
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
