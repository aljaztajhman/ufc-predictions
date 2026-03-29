/**
 * Migration: add subscription fields to users table.
 * Safe to run multiple times (uses ALTER TABLE IF NOT EXISTS pattern).
 *
 * Run: node scripts/migrate-subscription.mjs
 *
 * Adds:
 *   subscription_status    VARCHAR(20) DEFAULT 'free'
 *   subscription_expires_at TIMESTAMPTZ
 *   stripe_customer_id     VARCHAR(100)
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

try {
  const env = readFileSync(".env.local", "utf-8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log("🔄  Running subscription migration...");

  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS subscription_status    VARCHAR(20)  NOT NULL DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS stripe_customer_id     VARCHAR(100)
  `;

  console.log("✓  subscription_status, subscription_expires_at, stripe_customer_id added.");
  console.log("✅  Migration complete.");
}

migrate().catch((err) => {
  console.error("❌  Migration failed:", err);
  process.exit(1);
});
