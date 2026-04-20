import { describe, it, expect } from "vitest";
import { normalizeImportCategoryLabel, suggestCategory } from "@/lib/category-suggest";

describe("suggestCategory", () => {
  it("suggests Food & Dining for known restaurant merchants", () => {
    const result = suggestCategory("Starbucks");
    expect(result.category).toBe("Food & Dining");
    expect(result.source).toBe("merchant");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("suggests Groceries for grocery stores", () => {
    expect(suggestCategory("Walmart").category).toBe("Groceries");
    expect(suggestCategory("Whole Foods").category).toBe("Groceries");
    expect(suggestCategory("kroger").category).toBe("Groceries");
  });

  it("suggests Transportation for gas stations", () => {
    expect(suggestCategory("Shell").category).toBe("Transportation");
    expect(suggestCategory("Chevron").category).toBe("Transportation");
  });

  it("suggests Shopping for retail", () => {
    expect(suggestCategory("Amazon").category).toBe("Shopping");
    expect(suggestCategory("Best Buy").category).toBe("Shopping");
  });

  it("suggests Groceries for supermarkets and hypermarkets", () => {
    expect(suggestCategory("HILAL AL MADINA SUPERMARKET BR1").category).toBe("Groceries");
    expect(suggestCategory("City Hypermarket").category).toBe("Groceries");
  });

  it("normalizes bank export category labels", () => {
    expect(normalizeImportCategoryLabel("Food & Drink")).toBe("Food & Dining");
    expect(normalizeImportCategoryLabel("Gas & Fuel")).toBe("Transportation");
    expect(normalizeImportCategoryLabel("Auto & Transport")).toBe("Transportation");
    expect(normalizeImportCategoryLabel("Food & Dining")).toBe("Food & Dining");
  });

  it("uses weighted OCR keywords when merchant is unknown", () => {
    const gas = suggestCategory("Unknown", "Fuel pump 10 gallons unleaded");
    expect(gas.category).toBe("Transportation");
    expect(gas.source).toBe("text_keyword");
  });

  it("suggests category from OCR text keywords", () => {
    const result = suggestCategory("Unknown Store", "restaurant tip appetizer menu");
    expect(result.category).toBe("Food & Dining");
    expect(result.source).toBe("text_keyword");
  });

  it("uses single keyword match with lower confidence", () => {
    const result = suggestCategory("Unknown Store", "some grocery items");
    expect(result.category).toBe("Groceries");
    expect(result.confidence).toBeLessThan(0.7);
  });

  it("falls back to Other for unknown merchants and no text", () => {
    const result = suggestCategory("Random Place");
    expect(result.category).toBe("Other");
    expect(result.source).toBe("fallback");
    expect(result.confidence).toBeLessThanOrEqual(0.2);
  });

  it("handles Healthcare merchants", () => {
    expect(suggestCategory("CVS").category).toBe("Healthcare");
    expect(suggestCategory("walgreens").category).toBe("Healthcare");
  });

  it("handles Entertainment merchants", () => {
    expect(suggestCategory("Netflix").category).toBe("Entertainment");
    expect(suggestCategory("Spotify").category).toBe("Entertainment");
  });
});
