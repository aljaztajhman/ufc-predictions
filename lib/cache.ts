/**
 * Cache layer — Upstash Redis as primary, in-memory Map as fallback.
 * Uses @upstash/redis with UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN env vars.
 * Falls back to a module-level Map for local dev when Redis is not configured.
 */

import type { PredictionResult } from "@/types";

// ─── In-memory fallback ───────────────────────────────────────────────────────
const memCache = new Map<string, { value: unknown; expires: number }>();

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    memCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function memSet(key: string, value: unknown, ttlSeconds: number): void {
  memCache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
}

// ─── Upstash Redis helpers ────────────────────────────────────────────────────
function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

async function redisGet<T>(key: string): Promise<T | null> {
  if (!isRedisConfigured()) return null;
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    return await redis.get<T>(key);
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // silently fall through to mem cache
  }
}

// ─── TTLs ─────────────────────────────────────────────────────────────────────
const PREDICTION_TTL = 60 * 60 * 24 * 30; // 30 days — permanent per fight
const EVENTS_TTL = 60 * 60 * 6;            // 6 hours for event listings

// ─── Public API ───────────────────────────────────────────────────────────────
export async function getCachedPrediction(fightId: string): Promise<PredictionResult | null> {
  const key = `prediction:${fightId}`;
  const redis = await redisGet<PredictionResult>(key);
  if (redis) return redis;
  return memGet<PredictionResult>(key);
}

export async function setCachedPrediction(fightId: string, prediction: PredictionResult): Promise<void> {
  const key = `prediction:${fightId}`;
  await redisSet(key, prediction, PREDICTION_TTL);
  memSet(key, prediction, PREDICTION_TTL);
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  const redis = await redisGet<T>(key);
  if (redis) return redis;
  return memGet<T>(key);
}

export async function setCachedData<T>(key: string, value: T, ttl = EVENTS_TTL): Promise<void> {
  await redisSet(key, value, ttl);
  memSet(key, value, ttl);
}

export function isCacheWarmed(): boolean {
  return isRedisConfigured();
}
