/**
 * KV health-check endpoint — shows Redis connectivity and what's currently cached.
 *
 * GET /api/cron/status
 *
 * Returns:
 *   - redis: whether Upstash Redis is reachable
 *   - keys: which KV keys exist and their remaining TTL (seconds)
 *   - events: how many upcoming events are cached (if any)
 */

import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { KV_KEYS } from "@/lib/cache";

export const runtime = "nodejs";

export async function GET() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return NextResponse.json(
      {
        redis: false,
        error: "Redis env vars not set (KV_REST_API_URL / KV_REST_API_TOKEN)",
        keys: {},
      },
      { status: 200 }
    );
  }

  let redis: Redis;
  try {
    redis = new Redis({ url, token });
  } catch (err) {
    return NextResponse.json(
      { redis: false, error: `Failed to init Redis client: ${String(err)}`, keys: {} },
      { status: 200 }
    );
  }

  // Ping Redis to confirm connectivity
  let connected = false;
  try {
    await redis.ping();
    connected = true;
  } catch (err) {
    return NextResponse.json(
      { redis: false, error: `Redis ping failed: ${String(err)}`, keys: {} },
      { status: 200 }
    );
  }

  // Check which keys exist and their TTLs
  const eventsKey = KV_KEYS.upcomingEvents();

  // Fetch TTL and value for the events key
  const [eventsTtl, eventsRaw] = await Promise.all([
    redis.ttl(eventsKey).catch(() => -2),
    redis.get(eventsKey).catch(() => null),
  ]);

  // Count how many event-data keys exist (scan for ufc:event:* pattern)
  let eventDataKeys: string[] = [];
  try {
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: "ufc:event:*",
        count: 100,
      });
      cursor = Number(nextCursor);
      eventDataKeys.push(...keys);
    } while (cursor !== 0);
  } catch {
    // scan not critical — ignore errors
  }

  // For each event-data key, grab its TTL
  const eventDataTtls: Record<string, number> = {};
  await Promise.all(
    eventDataKeys.map(async (k) => {
      const ttl = await redis.ttl(k).catch(() => -2);
      eventDataTtls[k] = ttl;
    })
  );

  const eventsCount = Array.isArray(eventsRaw) ? eventsRaw.length : null;

  return NextResponse.json({
    redis: connected,
    keys: {
      [eventsKey]: {
        exists: eventsTtl !== -2,
        ttlSeconds: eventsTtl,
        ttlHuman:
          eventsTtl > 0
            ? `${Math.floor(eventsTtl / 3600)}h ${Math.floor((eventsTtl % 3600) / 60)}m`
            : eventsTtl === -1
            ? "no expiry"
            : "missing",
        cachedEventsCount: eventsCount,
      },
    },
    eventDataKeys: Object.entries(eventDataTtls).map(([key, ttl]) => ({
      key,
      ttlSeconds: ttl,
      ttlHuman:
        ttl > 0
          ? `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`
          : ttl === -1
          ? "no expiry"
          : "missing",
    })),
  });
}
