/**
 * POST /api/stripe/checkout
 *
 * Two modes:
 *   type: "register"  — new user registration + Stripe subscription checkout
 *   type: "renew"     — existing logged-in user (expired/cancelled) renewing
 *
 * For "register":
 *   - Validates registration fields
 *   - Creates user with subscription_status = 'pending'
 *   - Returns Stripe Checkout URL
 *
 * For "renew":
 *   - Requires valid session
 *   - Creates Stripe Checkout URL for existing user
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia",
});

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://ufc-predictions-one.vercel.app";
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { type } = body;

  // ── RENEW: existing authenticated user ────────────────────────────────────
  if (type === "renew") {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    try {
      const rows = await sql`
        SELECT id, email, stripe_customer_id FROM users WHERE id = ${session.user.id}
      `;
      const user = rows[0];
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
        customer_email: user.stripe_customer_id ? undefined : (user.email as string),
        customer: user.stripe_customer_id ? (user.stripe_customer_id as string) : undefined,
        client_reference_id: String(user.id),
        subscription_data: { trial_period_days: undefined },
        success_url: `${appUrl()}/subscribe?renewed=1`,
        cancel_url: `${appUrl()}/subscribe`,
      });

      return NextResponse.json({ url: checkoutSession.url });
    } catch (err) {
      console.error("[stripe/checkout] renew error:", err);
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }
  }

  // ── REGISTER: new user ────────────────────────────────────────────────────
  if (type === "register") {
    const { username, email, password, confirmPassword } = body;

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
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    // Check uniqueness
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
      console.error("[stripe/checkout] DB lookup failed:", err);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Create pending user
    let userId: number;
    try {
      const hash = await bcrypt.hash(password, 12);
      const rows = await sql`
        INSERT INTO users (username, email, password_hash, role, subscription_status)
        VALUES (
          ${username.trim()},
          ${email.trim().toLowerCase()},
          ${hash},
          'user',
          'pending'
        )
        RETURNING id
      `;
      userId = rows[0].id as number;
    } catch (err) {
      console.error("[stripe/checkout] DB insert failed:", err);
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    // Create Stripe Checkout session
    try {
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
        customer_email: email.trim().toLowerCase(),
        client_reference_id: String(userId),
        success_url: `${appUrl()}/register/success?username=${encodeURIComponent(username.trim())}`,
        cancel_url: `${appUrl()}/register?cancelled=1`,
      });

      return NextResponse.json({ url: checkoutSession.url });
    } catch (err) {
      // Roll back the pending user if Stripe session creation fails
      await sql`DELETE FROM users WHERE id = ${userId}`.catch(() => {});
      console.error("[stripe/checkout] Stripe session failed:", err);
      return NextResponse.json({ error: "Failed to create payment session" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid checkout type" }, { status: 400 });
}
