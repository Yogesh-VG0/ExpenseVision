import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils";

function getOrigin(request: Request): string {
  const url = new URL(request.url);
  // Behind a reverse proxy the raw origin can be an internal address
  // (e.g. 0.0.0.0:10000). Use x-forwarded-host when available.
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${forwardedHost}`;
  }
  return url.origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getOrigin(request);
  const code = url.searchParams.get("code");
  const next = safeRedirectPath(url.searchParams.get("next") ?? "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
