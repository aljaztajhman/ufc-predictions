"use client";

import type { AccumulatorAnalysis } from "@/types";
import { formatAmericanOdds } from "@/lib/odds";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface AccumulatorResultProps {
  analysis: AccumulatorAnalysis;
}

const RISK_CONFIG = {
  safe: {
    label: "Safe",
    colour: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.35)",
  },
  risky: {
    label: "Risky",
    colour: "#eab308",
    bg: "rgba(234,179,8,0.12)",
    border: "rgba(234,179,8,0.35)",
  },
  longshot: {
    label: "Longshot",
    colour: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.35)",
  },
  miracle: {
    label: "Miracle",
    colour: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.35)",
  },
} as const;

function parlayToAmerican(decimal: number): string {
  if (decimal <= 1) return "—";
  const american =
    decimal >= 2
      ? Math.round((decimal - 1) * 100)
      : Math.round(-100 / (decimal - 1));
  return american > 0 ? `+${american}` : `${american}`;
}

export function AccumulatorResult({ analysis }: AccumulatorResultProps) {
  const risk = RISK_CONFIG[analysis.riskLevel];
  const score = analysis.slipScore;
  const edge = analysis.totalAiEdge;

  return (
    <div className="space-y-4">
      {/* ── Hero card ─────────────────────────────────────────────── */}
      <div
        className="rounded-xl border p-4 relative overflow-hidden"
        style={{ background: risk.bg, borderColor: risk.border }}
      >
        {/* top glow line */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${risk.colour}70, transparent)`,
          }}
        />

        {/* Slip Score + badge row */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-xs text-white/70 font-semibold uppercase tracking-widest mb-1">
              Slip Score
            </p>
            <p
              className="text-4xl font-black tabular-nums leading-none"
              style={{ color: risk.colour }}
            >
              {score}%
            </p>
            <p className="text-xs text-white/60 mt-1.5">
              avg. AI confidence across {analysis.picks.length} pick
              {analysis.picks.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 mt-1">
            {/* Risk badge */}
            <span
              className="px-3 py-1.5 rounded-full border text-xs font-bold"
              style={{
                color: risk.colour,
                background: risk.bg,
                borderColor: risk.border,
              }}
            >
              {risk.label}
            </span>

            {/* AI Edge badge — only if odds were available */}
            {edge !== undefined && (
              <span
                className="flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold"
                style={
                  edge > 0
                    ? {
                        color: "#4ade80",
                        background: "rgba(34,197,94,0.12)",
                        borderColor: "rgba(34,197,94,0.30)",
                      }
                    : edge < 0
                    ? {
                        color: "#f87171",
                        background: "rgba(239,68,68,0.12)",
                        borderColor: "rgba(239,68,68,0.30)",
                      }
                    : {
                        color: "rgba(255,255,255,0.60)",
                        background: "rgba(255,255,255,0.06)",
                        borderColor: "rgba(255,255,255,0.15)",
                      }
                }
              >
                {edge > 0 ? (
                  <TrendingUp size={11} />
                ) : edge < 0 ? (
                  <TrendingDown size={11} />
                ) : (
                  <Minus size={11} />
                )}
                {edge > 0 ? "+" : ""}
                {edge}% AI edge
              </span>
            )}
          </div>
        </div>

        {/* Score bar */}
        <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-3 mb-4">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(score, 100)}%`, background: risk.colour }}
          />
        </div>

        {/* Secondary stats */}
        <div className="space-y-2 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/65">Parlay odds</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-bold text-white/90">
                {analysis.parlayOddsDecimal.toFixed(2)}x
              </span>
              <span className="text-xs text-white/60 font-mono">
                ({parlayToAmerican(analysis.parlayOddsDecimal)})
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-white/55">Parlay probability</span>
            <span className="text-xs font-mono text-white/60">
              {analysis.combinedProbability.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── AI narrative ──────────────────────────────────────────── */}
      {analysis.narrative && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D20A0A] animate-pulse" />
            <span className="text-xs text-white/65 font-bold uppercase tracking-widest">
              AI Assessment
            </span>
          </div>
          <p className="text-sm text-white/80 leading-relaxed">
            {analysis.narrative}
          </p>
        </div>
      )}

      {/* ── Per-pick breakdown ────────────────────────────────────── */}
      <div>
        <p className="text-xs text-white/60 font-bold uppercase tracking-widest mb-2.5">
          Pick breakdown
        </p>
        <div className="space-y-2">
          {analysis.picks.map((pick) => {
            const p = pick.pickProbability ?? 0;
            const colour =
              p >= 65
                ? "#22c55e"
                : p >= 55
                ? "#eab308"
                : p >= 45
                ? "#f97316"
                : "#ef4444";
            const pickedOdds = pick.odds
              ? pick.pickedFighterName === pick.fighter1.name
                ? pick.odds.fighter1
                : pick.odds.fighter2
              : null;

            return (
              <div
                key={pick.fightId}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/[0.04] border border-white/8"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white/90 truncate">
                    {pick.pickedFighterName}
                  </p>
                  <p className="text-xs text-white/55 truncate mt-0.5">
                    {pick.fighter1.name} vs {pick.fighter2.name}
                    {!pick.matchesAI && (
                      <span className="text-red-400/80 ml-1 font-medium">· vs AI</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 ml-3 flex-shrink-0">
                  {pickedOdds && (
                    <span className="text-xs font-mono text-white/55">
                      {formatAmericanOdds(pickedOdds.americanOdds)}
                    </span>
                  )}
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: colour }}
                  >
                    {p}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-white/45 text-center pb-1">
        For entertainment only — not betting or financial advice.
      </p>
    </div>
  );
}
