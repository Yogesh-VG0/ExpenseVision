import { NextResponse, type NextRequest } from "next/server";

type RateLimiterLike = {
  limit: (identifier: string) => Promise<{ success: boolean }>;
};

export async function enforceRateLimit(
  limiter: RateLimiterLike | null,
  identifier: string,
  message = "Too many requests. Please try again shortly."
) {
  if (!limiter) {
    return null;
  }

  const { success } = await limiter.limit(identifier);

  if (success) {
    return null;
  }

  return NextResponse.json({ error: message }, { status: 429 });
}

export function getRequestIp(request: Request | NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}