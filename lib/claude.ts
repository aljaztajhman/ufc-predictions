/**
 * Claude AI prediction engine.
 * Step 1: enrich fighters with UFCStats data (no AI).
 * Step 2: pass structured JSON to Claude and get back a structured prediction.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Fight, Fighter, PredictionResult } from "@/types";
import { enrichFighterWithUFCStats } from "./ufcstats";
import { getCachedPrediction, setCachedPrediction } from "./cache";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Fighter data prep ────────────────────────────────────────────────────────

function buildFighterContext(fighter: Fighter) {
  return {
    name: fighter.name,
    nickname: fighter.nickname || null,
    record: `${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}`,
    winsBreakdown: {
      byKO: fighter.record.winsByKO ?? "unknown",
      bySubmission: fighter.record.winsBySub ?? "unknown",
      byDecision: fighter.record.winsByDec ?? "unknown",
    },
    physicalAttributes: {
      height: fighter.height || "unknown",
      reach: fighter.reach || "unknown",
      stance: fighter.stance || "unknown",
      nationality: fighter.nationality || "unknown",
    },
    strikingStats: {
      significantStrikesLandedPerMin: fighter.sigStrikesLandedPerMin ?? "unknown",
      significantStrikesAbsorbedPerMin: fighter.sigStrikesAbsorbedPerMin ?? "unknown",
      strikeAccuracyPercent: fighter.sigStrikeAccuracy ?? "unknown",
      strikeDefensePercent: fighter.sigStrikeDefense ?? "unknown",
    },
    grapplingStats: {
      takedownsAvgPer15Min: fighter.takedownAvgPer15Min ?? "unknown",
      takedownAccuracyPercent: fighter.takedownAccuracy ?? "unknown",
      takedownDefensePercent: fighter.takedownDefense ?? "unknown",
      submissionAttemptsAvgPer15Min: fighter.submissionAvgPer15Min ?? "unknown",
    },
    recentForm: (fighter.recentFights || []).map((f) => ({
      opponent: f.opponent,
      result: f.result,
      method: f.method,
      event: f.event,
      date: f.date,
    })),
  };
}

// ─── Claude prediction ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert MMA analyst with deep knowledge of UFC fighter statistics, fighting styles, and matchup analysis. You analyze fights with the precision of a professional oddsmaker. You always respond with valid JSON only — no markdown, no prose outside the JSON structure.`;

const USER_PROMPT_TEMPLATE = (
  weightClass: string,
  isTitleFight: boolean,
  f1: object,
  f2: object
) => `Based on the following fighter statistics and recent form, provide a structured prediction for this ${isTitleFight ? "title " : ""}fight in the ${weightClass} division.

Fighter 1:
${JSON.stringify(f1, null, 2)}

Fighter 2:
${JSON.stringify(f2, null, 2)}

Respond ONLY with a JSON object (no markdown code blocks) matching this exact schema:
{
  "winner": "exact fighter name",
  "confidence": <integer 50-95>,
  "method": "KO/TKO" | "Submission" | "Decision" | "Split Decision",
  "rounds": <integer 1-5 or null if decision>,
  "fighter1Breakdown": {
    "name": "exact fighter 1 name",
    "keyAdvantages": ["advantage 1", "advantage 2", "advantage 3"],
    "keyWeaknesses": ["weakness 1", "weakness 2"]
  },
  "fighter2Breakdown": {
    "name": "exact fighter 2 name",
    "keyAdvantages": ["advantage 1", "advantage 2", "advantage 3"],
    "keyWeaknesses": ["weakness 1", "weakness 2"]
  },
  "narrative": "2-3 sentence analytical breakdown of why this fight plays out this way, referencing specific stats and recent form."
}`;

export async function generatePrediction(fight: Fight): Promise<PredictionResult> {
  // Check cache first — predictions are immutable once generated
  const cached = await getCachedPrediction(fight.id);
  if (cached) return cached;

  // Step 1: Enrich fighters with UFCStats data
  const [enrichedF1, enrichedF2] = await Promise.all([
    enrichFighterWithUFCStats(fight.fighter1),
    enrichFighterWithUFCStats(fight.fighter2),
  ]);

  const f1Context = buildFighterContext(enrichedF1);
  const f2Context = buildFighterContext(enrichedF2);

  // Step 2: Call Claude
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: USER_PROMPT_TEMPLATE(fight.weightClass, fight.isTitleFight, f1Context, f2Context),
      },
    ],
  });

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";

  // Parse JSON — strip any accidental markdown fences
  const jsonText = rawText.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(jsonText);

  const prediction: PredictionResult = {
    fightId: fight.id,
    winner: parsed.winner,
    confidence: Math.min(95, Math.max(50, Number(parsed.confidence))),
    method: parsed.method,
    rounds: parsed.rounds || null,
    fighter1Breakdown: {
      name: parsed.fighter1Breakdown?.name || fight.fighter1.name,
      keyAdvantages: parsed.fighter1Breakdown?.keyAdvantages || [],
      keyWeaknesses: parsed.fighter1Breakdown?.keyWeaknesses || [],
    },
    fighter2Breakdown: {
      name: parsed.fighter2Breakdown?.name || fight.fighter2.name,
      keyAdvantages: parsed.fighter2Breakdown?.keyAdvantages || [],
      keyWeaknesses: parsed.fighter2Breakdown?.keyWeaknesses || [],
    },
    narrative: parsed.narrative || "",
    generatedAt: new Date().toISOString(),
  };

  // Cache permanently
  await setCachedPrediction(fight.id, prediction);

  return prediction;
}
