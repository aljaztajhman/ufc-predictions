/**
 * Admin invite code management.
 *
 * GET  /api/admin/invite-codes         — list all codes
 * POST /api/admin/invite-codes         — create a new code
 * DELETE /api/admin/invite-codes?id=X  — delete an unused code
 *
 * Protected by CRON_SECRET bearer token (same as admin cache endpoint).
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { nanoid } from "nanoid";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ── List all codes ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const codes = await sql`
      SELECT ic.id, ic.code, ic.note, ic.created_at, ic.used_at,
             u.username AS used_by_username
      FROM invite_codes ic
      LEFT JOIN users u ON u.id = ic.used_by_id
      ORDER BY ic.created_at DESC
    `;
    return NextResponse.json({ codes });
  } catch (err) {
    console.error("[admin/invite-codes] GET error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ── Create a new code ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  // Auto-generate a readable code if not provided: e.g. UFC-A1B2C3
  const code = body.code
    ? (body.code as string).trim().toUpperCase()
    : `UFC-${nanoid(6).toUpperCase()}`;
  const note = (body.note as string | undefined)?.trim() ?? null;

  try {
    const rows = await sql`
      INSERT INTO invite_codes (code, note) VALUES (${code}, ${note})
      RETURNING id, code, note, created_at
    `;
    return NextResponse.json({ ok: true, code: rows[0] }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json({ error: "Code already exists" }, { status: 409 });
    }
    console.error("[admin/invite-codes] POST error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ── Delete an unused code ─────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) return NextResponse.json({ error: "id parameter required" }, { status: 400 });

  const id = parseInt(idParam, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "id must be a valid integer" }, { status: 400 });
  }

  try {
    const result = await sql`
      DELETE FROM invite_codes WHERE id = ${id} AND used_by_id IS NULL
      RETURNING id
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: "Code not found or already used" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deleted: id });
  } catch (err) {
    console.error("[admin/invite-codes] DELETE error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
