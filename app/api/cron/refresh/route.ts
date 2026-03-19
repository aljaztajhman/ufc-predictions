/**
 * Background cache refresh — called by Vercel Cron 3× daily.
 *
 * Schedule (vercel.json): "0 6,12,20 * * *"  (6am, 12pm, 8pm UTC)
 *
 * What it does:
 *   1. Fetch upcoming UFC events from ESPN Core
 *   2. For each event, fetch the full fight card
 *   3. Write everything to KV (Upstash Redis)
 *
 * After this runs, every page load is a fast KV read — no ESPN calls
 * on the hot path. If ESPN is down, the last good data still serves.
 *
 * Protection: Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
 * Set CRON_SECRET in your Vercel project env vars.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchUpcomingEvents, fetchEventWithFights } from "@/lib/espn";
import {
  setCachedEvents,
  setCachedFights,
  isRedisConfigured,
} from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 60; // allow up to 60s for full card fetch

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const started = Date.now();
  const log: string[] = [];

  if (!isRedisConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Redis not configured — set KV_REST_API_URL and KV_REST_API_TOKEN" },
      { status: 500 }
    );
  }

  // ── Step 1: Fetch + cache upcoming events ──────────────────────────────────
  let events;
  try {
    events = await fetchUpcomingEvents();
    if (events.length > 0) {
      await setCachedEvents(events);
      log.push(`✓ cached ${events.length} upcoming events`);
    } else {
      log.push("⚠ ESPN returned 0 upcoming events — skipping events cache");
    }
  } catch (err) {
    log.push(`✗ failed to fetch upcoming events: ${String(err)}`);
    return NextResponse.json({ ok: false, log }, { status: 500 });
  }

  // ── Step 2: Fetch + cache full fight card for each upcoming event ──────────
  const results = await Promise.allSettled(
    events.map(async (event) => {
      const data = await fetchEventWithFights(event.id);
      if (!data) {
        log.push(`⚠ ${event.name}: no fight data returned`);
        return;
      }

      if (data.fights.length > 0) {
        await setCachedFights(event.id, data.fights);
        log.push(`✓ ${event.name}: cached ${data.fights.length} fights`);
      } else {
        log.push(`⚠ ${event.name}: fight card not yet announced`);
      }
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    log.push(`✗ ${failed} event(s) failed to fetch`);
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - started,
    eventsRefreshed: events.length,
    log,
  });
}
