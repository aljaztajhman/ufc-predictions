"use client";

import { useState, useTransition } from "react";
import { Sparkles, ChevronRight, AlertCircle, Clock } from "lucide-react";
import type { Fight, PredictionResult } from "@/types";
import { ConfidenceRing } from "@/components/ui/ConfidenceRing";
import { PredictionSkeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/utils";

interface PredictionPanelProps {
  fight: Fight;
  /**
   * Legacy prop — kept for type-compat with callers that still pass it.
   * NOT used as initial state: every user sees the same "Show Prediction"
   * button regardless of cache status so the page feels consistent. The
   * first click triggers a real fetch; subsequent visitors hit Postgres/KV
   * behind the scenes via /api/prediction and it still looks the same.
   */
  cachedPrediction?: PredictionResult | null;
}

// Minimum client-side wait between click and prediction reveal. This hides
// the difference between a KV hit (~50ms), a Postgres fallback (~150ms), and
// a fresh Claude generation (~5-15s, though Postgres caches it). From the
// user's perspective, every fight feels like the AI "is thinking", not like
// they're the Nth person to see a pre-canned answer.
const MIN_LOADING_MS = 2000;

export function PredictionPanel({ fight }: PredictionPanelProps) {
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [requested, setRequested] = useState(false);

  const requestPrediction = () => {
    if (isPending || prediction) return;
    setRequested(true);
    setError(null);

    startTransition(async () => {
      try {
        const [res] = await Promise.all([
          fetch(`/api/prediction/${fight.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fight }),
          }),
          new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS)),
        ]);

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Request failed: ${res.status}`);
        }

        const data: PredictionResult = await res.json();
        setPrediction(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate prediction");
        setRequested(false);
      }
    });
  };

  // Not yet requested
  if (!requested && !prediction) {
    return (
      <div className="p-4 sm:p-5">
        <button
          onClick={requestPrediction}
          className={cn(
            "w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl",
            "bg-ufc-red/10 border border-ufc-red/20 text-ufc-red font-semibold text-sm",
            "hover:bg-ufc-red/15 hover:border-ufc-red/35 transition-all duration-200",
            "group"
          )}
        >
          <Sparkles size={15} className="group-hover:scale-110 transition-transform" />
          Show AI Prediction
          <ChevronRight size={14} className="opacity-60 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    );
  }

  // Loading
  if (isPending) {
    return (
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-white/60 text-xs mb-4">
          <div className="w-3 h-3 border-2 border-ufc-red/40 border-t-ufc-red rounded-full animate-spin" />
          <span>Analyzing fighter data and generating prediction…</span>
        </div>
        <PredictionSkeleton />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 p-3 bg-red-500/8 border border-red-500/20 rounded-lg">
          <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-red-400 text-sm font-medium">Prediction failed</p>
            <p className="text-red-400/60 text-xs mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => { setError(null); setRequested(false); }}
            className="text-red-400/60 hover:text-red-400 text-xs underline flex-shrink-0"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Prediction available
  if (!prediction) return null;

  const isF1Winner = prediction.winner === fight.fighter1.name ||
    fight.fighter1.name.toLowerCase().includes(prediction.winner.toLowerCase()) ||
    prediction.winner.toLowerCase().includes(fight.fighter1.name.toLowerCase().split(" ").pop() || "");

  return (
    <div className="p-4 sm:p-5 space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-ufc-red/15 rounded flex items-center justify-center">
            <Sparkles size={11} className="text-ufc-red" />
          </div>
          <span className="text-white/80 text-sm font-semibold uppercase tracking-wider">
            AI Prediction
          </span>
        </div>
        {prediction.generatedAt && (
          <div className="flex items-center gap-1 text-white/50 text-xs">
            <Clock size={11} />
            <span>{formatShortDate(prediction.generatedAt)}</span>
          </div>
        )}
      </div>

      {/* Winner + confidence */}
      <div className="flex items-center gap-5 p-4 bg-black/30 rounded-xl border border-white/5">
        <ConfidenceRing value={prediction.confidence} size={84} />
        <div className="flex-1 min-w-0">
          <p className="text-white/65 text-xs uppercase tracking-widest mb-1">Predicted Winner</p>
          <p className="text-white font-black text-lg sm:text-xl leading-tight truncate">
            {prediction.winner}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant="outline" size="sm">{prediction.method}</Badge>
            {prediction.rounds && (
              <Badge variant="gray" size="sm">Rd {prediction.rounds}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Fighter breakdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { data: prediction.fighter1Breakdown, isWinner: isF1Winner },
          { data: prediction.fighter2Breakdown, isWinner: !isF1Winner },
        ].map(({ data, isWinner }) => (
          <div
            key={data.name}
            className={cn(
              "p-3 rounded-lg border space-y-2",
              isWinner
                ? "bg-ufc-red/5 border-ufc-red/15"
                : "bg-white/3 border-white/6"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-white/90 text-sm font-bold truncate">{data.name}</span>
              {isWinner && (
                <span className="text-ufc-red text-xs uppercase tracking-wider font-semibold flex-shrink-0">
                  ✓ Pick
                </span>
              )}
            </div>

            {data.keyAdvantages.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest text-emerald-400/80 mb-1.5">Advantages</p>
                <ul className="space-y-1">
                  {data.keyAdvantages.map((adv, i) => (
                    <li key={i} className="text-xs text-white/65 flex gap-1.5">
                      <span className="text-emerald-500/60 flex-shrink-0">+</span>
                      <span>{adv}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.keyWeaknesses.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest text-red-400/80 mb-1.5">Concerns</p>
                <ul className="space-y-1">
                  {data.keyWeaknesses.map((w, i) => (
                    <li key={i} className="text-xs text-white/60 flex gap-1.5">
                      <span className="text-red-400/70 flex-shrink-0">−</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Narrative */}
      {prediction.narrative && (
        <div className="p-3 bg-black/20 rounded-lg border border-white/5">
          <p className="text-xs uppercase tracking-widest text-white/55 mb-2">Analysis</p>
          <p className="text-white/75 text-sm leading-relaxed">{prediction.narrative}</p>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-white/45 text-xs text-center">
        AI analysis for entertainment only. Not betting advice.
      </p>
    </div>
  );
}