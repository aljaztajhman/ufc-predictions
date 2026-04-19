"use client";

import { useState } from "react";
import { ChevronDown, Swords, Plus, Check } from "lucide-react";
import type { Fight, PredictionResult, FightOdds } from "@/types";
import { Badge, TitleFightBadge } from "@/components/ui/Badge";
import { StatsComparison } from "@/components/ui/StatBar";
import { PredictionPanel } from "@/components/prediction/PredictionPanel";
import { FightPickModal } from "@/components/slip/FightPickModal";
import { useSlip } from "@/contexts/SlipContext";
import { formatRecord, getFlagEmoji } from "@/lib/utils";
import { formatAmericanOdds } from "@/lib/odds";
import { cn } from "@/lib/utils";

interface FightCardItemProps {
  fight: Fight;
  eventName: string;
  eventDate: string;
  cachedPrediction?: PredictionResult | null;
  odds?: FightOdds | null;
}

export function FightCardItem({
  fight,
  eventName,
  eventDate,
  cachedPrediction,
  odds,
}: FightCardItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [pickModalOpen, setPickModalOpen] = useState(false);
  const { isInSlip } = useSlip();

  const { fighter1, fighter2 } = fight;
  const inSlip = isInSlip(fight.id);

  return (
    <>
      <div className={cn(
        "relative overflow-hidden rounded-2xl border transition-all duration-300",
        fight.isMainEvent
          ? "border-ufc-red/25 bg-gradient-to-br from-[#1A0808] via-[#131520] to-[#0D0F18]"
          : "border-white/7 bg-ufc-dark-2",
        expanded && "border-white/12"
      )}>
        {/* Main event: subtle top accent */}
        {fight.isMainEvent && (
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-ufc-red/60 to-transparent" />
        )}

        {/* Fight header button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left p-4 sm:p-5 group"
          aria-expanded={expanded}
        >
          {/* Badges row */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border",
                fight.isTitleFight
                  ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/25"
                  : fight.isMainEvent
                  ? "text-ufc-red bg-ufc-red/10 border-ufc-red/20"
                  : "text-white/60 bg-white/5 border-white/8"
              )}>
                {fight.isTitleFight ? "🏆 Title Fight" : fight.isMainEvent ? "Main Event" : fight.weightClass}
              </span>
              {fight.isTitleFight && (
                <span className="text-xs font-medium text-white/55 uppercase tracking-wider">
                  {fight.weightClass}
                </span>
              )}
            </div>

            {/* Expand chevron */}
            <div className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              expanded ? "text-white/70" : "text-white/40 group-hover:text-white/65"
            )}>
              <span className="hidden sm:block text-xs font-medium">AI Prediction</span>
              <ChevronDown
                size={14}
                className={cn("transition-transform duration-300", expanded && "rotate-180")}
              />
            </div>
          </div>

          {/* Fighters matchup */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Fighter 1 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {fighter1.countryCode && (
                  <span className="text-lg leading-none flex-shrink-0" title={fighter1.nationality}>
                    {getFlagEmoji(fighter1.countryCode)}
                  </span>
                )}
                <span className={cn(
                  "font-black truncate leading-tight",
                  fight.isMainEvent
                    ? "text-lg sm:text-xl text-white"
                    : "text-base sm:text-lg text-white/95"
                )}>
                  {fighter1.name}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-0.5">
                <span className="text-white/55 text-xs font-mono tabular-nums">
                  {formatRecord(fighter1.record.wins, fighter1.record.losses, fighter1.record.draws)}
                </span>
                {fighter1.stance && (
                  <span className="text-white/60 text-xs uppercase tracking-wider font-medium border border-white/10 px-1.5 py-0.5 rounded-full">
                    {fighter1.stance}
                  </span>
                )}
              </div>
              {/* Inline odds — fighter 1 */}
              {odds && (
                <span className={cn(
                  "text-xs font-mono font-semibold mt-1 block",
                  odds.fighter1.americanOdds < 0 ? "text-green-400/80" : "text-blue-400/80"
                )}>
                  {formatAmericanOdds(odds.fighter1.americanOdds)}
                </span>
              )}
            </div>

            {/* VS badge */}
            <div className="flex-shrink-0 flex items-center justify-center">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center border",
                fight.isMainEvent
                  ? "bg-ufc-red/15 border-ufc-red/30"
                  : "bg-white/5 border-white/10"
              )}>
                <span className={cn(
                  "text-xs font-black uppercase tracking-widest",
                  fight.isMainEvent ? "text-ufc-red" : "text-white/55"
                )}>
                  VS
                </span>
              </div>
            </div>

            {/* Fighter 2 */}
            <div className="flex-1 min-w-0 text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <span className={cn(
                  "font-black truncate leading-tight",
                  fight.isMainEvent
                    ? "text-lg sm:text-xl text-white"
                    : "text-base sm:text-lg text-white/95"
                )}>
                  {fighter2.name}
                </span>
                {fighter2.countryCode && (
                  <span className="text-lg leading-none flex-shrink-0" title={fighter2.nationality}>
                    {getFlagEmoji(fighter2.countryCode)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 mr-0.5">
                {fighter2.stance && (
                  <span className="text-white/60 text-xs uppercase tracking-wider font-medium border border-white/10 px-1.5 py-0.5 rounded-full">
                    {fighter2.stance}
                  </span>
                )}
                <span className="text-white/55 text-xs font-mono tabular-nums">
                  {formatRecord(fighter2.record.wins, fighter2.record.losses, fighter2.record.draws)}
                </span>
              </div>
              {/* Inline odds — fighter 2 */}
              {odds && (
                <span className={cn(
                  "text-xs font-mono font-semibold mt-1 block",
                  odds.fighter2.americanOdds < 0 ? "text-green-400/80" : "text-blue-400/80"
                )}>
                  {formatAmericanOdds(odds.fighter2.americanOdds)}
                </span>
              )}
            </div>
          </div>

          {/* Add to Slip button — sits below the fighters row */}
          <div
            className="mt-3 flex justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPickModalOpen(true)}
              disabled={inSlip}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                inSlip
                  ? "border-green-500/30 bg-green-500/8 text-green-400 cursor-default"
                  : "border-white/12 bg-white/[0.04] text-white/60 hover:border-[#D20A0A]/40 hover:bg-[#D20A0A]/8 hover:text-white/85"
              )}
            >
              {inSlip ? (
                <>
                  <Check size={11} />
                  In Slip
                </>
              ) : (
                <>
                  <Plus size={11} />
                  Add to Slip
                </>
              )}
            </button>
          </div>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-white/6 animate-fade-in-up">
            {/* Stats section */}
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white/75 text-sm font-semibold truncate max-w-[40%]">{fighter1.name}</span>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/8">
                  <Swords size={12} className="text-white/70" />
                  <span className="text-white/70 text-xs uppercase tracking-widest font-semibold">Stats</span>
                </div>
                <span className="text-white/75 text-sm font-semibold text-right truncate max-w-[40%]">{fighter2.name}</span>
              </div>
              <StatsComparison fighter1={fighter1} fighter2={fighter2} />
            </div>

            {/* Physical attributes */}
            {(fighter1.height || fighter1.reach || fighter2.height || fighter2.reach) && (
              <div className="px-4 sm:px-5 pb-4">
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-black/20 border border-white/5">
                  <div className="space-y-2">
                    {fighter1.height && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/45 font-medium">Height</span>
                        <span className="text-white/70 font-mono">{fighter1.height}</span>
                      </div>
                    )}
                    {fighter1.reach && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/45 font-medium">Reach</span>
                        <span className="text-white/70 font-mono">{fighter1.reach}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {fighter2.height && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/70 font-mono text-right flex-1">{fighter2.height}</span>
                        <span className="text-white/45 font-medium ml-2">Height</span>
                      </div>
                    )}
                    {fighter2.reach && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/70 font-mono text-right flex-1">{fighter2.reach}</span>
                        <span className="text-white/45 font-medium ml-2">Reach</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Odds detail block */}
            {odds && (
              <div className="px-4 sm:px-5 pb-4">
                <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3.5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-white/50 font-medium uppercase tracking-widest">
                      Moneyline Odds
                    </span>
                    <span className="text-xs text-white/35">
                      · {odds.bookmakerCount} bookmaker avg
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Fighter 1 odds */}
                    <div>
                      <p className="text-white/60 text-xs font-semibold mb-1 truncate">{fighter1.name}</p>
                      <p className={cn(
                        "text-base font-black font-mono",
                        odds.fighter1.americanOdds < 0 ? "text-green-400" : "text-blue-400"
                      )}>
                        {formatAmericanOdds(odds.fighter1.americanOdds)}
                      </p>
                      <p className="text-xs text-white/45 mt-0.5">
                        {odds.fighter1.decimalOdds.toFixed(2)} · {odds.fighter1.impliedProbability}% implied
                      </p>
                    </div>
                    {/* Fighter 2 odds */}
                    <div className="text-right">
                      <p className="text-white/60 text-xs font-semibold mb-1 truncate">{fighter2.name}</p>
                      <p className={cn(
                        "text-base font-black font-mono",
                        odds.fighter2.americanOdds < 0 ? "text-green-400" : "text-blue-400"
                      )}>
                        {formatAmericanOdds(odds.fighter2.americanOdds)}
                      </p>
                      <p className="text-xs text-white/45 mt-0.5">
                        {odds.fighter2.decimalOdds.toFixed(2)} · {odds.fighter2.impliedProbability}% implied
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Prediction */}
            <div className="border-t border-white/5">
              <PredictionPanel
                fight={fight}
                eventName={eventName}
                eventDate={eventDate}
                cachedPrediction={cachedPrediction}
              />
            </div>
          </div>
        )}
      </div>

      {/* Fight pick modal */}
      {pickModalOpen && (
        <FightPickModal
          fight={fight}
          eventName={eventName}
          eventDate={eventDate}
          odds={odds}
          onClose={() => setPickModalOpen(false)}
        />
      )}
    </>
  );
}

interface FightSectionProps {
  title: string;
  fights: Fight[];
  predictions: Record<string, PredictionResult | null>;
  fightOdds: Record<string, FightOdds | null>;
  eventName: string;
  eventDate: string;
  accent?: boolean;
}

export function FightSection({
  title,
  fights,
  predictions,
  fightOdds,
  eventName,
  eventDate,
  accent,
}: FightSectionProps) {
  if (fights.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        {accent && (
          <div className="w-1 h-5 rounded-full" style={{ background: "linear-gradient(180deg, #FF2525, #D20A0A)" }} />
        )}
        <h2 className={cn(
          "text-xs font-black uppercase tracking-widest",
          accent ? "text-white" : "text-white/50"
        )}>
          {title}
        </h2>
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-white/35 text-xs font-medium">{fights.length} fights</span>
      </div>
      <div className="space-y-2.5 stagger-children">
        {fights.map((fight) => (
          <FightCardItem
            key={fight.id}
            fight={fight}
            eventName={eventName}
            eventDate={eventDate}
            cachedPrediction={predictions[fight.id]}
            odds={fightOdds[fight.id]}
          />
        ))}
      </div>
    </section>
  );
}