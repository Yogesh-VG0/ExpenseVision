/**
 * CSV parsing utility for expense imports.
 *
 * Parses a CSV string into typed row objects with configurable column mapping,
 * validates each row against the expense schema, and returns both valid and
 * errored rows for the import wizard to display.
 */

import { CATEGORIES } from "@/lib/types";

export interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
  vendor: string;
  category: string;
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
  // Try common formats
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;

  const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (usMatch) {
    const year = usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3];
    return `${year}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`;
  }

  // Try native parse as fallback
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];

  return null;
}

function parseAmount(value: string): number | null {
  // Remove currency symbols and whitespace
  const cleaned = value.replace(/[$ £€¥₹,\s]/g, "").replace(/^\((.+)\)$/, "-$1");
  const num = Number.parseFloat(cleaned);
  if (isNaN(num) || num <= 0) return null;
  return Math.round(num * 100) / 100;
}

function guessCategory(value: string): string | null {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  // Try exact match first
  const exact = CATEGORIES.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact.name;
  // Try partial match
  const partial = CATEGORIES.find((c) => lower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(lower));
  return partial?.name || null;
}

export function mapAndValidateRows(
  rawRows: Record<string, string>[],
  mapping: ColumnMapping
): ParsedRow[] {
  return rawRows.map((raw, rowIndex) => {
    const errors: string[] = [];

    const dateStr = raw[mapping.date] ?? "";
    const amountStr = raw[mapping.amount] ?? "";
    const description = raw[mapping.description] ?? "";
    const vendor = raw[mapping.vendor] ?? "";
    const categoryStr = raw[mapping.category] ?? "";

    const date = parseDate(dateStr);
    if (!date) errors.push(`Invalid date: "${dateStr}"`);

    const amount = parseAmount(amountStr);
    if (amount === null) errors.push(`Invalid amount: "${amountStr}"`);

    const category = guessCategory(categoryStr) || "Other";

    if (errors.length > 0) {
      return { rowIndex, raw, mapped: null, errors };
    }

    return {
      rowIndex,
      raw,
      mapped: {
        date: date!,
        amount: amount!,
        description,
        vendor,
        category,
      },
      errors: [],
    };
  });
}

export function autoDetectMapping(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const lower = headers.map((h) => h.toLowerCase());

  const dateAliases = ["date", "transaction date", "trans date", "posted date", "posting date"];
  const amountAliases = ["amount", "debit", "total", "charge", "price", "value"];
  const descAliases = ["description", "memo", "note", "notes", "details", "narrative"];
  const vendorAliases = ["merchant", "vendor", "payee", "name", "store"];
  const categoryAliases = ["category", "type", "group", "classification"];

  for (const [idx, h] of lower.entries()) {
    if (!mapping.date && dateAliases.some((a) => h.includes(a))) {
      mapping.date = headers[idx];
    }
    if (!mapping.amount && amountAliases.some((a) => h.includes(a))) {
      mapping.amount = headers[idx];
    }
    if (!mapping.description && descAliases.some((a) => h.includes(a))) {
      mapping.description = headers[idx];
    }
    if (!mapping.vendor && vendorAliases.some((a) => h.includes(a))) {
      mapping.vendor = headers[idx];
    }
    if (!mapping.category && categoryAliases.some((a) => h.includes(a))) {
      mapping.category = headers[idx];
    }
  }

  return mapping;
}
