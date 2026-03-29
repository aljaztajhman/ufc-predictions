"use client";

/**
 * FightPickModal — shown when the user clicks "+ Add to Slip" on a fight card.
 */

import { useState, useEffect } from "react";
import { X, Trophy, TrendingUp, TrendingDown } from "lucide-react";
import { useSlip } from "@/contexts/SlipContext";
import { formatAmericanOdds } from "@/lib/odds";
import type { Fight, FightOdds, SlipMethod } from "@/types";
import { cn } from "@/lib/utils";
import { formatRecord } from "@/lib/utils";

interface FightPickModalProps {
  fight: Fight;
  eventName: string;
  eventDate: string;
  odds?: FightOdds | null;
  onClose: () => void;
}

const METHODS: { value: SlipMethod; label: string }[] = [
  { value: "any", label: "Any method" },
  { value: "KO/TKO", label: "KO / TKO" },
  { value: "Submission", label: "Submission" },
  { value: "Decision", label: "Decision" },
];

export function FightPickModal({
  fight,
  eventName,
  eventDate,
  odds,
  onClose,
}: FightPickModalProps) {
  const { addPick, isInSlip } = useSlip();
  const [selectedFighterId, setSelectedFighterId] = useState<string | null>(null);
  const [selectedFighterName, setSelectedFighterName] = useState<string | null>(null);
  const [method, setMethod] = useState<SlipMethod>("any");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const alreadyInSlip = isInSlip(fight.id);

  function selectFighter(id: string, name: string) {
    setSelectedFighterId(id);
    setSelectedFighterName(name);
  }

  function handleConfirm() {
    if (!selectedFighterId || !selectedFighterName) return;

    addPick({
      fightId: fight.id,
      eventId: fight.eventId,
      eventName,
      eventDate,
      fighter1: {
        id: fight.fighter1.id,
        name: fight.fighter1.name,
        record: fight.fighter1.record,
      },
      fighter2: {
        id: fight.fighter2.id,
        name: fight.fighter2.name,
        record: fight.fighter2.record,
      },
      weightClass: fight.weightClass,
      isTitleFight: fight.isTitleFight,
      pickedFighterId: selectedFighterId,
      pickedFighterName: selectedFighterName,
      pickedMethod: method,
      addedAt: Date.now(),
      odds: odds ?? undefined,
    });

    onClose();
  }

  function getFighterOdds(fighterName: string) {
    if (!odds) return null;
    return fighterName === fight.fighter1.name ? odds.fighter1 : odds.fighter2;
  }

  function renderFighterCard(
    fighter: Fight["fighter1"] | Fight["fighter2"],
  ) {
    const isSelected = selectedFighterId === fighter.id;
    const fighterOdds = getFighterOdds(fighter.name);
    const isFavourite = fighterOdds && fighterOdds.americanOdds < 0;

    return (
      <button
        onClick={() => selectFighter(fighter.id, fighter.name)}
        className={cn(
          "flex-1 rounded-xl border p-4 transition-all duration-200 text-left group relative overflow-hidden",
          isSelected
            ? "border-[#D20A0A]/60 bg-[#D20A0A]/10"
            : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
        )}
      >
        {isSelected && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#D20A0A]/8 to-transparent pointer-events-none" />
        )}

        {/* Fighter name */}
        <p className={cn(
          "font-black text-sm leading-tight mb-1 relative z-10",
          isSelected ? "text-white" : "text-white/75 group-hover:text-white/95"
        )}>
          {fighter.name}
        </p>

        {/* Record */}
        <p className="text-xs text-white/55 font-mono relative z-10">
          {formatRecord(fighter.record.wins, fighter.record.losses, fighter.record.draws)}
        </p>

        {/* Odds block */}
        {fighterOdds && (
          <div className="mt-3 relative z-10">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={cn(
                "text-sm font-bold font-mono",
                isFavourite ? "text-green-400" : "text-blue-400"
              )}>
                {formatAmericanOdds(fighterOdds.americanOdds)}
              </span>
              {isFavourite
                ? <TrendingDown size={12} className="text-green-400/80" />
                : <TrendingUp size={12} className="text-blue-400/80" />
              }
            </div>
            <p className="text-xs text-white/60">
              {fighterOdds.impliedProbability}% implied
            </p>
          </div>
        )}

        {/* Selected tick */}
        {isSelected && (
          <div
            className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-black"
            style={{ background: "rgba(210,10,10,0.85)" }}
          >
            ✓
          </div>
        )}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md bg-[#141520] border border-white/12 rounded-2xl shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D20A0A]/60 to-transparent" />

        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {fight.isTitleFight && (
                <Trophy size={13} className="text-yellow-400" />
              )}
              <span className="text-xs text-white/65 font-semibold uppercase tracking-widest">
                {fight.weightClass}{fight.isTitleFight ? " · Title Fight" : ""}
              </span>
            </div>
            <p className="text-white/70 text-sm">{eventName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/55 hover:text-white/80 hover:bg-white/8 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Pick prompt */}
        <p className="px-5 text-white font-bold text-base mb-4">
          Pick your winner
        </p>

        {/* Fighter cards */}
        <div className="px-5 flex gap-3 mb-5">
          {renderFighterCard(fight.fighter1)}

          <div className="flex items-center justify-center flex-shrink-0">
            <span className="text-white/45 text-xs font-black">VS</span>
          </div>

          {renderFighterCard(fight.fighter2)}
        </div>

        {/* Bookmaker note */}
        {odds && (
          <p className="px-5 text-xs text-white/55 mb-4">
            Odds from {odds.bookmakerCount} bookmaker{odds.bookmakerCount !== 1 ? "s" : ""} · consensus average
          </p>
        )}

        {/* Method selector */}
        <div className="px-5 mb-5">
          <p className="text-xs text-white/65 font-semibold uppercase tracking-widest mb-3">
            Win method (optional)
          </p>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMethod(m.value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                  method === m.value
                    ? "border-[#D20A0A]/60 bg-[#D20A0A]/15 text-white"
                    : "border-white/12 bg-white/[0.04] text-white/60 hover:border-white/25 hover:text-white/80"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/12 text-white/65 hover:text-white/85 text-sm font-semibold transition-all hover:bg-white/6"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedFighterId || alreadyInSlip}
            className={cn(
              "flex-[2] py-3 rounded-xl text-sm font-bold transition-all",
              selectedFighterId && !alreadyInSlip
                ? "text-white cursor-pointer hover:opacity-90"
                : "text-white/40 cursor-not-allowed"
            )}
            style={{
              background: selectedFighterId && !alreadyInSlip
                ? "linear-gradient(135deg, #D20A0A, #FF2525)"
                : "rgba(255,255,255,0.07)",
            }}
          >
            {alreadyInSlip ? "Already in slip" : "Add to Slip"}
          </button>
        </div>
      </div>
    </div>
  );
}
