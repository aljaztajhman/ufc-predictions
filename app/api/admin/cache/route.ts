/**
 * Admin cache management endpoint.
 *
 * DELETE /api/admin/cache?type=predictions
 *   → Clears all cached predictions (v1 + v2) so the next request regenerates them.
 *
 * Protected by CRON_SECRET (same secret used by the refresh cron job).
 * Pass it as:  Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { clearPredictionCache } from "@/lib/cache";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // no secret configured → deny all
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "predictions";

  if (type === "predictions") {
    const deleted = await clearPredictionCache();
    return NextResponse.json({
      ok: true,
      message: `Cleared prediction cache. ${deleted} key(s) removed (Redis + in-memory).`,
      deleted,
    });
  }

  return NextResponse.json({ error: `Unknown cache type: ${type}` }, { status: 400 });
}
