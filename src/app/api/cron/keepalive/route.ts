import { NextRequest, NextResponse } from "next/server";
import { pingSupabaseProject } from "@/lib/supabase/keepalive";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Cron entrypoint that pings Supabase (Auth + REST heartbeat).
 * Scheduled via render.yaml and optional external cron; GitHub Actions
 * also pings Supabase directly so keep-alive works when Render is spun down.
 */
export async function POST(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await pingSupabaseProject({ touchHeartbeat: true });

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        ...result,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    success: true,
    ...result,
    timestamp: new Date().toISOString(),
  });
}
