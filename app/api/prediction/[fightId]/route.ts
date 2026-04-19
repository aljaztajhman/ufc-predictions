import { NextRequest, NextResponse } from "next/server";
import { generatePrediction } from "@/lib/claude";
import { getCachedPrediction } from "@/lib/cache";
import { readStoredPrediction, recordPredictionView, MODEL_VERSION } from "@/lib/predictions";
import { auth } from "@/lib/auth";
import { checkPredictionRateLimit, getClientIp, rateLimitResponse } from "@/lib/ratelimit";
import type { Fight } from "@/types";

// GET supports optional ?f1=<id>&f2=<id> so callers that know the matchup can
// hit the matchup-scoped v4 cache directly (avoids serving a stale legacy
// entry after a fighter swap or model bump). Without the params we still fall
// back through v3 → v2 → v1 inside getCachedPrediction.
export async function GET(
  req: NextRequest,
  { params }: { params: { fightId: string } }
) {
  const { searchParams } = new URL(req.url);
  const f1 = searchParams.get("f1") ?? undefined;
  const f2 = searchParams.get("f2") ?? undefined;

  // Always pass MODEL_VERSION so v4 is preferred when fighter IDs are known.
  const cached = await getCachedPrediction(params.fightId, f1, f2, MODEL_VERSION);
  if (!cached) {
    return NextResponse.json({ error: "Prediction not found" }, { status: 404 });
  }
  return NextResponse.json(cached);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { fightId: string } }
) {
  try {
    // Parse body FIRST — we need fighter IDs to do a matchup-scoped cache
    // lookup. Doing the cache check with just fightId (as this code used to)
    // could serve a stale prediction from before a fighter swap.
    const body = await req.json();
    const fight: Fight = body.fight;
    // Optional event context for the /my-predictions history denormalization.
    // Older clients that don't send this still work — the view row just has
    // null event_name / event_date and the history page falls back gracefully.
    const eventName: string | undefined = typeof body.eventName === "string" ? body.eventName : undefined;
    const eventDate: string | undefined = typeof body.eventDate === "string" ? body.eventDate : undefined;

    if (!fight || !fight.fighter1 || !fight.fighter2) {
      return NextResponse.json(
        { error: "Invalid fight data provided" },
        { status: 400 }
      );
    }

    // Resolve the session up front so we can record the view on BOTH the
    // cached and the fresh path. (Rate-limit check still only applies to the
    // fresh-generate branch below.)
    const session = await auth();
    const userId = session?.user?.id;
    const viewCtx = { eventName, eventDate };

    // Unified read chain: KV (fast) → Postgres (authoritative) → miss.
    // Postgres hits skip the rate limit AND skip Claude entirely — another
    // user has already generated this prediction, so it costs us nothing to
    // serve it again.
    const stored = await readStoredPrediction(fight);
    if (stored) {
      // Record view for the user's /my-predictions history. Fire-and-forget;
      // never block the response on a history-write failure.
      recordPredictionView(fight, userId, viewCtx).catch(() => { /* logged inside */ });
      return NextResponse.json(stored);
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 503 }
      );
    }

    // Rate limit applies ONLY to the expensive path (cache miss → Claude call).
    // Cached reads above don't count — a user refreshing an already-seen
    // event shouldn't burn budget. Per-user 30/day + per-IP 200/hr.
    const ip = getClientIp(req.headers);
    const rl = await checkPredictionRateLimit(userId, ip);
    if (!rl.success) {
      return rateLimitResponse(rl) as unknown as NextResponse;
    }

    const prediction = await generatePrediction(fight);
    // Record the view on the fresh-generate path too — the user just caused
    // this prediction to exist, so it definitely belongs in their history.
    recordPredictionView(fight, userId, viewCtx).catch(() => { /* logged inside */ });
    return NextResponse.json(prediction);
  } catch (err) {
    console.error("Prediction API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const maxDuration = 30;
