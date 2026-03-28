"use client";

/**
 * AccumulatorResult — displayed at the bottom of the SlipDrawer
 * after the user runs "Analyze Accumulator".
 *
 * Shows:
 *  - Combined probability (large number + progress arc)
 *  - Risk level badge
 *  - Theoretical parlay odds multiplier
 *  - AI narrative
 *  - Per-pick confidence breakdown
 */

import type { AccumulatorAnalysis } from "@/types";
import { cn } from "@/lib/utils";
import { formatAmericanOdds } from "@/lib/odds";

interface AccumulatorResultProps {
  analysis: AccumulatorAnalysis;
}

const RISK_CONFIG = {
  safe: {
    label: "Safe",
    colour: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.30)",
    desc: "Strong combined probability",
  },
  risky: {
    label: "Risky",
    colour: "#eab308",
    bg: "rgba(234,179,8,0.12)",
    border: "rgba(234,179,8,0.30)",
    desc: "Moderate combined probability",
  },
  longshot: {
    label: "Longshot",
    colour: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.30)",
    desc: "Low combined probability",
  },
  miracle: {
    label: "Miracle",
    colour: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.30)",
    desc: "Very low combined probability",
  },
} as const;

export function AccumulatorResult({ analysis }: AccumulatorResultProps) {
  const risk = RISK_CONFIG[analysis.riskLevel];
  const prob = analysis.combinedProbability;

  // Format parlay odds as American for display
  function parlayToAmerican(decimal: number): string {
    if (decimal <= 1) return "—";
    const american = decimal >= 2
      ? Math.round((decimal - 1) * 100)
      : Math.round(-100 / (decimal - 1));
    return american > 0 ? `+${american}` : `${american}`;
  }

  return (
    <div className="space-y-4">
      {/* Combined probability + risk */}
      <div
        className="rounded-xl border p-4 relative overflow-hidden"
        style={{ background: risk.bg, borderColor: risk.border }}
      >
        <div className="absolute top-0 left-0 right-0 h-[1px]"
             style={{ background: `linear-gradient(90deg, transparent, ${risk.colour}60, transparent)` }} />

        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] text-white/35 font-medium uppercase tracking-widest mb-0.5">
              Combined Probability
            </p>
            <p className="text-3xl font-black tabular-nums" style={{ color: risk.colour }}>
              {prob.toFixed(1)}%
            </p>
          </div>
          <div
            className="px-3 py-1.5 rounded-full border text-xs font-bold"
            style={{ color: risk.colour, background: risk.bg, borderColor: risk.border }}
          >
            {risk.label}
          </div>
        </div>

        {/* Probability bar */}
        <div className="h-1.5 rounded-full bg-white/8 overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(prob, 100)}%`, background: risk.colour }}
          />
        </div>

        {/* Parlay odds row */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/30">Theoretical parlay odds</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-white/60">
              {analysis.parlayOddsDecimal.toFixed(2)}x
            </span>
            <span className="text-white/30">
              ({parlayToAmerican(analysis.parlayOddsDecimal)})
            </span>
          </div>
        </div>

        {/* AI overall score vs statistical */}
        {analysis.aiOverallScore !== analysis.combinedProbability && (
          <div className="flex items-center justify-between text-xs mt-1.5">
            <span className="text-white/30">AI holistic score</span>
            <span className="font-mono font-semibold text-white/60">
              {analysis.aiOverallScore}%
            </span>
          </div>
        )}
      </div>

      {/* AI narrative */}
      {analysis.narrative && (
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D20A0A] animate-pulse" />
            <span className="text-[10px] text-white/35 font-medium uppercase tracking-widest">
              AI Assessment
            </span>
          </div>
          <p className="text-white/70 text-xs leading-relaxed">
            {analysis.narrative}
          </p>
        </div>
      )}

      {/* Per-pick breakdown */}
      <div>
        <p className="text-[10px] text-white/25 font-medium uppercase tracking-widest mb-2">
          Pick breakdown
        </p>
        <div className="space-y-1.5">
          {analysis.picks.map((pick) => {
            const prob = pick.pickProbability ?? 0;
            const colour = prob >= 65 ? "#22c55e" : prob >= 45 ? "#eab308" : prob >= 30 ? "#f97316" : "#ef4444";
            const pickedOdds = pick.odds
              ? (pick.pickedFighterName === pick.fighter1.name
                  ? pick.odds.fighter1
                  : pick.odds.fighter2)
              : null;

            return (
              <div
                key={pick.fightId}
                className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.03] border border-white/5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white/80 truncate">
                    {pick.pickedFighterName}
                  </p>
                  <p className="text-[10px] text-white/25 truncate">
                    {pick.fighter1.name} vs {pick.fighter2.name}
                    {!pick.matchesAI && (
                      <span className="text-red-400/70 ml-1">· vs AI</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  {pickedOdds && (
                    <span className="text-[10px] font-mono text-white/35">
                      {formatAmericanOdds(pickedOdds.americanOdds)}
                    </span>
                  )}
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: colour }}
                  >
                    {prob}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-white/15 text-center leading-relaxed">
        For entertainment only. Not betting or financial advice.
      </p>
    </div>
  );
}
