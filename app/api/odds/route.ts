/**
 * GET /api/odds
 * Returns all current MMA odds from The Odds API (cached 1 hour in Redis).
 * Used by the event page (server-side) and the slip modal (client-side).
 *
 * Requires env var: ODDS_API_KEY
 * Returns: OddsAPIEvent[] (raw odds data — caller maps to fight IDs)
 */

import { NextResponse } from "next/server";
import { fetchAllMMAOdds } from "@/lib/odds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // odds are always live — never statically rendered

export async function GET() {
  if (!process.env.ODDS_API_KEY) {
    return NextResponse.json(
      { error: "ODDS_API_KEY is not configured", data: [] },
      { status: 200 } // soft fail: caller treats empty array as "no odds"
    );
  }

  try {
    const data = await fetchAllMMAOdds();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/odds] Error:", err);
    return NextResponse.json([], { status: 200 }); // soft fail
  }
}
