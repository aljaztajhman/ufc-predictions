/**
 * Migration: invite_codes table + stripe_subscription_id column on users.
 * Safe to run multiple times.
 *
 * Run: node scripts/migrate-invite-subscriptions.mjs
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
if (!DATABASE_URL) { console.error("❌  DATABASE_URL is not set."); process.exit(1); }

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log("🔄  Running invite + subscription migration...");

  // 1. Add stripe_subscription_id to users (for webhook → user lookup)
  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(100)
  `;
  console.log("✓  stripe_subscription_id column added to users.");

  // 2. Create invite_codes table
  await sql`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id           SERIAL PRIMARY KEY,
      code         VARCHAR(50) UNIQUE NOT NULL,
      note         VARCHAR(200),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      used_by_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      used_at      TIMESTAMPTZ
    )
  `;
  console.log("✓  invite_codes table created.");

  console.log("✅  Migration complete.");
}

migrate().catch((err) => {
  console.error("❌  Migration failed:", err);
  process.exit(1);
});
