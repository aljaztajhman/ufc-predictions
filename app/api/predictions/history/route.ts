/**
 * GET /api/predictions/history
 *
 * Returns the currently-logged-in user's prediction-view history, newest
 * first. Each row is a matchup the user has clicked "Show AI Prediction"
 * on, joined with the AI's pick.
 *
 * Auth: required. 401 for anonymous. (We could loosen this later to surface
 * a "trending predictions" feed for logged-out users, but the schema admits
 * NULL user_id specifically so that extension is additive.)
 *
 * Query params:
 *   ?limit=<n>   — cap on rows returned (default 50, max 200)
 *
 * Response:
 *   { views: UserPredictionViewRow[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listUserPredictionViews } from "@/lib/predictions";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawLimit = Number(searchParams.get("limit") ?? "50");
  // Clamp: 1..200. Anything outside that is almost certainly a mistake/abuse.
  const limit = Number.isFinite(rawLimit)
    ? Math.min(200, Math.max(1, Math.trunc(rawLimit)))
    : 50;

  try {
    const views = await listUserPredictionViews(userId, limit);
    return NextResponse.json({ views });
  } catch (err) {
    console.error("[/api/predictions/history] DB read failed:", err);
    return NextResponse.json(
      { error: "Failed to load history" },
      { status: 500 },
    );
  }
}
