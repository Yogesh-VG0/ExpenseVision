import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Redis client — disabled gracefully if env vars are not set
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Rate limiter for AI/OCR routes: 20 requests per 60 seconds per user
export const aiRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "60 s"),
      prefix: "ratelimit:ai",
    })
  : null;

// Rate limiter for general API routes: 60 requests per 60 seconds per user
export const apiRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "60 s"),
      prefix: "ratelimit:api",
    })
  : null;

export { redis };
