import { describe, it, expect, vi } from "vitest";

// Mock supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("budget-alerts", () => {
  it("module exports checkBudgetAlerts function", async () => {
    const mod = await import("@/lib/budget-alerts");
    expect(typeof mod.checkBudgetAlerts).toBe("function");
  });

  it("returns empty alerts when no budget exists", async () => {
    const mod = await import("@/lib/budget-alerts");
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => ({ data: null })),
            })),
          })),
        })),
      })),
    };

    const result = await mod.checkBudgetAlerts(
      mockSupabase as never,
      "user-123",
      "Food & Dining"
    );

    expect(result.alerts).toHaveLength(0);
  });
});
