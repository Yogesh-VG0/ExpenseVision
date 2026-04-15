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

    // The function now queries profiles first (for preferences), then budgets.
    let fromCallCount = 0;
    const mockSupabase = {
      from: vi.fn(() => {
        fromCallCount++;
        if (fromCallCount === 1) {
          // profiles query: select → eq → maybeSingle
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => ({ data: null })),
              })),
            })),
          };
        }
        // budgets query: select → eq → eq → maybeSingle
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => ({ data: null })),
              })),
            })),
          })),
        };
      }),
    };

    const result = await mod.checkBudgetAlerts(
      mockSupabase as never,
      "user-123",
      "Food & Dining"
    );

    expect(result.alerts).toHaveLength(0);
  });
});
