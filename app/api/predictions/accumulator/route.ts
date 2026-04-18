/**
 * POST /api/predictions/accumulator
 *
 * Takes an array of SlipPick objects and returns an AccumulatorAnalysis.
 *
 * For each pick:
 *  1. Fetch cached prediction (or generate via Claude + UFCStats)
 *  2. Calculate P(user's pick correct):
 *       - user matches AI winner  → confidence
 *       - user goes against AI    → 100 - confidence
 *  3. Calculate AI edge vs market implied probability (if odds available)
 *
 * For the accumulator:
 *  4. Combined probability = product of individual pick probabilities
 *  5. Parlay odds = product of decimal odds (or derived from AI probability)
 *  6. Ask Claude for a holistic narrative + overall score
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generatePrediction } from "@/lib/claude";
import { auth } from "@/lib/auth";
import { checkAccumulatorRateLimit, getClientIp, rateLimitResponse } from "@/lib/ratelimit";
import type { Fight, SlipPick, AccumulatorAnalysis } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60; // up to 60s — may need to generate several predictions

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Risk level from slip score (average AI confidence) ──────────────────────
// Based on average pick quality, not the compounding parlay math.

function getRiskLevel(slipScore: number): AccumulatorAnalysis["riskLevel"] {
  if (slipScore >= 65) return "safe";
  if (slipScore >= 55) return "risky";
  if (slipScore >= 45) return "longshot";
  return "miracle";
}

// ─── Build a minimal Fight object from a SlipPick for prediction generation ───

function pickToFight(pick: SlipPick): Fight {
  return {
    id: pick.fightId,
    eventId: pick.eventId,
    order: 0,
    section: "main",
    weightClass: pick.weightClass,
    isTitleFight: pick.isTitleFight,
    isMainEvent: false,
    fighter1: {
      id: pick.fighter1.id,
      name: pick.fighter1.name,
      record: pick.fighter1.record,
    },
    fighter2: {
      id: pick.fighter2.id,
      name: pick.fighter2.name,
      record: pick.fighter2.record,
    },
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 503 }
    );
  }

  // Rate limit — accumulator is more expensive than a single prediction
  // (N cached/fresh predictions + 1 narrative call), so the budget is
  // tighter: 10/day/user + 60/hr/IP.
  const session = await auth();
  const userId = session?.user?.id;
  const ip = getClientIp(req.headers);
  const rl = await checkAccumulatorRateLimit(userId, ip);
  if (!rl.success) {
    return rateLimitResponse(rl) as unknown as NextResponse;
  }

  let picks: SlipPick[];
  try {
    const body = await req.json();
    picks = body.picks;
    if (!Array.isArray(picks) || picks.length === 0) {
      return NextResponse.json({ error: "picks array is required" }, { status: 400 });
    }
    if (picks.length > 8) {
      return NextResponse.json({ error: "Maximum 8 picks per slip" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // ── Step 1: Enrich each pick with AI prediction ────────────────────────────
  const enrichedPicks: SlipPick[] = await Promise.all(
    picks.map(async (pick): Promise<SlipPick> => {
      try {
        const fight = pickToFight(pick);
        const prediction = await generatePrediction(fight);

        const matchesAI = prediction.winner === pick.pickedFighterName;
        const pickProbability = matchesAI
          ? prediction.confidence
          : Math.max(5, 100 - prediction.confidence); // floor at 5% — not 0

        // AI edge vs market implied probability (signed: positive = AI sees value)
        let aiEdge: number | undefined;
        if (pick.odds) {
          const marketImplied =
            pick.pickedFighterName === pick.fighter1.name
              ? pick.odds.fighter1.impliedProbability
              : pick.odds.fighter2.impliedProbability;
          aiEdge = pickProbability - marketImplied;
        }

        return {
          ...pick,
          aiPrediction: prediction,
          matchesAI,
          pickProbability,
          aiEdge,
        };
      } catch (err) {
        console.error(`[accumulator] Prediction failed for fight ${pick.fightId}:`, err);
        // Keep the pick but without enrichment — use 50% as fallback
        return { ...pick, pickProbability: 50, matchesAI: undefined };
      }
    })
  );

  // ── Step 2: Slip score (average AI confidence) + combined parlay probability ─
  const slipScore = Math.round(
    enrichedPicks.reduce((sum, pick) => sum + (pick.pickProbability ?? 50), 0) /
      enrichedPicks.length
  );

  const combinedDecimal = enrichedPicks.reduce(
    (acc, pick) => acc * ((pick.pickProbability ?? 50) / 100),
    1
  );
  const combinedProbability = Math.round(combinedDecimal * 1000) / 10; // 1 decimal

  // Total AI edge: sum of per-pick edges (only where odds were available)
  const edgePicks = enrichedPicks.filter((p) => p.aiEdge !== undefined);
  const totalAiEdge =
    edgePicks.length > 0
      ? Math.round(edgePicks.reduce((sum, p) => sum + (p.aiEdge ?? 0), 0))
      : undefined;

  // ── Step 3: Parlay odds ───────────────────────────────────────────────────
  const parlayOddsDecimal = enrichedPicks.reduce((acc, pick) => {
    if (pick.odds) {
      // Use real market odds for the fighter the user picked
      const odds =
        pick.pickedFighterName === pick.fighter1.name
          ? pick.odds.fighter1.decimalOdds
          : pick.odds.fighter2.decimalOdds;
      return acc * odds;
    }
    // Fallback: derive from AI probability (avoid division by near-zero)
    const p = Math.max(0.05, (pick.pickProbability ?? 50) / 100);
    return acc * (1 / p);
  }, 1);

  // ── Step 4: Claude narrative ──────────────────────────────────────────────
  const riskLevel = getRiskLevel(slipScore);

  const picksDesc = enrichedPicks
    .map((pick, i) => {
      const matchText = pick.matchesAI === true
        ? `Matches AI pick (${pick.pickProbability}% probability)`
        : pick.matchesAI === false
        ? `Goes against AI — only ${pick.pickProbability}% probability`
        : `Probability: ${pick.pickProbability}%`;

      const edgeText =
        pick.aiEdge !== undefined
          ? ` | AI edge vs market: ${pick.aiEdge > 0 ? "+" : ""}${pick.aiEdge}%`
          : "";

      return (
        `Pick ${i + 1}: ${pick.pickedFighterName} to win ` +
        `(${pick.fighter1.name} vs ${pick.fighter2.name}, ${pick.weightClass})\n` +
        `  → ${matchText}${edgeText}` +
        (pick.pickedMethod !== "any" ? `\n  → Method: ${pick.pickedMethod}` : "")
      );
    })
    .join("\n\n");

  let narrative = "";
  let aiOverallScore = Math.round(combinedProbability);

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 384,
      system:
        "You are a sharp MMA analyst evaluating a prediction slip. " +
        "Respond ONLY with valid JSON — no markdown, no extra text.",
      messages: [
        {
          role: "user",
          content:
            `Evaluate this ${enrichedPicks.length}-fight accumulator:\n\n` +
            picksDesc +
            `\n\nSlip score (average AI confidence): ${slipScore}%\n` +
            `Parlay probability (compounded): ${combinedProbability}%\n` +
            (totalAiEdge !== undefined ? `Total AI edge vs market: ${totalAiEdge > 0 ? "+" : ""}${totalAiEdge}%\n` : "") +
            `Risk level: ${riskLevel}\n\n` +
            `Respond with exactly this JSON: ` +
            `{"aiOverallScore": <integer 0-100>, "narrative": "<2-3 sentence assessment of this slip>"}`,
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    aiOverallScore = Math.min(100, Math.max(0, Number(parsed.aiOverallScore ?? combinedProbability)));
    narrative = typeof parsed.narrative === "string" ? parsed.narrative : "";
  } catch (err) {
    console.error("[accumulator] Claude narrative failed:", err);
    // Continue without narrative — analysis is still useful
  }

  // ── Step 5: Build and return result ──────────────────────────────────────
  const result: AccumulatorAnalysis = {
    picks: enrichedPicks,
    combinedProbability,
    slipScore,
    totalAiEdge,
    aiOverallScore,
    riskLevel,
    parlayOddsDecimal: Math.round(parlayOddsDecimal * 100) / 100,
    narrative,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(result);
}
