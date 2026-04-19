/**
 * Cache layer — Upstash Redis (KV) as primary, in-memory Map as fallback.
 *
 * Vercel's Upstash integration injects KV_REST_API_URL + KV_REST_API_TOKEN.
 * Falls back to in-memory for local dev when Redis is not configured.
 *
 * Key schema:
 *   ufc:events:upcoming           → UFCEvent[]        TTL: 6 h
 *   ufc:event:{id}:fights         → Fight[]           TTL: 6 h
 *   ufc:prediction:{fightId}      → PredictionResult  TTL: 30 days
 */

import type { PredictionResult, UFCEvent, Fight, EventWithFights } from "@/types";
import { Redis } from "@upstash/redis";

// ─── Redis singleton ──────────────────────────────────────────────────────────
// Created once per process. If env vars are missing (local dev without Redis),
// every operation silently falls through to the in-memory cache.

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

// ─── In-memory fallback ───────────────────────────────────────────────────────
const memCache = new Map<string, { value: unknown; expires: number }>();

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { memCache.delete(key); return null; }
  return entry.value as T;
}

function memSet(key: string, value: unknown, ttlSeconds: number): void {
  memCache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
}

// ─── Low-level helpers ────────────────────────────────────────────────────────
async function kvGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await redis.get<T>(key);
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // silently fall through to mem cache
  }
}

async function kvDel(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try { await redis.del(key); } catch { /* ignore */ }
}

// ─── TTLs ─────────────────────────────────────────────────────────────────────
// EVENTS/FIGHTS dropped from 6h → 3h: pairs with the cron moving from 1×/day
// to 4×/day (every 6h), so any matchup change is reflected in the UI within
// a max of ~3h whether cron runs or a user triggers the revalidate-on-miss.
export const TTL = {
  EVENTS:     60 * 60 * 3,        // 3 hours  — upcoming event list
  FIGHTS:     60 * 60 * 3,        // 3 hours  — fight card per event
  PREDICTION: 60 * 60 * 24 * 30,  // 30 days  — AI predictions (matchup-scoped, see KV_KEYS.predictionV3)
} as const;

// ─── Key builders ─────────────────────────────────────────────────────────────
//
// Prediction keys are versioned so we can invalidate en-masse without touching
// other caches. Important: v3 bakes fighter identity into the key so that if
// ESPN swaps a fighter in the same slot (common — they keep matchNumber stable
// across injury replacements), we naturally miss the cache and re-generate
// against the new matchup. Pre-v3 behaviour would serve the OLD fighter's
// prediction for the NEW fight until the 30-day TTL expired.
export const KV_KEYS = {
  upcomingEvents:   ()                => "ufc:events:upcoming",
  eventData:        (id: string)      => `ufc:event:${id}`,        // full EventWithFights
  eventFights:      (id: string)      => `ufc:event:${id}:fights`, // legacy compat
  prediction:       (fightId: string) => `ufc:prediction:${fightId}`,     // v1 (legacy read)
  predictionV2:     (fightId: string) => `ufc:prediction:v2:${fightId}`,  // v2 (legacy read)
  predictionV3:     (fightId: string, f1Id: string, f2Id: string) =>
    `ufc:prediction:v3:${fightId}:${f1Id}:${f2Id}`,                         // v3 (legacy read)
  // v4 bakes model_version into the key. Every model bump (e.g. sonnet-4 -> opus-4-6)
  // automatically lives in a separate namespace, so old cached predictions are never
  // served for the new model — no cache wipe required.
  predictionV4:     (fightId: string, f1Id: string, f2Id: string, modelVersion: string) =>
    `ufc:prediction:v4:${fightId}:${f1Id}:${f2Id}:${modelVersion}`,         // v4 (current write)
} as const;

// ─── Typed public API ─────────────────────────────────────────────────────────

export async function getCachedEvents(): Promise<UFCEvent[] | null> {
  const key = KV_KEYS.upcomingEvents();
  return (await kvGet<UFCEvent[]>(key)) ?? memGet<UFCEvent[]>(key);
}

export async function setCachedEvents(events: UFCEvent[]): Promise<void> {
  const key = KV_KEYS.upcomingEvents();
  await kvSet(key, events, TTL.EVENTS);
  memSet(key, events, TTL.EVENTS);
}

// Full event object (metadata + fights) — what the event page needs
export async function getCachedEventData(eventId: string): Promise<EventWithFights | null> {
  const key = KV_KEYS.eventData(eventId);
  return (await kvGet<EventWithFights>(key)) ?? memGet<EventWithFights>(key);
}

export async function setCachedEventData(eventId: string, data: EventWithFights): Promise<void> {
  const key = KV_KEYS.eventData(eventId);
  await kvSet(key, data, TTL.FIGHTS);
  memSet(key, data, TTL.FIGHTS);
}

// Legacy: fights-only (still used by cron for backwards compat)
export async function getCachedFights(eventId: string): Promise<Fight[] | null> {
  const key = KV_KEYS.eventFights(eventId);
  return (await kvGet<Fight[]>(key)) ?? memGet<Fight[]>(key);
}

export async function setCachedFights(eventId: string, fights: Fight[]): Promise<void> {
  const key = KV_KEYS.eventFights(eventId);
  await kvSet(key, fights, TTL.FIGHTS);
  memSet(key, fights, TTL.FIGHTS);
}

/**
 * Read a cached prediction.
 *
 * Key-version priority: v4 (matchup + model) -> v3 (matchup) -> v2 -> v1.
 * v4 is the only key we WRITE to now; the others are legacy reads so entries
 * from previous deploys still serve until they expire or are overwritten.
 *
 * `modelVersion` is optional. If provided (new callers), we check v4 first.
 * If omitted (old callers / GET /api/prediction/[fightId] without context),
 * we skip v4 and start at v3. That keeps the function backwards-compatible.
 */
export async function getCachedPrediction(
  fightId: string,
  f1Id?: string,
  f2Id?: string,
  modelVersion?: string,
): Promise<PredictionResult | null> {
  // v4: matchup + model — only hit if all three identity pieces are available.
  if (f1Id && f2Id && modelVersion) {
    const v4Key = KV_KEYS.predictionV4(fightId, f1Id, f2Id, modelVersion);
    const v4 = (await kvGet<PredictionResult>(v4Key)) ?? memGet<PredictionResult>(v4Key);
    if (v4) return v4;
  }

  // v3: matchup-scoped — useful when the model version wasn't passed but we
  // still have fighter IDs. Note: after the opus-4-6 cutover this path may
  // return predictions generated by an older model; that's intentional for
  // legacy compat, and will naturally drain as v3 entries hit TTL.
  if (f1Id && f2Id) {
    const v3Key = KV_KEYS.predictionV3(fightId, f1Id, f2Id);
    const v3 = (await kvGet<PredictionResult>(v3Key)) ?? memGet<PredictionResult>(v3Key);
    if (v3) return v3;
  }

  // v2 / v1: legacy reads — may return the wrong prediction after a fighter
  // swap (that's the bug v3 fixes), but for unchanged matchups these are fine.
  const v2Key = KV_KEYS.predictionV2(fightId);
  const v2 = (await kvGet<PredictionResult>(v2Key)) ?? memGet<PredictionResult>(v2Key);
  if (v2) return v2;

  const v1Key = KV_KEYS.prediction(fightId);
  return (await kvGet<PredictionResult>(v1Key)) ?? memGet<PredictionResult>(v1Key);
}

/**
 * Write a prediction. Always writes to v4 (matchup + model) when all three
 * identity pieces are supplied — that's the only key new deploys should use.
 * Falls back through v3 -> v2 to avoid a silent write-loss if a caller hasn't
 * been updated yet, but those paths are deprecated.
 */
export async function setCachedPrediction(
  fightId: string,
  prediction: PredictionResult,
  f1Id?: string,
  f2Id?: string,
  modelVersion?: string,
): Promise<void> {
  let key: string;
  if (f1Id && f2Id && modelVersion) {
    key = KV_KEYS.predictionV4(fightId, f1Id, f2Id, modelVersion);
  } else if (f1Id && f2Id) {
    key = KV_KEYS.predictionV3(fightId, f1Id, f2Id);
  } else {
    key = KV_KEYS.predictionV2(fightId);
  }
  await kvSet(key, prediction, TTL.PREDICTION);
  memSet(key, prediction, TTL.PREDICTION);
}

// Legacy generic helpers — kept for backward compat with existing page.tsx calls
export async function getCachedData<T>(key: string): Promise<T | null> {
  return (await kvGet<T>(key)) ?? memGet<T>(key);
}

export async function setCachedData<T>(key: string, value: T, ttl = TTL.EVENTS): Promise<void> {
  await kvSet(key, value, ttl);
  memSet(key, value, ttl);
}

export async function invalidateEvents(): Promise<void> {
  await kvDel(KV_KEYS.upcomingEvents());
  memCache.delete(KV_KEYS.upcomingEvents());
}

/**
 * Delete ALL cached predictions (v1 + v2) from Redis and the in-memory map.
 * Used by the admin cache-clear endpoint to force fresh predictions.
 * Returns the number of keys deleted.
 */
export async function clearPredictionCache(): Promise<number> {
  let deleted = 0;

  // 1. Clear in-memory entries matching either prediction key pattern
  for (const key of memCache.keys()) {
    if (key.startsWith("ufc:prediction:")) {
      memCache.delete(key);
      deleted++;
    }
  }

  // 2. Clear Redis if configured
  const redis = getRedis();
  if (redis) {
    try {
      // Upstash supports keys() for admin-style operations
      const v1Keys = await redis.keys("ufc:prediction:*");
      // v2 keys are a subset of the above pattern so one scan is enough
      if (v1Keys.length > 0) {
        await redis.del(...(v1Keys as [string, ...string[]]));
        deleted += v1Keys.length;
      }
    } catch {
      // Redis unavailable — in-memory clear was still done
    }
  }

  return deleted;
}

export function isRedisConfigured(): boolean {
  return getRedis() !== null;
}
