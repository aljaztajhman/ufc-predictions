"use client";

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

  function probColour(p: number): string {
    if (p >= 65) return "#22c55e";
    if (p >= 45) return "#eab308";
    if (p >= 30) return "#f97316";
    return "#ef4444";
  }

  const edgeDisplay = (() => {
    if (pick.aiEdge === undefined || pick.odds === undefined) return null;
    if (Math.abs(pick.aiEdge) < 2) return { label: "Neutral", Icon: Minus, colour: "text-white/55" };
    if (pick.aiEdge > 0) return { label: `+${pick.aiEdge}% AI edge`, Icon: TrendingUp, colour: "text-green-400" };
    return { label: `${pick.aiEdge}% vs market`, Icon: TrendingDown, colour: "text-red-400" };
  })();

  return (
    <div className="relative rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden">
      {hasAnalysis && pick.matchesAI && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
      )}
      {hasAnalysis && !pick.matchesAI && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
      )}

      <div className="p-3.5">
        {/* Header row: weight class + remove */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/65 font-semibold uppercase tracking-wider">
              {pick.weightClass}
            </span>
            {pick.isTitleFight && (
              <span className="text-xs text-yellow-400/80">🏆</span>
            )}
          </div>
          <button
            onClick={() => removePick(pick.fightId)}
            className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/10 transition-all"
            aria-label="Remove pick"
          >
            <X size={13} />
          </button>
        </div>

        {/* Fighters row */}
        <div className="flex items-center gap-2 mb-3">
          {/* Fighter 1 */}
          <div className={cn(
            "flex-1 min-w-0 px-2.5 py-2 rounded-lg border transition-all",
            pick.pickedFighterName === pick.fighter1.name
              ? "border-[#D20A0A]/50 bg-[#D20A0A]/10"
              : "border-white/8 bg-transparent"
          )}>
            <p className={cn(
              "text-sm font-bold truncate leading-tight",
              pick.pickedFighterName === pick.fighter1.name
                ? "text-white"
                : "text-white/55"
            )}>
              {pick.fighter1.name}
            </p>
            <p className="text-xs text-white/55 font-mono mt-0.5">
              {pick.fighter1.record.wins}-{pick.fighter1.record.losses}-{pick.fighter1.record.draws}
            </p>
          </div>

          <span className="text-xs text-white/45 font-black flex-shrink-0">VS</span>

          {/* Fighter 2 */}
          <div className={cn(
            "flex-1 min-w-0 px-2.5 py-2 rounded-lg border transition-all text-right",
            pick.pickedFighterName === pick.fighter2.name
              ? "border-[#D20A0A]/50 bg-[#D20A0A]/10"
              : "border-white/8 bg-transparent"
          )}>
            <p className={cn(
              "text-sm font-bold truncate leading-tight",
              pick.pickedFighterName === pick.fighter2.name
                ? "text-white"
                : "text-white/55"
            )}>
              {pick.fighter2.name}
            </p>
            <p className="text-xs text-white/55 font-mono mt-0.5">
              {pick.fighter2.record.wins}-{pick.fighter2.record.losses}-{pick.fighter2.record.draws}
            </p>
          </div>
        </div>

        {/* Method badge */}
        {pick.pickedMethod !== "any" && (
          <p className="text-xs text-white/55 mb-2.5">
            Method: <span className="text-white/80 font-medium">{pick.pickedMethod}</span>
          </p>
        )}

        {/* Analysis data */}
        {hasAnalysis && (
          <div className="space-y-2.5 pt-2.5 border-t border-white/8">
            {/* Pick probability bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-white/65 font-medium">AI pick probability</span>
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: probColour(pick.pickProbability!) }}
                >
                  {pick.pickProbability}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
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
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/60">Odds</span>
                  <span className="text-sm font-mono font-bold text-white/90">
                    {formatAmericanOdds(pickedOdds.americanOdds)}
                  </span>
                  <span className="text-xs text-white/55">
                    ({pickedOdds.impliedProbability}% mkt)
                  </span>
                </div>
                {edgeDisplay && (
                  <div className={cn("flex items-center gap-1", edgeDisplay.colour)}>
                    <edgeDisplay.Icon size={13} />
                    <span className="text-xs font-semibold">{edgeDisplay.label}</span>
                  </div>
                )}
              </div>
            )}

            {/* AI disagreement warning */}
            {!pick.matchesAI && (
              <p className="text-xs text-red-400/80 font-medium">
                ⚠ Goes against AI prediction
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
