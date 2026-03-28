import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// ── Validation helpers ────────────────────────────────────────────────────────
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { username, email, password, confirmPassword } = body as Record<string, string>;

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

  // ── Check uniqueness ──────────────────────────────────────────────────────
  try {
    const existing = await sql`
      SELECT id FROM users
      WHERE username = ${username.trim()} OR email = ${email.trim().toLowerCase()}
      LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Username or email is already taken" },
        { status: 409 }
      );
    }
  } catch (err) {
    console.error("[register] DB lookup failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // ── Hash + insert ─────────────────────────────────────────────────────────
  try {
    const hash = await bcrypt.hash(password, 12);
    await sql`
      INSERT INTO users (username, email, password_hash, role)
      VALUES (
        ${username.trim()},
        ${email.trim().toLowerCase()},
        ${hash},
        'user'
      )
    `;
  } catch (err) {
    console.error("[register] DB insert failed:", err);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
