/**
 * POST /api/invite/validate
 *
 * Checks whether an invite code exists and hasn't been used yet.
 * Does NOT consume the code — that happens during register.
 *
 * Body: { code: string }
 * Response: { valid: true } | { valid: false, reason: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ valid: false, reason: "Invalid request" }, { status: 400 });
  }

  const code = (body.code as string | undefined)?.trim().toUpperCase();
  if (!code) return NextResponse.json({ valid: false, reason: "No code provided" });

  try {
    const rows = await sql`
      SELECT id, used_by_id FROM invite_codes WHERE code = ${code} LIMIT 1
    `;

    if (rows.length === 0) return NextResponse.json({ valid: false, reason: "Invalid invite code" });
    if (rows[0].used_by_id) return NextResponse.json({ valid: false, reason: "Invite code already used" });

    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error("[invite/validate] DB error:", err);
    return NextResponse.json({ valid: false, reason: "Server error" }, { status: 500 });
  }
}
