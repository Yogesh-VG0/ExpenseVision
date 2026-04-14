import { describe, it, expect } from "vitest";
import { normalizeMerchant } from "@/lib/merchant-normalize";

describe("normalizeMerchant", () => {
  it("returns empty string for empty input", () => {
    expect(normalizeMerchant("").canonical).toBe("");
    expect(normalizeMerchant("  ").canonical).toBe("");
  });

  it("normalizes known merchant variants", () => {
    expect(normalizeMerchant("STARBUCKS").canonical).toBe("Starbucks");
    expect(normalizeMerchant("starbucks coffee").canonical).toBe("Starbucks");
    expect(normalizeMerchant("Wal-Mart").canonical).toBe("Walmart");
    expect(normalizeMerchant("WALMART").canonical).toBe("Walmart");
    expect(normalizeMerchant("McDonald's").canonical).toBe("McDonald's");
    expect(normalizeMerchant("MCDONALDS").canonical).toBe("McDonald's");
  });

  it("matches by prefix for POS-style suffixes", () => {
    expect(normalizeMerchant("STARBUCKS #12345").canonical).toBe("Starbucks");
    expect(normalizeMerchant("walmart store 42").canonical).toBe("Walmart");
  });

  it("strips noise suffixes from unknown merchants", () => {
    const result = normalizeMerchant("ACME SUPPLIES #999");
    expect(result.canonical).toBe("Acme Supplies");
    expect(result.matched).toBe(false);
  });

  it("title-cases unknown merchants", () => {
    const result = normalizeMerchant("local pizza shop");
    expect(result.canonical).toBe("Local Pizza Shop");
    expect(result.matched).toBe(false);
  });

  it("marks known matches as matched", () => {
    const result = normalizeMerchant("starbucks");
    expect(result.matched).toBe(true);
    expect(result.raw).toBe("starbucks");
  });

  it("handles Amazon variants", () => {
    expect(normalizeMerchant("AMAZON.COM").canonical).toBe("Amazon");
    expect(normalizeMerchant("amzn").canonical).toBe("Amazon");
  });

  it("normalizes gas stations", () => {
    expect(normalizeMerchant("SHELL OIL").canonical).toBe("Shell");
    expect(normalizeMerchant("EXXON MOBIL").canonical).toBe("ExxonMobil");
  });
});
