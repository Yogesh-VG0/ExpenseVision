import { describe, it, expect } from "vitest";
import {
  parseCSVString,
  mapAndValidateRows,
  autoDetectMapping,
  type ColumnMapping,
} from "@/lib/csv-parser";

const SAMPLE_CSV = `Date,Amount,Description,Category,Vendor
2024-01-15,5.75,"Morning coffee","Food & Dining","Starbucks"
01/14/2024,142.30,"Weekly groceries","Groceries","Walmart"
2024-01-13,$45.00,"Gas fill-up","Transportation","Shell"
invalid-date,abc,"Bad row","Other","Unknown"`;

describe("parseCSVString", () => {
  it("parses headers and rows correctly", () => {
    const result = parseCSVString(SAMPLE_CSV);
    expect(result.headers).toEqual(["Date", "Amount", "Description", "Category", "Vendor"]);
    expect(result.rows).toHaveLength(4);
  });

  it("handles quoted fields with commas", () => {
    const csv = `Name,Description\n"Company, Inc.","A description with ""quotes"""`;
    const result = parseCSVString(csv);
    expect(result.rows[0].Name).toBe("Company, Inc.");
    expect(result.rows[0].Description).toBe('A description with "quotes"');
  });

  it("returns empty for empty input", () => {
    const result = parseCSVString("");
    expect(result.headers).toHaveLength(0);
    expect(result.rows).toHaveLength(0);
  });
});

describe("autoDetectMapping", () => {
  it("detects common column names", () => {
    const headers = ["Transaction Date", "Debit", "Memo", "Type"];
    const mapping = autoDetectMapping(headers);
    expect(mapping.date).toBe("Transaction Date");
    expect(mapping.amount).toBe("Debit");
    expect(mapping.description).toBe("Memo");
  });

  it("detects direct column names", () => {
    const headers = ["Date", "Amount", "Description", "Category", "Vendor"];
    const mapping = autoDetectMapping(headers);
    expect(mapping.date).toBe("Date");
    expect(mapping.amount).toBe("Amount");
    expect(mapping.description).toBe("Description");
    expect(mapping.category).toBe("Category");
    expect(mapping.vendor).toBe("Vendor");
  });
});

describe("mapAndValidateRows", () => {
  const mapping: ColumnMapping = {
    date: "Date",
    amount: "Amount",
    description: "Description",
    category: "Category",
    vendor: "Vendor",
  };

  it("validates valid rows", () => {
    const { rows } = parseCSVString(SAMPLE_CSV);
    const validated = mapAndValidateRows(rows, mapping);

    expect(validated[0].errors).toHaveLength(0);
    expect(validated[0].mapped!.date).toBe("2024-01-15");
    expect(validated[0].mapped!.amount).toBe(5.75);
  });

  it("parses US date format", () => {
    const { rows } = parseCSVString(SAMPLE_CSV);
    const validated = mapAndValidateRows(rows, mapping);

    expect(validated[1].errors).toHaveLength(0);
    expect(validated[1].mapped!.date).toBe("2024-01-14");
  });

  it("strips currency symbols from amounts", () => {
    const { rows } = parseCSVString(SAMPLE_CSV);
    const validated = mapAndValidateRows(rows, mapping);

    expect(validated[2].errors).toHaveLength(0);
    expect(validated[2].mapped!.amount).toBe(45.00);
  });

  it("marks invalid rows with errors", () => {
    const { rows } = parseCSVString(SAMPLE_CSV);
    const validated = mapAndValidateRows(rows, mapping);

    expect(validated[3].errors.length).toBeGreaterThan(0);
    expect(validated[3].mapped).toBeNull();
  });

  it("defaults to Other category for unknown categories", () => {
    const csv = `Date,Amount,Description,Category\n2024-01-15,10.00,"Test","UnknownCat"`;
    const { rows } = parseCSVString(csv);
    const validated = mapAndValidateRows(rows, { ...mapping, category: "Category" });

    expect(validated[0].mapped!.category).toBe("Other");
  });
});
