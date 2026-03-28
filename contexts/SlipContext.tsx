"use client";

/**
 * SlipContext — global state for the prediction slip (accumulator).
 *
 * Provides:
 *  - picks: current selections
 *  - analysis: result of the last accumulator analysis
 *  - addPick / removePick / clearSlip
 *  - isInSlip(fightId): quick check to show "added" state on fight cards
 *  - analyzeAccumulator(): calls POST /api/predictions/accumulator
 *  - drawerOpen / setDrawerOpen: controls the slip panel visibility
 *
 * Persistence: picks are stored in localStorage keyed by userId.
 * Analysis result is session-only (re-run after any pick change).
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import type { SlipPick, AccumulatorAnalysis } from "@/types";

// ─── Context shape ────────────────────────────────────────────────────────────

interface SlipContextValue {
  picks: SlipPick[];
  analysis: AccumulatorAnalysis | null;
  isAnalyzing: boolean;
  analyzeError: string | null;
  drawerOpen: boolean;
  addPick: (pick: SlipPick) => void;
  removePick: (fightId: string) => void;
  clearSlip: () => void;
  isInSlip: (fightId: string) => boolean;
  analyzeAccumulator: () => Promise<void>;
  setDrawerOpen: (open: boolean) => void;
}

const SlipContext = createContext<SlipContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

const MAX_PICKS = 8;

export function SlipProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "guest";
  const storageKey = `ufc:slip:${userId}`;

  const [picks, setPicks] = useState<SlipPick[]>([]);
  const [analysis, setAnalysis] = useState<AccumulatorAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // ── Hydrate from localStorage on mount / user change ──────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Strip any stale analysis-only fields when reloading
          setPicks(
            parsed.map((p: SlipPick) => ({
              ...p,
              aiPrediction: undefined,
              pickProbability: undefined,
              matchesAI: undefined,
              aiEdge: undefined,
            }))
          );
        }
      }
    } catch {
      // corrupted storage — start fresh
      localStorage.removeItem(storageKey);
    }
    setHydrated(true);
  }, [storageKey]);

  // ── Persist picks to localStorage whenever they change ────────────────────
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(picks));
    } catch {
      // storage full or private mode — non-fatal
    }
  }, [picks, storageKey, hydrated]);

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const addPick = useCallback((pick: SlipPick) => {
    setPicks((prev) => {
      if (prev.some((p) => p.fightId === pick.fightId)) return prev; // already in slip
      if (prev.length >= MAX_PICKS) return prev;                       // cap at 8
      return [...prev, pick];
    });
    setAnalysis(null);   // invalidate previous analysis
    setAnalyzeError(null);
    setDrawerOpen(true); // open drawer so user sees their pick was added
  }, []);

  const removePick = useCallback((fightId: string) => {
    setPicks((prev) => prev.filter((p) => p.fightId !== fightId));
    setAnalysis(null);
    setAnalyzeError(null);
  }, []);

  const clearSlip = useCallback(() => {
    setPicks([]);
    setAnalysis(null);
    setAnalyzeError(null);
  }, []);

  const isInSlip = useCallback(
    (fightId: string) => picks.some((p) => p.fightId === fightId),
    [picks]
  );

  // ─── Analyze ───────────────────────────────────────────────────────────────

  const analyzeAccumulator = useCallback(async () => {
    if (picks.length === 0 || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      const res = await fetch("/api/predictions/accumulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Analysis failed (${res.status})`);
      }

      const result: AccumulatorAnalysis = await res.json();

      // Merge enriched pick data (probabilities, odds, aiPrediction) back
      setPicks(result.picks);
      setAnalysis(result);
    } catch (err) {
      console.error("[slip] analyzeAccumulator error:", err);
      setAnalyzeError(
        err instanceof Error ? err.message : "Analysis failed. Please try again."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [picks, isAnalyzing]);

  // ─── Context value ─────────────────────────────────────────────────────────

  return (
    <SlipContext.Provider
      value={{
        picks,
        analysis,
        isAnalyzing,
        analyzeError,
        drawerOpen,
        addPick,
        removePick,
        clearSlip,
        isInSlip,
        analyzeAccumulator,
        setDrawerOpen,
      }}
    >
      {children}
    </SlipContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSlip(): SlipContextValue {
  const ctx = useContext(SlipContext);
  if (!ctx) throw new Error("useSlip must be used within a SlipProvider");
  return ctx;
}
