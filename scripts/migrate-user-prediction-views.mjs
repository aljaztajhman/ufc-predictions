/**
 * Migration: user_prediction_views table.
 *
 * Purpose:
 *   Track which predictions each logged-in user has viewed, so the
 *   "My Predictions" tab can show a personal history of every fight
 *   they've looked at — matchup, prediction, view count, first/last seen.
 *
 * Why a separate table from `predictions`:
 *   `predictions` is one row per matchup-per-model (shared by all users).
 *   `user_prediction_views` is one row per (user, matchup). Joined to
 *   `predictions` on (fight_id, fighter1_id, fighter2_id) + current
 *   MODEL_VERSION to hydrate the full prediction on the history page.
 *
 * Why we store fighter IDs here and not just fight_id:
 *   After a fighter swap, the ESPN fight_id often stays the same but the
 *   matchup changes. A user who viewed the OLD matchup should still see
 *   that old matchup in their history, not the new one. Keying on the
 *   full tuple preserves the historical view.
 *
 * Global-ready design:
 *   Setting user_id to NULL represents an anonymous/global view (logged-out
 *   users, or aggregated popularity metrics). We don't insert those yet —
 *   the /api/prediction endpoint only writes a row when the session has a
 *   user id — but the schema admits it without migration churn later.
 *
 * Safe to run multiple times (uses IF NOT EXISTS everywhere).
 *
 * Run: node scripts/migrate-user-prediction-views.mjs
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
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log("Running user_prediction_views migration...");

  await sql`
    CREATE TABLE IF NOT EXISTS user_prediction_views (
      id               SERIAL PRIMARY KEY,
      user_id          VARCHAR(100),
      fight_id         VARCHAR(100) NOT NULL,
      fighter1_id      VARCHAR(100) NOT NULL,
      fighter2_id      VARCHAR(100) NOT NULL,
      event_id         VARCHAR(100),
      model_version    VARCHAR(100) NOT NULL,
      first_viewed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      last_viewed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      view_count       INTEGER      NOT NULL DEFAULT 1
    )
  `;
  console.log("user_prediction_views table created.");

  // One row per user per matchup per model. Incrementing the same user's
  // view on the same fight is an UPSERT against this unique index.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_prediction_views_user_matchup_key
      ON user_prediction_views (user_id, fight_id, fighter1_id, fighter2_id, model_version)
  `;
  console.log("unique index (user_id, fight_id, fighter1_id, fighter2_id, model_version) created.");

  // For the /my-predictions page: "my most-recent N views, newest first".
  await sql`
    CREATE INDEX IF NOT EXISTS user_prediction_views_user_recency_idx
      ON user_prediction_views (user_id, last_viewed_at DESC)
  `;
  console.log("user recency index created.");

  // For the future global accuracy page joined by event.
  await sql`
    CREATE INDEX IF NOT EXISTS user_prediction_views_event_id_idx
      ON user_prediction_views (event_id)
  `;
  console.log("event_id index created.");

  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
