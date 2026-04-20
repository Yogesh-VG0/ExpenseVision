/**
 * Parses Excel .xlsx/.xls workbooks for the import wizard (first sheet only).
 * Uses SheetJS with defensive limits for untrusted uploads.
 */

import * as XLSX from "xlsx";

const MAX_ROWS = 2000;
const MAX_SHEET_CELLS = 50_000;

function cellToString(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

/**
 * Reads first worksheet as header row + data rows (same shape as parseCSVString).
 */
export function parseWorkbookBuffer(buffer: ArrayBuffer): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    bookVBA: false,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [] };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  }) as unknown[][];

  if (matrix.length === 0) {
    return { headers: [], rows: [] };
  }

  const firstRow = matrix[0] ?? [];
  const headerRow = firstRow.map((c) => cellToString(c));
  const headers = headerRow.map((h, i) => (h ? h : `Column ${i + 1}`));

  let cellCount = 0;
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < matrix.length && rows.length < MAX_ROWS; r++) {
    const line = (matrix[r] ?? []) as unknown[];
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = cellToString(line[c]);
      cellCount++;
      if (cellCount > MAX_SHEET_CELLS) {
        return { headers, rows };
      }
    }
    rows.push(row);
  }

  return { headers, rows };
}
