import { describe, it, expect } from "vitest";
import { detectDuplicate, type DuplicateCandidate } from "@/lib/duplicate-detection";

const recentExpenses = [
  { id: "e1", vendor: "Starbucks", amount: 5.75, date: "2024-01-15" },
  { id: "e2", vendor: "walmart", amount: 142.30, date: "2024-01-14" },
  { id: "e3", vendor: "Shell", amount: 45.00, date: "2024-01-13" },
];

describe("detectDuplicate", () => {
  it("returns no duplicate for empty expense list", () => {
    const candidate: DuplicateCandidate = { vendor: "Starbucks", amount: 5.75, date: "2024-01-15" };
    const result = detectDuplicate(candidate, []);
    expect(result.isDuplicate).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it("detects exact duplicate (same vendor, amount, date)", () => {
    const candidate: DuplicateCandidate = { vendor: "Starbucks", amount: 5.75, date: "2024-01-15" };
    const result = detectDuplicate(candidate, recentExpenses);
    expect(result.isDuplicate).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.matchId).toBe("e1");
  });

  it("detects duplicate with variant vendor name", () => {
    const candidate: DuplicateCandidate = { vendor: "STARBUCKS COFFEE", amount: 5.75, date: "2024-01-15" };
    const result = detectDuplicate(candidate, recentExpenses);
    expect(result.isDuplicate).toBe(true);
    expect(result.matchId).toBe("e1");
  });

  it("does not flag different amount as duplicate", () => {
    const candidate: DuplicateCandidate = { vendor: "Starbucks", amount: 12.50, date: "2024-01-15" };
    const result = detectDuplicate(candidate, recentExpenses);
    // Same vendor + date but different amount — should not hit 0.75 threshold
    expect(result.confidence).toBeLessThan(0.75);
  });

  it("does not flag different vendor as duplicate", () => {
    const candidate: DuplicateCandidate = { vendor: "Unknown Coffee", amount: 5.75, date: "2024-01-15" };
    const result = detectDuplicate(candidate, recentExpenses);
    // Same amount + date but different vendor
    expect(result.isDuplicate).toBe(false);
  });

  it("reduces confidence for distant dates", () => {
    const candidate: DuplicateCandidate = { vendor: "Starbucks", amount: 5.75, date: "2024-01-20" };
    const result = detectDuplicate(candidate, recentExpenses);
    // Same vendor + amount but 5 days apart — lower score
    expect(result.confidence).toBeLessThanOrEqual(0.75);
  });
});
