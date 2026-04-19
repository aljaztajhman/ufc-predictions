import { NextRequest, NextResponse } from "next/server";
import { generatePrediction } from "@/lib/claude";
import { getCachedPrediction } from "@/lib/cache";
import { readStoredPrediction } from "@/lib/predictions";
import { auth } from "@/lib/auth";
import { checkPredictionRateLimit, getClientIp, rateLimitResponse } from "@/lib/ratelimit";
import type { Fight } from "@/types";

// GET supports optional ?f1=<id>&f2=<id> so callers that know the matchup can
// hit the matchup-scoped v3 cache directly (avoids serving a stale v2 entry
// after a fighter swap). Without the params we fall back to the legacy lookup.
export async function GET(
  req: NextRequest,
  { params }: { params: { fightId: string } }
) {
  const { searchParams } = new URL(req.url);
  const f1 = searchParams.get("f1") ?? undefined;
  const f2 = searchParams.get("f2") ?? undefined;

  const cached = await getCachedPrediction(params.fightId, f1, f2);
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

    if (!fight || !fight.fighter1 || !fight.fighter2) {
      return NextResponse.json(
        { error: "Invalid fight data provided" },
        { status: 400 }
      );
    }

    // Unified read chain: KV (fast) → Postgres (authoritative) → miss.
    // Postgres hits skip the rate limit AND skip Claude entirely — another
    // user has already generated this prediction, so it costs us nothing to
    // serve it again.
    const stored = await readStoredPrediction(fight);
    if (stored) {
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
    const session = await auth();
    const userId = session?.user?.id;
    const ip = getClientIp(req.headers);
    const rl = await checkPredictionRateLimit(userId, ip);
    if (!rl.success) {
      return rateLimitResponse(rl) as unknown as NextResponse;
    }

    const prediction = await generatePrediction(fight);
    return NextResponse.json(prediction);
  } catch (err) {
    console.error("Prediction API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const maxDuration = 30;
