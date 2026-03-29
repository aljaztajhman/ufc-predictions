/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events to keep subscription status in sync.
 *
 * Events handled:
 *   checkout.session.completed      → activate subscription after first payment
 *   invoice.payment_succeeded       → renew subscription (update expires_at)
 *   customer.subscription.deleted   → mark cancelled/expired
 *   invoice.payment_failed          → could set to payment_failed (currently logs only)
 *
 * Requires env: STRIPE_WEBHOOK_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// Disable body parsing — Stripe needs the raw body for signature verification
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia",
});

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Payment completed for first-time checkout ────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        if (!userId) break;

        // Fetch the subscription to get period end
        let periodEnd: Date | null = null;
        let subscriptionId: string | null = null;
        let customerId: string | null = null;

        if (session.subscription) {
          subscriptionId = session.subscription as string;
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          periodEnd = new Date((sub as any).current_period_end * 1000);
          customerId = sub.customer as string;
        }

        await sql`
          UPDATE users SET
            subscription_status      = 'active',
            subscription_expires_at  = ${periodEnd?.toISOString() ?? null},
            stripe_customer_id       = COALESCE(${customerId}, stripe_customer_id),
            stripe_subscription_id   = COALESCE(${subscriptionId}, stripe_subscription_id)
          WHERE id = ${userId}
        `;
        console.log(`[webhook] User ${userId} activated`);
        break;
      }

      // ── Subscription renewed successfully ────────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if ((invoice as any).billing_reason !== "subscription_cycle") break; // only renewals
        const subscriptionId = (invoice as any).subscription as string;
        if (!subscriptionId) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const periodEnd = new Date((sub as any).current_period_end * 1000);

        await sql`
          UPDATE users SET
            subscription_status     = 'active',
            subscription_expires_at = ${periodEnd.toISOString()}
          WHERE stripe_subscription_id = ${subscriptionId}
        `;
        console.log(`[webhook] Subscription ${subscriptionId} renewed until ${periodEnd.toISOString()}`);
        break;
      }

      // ── Subscription cancelled or expired ────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const subscriptionId = sub.id;

        await sql`
          UPDATE users SET
            subscription_status     = 'cancelled',
            subscription_expires_at = NOW()
          WHERE stripe_subscription_id = ${subscriptionId}
        `;
        console.log(`[webhook] Subscription ${subscriptionId} cancelled`);
        break;
      }

      // ── Payment failed — log but don't immediately revoke ────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        console.warn(`[webhook] Payment failed for subscription ${subscriptionId}`);
        // Stripe will retry — only revoke on subscription.deleted
        break;
      }

      default:
        // Ignore other events
        break;
    }
  } catch (err) {
    console.error("[webhook] Handler error:", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
