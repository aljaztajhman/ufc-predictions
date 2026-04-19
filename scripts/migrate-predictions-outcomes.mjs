/**
 * Migration: predictions + fight_outcomes tables.
 *
 * Purpose:
 *   - predictions:   authoritative store of every AI prediction ever generated.
 *                    KV stays as a hot read cache but Postgres is the truth.
 *                    This enables (a) accuracy tracking against real outcomes,
 *                    (b) a per-user prediction-history tab, (c) analytics on
 *                    model quality over time.
 *   - fight_outcomes: real-world results once a fight has happened. Joined
 *                    against `predictions` to compute accuracy per model
 *                    version, per weight class, per method, etc.
 *
 * Schema notes:
 *   - predictions.prediction is JSONB (matches PredictionResult shape).
 *   - predictions.inputs is JSONB and optional — stores the signals + odds
 *     snapshot used to generate the prediction, so we can do post-hoc
 *     "what signals correlate with correct predictions?" analysis later.
 *   - UNIQUE (fight_id, fighter1_id, fighter2_id, model_version) means we
 *     keep ONE prediction per matchup per model. If the model version bumps,
 *     we write a new row (older row preserved for historical comparison).
 *     If a fighter is swapped, the new tuple is a new matchup, new row.
 *
 * Safe to run multiple times.
 *
 * Run: node scripts/migrate-predictions-outcomes.mjs
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
  console.log("🔄  Running predictions + fight_outcomes migration...");

  // 1. predictions — authoritative store of AI predictions
  await sql`
    CREATE TABLE IF NOT EXISTS predictions (
      id             SERIAL PRIMARY KEY,
      fight_id       VARCHAR(100) NOT NULL,
      fighter1_id    VARCHAR(100) NOT NULL,
      fighter2_id    VARCHAR(100) NOT NULL,
      event_id       VARCHAR(100),
      model_version  VARCHAR(100) NOT NULL,
      prediction     JSONB        NOT NULL,
      inputs         JSONB,
      generated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓  predictions table created.");

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS predictions_matchup_model_key
      ON predictions (fight_id, fighter1_id, fighter2_id, model_version)
  `;
  console.log("✓  predictions unique index (fight_id, fighter1_id, fighter2_id, model_version) created.");

  await sql`
    CREATE INDEX IF NOT EXISTS predictions_event_id_idx ON predictions (event_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS predictions_generated_at_idx ON predictions (generated_at DESC)
  `;
  console.log("✓  predictions secondary indexes (event_id, generated_at) created.");

  // 2. fight_outcomes — real-world results to compute accuracy against
  await sql`
    CREATE TABLE IF NOT EXISTS fight_outcomes (
      fight_id       VARCHAR(100) PRIMARY KEY,
      event_id       VARCHAR(100),
      winner_id      VARCHAR(100),
      winner_name    VARCHAR(200),
      method         VARCHAR(50),
      round          SMALLINT,
      time           VARCHAR(20),
      fetched_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓  fight_outcomes table created.");

  await sql`
    CREATE INDEX IF NOT EXISTS fight_outcomes_event_id_idx ON fight_outcomes (event_id)
  `;
  console.log("✓  fight_outcomes event_id index created.");

  console.log("✅  Migration complete.");
}

migrate().catch((err) => {
  console.error("❌  Migration failed:", err);
  process.exit(1);
});
