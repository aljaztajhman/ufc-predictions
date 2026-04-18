/**
 * Rate limiting for Claude-calling endpoints.
 *
 * Goals:
 *   - Protect our Anthropic spend from a runaway client loop or abusive user
 *     who, despite having a paid subscription, hammers /api/prediction or
 *     /api/predictions/accumulator.
 *   - Apply per-user budgets (when signed in) and an IP fallback.
 *
 * Primary implementation: Upstash Ratelimit (same Redis we use for cache).
 * Fallback: a simple in-memory sliding window for local dev / when Redis
 * is not configured. The fallback is obviously not shared across Vercel
 * Serverless invocations — but in prod we always have Upstash, and in dev
 * it just means limits don't apply tightly. Good enough.
 *
 * Budgets (per plan):
 *   - PREDICTION:  30 / day per user       + 200 / hour per IP
 *   - ACCUMULATOR: 10 / day per user       + 60  / hour per IP
 *
 * These are deliberately generous for real users (a max fight-card watcher
 * needs ~15 prediction calls per event). The point is to catch runaway
 * loops, not to nickel-and-dime power users.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─── Redis singleton (same pattern as lib/cache.ts) ──────────────────────────
let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    _redis = new Redis({ url, token });
    return _redis;
  } catch {
    return null;
  }
}

// ─── Upstash Ratelimit instances (cached by shape) ───────────────────────────
let _predictionUser:   Ratelimit | null = null;
let _predictionIp:     Ratelimit | null = null;
let _accumulatorUser:  Ratelimit | null = null;
let _accumulatorIp:    Ratelimit | null = null;

function buildLimiter(tokens: number, window: `${number} ${"s" | "m" | "h" | "d"}`, prefix: string): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: false,
    prefix: `ufc:rl:${prefix}`,
  });
}

function predictionUserLimiter()  { return _predictionUser  ??= buildLimiter(30,  "1 d", "pred:u");  }
function predictionIpLimiter()    { return _predictionIp    ??= buildLimiter(200, "1 h", "pred:ip"); }
function accumulatorUserLimiter() { return _accumulatorUser ??= buildLimiter(10,  "1 d", "acc:u");   }
function accumulatorIpLimiter()   { return _accumulatorIp   ??= buildLimiter(60,  "1 h", "acc:ip");  }

// ─── In-memory fallback (dev only) ───────────────────────────────────────────
// Map<key, { count, resetAt }> — simple fixed-window, not sliding.
const memCounts = new Map<string, { count: number; resetAt: number }>();

function memLimit(key: string, limit: number, windowMs: number): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const entry = memCounts.get(key);
  if (!entry || entry.resetAt <= now) {
    memCounts.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, reset: now + windowMs };
  }
  if (entry.count >= limit) {
    return { success: false, remaining: 0, reset: entry.resetAt };
  }
  entry.count++;
  return { success: true, remaining: limit - entry.count, reset: entry.resetAt };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type RatelimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  /** unix-ms when the window resets */
  reset: number;
  /** which bucket tripped — useful for error copy */
  bucket?: "user" | "ip";
};

async function check(
  userLimiter: Ratelimit | null,
  ipLimiter:   Ratelimit | null,
  userId:      string | undefined,
  ip:          string,
  userLimit:   number,
  userWindow:  number,
  ipLimit:     number,
  ipWindow:    number,
  prefix:      string,
): Promise<RatelimitResult> {
  // 1) per-user (only if authenticated and Upstash configured)
  if (userId) {
    if (userLimiter) {
      const r = await userLimiter.limit(`u:${userId}`);
      if (!r.success) {
        return { success: false, limit: r.limit, remaining: r.remaining, reset: r.reset, bucket: "user" };
      }
    } else {
      const r = memLimit(`${prefix}:u:${userId}`, userLimit, userWindow);
      if (!r.success) {
        return { success: false, limit: userLimit, remaining: 0, reset: r.reset, bucket: "user" };
      }
    }
  }

  // 2) per-IP (always — catches anon/shared cases and serves as a second
  //    line when someone cycles accounts)
  if (ipLimiter) {
    const r = await ipLimiter.limit(`ip:${ip}`);
    if (!r.success) {
      return { success: false, limit: r.limit, remaining: r.remaining, reset: r.reset, bucket: "ip" };
    }
    return { success: true, limit: r.limit, remaining: r.remaining, reset: r.reset };
  } else {
    const r = memLimit(`${prefix}:ip:${ip}`, ipLimit, ipWindow);
    if (!r.success) {
      return { success: false, limit: ipLimit, remaining: 0, reset: r.reset, bucket: "ip" };
    }
    return { success: true, limit: ipLimit, remaining: r.remaining, reset: r.reset };
  }
}

/** 30 predictions/day/user, 200/hour/IP */
export async function checkPredictionRateLimit(userId: string | undefined, ip: string): Promise<RatelimitResult> {
  return check(
    predictionUserLimiter(),
    predictionIpLimiter(),
    userId,
    ip,
    30,  24 * 60 * 60 * 1000,
    200,       60 * 60 * 1000,
    "pred",
  );
}

/** 10 accumulator builds/day/user, 60/hour/IP */
export async function checkAccumulatorRateLimit(userId: string | undefined, ip: string): Promise<RatelimitResult> {
  return check(
    accumulatorUserLimiter(),
    accumulatorIpLimiter(),
    userId,
    ip,
    10,  24 * 60 * 60 * 1000,
    60,        60 * 60 * 1000,
    "acc",
  );
}

/** Extract client IP from Next request headers — Vercel puts it in x-forwarded-for. */
export function getClientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/** Build a 429 response with standard rate-limit headers. */
export function rateLimitResponse(result: RatelimitResult): Response {
  const retryAfterSec = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  const msg =
    result.bucket === "user"
      ? "You've hit your daily request limit. It resets in a few hours — thanks for your patience."
      : "Too many requests from this network. Please slow down and try again shortly.";
  return new Response(
    JSON.stringify({ error: msg, retryAfter: retryAfterSec }),
    {
      status: 429,
      headers: {
        "Content-Type":        "application/json",
        "Retry-After":         String(retryAfterSec),
        "X-RateLimit-Limit":   String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset":   String(Math.floor(result.reset / 1000)),
      },
    },
  );
}
