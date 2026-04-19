/**
 * Prediction persistence layer.
 *
 * Architecture:
 *   KV (Upstash Redis)      — hot read cache, optional, best-effort.
 *   Postgres (predictions)  — authoritative store. Every prediction ever
 *                             generated is kept here forever, enabling the
 *                             accuracy track-record page and the per-user
 *                             prediction-history tab.
 *
 * Read chain (readStoredPrediction):
 *   1. KV hit                  → return (hot path, ~10ms)
 *   2. Postgres hit            → re-populate KV, return (warm path, ~50ms)
 *   3. miss                    → caller (lib/claude.ts) generates fresh
 *
 * Write chain (writeStoredPrediction):
 *   Always write-through: KV + Postgres in parallel. A KV failure never
 *   blocks the Postgres write, because Postgres is the truth. A Postgres
 *   failure is logged but does not block KV (so the user still sees the
 *   prediction immediately — the next cron pass or a manual backfill can
 *   recover the missing row).
 */

import type { Fight, PredictionResult } from "@/types";
import { sql } from "@/lib/db";
import {
  getCachedPrediction,
  setCachedPrediction,
} from "@/lib/cache";

// Bumped whenever the prompt, model, or input signals change in a way that
// invalidates prior predictions. Used as the model_version column in Postgres
// and keeps older predictions around for historical / accuracy comparison.
//
// Current: claude-opus-4-6 (upgraded from sonnet-4 in Task C).
export const MODEL_VERSION = "opus-4-6-v1";

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Look up an existing prediction for this exact matchup + model, preferring
 * the fast KV cache. On KV miss, fall back to Postgres and re-populate KV.
 * Returns null if we've never generated this prediction before.
 */
export async function readStoredPrediction(
  fight: Fight,
): Promise<PredictionResult | null> {
  // 1. KV hot path. Uses the v3 matchup-scoped key internally.
  const kv = await getCachedPrediction(
    fight.id,
    fight.fighter1.id,
    fight.fighter2.id,
  );
  if (kv) return kv;

  // 2. Postgres fallback.
  try {
    const rows = await sql`
      SELECT prediction
      FROM predictions
      WHERE fight_id      = ${fight.id}
        AND fighter1_id   = ${fight.fighter1.id}
        AND fighter2_id   = ${fight.fighter2.id}
        AND model_version = ${MODEL_VERSION}
      ORDER BY generated_at DESC
      LIMIT 1
    `;
    if (rows.length === 0) return null;

    const prediction = rows[0].prediction as PredictionResult;

    // Warm the KV back up so the next reader gets the fast path.
    // Fire-and-forget: never block the response on cache writes.
    setCachedPrediction(
      fight.id,
      prediction,
      fight.fighter1.id,
      fight.fighter2.id,
    ).catch(() => { /* ignore */ });

    return prediction;
  } catch (err) {
    console.error("[predictions] Postgres read failed:", err);
    // KV was already checked and missed; if Postgres is down we have to
    // report a miss so the caller can decide to regenerate.
    return null;
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export interface PredictionInputsSnapshot {
  // A compact snapshot of the key signals / odds used to make the prediction.
  // Freeform JSONB — schema will evolve. Keep it small (we write one row per
  // matchup per model).
  signals?: unknown;
  marketOdds?: unknown;
  [key: string]: unknown;
}

/**
 * Persist a freshly-generated prediction. Writes to BOTH Postgres (authoritative)
 * and KV (cache). Inputs are optional but recommended — they enable post-hoc
 * accuracy analysis by signal.
 */
export async function writeStoredPrediction(
  fight: Fight,
  prediction: PredictionResult,
  inputs?: PredictionInputsSnapshot,
): Promise<void> {
  const kvWrite = setCachedPrediction(
    fight.id,
    prediction,
    fight.fighter1.id,
    fight.fighter2.id,
  ).catch((err) => {
    console.error("[predictions] KV write failed (non-fatal):", err);
  });

  const pgWrite = persistPredictionRow(fight, prediction, inputs).catch(
    (err) => {
      console.error("[predictions] Postgres write failed (non-fatal):", err);
    },
  );

  // Both are best-effort; we await so that callers can rely on the write
  // having been attempted by the time they return to the HTTP handler.
  await Promise.all([kvWrite, pgWrite]);
}

async function persistPredictionRow(
  fight: Fight,
  prediction: PredictionResult,
  inputs?: PredictionInputsSnapshot,
): Promise<void> {
  // ON CONFLICT DO UPDATE so re-generating the same matchup overwrites the
  // previous row (same model_version). If model_version differs, this is a
  // new row — the UNIQUE index includes model_version.
  await sql`
    INSERT INTO predictions
      (fight_id, fighter1_id, fighter2_id, event_id, model_version, prediction, inputs, generated_at)
    VALUES
      (
        ${fight.id},
        ${fight.fighter1.id},
        ${fight.fighter2.id},
        ${fight.eventId},
        ${MODEL_VERSION},
        ${JSON.stringify(prediction)}::jsonb,
        ${inputs ? JSON.stringify(inputs) : null}::jsonb,
        NOW()
      )
    ON CONFLICT (fight_id, fighter1_id, fighter2_id, model_version)
    DO UPDATE SET
      prediction   = EXCLUDED.prediction,
      inputs       = EXCLUDED.inputs,
      generated_at = NOW()
  `;
}

// ─── Accuracy / history helpers (used by /api/accuracy, /api/history) ─────────

export interface StoredPredictionRow {
  id: number;
  fightId: string;
  fighter1Id: string;
  fighter2Id: string;
  eventId: string | null;
  modelVersion: string;
  prediction: PredictionResult;
  generatedAt: string;
}

/**
 * List all predictions for a given event (for the event-level history view).
 */
export async function listPredictionsForEvent(
  eventId: string,
): Promise<StoredPredictionRow[]> {
  const rows = await sql`
    SELECT id, fight_id, fighter1_id, fighter2_id, event_id,
           model_version, prediction, generated_at
    FROM predictions
    WHERE event_id = ${eventId}
    ORDER BY generated_at DESC
  `;
  return rows.map((r: any) => ({
    id:           r.id as number,
    fightId:      r.fight_id as string,
    fighter1Id:   r.fighter1_id as string,
    fighter2Id:   r.fighter2_id as string,
    eventId:      (r.event_id as string) ?? null,
    modelVersion: r.model_version as string,
    prediction:   r.prediction as PredictionResult,
    generatedAt:  new Date(r.generated_at as string).toISOString(),
  }));
}
