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

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-03-25.dahlia",
  });
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
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

        // Customer is available directly on the session
        customerId = (session.customer as string | null) ?? null;

        if (session.subscription) {
          subscriptionId = session.subscription as string;
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            customerId = customerId ?? (sub.customer as string);
            // current_period_end moved in newer API versions — try multiple paths
            const ts = (sub as any).current_period_end
              ?? (sub as any).items?.data?.[0]?.current_period_end;
            if (ts && !isNaN(Number(ts))) {
              periodEnd = new Date(Number(ts) * 1000);
            }
          } catch (subErr) {
            console.error("[webhook] Failed to retrieve subscription:", subErr);
          }
          // Fallback: 31 days from now
          if (!periodEnd || isNaN(periodEnd.getTime())) {
            periodEnd = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
          }
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
        const ts = (sub as any).current_period_end
          ?? (sub as any).items?.data?.[0]?.current_period_end;
        const periodEnd = (ts && !isNaN(Number(ts)))
          ? new Date(Number(ts) * 1000)
          : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);

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
      //
      // Grace period: when a user cancels (or Stripe auto-cancels after
      // repeated payment failures), they've typically already paid through
      // the end of the current period. We preserve access until that date
      // instead of revoking immediately — both more correct (they paid for
      // it) and lower-churn (people often reactivate before expiry). If
      // Stripe's period_end isn't present for any reason we fall back to
      // NOW() so we fail closed rather than granting indefinite access.
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const subscriptionId = sub.id;

        const ts = (sub as any).current_period_end
          ?? (sub as any).items?.data?.[0]?.current_period_end
          ?? (sub as any).cancel_at
          ?? (sub as any).canceled_at;
        const expiresAt = (ts && !isNaN(Number(ts)))
          ? new Date(Number(ts) * 1000)
          : new Date(); // fall back to NOW() — fail closed

        // Status: if the grace period is still in the future, keep the row
        // marked 'active' so middleware continues allowing access. Flip to
        // 'cancelled' only when the period has actually elapsed (the nightly
        // cron or a subsequent event will handle late flips if needed).
        const stillWithinPeriod = expiresAt.getTime() > Date.now();
        const newStatus = stillWithinPeriod ? 'active' : 'cancelled';

        await sql`
          UPDATE users SET
            subscription_status     = ${newStatus},
            subscription_expires_at = ${expiresAt.toISOString()}
          WHERE stripe_subscription_id = ${subscriptionId}
        `;
        console.log(
          `[webhook] Subscription ${subscriptionId} cancelled — ` +
          `access retained until ${expiresAt.toISOString()} (status=${newStatus})`
        );
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