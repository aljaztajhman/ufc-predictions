"use client";

/**
 * SlipItem — one pick row inside the SlipDrawer.
 *
 * Shows:
 *  - Weight class + event name
 *  - Fighter 1 vs Fighter 2 — with the user's pick highlighted
 *  - If analysis has run: AI confidence bar, market odds, AI edge indicator
 *  - Remove button (×)
 */

import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useSlip } from "@/contexts/SlipContext";
import { formatAmericanOdds } from "@/lib/odds";
import type { SlipPick } from "@/types";
import { cn } from "@/lib/utils";

interface SlipItemProps {
  pick: SlipPick;
}

export function SlipItem({ pick }: SlipItemProps) {
  const { removePick } = useSlip();

  const hasAnalysis =
    pick.pickProbability !== undefined && pick.matchesAI !== undefined;

  const pickedOdds =
    pick.odds
      ? pick.pickedFighterName === pick.fighter1.name
        ? pick.odds.fighter1
        : pick.odds.fighter2
      : null;

  // Colour coding for pick probability
  function probColour(p: number): string {
    if (p >= 65) return "#22c55e"; // green
    if (p >= 45) return "#eab308"; // yellow
    if (p >= 30) return "#f97316"; // orange
    return "#ef4444";              // red
  }

  // AI edge display
  const edgeDisplay = (() => {
    if (pick.aiEdge === undefined || pick.odds === undefined) return null;
    if (Math.abs(pick.aiEdge) < 2) return { label: "Neutral", icon: Minus, colour: "text-white/40" };
    if (pick.aiEdge > 0) return { label: `+${pick.aiEdge}% AI edge`, icon: TrendingUp, colour: "text-green-400" };
    return { label: `${pick.aiEdge}% vs market`, icon: TrendingDown, colour: "text-red-400" };
  })();

  return (
    <div className="relative rounded-xl border border-white/8 bg-white/[0.03] overflow-hidden">
      {/* Top accent for picks that match AI */}
      {hasAnalysis && pick.matchesAI && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
      )}
      {hasAnalysis && !pick.matchesAI && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
      )}

      <div className="p-3">
        {/* Header row: weight class + remove */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/30 font-medium uppercase tracking-wider">
              {pick.weightClass}
            </span>
            {pick.isTitleFight && (
              <span className="text-[10px] text-yellow-400/70">🏆</span>
            )}
          </div>
          <button
            onClick={() => removePick(pick.fightId)}
            className="w-5 h-5 rounded-full flex items-center justify-center text-white/25 hover:text-white/70 hover:bg-white/8 transition-all"
            aria-label="Remove pick"
          >
            <X size={11} />
          </button>
        </div>

        {/* Fighters row */}
        <div className="flex items-center gap-2 mb-2.5">
          {/* Fighter 1 */}
          <div className={cn(
            "flex-1 min-w-0 px-2 py-1.5 rounded-lg border transition-all text-left",
            pick.pickedFighterName === pick.fighter1.name
              ? "border-[#D20A0A]/50 bg-[#D20A0A]/10"
              : "border-white/6 bg-transparent"
          )}>
            <p className={cn(
              "text-xs font-bold truncate leading-tight",
              pick.pickedFighterName === pick.fighter1.name
                ? "text-white"
                : "text-white/40"
            )}>
              {pick.fighter1.name}
            </p>
            <p className="text-[10px] text-white/25 font-mono mt-0.5">
              {pick.fighter1.record.wins}-{pick.fighter1.record.losses}-{pick.fighter1.record.draws}
            </p>
          </div>

          <span className="text-[10px] text-white/20 font-black flex-shrink-0">VS</span>

          {/* Fighter 2 */}
          <div className={cn(
            "flex-1 min-w-0 px-2 py-1.5 rounded-lg border transition-all text-right",
            pick.pickedFighterName === pick.fighter2.name
              ? "border-[#D20A0A]/50 bg-[#D20A0A]/10"
              : "border-white/6 bg-transparent"
          )}>
            <p className={cn(
              "text-xs font-bold truncate leading-tight",
              pick.pickedFighterName === pick.fighter2.name
                ? "text-white"
                : "text-white/40"
            )}>
              {pick.fighter2.name}
            </p>
            <p className="text-[10px] text-white/25 font-mono mt-0.5">
              {pick.fighter2.record.wins}-{pick.fighter2.record.losses}-{pick.fighter2.record.draws}
            </p>
          </div>
        </div>

        {/* Method badge */}
        {pick.pickedMethod !== "any" && (
          <p className="text-[10px] text-white/30 mb-2">
            Method: <span className="text-white/50 font-medium">{pick.pickedMethod}</span>
          </p>
        )}

        {/* Analysis data — shown after accumulator is run */}
        {hasAnalysis && (
          <div className="space-y-2 pt-2 border-t border-white/6">
            {/* Pick probability bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/35 font-medium">AI pick probability</span>
                <span
                  className="text-[11px] font-bold tabular-nums"
                  style={{ color: probColour(pick.pickProbability!) }}
                >
                  {pick.pickProbability}%
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pick.pickProbability}%`,
                    background: probColour(pick.pickProbability!),
                  }}
                />
              </div>
            </div>

            {/* Odds + AI edge row */}
            {pickedOdds && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/30">Odds</span>
                  <span className="text-[11px] font-mono font-semibold text-white/70">
                    {formatAmericanOdds(pickedOdds.americanOdds)}
                  </span>
                  <span className="text-[10px] text-white/25">
                    ({pickedOdds.impliedProbability}% mkt)
                  </span>
                </div>
                {edgeDisplay && (
                  <div className={cn("flex items-center gap-1", edgeDisplay.colour)}>
                    <edgeDisplay.icon size={10} />
                    <span className="text-[10px] font-medium">{edgeDisplay.label}</span>
                  </div>
                )}
              </div>
            )}

            {/* AI disagreement warning */}
            {!pick.matchesAI && (
              <p className="text-[10px] text-red-400/70">
                ⚠ Goes against AI prediction
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
