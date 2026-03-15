"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Fight, PredictionResult } from "@/types";
import { Badge, TitleFightBadge } from "@/components/ui/Badge";
import { StatsComparison } from "@/components/ui/StatBar";
import { PredictionPanel } from "@/components/prediction/PredictionPanel";
import { formatRecord, getFlagEmoji } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface FightCardItemProps {
  fight: Fight;
  cachedPrediction?: PredictionResult | null;
}

export function FightCardItem({ fight, cachedPrediction }: FightCardItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { fighter1, fighter2 } = fight;

  return (
    <div className={cn(
      "bg-ufc-dark-2 border rounded-xl overflow-hidden transition-all duration-300",
      fight.isMainEvent
        ? "border-ufc-red/25 shadow-lg shadow-ufc-red/5"
        : "border-white/6",
      expanded && "border-white/10"
    )}>
      {/* Fight header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 sm:p-5 group"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="gray" size="sm">
              {fight.weightClass}
            </Badge>
            {fight.isTitleFight && <TitleFightBadge />}
            {fight.isMainEvent && !fight.isTitleFight && (
              <Badge variant="red" size="sm">Main Event</Badge>
            )}
          </div>
          {/* Expand indicator */}
          <div className={cn(
            "flex items-center gap-1.5 text-xs text-white/30 flex-shrink-0 transition-colors group-hover:text-white/60"
          )}>
            <span className="hidden sm:block">AI Prediction</span>
            <ChevronDown
              size={14}
              className={cn("transition-transform duration-300", expanded && "rotate-180")}
            />
          </div>
        </div>

        {/* Fighters row */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Fighter 1 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {fighter1.countryCode && (
                <span className="text-base leading-none" title={fighter1.nationality}>
                  {getFlagEmoji(fighter1.countryCode)}
                </span>
              )}
              <span className="text-white font-bold text-sm sm:text-base truncate">
                {fighter1.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs font-mono">
                {formatRecord(fighter1.record.wins, fighter1.record.losses, fighter1.record.draws)}
              </span>
              {fighter1.stance && (
                <span className="text-white/25 text-[10px] uppercase">{fighter1.stance}</span>
              )}
            </div>
          </div>

          {/* VS */}
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-ufc-red/10 border border-ufc-red/20 flex items-center justify-center">
                <span className="text-ufc-red text-[10px] font-black uppercase">VS</span>
              </div>
            </div>
          </div>

          {/* Fighter 2 */}
          <div className="flex-1 min-w-0 text-right">
            <div className="flex items-center justify-end gap-1.5 mb-0.5">
              <span className="text-white font-bold text-sm sm:text-base truncate">
                {fighter2.name}
              </span>
              {fighter2.countryCode && (
                <span className="text-base leading-none" title={fighter2.nationality}>
                  {getFlagEmoji(fighter2.countryCode)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              {fighter2.stance && (
                <span className="text-white/25 text-[10px] uppercase">{fighter2.stance}</span>
              )}
              <span className="text-white/40 text-xs font-mono">
                {formatRecord(fighter2.record.wins, fighter2.record.losses, fighter2.record.draws)}
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/5 animate-fade-in-up">
          {/* Stats comparison */}
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-white/80 text-sm font-semibold">{fighter1.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-white/25 font-semibold px-2">
                Stats
              </div>
              <div className="text-white/80 text-sm font-semibold text-right">{fighter2.name}</div>
            </div>
            <StatsComparison fighter1={fighter1} fighter2={fighter2} />
          </div>

          {/* Physical attributes */}
          {(fighter1.height || fighter1.reach || fighter2.height || fighter2.reach) && (
            <div className="px-4 sm:px-5 pb-4">
              <div className="grid grid-cols-2 gap-4 p-3 bg-black/20 rounded-lg border border-white/4">
                <div className="space-y-2">
                  {fighter1.height && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/30">Height</span>
                      <span className="text-white/70 font-mono">{fighter1.height}</span>
                    </div>
                  )}
                  {fighter1.reach && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/30">Reach</span>
                      <span className="text-white/70 font-mono">{fighter1.reach}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {fighter2.height && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/70 font-mono">{fighter2.height}</span>
                      <span className="text-white/30">Height</span>
                    </div>
                  )}
                  {fighter2.reach && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/70 font-mono">{fighter2.reach}</span>
                      <span className="text-white/30">Reach</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AI Prediction */}
          <div className="border-t border-white/5">
            <PredictionPanel fight={fight} cachedPrediction={cachedPrediction} />
          </div>
        </div>
      )}
    </div>
  );
}

interface FightSectionProps {
  title: string;
  fights: Fight[];
  predictions: Record<string, PredictionResult | null>;
  accent?: boolean;
}

export function FightSection({ title, fights, predictions, accent }: FightSectionProps) {
  if (fights.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        {accent && <div className="w-1 h-5 bg-ufc-red rounded-full" />}
        <h2 className={cn(
          "text-sm font-black uppercase tracking-widest",
          accent ? "text-white" : "text-white/40"
        )}>
          {title}
        </h2>
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-white/25 text-xs">{fights.length} fights</span>
      </div>
      <div className="space-y-3 stagger-children">
        {fights.map((fight) => (
          <FightCardItem
            key={fight.id}
            fight={fight}
            cachedPrediction={predictions[fight.id]}
          />
        ))}
      </div>
    </section>
  );
}
