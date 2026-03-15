/**
 * Cache layer with Vercel KV as primary and in-memory fallback.
 * Vercel KV is used when KV_REST_API_URL + KV_REST_API_TOKEN are set.
 * Falls back to a module-level Map for local dev / when KV is not configured.
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

// ─── KV helpers ──────────────────────────────────────────────────────────────
function isKVConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvGet<T>(key: string): Promise<T | null> {
  if (!isKVConfigured()) return null;
  try {
    const { kv } = await import("@vercel/kv");
    return await kv.get<T>(key);
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!isKVConfigured()) return;
  try {
    const { kv } = await import("@vercel/kv");
    await kv.set(key, value, { ex: ttlSeconds });
  } catch {
    // silently fall through
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
const PREDICTION_TTL = 60 * 60 * 24 * 30; // 30 days — predictions are permanent per fight
const EVENTS_TTL = 60 * 60 * 6; // 6 hours for event listings

export async function getCachedPrediction(fightId: string): Promise<PredictionResult | null> {
  const key = `prediction:${fightId}`;
  const kv = await kvGet<PredictionResult>(key);
  if (kv) return kv;
  return memGet<PredictionResult>(key);
}

export async function setCachedPrediction(fightId: string, prediction: PredictionResult): Promise<void> {
  const key = `prediction:${fightId}`;
  await kvSet(key, prediction, PREDICTION_TTL);
  memSet(key, prediction, PREDICTION_TTL);
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  const kv = await kvGet<T>(key);
  if (kv) return kv;
  return memGet<T>(key);
}

export async function setCachedData<T>(key: string, value: T, ttl = EVENTS_TTL): Promise<void> {
  await kvSet(key, value, ttl);
  memSet(key, value, ttl);
}

export function isCacheWarmed(): boolean {
  return isKVConfigured();
}
