export type KeepalivePingResult = {
  ok: boolean;
  authHealth: { status: number; ok: boolean };
  database: { status: number; ok: boolean; lastPingAt?: string };
  touched: boolean;
  error?: string;
};

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

/**
 * Pings Supabase Auth health + REST heartbeat. Optionally updates last_ping_at
 * when SUPABASE_SERVICE_ROLE_KEY is set (cron / warmup with write activity).
 */
export async function pingSupabaseProject(options?: {
  touchHeartbeat?: boolean;
}): Promise<KeepalivePingResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const touchHeartbeat = options?.touchHeartbeat ?? Boolean(serviceRoleKey);

  if (!url || !anonKey) {
    return {
      ok: false,
      authHealth: { status: 0, ok: false },
      database: { status: 0, ok: false },
      touched: false,
      error: "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing",
    };
  }

  try {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    const key = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey);

    const authRes = await fetch(`${supabaseUrl}/auth/v1/health`, {
      cache: "no-store",
    });

    const dbRes = await fetch(
      `${supabaseUrl}/rest/v1/project_heartbeat?select=last_ping_at&id=eq.singleton`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        cache: "no-store",
      }
    );

    let lastPingAt: string | undefined;
    if (dbRes.ok) {
      const rows = (await dbRes.json()) as { last_ping_at?: string }[];
      lastPingAt = rows[0]?.last_ping_at;
    }

    let touched = false;
    if (touchHeartbeat && serviceRoleKey && dbRes.ok) {
      const touchRes = await fetch(
        `${supabaseUrl}/rest/v1/project_heartbeat?id=eq.singleton`,
        {
          method: "PATCH",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ last_ping_at: new Date().toISOString() }),
          cache: "no-store",
        }
      );
      touched = touchRes.ok;
    }

    const authOk = authRes.ok;
    const dbOk = dbRes.ok;
    const ok = authOk && dbOk;

    return {
      ok,
      authHealth: { status: authRes.status, ok: authOk },
      database: { status: dbRes.status, ok: dbOk, lastPingAt },
      touched,
      error: ok
        ? undefined
        : !authOk
          ? `Auth health returned ${authRes.status}`
          : `Heartbeat query returned ${dbRes.status} (run migration 009_project_heartbeat.sql)`,
    };
  } catch (error) {
    return {
      ok: false,
      authHealth: { status: 0, ok: false },
      database: { status: 0, ok: false },
      touched: false,
      error: error instanceof Error ? error.message : "Keep-alive ping failed",
    };
  }
}
