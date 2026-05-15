import { NextResponse } from "next/server";
import { pingSupabaseProject } from "@/lib/supabase/keepalive";

export async function GET() {
  const supabase = await pingSupabaseProject({ touchHeartbeat: true });

  const body = {
    status: supabase.ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    supabase,
  };

  return NextResponse.json(body, { status: supabase.ok ? 200 : 503 });
}
