/**
 * CSV / spreadsheet parsing for expense imports.
 *
 * Parses a CSV string into typed row objects with configurable column mapping,
 * validates each row, and returns both valid and errored rows for the wizard.
 */

import type { Category } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { MAX_EXPENSE_AMOUNT } from "@/lib/constants";

export interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
  vendor: string;
  category: string;
  /** Column with Debit/Credit (or similar). Empty string = not used. */
  transactionType: string;
}

export interface MapRowsOptions {
  /** When true, rows whose type column looks like Credit are skipped. */
  skipCreditRows?: boolean;
}

export interface ParsedRow {
  rowIndex: number;
  raw: Record<string, string>;
  mapped: {
    date: string;
    amount: number;
    description: string;
    vendor: string;
    category: string;
  } | null;
  errors: string[];
}

export interface CSVParseResult {
  headers: string[];
  rows: ParsedRow[];
  validCount: number;
  errorCount: number;
}

/** Simple CSV parser supporting quoted fields and embedded commas. */
export function parseCSVString(csv: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });

  return { headers, rows };
}

function parseDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;

  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (usMatch) {
    const year = usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3];
    return `${year}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`;
  }

  const euMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (euMatch) {
    const year = euMatch[3].length === 2 ? `20${euMatch[3]}` : euMatch[3];
    return `${year}-${euMatch[2].padStart(2, "0")}-${euMatch[1].padStart(2, "0")}`;
  }

  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) return d.toISOString().split("T")[0];

  return null;
}

/**
 * Bank exports often use negative amounts for debits. We store expenses as positive values.
 */
function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[$ £€¥₹,\s]/g, "").replace(/^\((.+)\)$/, "-$1");
  const num = Number.parseFloat(cleaned);
  if (Number.isNaN(num) || num === 0) return null;
  const abs = Math.abs(num);
  return Math.round(abs * 100) / 100;
}

/** Maps labels from banks / spreadsheets to ExpenseVision categories. */
const CATEGORY_ALIASES: Record<string, Category> = {
  "food & drink": "Food & Dining",
  "food and drink": "Food & Dining",
  "food/drink": "Food & Dining",
  "food": "Food & Dining",
  "restaurants": "Food & Dining",
  "dining": "Food & Dining",
  "groceries": "Groceries",
  "grocery": "Groceries",
  "gas & fuel": "Transportation",
  "gas": "Transportation",
  "fuel": "Transportation",
  "auto": "Transportation",
  "transport": "Transportation",
  "income": "Other",
  "salary": "Other",
  "transfer": "Other",
  "entertainment": "Entertainment",
  "utilities": "Bills & Utilities",
  "bills": "Bills & Utilities",
  "health": "Healthcare",
  "medical": "Healthcare",
  "education": "Education",
  "travel": "Travel",
  "shopping": "Shopping",
  "subscriptions": "Entertainment",
};

function normalizeCategory(value: string): Category {
  if (!value.trim()) return "Other";
  const lower = value.toLowerCase().trim();

  const alias = CATEGORY_ALIASES[lower];
  if (alias) return alias;

  const exact = CATEGORIES.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact.name;

  const partial = CATEGORIES.find(
    (c) => lower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(lower)
  );
  if (partial) return partial.name;

  const fuzzyAlias = Object.entries(CATEGORY_ALIASES).find(
    ([key]) => lower.includes(key) || key.includes(lower)
  );
  return fuzzyAlias?.[1] ?? "Other";
}

function isCreditTransaction(typeStr: string): boolean {
  const t = typeStr.toLowerCase();
  if (!t) return false;
  if (/\bcredit\b/.test(t) && !/\bdebit\b/.test(t)) return true;
  if (/\bincome\b/.test(t) || /\bdeposit\b/.test(t)) return true;
  return false;
}

/** Re-validate a row after the user edits it in the preview step. */
export function validateMappedRowEdit(mapped: NonNullable<ParsedRow["mapped"]>): string[] {
  const errors: string[] = [];
  if (!parseDate(mapped.date)) errors.push(`Invalid date: "${mapped.date}"`);
  if (!Number.isFinite(mapped.amount) || mapped.amount <= 0) {
    errors.push(`Invalid amount: "${mapped.amount}"`);
  } else if (mapped.amount > MAX_EXPENSE_AMOUNT) {
    errors.push("Amount too large");
  }
  if (!CATEGORIES.some((c) => c.name === mapped.category)) {
    errors.push("Invalid category");
  }
  if (!mapped.description.trim()) {
    errors.push("Description is required");
  }
  return errors;
}

export function mapAndValidateRows(
  rawRows: Record<string, string>[],
  mapping: ColumnMapping,
  options?: MapRowsOptions
): ParsedRow[] {
  const skipCreditRows = options?.skipCreditRows ?? false;

  return rawRows.map((raw, rowIndex) => {
    const errors: string[] = [];

    const dateStr = raw[mapping.date] ?? "";
    const amountStr = raw[mapping.amount] ?? "";
    const description = (raw[mapping.description] ?? "").trim();
    const vendor = (raw[mapping.vendor] ?? "").trim();
    const categoryStr = raw[mapping.category] ?? "";
    const typeStr =
      mapping.transactionType && mapping.transactionType.length > 0
        ? (raw[mapping.transactionType] ?? "").trim()
        : "";

    if (skipCreditRows && mapping.transactionType && isCreditTransaction(typeStr)) {
      return {
        rowIndex,
        raw,
        mapped: null,
        errors: [
          "Skipped: row looks like a credit/deposit. Turn off “Skip credit rows” to import it.",
        ],
      };
    }

    const date = parseDate(dateStr);
    if (!date) errors.push(`Invalid date: "${dateStr || "(empty)"}"`);

    const amount = parseAmount(amountStr);
    if (amount === null) {
      errors.push(`Invalid amount: "${amountStr || "(empty)"}"`);
    } else if (amount > MAX_EXPENSE_AMOUNT) {
      errors.push("Amount too large");
    }

    const category = normalizeCategory(categoryStr);

    if (errors.length > 0) {
      return { rowIndex, raw, mapped: null, errors };
    }

    const vendorResolved = vendor || description.split(/[|\n]/)[0]?.trim() || "";

    return {
      rowIndex,
      raw,
      mapped: {
        date: date!,
        amount: amount!,
        description: description || vendorResolved || "Imported transaction",
        vendor: vendorResolved,
        category,
      },
      errors: [],
    };
  });
}

export function autoDetectMapping(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const lower = headers.map((h) => h.toLowerCase());

  const dateAliases = ["date", "transaction date", "trans date", "posted date", "posting date", "value date"];
  const descAliases = ["description", "memo", "note", "notes", "details", "narrative", "summary"];
  /** "name" alone is ambiguous; match payee name patterns */
  const vendorStrong = ["merchant", "vendor", "payee", "store", "counterparty"];
  const categoryAliases = ["category", "group", "classification", "class"];
  const typeAliases = ["type", "dr/cr", "d/c", "transaction type", "debit/credit"];

  for (const [idx, h] of lower.entries()) {
    if (!mapping.date && dateAliases.some((a) => h === a || h.includes(a))) {
      mapping.date = headers[idx];
    }
  }

  for (const [idx, h] of lower.entries()) {
    if (mapping.amount) continue;
    if (["amount", "debit", "credit", "charge", "price"].includes(h)) {
      mapping.amount = headers[idx];
    } else if (h === "total" && !h.includes("sub")) {
      mapping.amount = headers[idx];
    }
  }

  for (const [idx, h] of lower.entries()) {
    if (!mapping.description && descAliases.some((a) => h.includes(a))) {
      mapping.description = headers[idx];
    }
  }

  for (const [idx, h] of lower.entries()) {
    if (!mapping.vendor && vendorStrong.some((a) => h.includes(a))) {
      mapping.vendor = headers[idx];
    }
  }

  for (const [idx, h] of lower.entries()) {
    if (!mapping.category && categoryAliases.some((a) => h.includes(a))) {
      mapping.category = headers[idx];
    }
  }

  for (const [idx, h] of lower.entries()) {
    if (!mapping.transactionType && typeAliases.some((a) => h.includes(a))) {
      mapping.transactionType = headers[idx];
    }
  }

  // "Name" column: use as vendor only if we still need a merchant column
  for (const [idx, h] of lower.entries()) {
    if (h === "name" && !mapping.vendor) {
      mapping.vendor = headers[idx];
    }
  }

  return mapping;
}
