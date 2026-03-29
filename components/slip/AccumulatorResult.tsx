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
    border: "rgba(34,197,94,0.30)",
  },
  risky: {
    label: "Risky",
    colour: "#eab308",
    bg: "rgba(234,179,8,0.12)",
    border: "rgba(234,179,8,0.30)",
  },
  longshot: {
    label: "Longshot",
    colour: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.30)",
  },
  miracle: {
    label: "Miracle",
    colour: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.30)",
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
            background: `linear-gradient(90deg, transparent, ${risk.colour}60, transparent)`,
          }}
        />

        {/* Slip Score + badge row */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-xs text-white/40 font-medium uppercase tracking-widest mb-1">
              Slip Score
            </p>
            <p
              className="text-4xl font-black tabular-nums leading-none"
              style={{ color: risk.colour }}
            >
              {score}%
            </p>
            <p className="text-xs text-white/30 mt-1.5">
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
                        color: "#22c55e",
                        background: "rgba(34,197,94,0.10)",
                        borderColor: "rgba(34,197,94,0.25)",
                      }
                    : edge < 0
                    ? {
                        color: "#ef4444",
                        background: "rgba(239,68,68,0.10)",
                        borderColor: "rgba(239,68,68,0.25)",
                      }
                    : {
                        color: "rgba(255,255,255,0.35)",
                        background: "rgba(255,255,255,0.04)",
                        borderColor: "rgba(255,255,255,0.10)",
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
        <div className="h-2 rounded-full bg-white/8 overflow-hidden mt-3 mb-4">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(score, 100)}%`, background: risk.colour }}
          />
        </div>

        {/* Secondary stats */}
        <div className="space-y-2 pt-3 border-t border-white/8">
          {/* Parlay odds */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/55">Parlay odds</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-semibold text-white/85">
                {analysis.parlayOddsDecimal.toFixed(2)}x
              </span>
              <span className="text-xs text-white/50 font-mono">
                ({parlayToAmerican(analysis.parlayOddsDecimal)})
              </span>
            </div>
          </div>

          {/* Parlay probability — kept as a small secondary number */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/45">Parlay probability</span>
            <span className="text-xs font-mono text-white/50">
              {analysis.combinedProbability.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── AI narrative ──────────────────────────────────────────── */}
      {analysis.narrative && (
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D20A0A] animate-pulse" />
            <span className="text-xs text-white/40 font-semibold uppercase tracking-widest">
              AI Assessment
            </span>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            {analysis.narrative}
          </p>
        </div>
      )}

      {/* ── Per-pick breakdown ────────────────────────────────────── */}
      <div>
        <p className="text-xs text-white/30 font-semibold uppercase tracking-widest mb-2.5">
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
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.03] border border-white/5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white/85 truncate">
                    {pick.pickedFighterName}
                  </p>
                  <p className="text-xs text-white/30 truncate mt-0.5">
                    {pick.fighter1.name} vs {pick.fighter2.name}
                    {!pick.matchesAI && (
                      <span className="text-red-400/70 ml-1">· vs AI</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 ml-3 flex-shrink-0">
                  {pickedOdds && (
                    <span className="text-xs font-mono text-white/40">
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

      <p className="text-xs text-white/20 text-center pb-1">
        For entertainment only — not betting or financial advice.
      </p>
    </div>
  );
}
