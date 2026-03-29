/**
 * POST /api/auth/register
 *
 * Invite-code registration only.
 * Subscription (Stripe) registrations go through /api/stripe/checkout instead.
 *
 * Body: { username, email, password, confirmPassword, inviteCode }
 *
 * On success:
 *   - Marks invite code as used
 *   - Creates user with subscription_status = 'lifetime'
 *   - Returns { ok: true }
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { username, email, password, confirmPassword, inviteCode } =
    body as Record<string, string>;

  // ── Require invite code ───────────────────────────────────────────────────
  if (!inviteCode?.trim()) {
    return NextResponse.json({ error: "An invite code is required" }, { status: 400 });
  }

  // ── Field validation ──────────────────────────────────────────────────────
  if (!username || !email || !password || !confirmPassword) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }
  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3–20 characters (letters, numbers, underscores only)" },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
  }

  // ── Validate invite code (atomic update check) ───────────────────────────
  const code = inviteCode.trim().toUpperCase();

  // ── Check username/email uniqueness ───────────────────────────────────────
  try {
    const existing = await sql`
      SELECT id FROM users
      WHERE username = ${username.trim()} OR email = ${email.trim().toLowerCase()}
      LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json({ error: "Username or email already taken" }, { status: 409 });
    }
  } catch (err) {
    console.error("[register] DB lookup failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // ── Create user ──────────────────────────────────────────────────────────
  let userId: number;
  try {
    const hash = await bcrypt.hash(password, 12);
    const newUser = await sql`
      INSERT INTO users (username, email, password_hash, role, subscription_status)
      VALUES (
        ${username.trim()},
        ${email.trim().toLowerCase()},
        ${hash},
        'user',
        'lifetime'
      )
      RETURNING id
    `;
    userId = newUser[0].id as number;
  } catch (err) {
    console.error("[register] DB insert failed:", err);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }

  // ── Mark invite code used (atomic check + update) ──────────────────────────
  try {
    const result = await sql`
      UPDATE invite_codes SET used_by_id = ${userId}, used_at = NOW()
      WHERE code = ${code} AND used_by_id IS NULL
      RETURNING id
    `;
    if (result.length === 0) {
      // Rollback user creation if code was invalid or already used
      await sql`DELETE FROM users WHERE id = ${userId}`.catch(() => {});
      return NextResponse.json({ error: "Invalid or already-used invite code" }, { status: 400 });
    }
  } catch (err) {
    console.error("[register] Invite code update failed:", err);
    // Rollback user creation on error
    await sql`DELETE FROM users WHERE id = ${userId}`.catch(() => {});
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
