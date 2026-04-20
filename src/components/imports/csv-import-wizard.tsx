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
  HelpCircle,
  Table2,
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  parseCSVString,
  mapAndValidateRows,
  autoDetectMapping,
  validateMappedRowEdit,
  type ColumnMapping,
  type ParsedRow,
} from "@/lib/csv-parser";
import { parseWorkbookBuffer } from "@/lib/spreadsheet-import";
import { trackEvent } from "@/lib/telemetry";
import { CATEGORIES, type Category } from "@/lib/types";
import { cn } from "@/lib/utils";

type WizardStep = "upload" | "mapping" | "preview" | "importing" | "results";

const CSV_MAX_FILE_BYTES = 5 * 1024 * 1024;
const SHEET_MAX_FILE_BYTES = 10 * 1024 * 1024;
const CSV_MAX_ROWS = 2000;
const IMPORT_CHUNK_SIZE = 50;
const NONE = "__none__";

interface ImportResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

const MAPPING_FIELDS: Array<{
  field: keyof ColumnMapping;
  label: string;
  required: boolean;
  title: string;
  body: string;
}> = [
  {
    field: "date",
    label: "Date",
    required: true,
    title: "When it happened",
    body: "Pick the column that has the transaction date (e.g. Date, Posted, Transaction date).",
  },
  {
    field: "amount",
    label: "Amount",
    required: true,
    title: "How much",
    body: "Pick the column with the dollar amount. Negative numbers (bank debits) and currency symbols are OK—we convert them to a normal expense amount.",
  },
  {
    field: "description",
    label: "Description",
    required: true,
    title: "What it was",
    body: "Usually “Description”, “Memo”, or “Details”. This becomes your expense notes. If you don’t have a separate merchant column, this text is also used as the merchant name.",
  },
  {
    field: "vendor",
    label: "Merchant / payee",
    required: false,
    title: "Who you paid (optional)",
    body: "Optional. Use if your file has a column like Merchant, Payee, or Store. Otherwise leave empty.",
  },
  {
    field: "category",
    label: "Category",
    required: false,
    title: "Category from your bank (optional)",
    body: "Optional. If your export includes categories, we’ll map common names (e.g. Food & Drink → Food & Dining).",
  },
  {
    field: "transactionType",
    label: "Debit / Credit",
    required: false,
    title: "Transaction type (optional)",
    body: "Optional. Map columns like Type or Debit/Credit if you want to skip deposits using the switch below.",
  },
];

function isProbablySpreadsheet(file: File) {
  const n = file.name.toLowerCase();
  return n.endsWith(".xlsx") || n.endsWith(".xls") || n.includes("spreadsheet");
}

export function CSVImportWizard() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [workingRows, setWorkingRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [skipCreditRows, setSkipCreditRows] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ingestTable = useCallback((h: string[], rows: Record<string, string>[]) => {
    if (h.length === 0 || rows.length === 0) {
      toast.error("File appears to be empty or invalid");
      return;
    }
    if (rows.length > CSV_MAX_ROWS) {
      toast.error(
        `File has ${rows.length.toLocaleString()} rows. Maximum is ${CSV_MAX_ROWS.toLocaleString()} per import.`
      );
      return;
    }
    setHeaders(h);
    setRawRows(rows);
    setMapping(autoDetectMapping(h));
    setStep("mapping");
    void trackEvent("csv_import_start", { rows: rows.length, columns: h.length });
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const maxBytes = isProbablySpreadsheet(file) ? SHEET_MAX_FILE_BYTES : CSV_MAX_FILE_BYTES;
      if (file.size > maxBytes) {
        toast.error(`File is too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))} MB.`);
        return;
      }

      if (isProbablySpreadsheet(file)) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const buf = ev.target?.result;
          if (!(buf instanceof ArrayBuffer)) {
            toast.error("Could not read spreadsheet");
            return;
          }
          try {
            const { headers: h, rows: r } = parseWorkbookBuffer(buf);
            ingestTable(h, r);
          } catch {
            toast.error("Could not read this Excel file. Try exporting as CSV or a newer .xlsx file.");
          }
        };
        reader.onerror = () => toast.error("Failed to read file");
        reader.readAsArrayBuffer(file);
        return;
      }

      if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv" && !file.type.startsWith("text/")) {
        toast.error("Please select a CSV file, or an Excel .xlsx / .xls file");
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const { headers: h, rows: r } = parseCSVString(text);
        ingestTable(h, r);
      };
      reader.onerror = () => toast.error("Failed to read file");
      reader.readAsText(file);
    },
    [ingestTable]
  );

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
      transactionType: mapping.transactionType ?? "",
    };

    const validated = mapAndValidateRows(rawRows, fullMapping, { skipCreditRows });
    setWorkingRows(
      validated.map((row) => ({
        ...row,
        mapped: row.mapped ? { ...row.mapped } : null,
        errors: [...row.errors],
      }))
    );
    setStep("preview");
  };

  const patchWorkingRow = useCallback(
    (rowIndex: number, patch: Partial<NonNullable<ParsedRow["mapped"]>>) => {
      setWorkingRows((prev) =>
        prev.map((row) => {
          if (row.rowIndex !== rowIndex || !row.mapped) return row;
          const nextMapped = { ...row.mapped, ...patch };
          return {
            ...row,
            mapped: nextMapped,
            errors: validateMappedRowEdit(nextMapped),
          };
        })
      );
    },
    []
  );

  const validRows = useMemo(
    () => workingRows.filter((r) => r.errors.length === 0 && r.mapped),
    [workingRows]
  );
  const errorRows = useMemo(
    () => workingRows.filter((r) => r.errors.length > 0),
    [workingRows]
  );

  const handleImport = useCallback(async () => {
    setStep("importing");
    setProgress(0);

    const importableRows = validRows.filter(
      (row): row is ParsedRow & { mapped: NonNullable<ParsedRow["mapped"]> } =>
        row.mapped !== null
    );

    const results: ImportResult = {
      total: importableRows.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    let processedRows = 0;

    for (let i = 0; i < importableRows.length; i += IMPORT_CHUNK_SIZE) {
      const chunk = importableRows.slice(i, i + IMPORT_CHUNK_SIZE);

      try {
        const res = await fetch("/api/expenses/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: chunk.map((row) => ({
              source_row: row.rowIndex + 1,
              amount: row.mapped.amount,
              vendor: row.mapped.vendor || undefined,
              category: row.mapped.category || undefined,
              description: row.mapped.description || "",
              date: row.mapped.date,
              idempotency_key: `csv-import-${row.rowIndex}-${row.mapped.date}-${row.mapped.amount}-${row.mapped.description.slice(0, 40)}`,
            })),
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          results.succeeded += typeof data.succeeded === "number" ? data.succeeded : 0;
          results.failed += typeof data.failed === "number" ? data.failed : 0;
          if (Array.isArray(data.errors)) {
            results.errors.push(
              ...data.errors
                .filter(
                  (error: unknown): error is { row: number; error: string } =>
                    typeof error === "object" &&
                    error !== null &&
                    typeof (error as { row?: unknown }).row === "number" &&
                    typeof (error as { error?: unknown }).error === "string"
                )
            );
          }
        } else {
          const chunkError = data.error || `Status ${res.status}`;
          results.failed += chunk.length;
          results.errors.push(
            ...chunk.map((row) => ({
              row: row.rowIndex + 1,
              error: chunkError,
            }))
          );
        }
      } catch (err) {
        const chunkError = err instanceof Error ? err.message : "Network error";
        results.failed += chunk.length;
        results.errors.push(
          ...chunk.map((row) => ({
            row: row.rowIndex + 1,
            error: chunkError,
          }))
        );
      }

      processedRows += chunk.length;
      setProgress(
        importableRows.length === 0
          ? 100
          : Math.round((processedRows / importableRows.length) * 100)
      );
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

  const handleReset = () => {
    setStep("upload");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setWorkingRows([]);
    setImportResult(null);
    setProgress(0);
    setSkipCreditRows(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Expenses</h1>
        <p className="text-muted-foreground">
          Upload a CSV or Excel file from your bank or spreadsheet app
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
        {(["upload", "mapping", "preview", "importing", "results"] as const).map(
          (s, idx) => (
            <div key={s} className="flex items-center gap-2">
              {idx > 0 && (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              )}
              <Badge
                variant={step === s ? "default" : "outline"}
                className={cn(step === s ? "" : "text-muted-foreground")}
              >
                {idx + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </Badge>
            </div>
          )
        )}
      </div>

      {step === "upload" && (
        <Card className="border-border bg-background/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload file
            </CardTitle>
            <CardDescription>
              First row must be column headers. We accept CSV (.csv) and Excel (.xlsx, .xls). For
              Google Sheets, use File → Download → Comma-separated values (.csv) or Microsoft Excel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              htmlFor="csv_upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-primary/5 sm:p-12"
            >
              <Table2 className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-center text-sm font-medium">
                Drop your file here or click to browse
              </p>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                CSV up to 5 MB · Excel up to 10 MB · max {CSV_MAX_ROWS.toLocaleString()} rows
              </p>
              <input
                id="csv_upload"
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="sr-only"
                onChange={handleFileSelect}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {step === "mapping" && (
        <Card className="border-border bg-background/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Match columns</CardTitle>
            <CardDescription>
              Tell ExpenseVision which column in your file is which. Required fields are marked with
              *.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-6">
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
              <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-1 text-muted-foreground">
                <p className="font-medium text-foreground">How this works</p>
                <p>
                  Each row in your file is one expense. Choose one CSV column for each item below.
                  If your bank uses negative amounts for money going out, that’s fine—we convert
                  them to positive amounts.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <Label htmlFor="skip-credits" className="text-base">
                  Skip credit / deposit rows
                </Label>
                <p className="text-xs text-muted-foreground">
                  Only if you mapped a “Debit/Credit” column. When on, rows marked as Credit are not
                  imported.
                </p>
              </div>
              <Switch
                id="skip-credits"
                checked={skipCreditRows}
                onCheckedChange={setSkipCreditRows}
              />
            </div>

            <div className="space-y-6">
              {MAPPING_FIELDS.map(({ field, label, required, title, body }) => (
                <div
                  key={field}
                  className="grid gap-3 rounded-xl border border-border/80 bg-background/40 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,280px)] sm:items-start sm:gap-6"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold leading-tight">
                      {label}
                      {required ? <span className="text-destructive"> *</span> : null}
                    </p>
                    <p className="text-xs font-medium text-primary">{title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="sr-only">{label}</Label>
                    <Select
                      value={
                        field === "transactionType" || field === "vendor" || field === "category"
                          ? mapping[field] || NONE
                          : mapping[field] || ""
                      }
                      onValueChange={(v) => {
                        if (v == null) return;
                        if (v === NONE) updateMapping(field, "");
                        else updateMapping(field, v);
                      }}
                    >
                      <SelectTrigger className="border-border bg-muted/30 w-full">
                        <SelectValue
                          placeholder={
                            required ? `Choose column…` : `None (optional)`
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {!required && (
                          <SelectItem value={NONE}>— None —</SelectItem>
                        )}
                        {headers.map((h) => (
                          <SelectItem key={`${field}-${h}`} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button variant="outline" type="button" onClick={handleReset}>
                <ChevronLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
              <Button type="button" onClick={handleConfirmMapping} disabled={!isMappingComplete}>
                Preview data
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <Card className="border-border bg-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Preview & edit</CardTitle>
              <CardDescription>
                {validRows.length} row{validRows.length === 1 ? "" : "s"} ready to import
                {errorRows.length > 0 && (
                  <span className="text-destructive">
                    {" · "}
                    {errorRows.length} row{errorRows.length === 1 ? "" : "s"} skipped or with errors
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Edit amounts, dates, or categories before importing. Only rows without errors are
                sent to your account.
              </p>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-2 py-2 text-left font-medium">Date</th>
                      <th className="px-2 py-2 text-left font-medium">Amount</th>
                      <th className="px-2 py-2 text-left font-medium">Vendor</th>
                      <th className="px-2 py-2 text-left font-medium">Category</th>
                      <th className="px-2 py-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 100).map((row) => (
                      <tr key={row.rowIndex} className="border-b border-border/50">
                        <td className="p-1 align-top">
                          <Input
                            className="h-9 min-w-[7rem] text-xs"
                            value={row.mapped!.date}
                            onChange={(e) =>
                              patchWorkingRow(row.rowIndex, { date: e.target.value })
                            }
                          />
                        </td>
                        <td className="p-1 align-top">
                          <Input
                            className="h-9 min-w-[5rem] text-xs"
                            type="number"
                            step="0.01"
                            min={0}
                            value={row.mapped!.amount}
                            onChange={(e) =>
                              patchWorkingRow(row.rowIndex, {
                                amount: Number.parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </td>
                        <td className="p-1 align-top">
                          <Input
                            className="h-9 min-w-[6rem] text-xs"
                            value={row.mapped!.vendor}
                            onChange={(e) =>
                              patchWorkingRow(row.rowIndex, { vendor: e.target.value })
                            }
                          />
                        </td>
                        <td className="p-1 align-top">
                          <Select
                            value={row.mapped!.category}
                            onValueChange={(v) =>
                              v && patchWorkingRow(row.rowIndex, { category: v as Category })
                            }
                          >
                            <SelectTrigger className="h-9 min-w-[8rem] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((c) => (
                                <SelectItem key={c.name} value={c.name}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-1 align-top">
                          <Input
                            className="h-9 min-w-[10rem] text-xs"
                            value={row.mapped!.description}
                            onChange={(e) =>
                              patchWorkingRow(row.rowIndex, { description: e.target.value })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validRows.length > 100 && (
                  <div className="border-t border-border bg-muted/20 px-3 py-2 text-center text-xs text-muted-foreground">
                    Showing first 100 of {validRows.length} rows (all will be imported)
                  </div>
                )}
              </div>

              {errorRows.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Rows not imported
                  </p>
                  <div className="space-y-1.5">
                    {errorRows.slice(0, 8).map((row) => (
                      <div
                        key={row.rowIndex}
                        className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs"
                      >
                        <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                        <span>
                          Row {row.rowIndex + 1}: {row.errors.join(", ")}
                        </span>
                      </div>
                    ))}
                    {errorRows.length > 8 && (
                      <p className="text-xs text-muted-foreground">
                        ...and {errorRows.length - 8} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Separator className="my-4" />

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" type="button" onClick={() => setStep("mapping")}>
                  <ChevronLeft className="mr-1.5 h-4 w-4" />
                  Back
                </Button>
                <Button type="button" onClick={handleImport} disabled={validRows.length === 0}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Import {validRows.length} expense{validRows.length === 1 ? "" : "s"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "importing" && (
        <Card className="border-border bg-background/60 backdrop-blur-xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
            <h3 className="text-lg font-semibold">Importing expenses...</h3>
            <p className="mt-1 text-sm text-muted-foreground">{progress}% complete</p>
            <Progress value={progress} className="mt-4 w-full max-w-xs" />
          </CardContent>
        </Card>
      )}

      {step === "results" && importResult && (
        <Card className="border-border bg-background/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-400" />
              Import complete
            </CardTitle>
            <CardDescription>
              {importResult.failed === 0
                ? "All rows in this batch were processed."
                : "Some rows could not be saved. Details below."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-muted/20 p-4 text-center">
                <p className="text-2xl font-bold">{importResult.total}</p>
                <p className="text-xs text-muted-foreground">Total in batch</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{importResult.succeeded}</p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
                <p className="text-2xl font-bold text-red-400">{importResult.failed}</p>
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
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    Row {err.row}: {err.error}
                  </div>
                ))}
              </div>
            )}

            <Button type="button" onClick={handleReset} className="w-full">
              Import another file
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
