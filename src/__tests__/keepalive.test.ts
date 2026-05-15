import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pingSupabaseProject } from "@/lib/supabase/keepalive";

describe("pingSupabaseProject", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("returns ok when auth and database pings succeed", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ last_ping_at: "2026-05-15T00:00:00Z" }],
      } as Response);

    const result = await pingSupabaseProject({ touchHeartbeat: false });

    expect(result.ok).toBe(true);
    expect(result.authHealth.ok).toBe(true);
    expect(result.database.ok).toBe(true);
    expect(result.database.lastPingAt).toBe("2026-05-15T00:00:00Z");
  });

  it("returns degraded when heartbeat table is missing", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response);

    const result = await pingSupabaseProject({ touchHeartbeat: false });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("404");
  });

  it("fails fast when env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const result = await pingSupabaseProject();

    expect(result.ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
