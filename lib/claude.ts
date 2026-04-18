/**
 * Claude AI prediction engine — v2.
 *
 * Improvements over v1:
 *  - Pre-computes analytical signals (streaks, trajectory, style, etc.)
 *    via lib/signals.ts before any AI call, so the prompt contains
 *    derived insights rather than just raw stat tables.
 *  - Four-section structured reasoning forces the model to think through
 *    (A) Recent Form, (B) Statistical Profile, (C) Context / Physical,
 *    (D) Matchup Signals, then optionally (E) Market Calibration.
 *  - Market odds injected as calibration input (not a source of truth).
 *  - Cache v2 keys — stale v1 predictions are still readable but new ones
 *    go to v2 automatically via the updated cache helpers.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Fight, Fighter, PredictionResult } from "@/types";
import { enrichFighterWithUFCStats } from "./ufcstats";
import { getCachedPrediction, setCachedPrediction } from "./cache";
import { computeFightSignals } from "./signals";
import { fetchAllMMAOdds, mapOddsToFight } from "./odds";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Fighter context builder ──────────────────────────────────────────────────

function buildFighterContext(fighter: Fighter) {
  return {
    name: fighter.name,
    nickname: fighter.nickname ?? null,
    record: `${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}`,
    winsBreakdown: {
      byKO:         fighter.record.winsByKO     ?? "unknown",
      bySubmission: fighter.record.winsBySub    ?? "unknown",
      byDecision:   fighter.record.winsByDec    ?? "unknown",
    },
    physicalAttributes: {
      height:      fighter.height      ?? "unknown",
      reach:       fighter.reach       ?? "unknown",
      stance:      fighter.stance      ?? "unknown",
      age:         fighter.age         ?? "unknown",
      careerYears: fighter.careerStartDate
        ? Math.floor(
            (Date.now() - new Date(fighter.careerStartDate).getTime()) /
              (1000 * 60 * 60 * 24 * 365)
          )
        : "unknown",
    },
    strikingStats: {
      significantStrikesLandedPerMin:   fighter.sigStrikesLandedPerMin    ?? "unknown",
      significantStrikesAbsorbedPerMin: fighter.sigStrikesAbsorbedPerMin  ?? "unknown",
      strikeAccuracyPercent:            fighter.sigStrikeAccuracy          ?? "unknown",
      strikeDefensePercent:             fighter.sigStrikeDefense           ?? "unknown",
    },
    grapplingStats: {
      takedownsAvgPer15Min:           fighter.takedownAvgPer15Min     ?? "unknown",
      takedownAccuracyPercent:        fighter.takedownAccuracy         ?? "unknown",
      takedownDefensePercent:         fighter.takedownDefense          ?? "unknown",
      submissionAttemptsAvgPer15Min:  fighter.submissionAvgPer15Min   ?? "unknown",
    },
    recentForm: (fighter.recentFights ?? []).map((f) => ({
      opponent: f.opponent,
      result:   f.result,
      method:   f.method,
      event:    f.event,
      date:     f.date,
    })),
  };
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are an elite MMA analyst with the precision of a professional oddsmaker. \
You make predictions by weighing RECENT FORM above career-average statistics, \
because a fighter's last 3-5 fights reveal far more than their career totals. \
A champion on a 4-fight losing streak must be treated as an underdog, not a favourite. \
You always respond with valid JSON only — no markdown, no prose outside the JSON structure.`;

function buildUserPrompt(
  weightClass: string,
  isTitleFight: boolean,
  f1: object,
  f2: object,
  signals: ReturnType<typeof computeFightSignals>,
  marketOdds: { f1Implied: number; f2Implied: number; bookmakers: number } | null
): string {
  const titleNote = isTitleFight ? "UFC TITLE FIGHT — " : "";
  const oddsSection = marketOdds
    ? `\n\n## (E) Market Calibration\nBookmaker consensus (${marketOdds.bookmakers} books, vig-removed):\n- ${signals.fighter1.formSummary.split(" ")[0]}: ${marketOdds.f1Implied}% implied probability\n- ${signals.fighter2.formSummary.split(" ")[0]}: ${marketOdds.f2Implied}% implied probability\nNote: You are NOT required to agree with the market. Use it as a sanity check only. If your analysis clearly supports a different conclusion, state your own confident prediction.`
    : "";

  return `\
Predict this ${titleNote}${weightClass} division fight using the structured analysis framework below.

---

## Fighter Data

### ${(f1 as { name: string }).name}
${JSON.stringify(f1, null, 2)}

### ${(f2 as { name: string }).name}
${JSON.stringify(f2, null, 2)}

---

## Pre-computed Analytical Signals

### (A) Recent Form
- ${signals.fighter1.formSummary}
- ${signals.fighter2.formSummary}

### (B) Statistical Profile
- ${signals.fighter1.styleSummary}
- ${signals.fighter2.styleSummary}

### (C) Context & Physical
- ${signals.fighter1.contextSummary}
- ${signals.fighter2.contextSummary}

### (D) Matchup Edges
- Striking edge:  ${signals.strikingEdge}
- Grappling edge: ${signals.grapplingEdge}
- Reach edge:     ${signals.reachEdge}
- Momentum edge:  ${signals.momentumEdge}
- Summary: ${signals.matchupSummary}${oddsSection}

---

⚠️  CRITICAL INSTRUCTIONS:
1. Weight RECENT FORM (last 3-5 fights) most heavily. A losing streak overrides strong career stats.
2. KO/TKO vulnerability is a major risk factor — fighters stopped by strikes recently are at real danger.
3. Ring rust (>12 months off) is a legitimate disadvantage, especially at high levels.
4. Confidence should reflect genuine uncertainty — avoid extremes unless the data is overwhelming.
5. Do NOT default to the "more famous" or "former champion" fighter without current evidence.

Respond ONLY with a JSON object (no markdown code blocks) matching this exact schema:
{
  "winner": "exact fighter name",
  "confidence": <integer 50-95>,
  "method": "KO/TKO" | "Submission" | "Decision" | "Split Decision",
  "rounds": <integer 1-5, or null if Decision>,
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
  "narrative": "2-3 sentence analytical breakdown focusing on WHY the predicted winner wins, referencing specific recent form, key stats, and matchup dynamics. Explicitly address the most important risk factor for the losing fighter."
}`;
}

// ─── Main prediction function ─────────────────────────────────────────────────

export async function generatePrediction(fight: Fight): Promise<PredictionResult> {
  // 1. Check cache first — v3 (matchup-scoped) first, then v2/v1 legacy fallback.
  // Passing the fighter IDs means a fighter swap on the same slot (common when
  // ESPN keeps matchNumber stable through an injury replacement) naturally
  // misses cache and regenerates against the new matchup.
  const cached = await getCachedPrediction(fight.id, fight.fighter1.id, fight.fighter2.id);
  if (cached) return cached;

  // 2. Enrich fighters + fetch odds in parallel
  const [enrichedF1, enrichedF2, allOdds] = await Promise.all([
    enrichFighterWithUFCStats(fight.fighter1),
    enrichFighterWithUFCStats(fight.fighter2),
    fetchAllMMAOdds().catch(() => []),
  ]);

  // 3. Compute analytical signals
  const signals = computeFightSignals(enrichedF1, enrichedF2);

  // 4. Map market odds (optional — soft-fail if unavailable)
  const fightOdds = mapOddsToFight(allOdds, fight.fighter1.name, fight.fighter2.name);
  const marketOdds = fightOdds
    ? {
        f1Implied:  fightOdds.fighter1.impliedProbability,
        f2Implied:  fightOdds.fighter2.impliedProbability,
        bookmakers: fightOdds.bookmakerCount,
      }
    : null;

  // 5. Build prompt context
  const f1Context = buildFighterContext(enrichedF1);
  const f2Context = buildFighterContext(enrichedF2);

  // 6. Call Claude with structured prompt
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserPrompt(
          fight.weightClass,
          fight.isTitleFight,
          f1Context,
          f2Context,
          signals,
          marketOdds
        ),
      },
    ],
  });

  const rawText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // 7. Parse JSON (strip accidental markdown fences)
  const jsonText = rawText
    .replace(/^```json?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const parsed = JSON.parse(jsonText);

  const prediction: PredictionResult = {
    fightId:    fight.id,
    winner:     parsed.winner,
    confidence: Math.min(95, Math.max(50, Number(parsed.confidence))),
    method:     parsed.method,
    rounds:     parsed.rounds ?? undefined,
    fighter1Breakdown: {
      name:           parsed.fighter1Breakdown?.name           ?? fight.fighter1.name,
      keyAdvantages:  parsed.fighter1Breakdown?.keyAdvantages  ?? [],
      keyWeaknesses:  parsed.fighter1Breakdown?.keyWeaknesses  ?? [],
    },
    fighter2Breakdown: {
      name:           parsed.fighter2Breakdown?.name           ?? fight.fighter2.name,
      keyAdvantages:  parsed.fighter2Breakdown?.keyAdvantages  ?? [],
      keyWeaknesses:  parsed.fighter2Breakdown?.keyWeaknesses  ?? [],
    },
    narrative:    parsed.narrative ?? "",
    generatedAt:  new Date().toISOString(),
  };

  // 8. Cache (writes to v2 key automatically)
  // Write to v3 (matchup-scoped) key so future fighter swaps naturally invalidate.
  await setCachedPrediction(fight.id, prediction, fight.fighter1.id, fight.fighter2.id);

  return prediction;
}
