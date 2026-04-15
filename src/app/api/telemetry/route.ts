import { NextRequest, NextResponse } from "next/server";
import { telemetryRateLimit } from "@/lib/redis";
import { enforceRateLimit, getRequestIp } from "@/lib/rate-limit";
import { TELEMETRY_EVENTS } from "@/lib/telemetry";

const VALID_EVENTS = new Set<string>(TELEMETRY_EVENTS);

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await enforceRateLimit(
      telemetryRateLimit,
      getRequestIp(request),
      "Too many telemetry events. Please slow down and try again shortly."
    );

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const event = typeof body?.event === "string" ? body.event : "";
    const payload =
      body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? body.payload
        : {};

    if (!VALID_EVENTS.has(event)) {
      return NextResponse.json({ error: "Invalid telemetry event" }, { status: 400 });
    }

    console.info("[telemetry]", event, payload);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to record telemetry" }, { status: 500 });
  }
}
