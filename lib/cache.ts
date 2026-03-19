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
export const TTL = {
  EVENTS:     60 * 60 * 6,        // 6 hours  — upcoming event list
  FIGHTS:     60 * 60 * 6,        // 6 hours  — fight card per event
  PREDICTION: 60 * 60 * 24 * 30,  // 30 days  — AI predictions (semi-permanent)
} as const;

// ─── Key builders ─────────────────────────────────────────────────────────────
export const KV_KEYS = {
  upcomingEvents: ()                => "ufc:events:upcoming",
  eventData:      (id: string)      => `ufc:event:${id}`,        // full EventWithFights
  eventFights:    (id: string)      => `ufc:event:${id}:fights`, // legacy compat
  prediction:     (fightId: string) => `ufc:prediction:${fightId}`,
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

export async function getCachedPrediction(fightId: string): Promise<PredictionResult | null> {
  const key = KV_KEYS.prediction(fightId);
  return (await kvGet<PredictionResult>(key)) ?? memGet<PredictionResult>(key);
}

export async function setCachedPrediction(fightId: string, prediction: PredictionResult): Promise<void> {
  const key = KV_KEYS.prediction(fightId);
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

export function isRedisConfigured(): boolean {
  return getRedis() !== null;
}
