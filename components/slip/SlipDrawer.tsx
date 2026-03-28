"use client";

/**
 * SlipDrawer — the persistent prediction slip panel.
 *
 * Structure:
 *  - Renders nothing on auth pages (login / register)
 *  - A fixed floating trigger button shows the pick count
 *  - Clicking it opens a slide-in panel from the right
 *  - Panel shows: picks list → Analyze button → AccumulatorResult
 *
 * The trigger button sits in the bottom-right corner on mobile,
 * and is accessible from any page in the app.
 */

import { useEffect, useRef } from "react";
import { X, Trash2, Sparkles, AlertCircle, ClipboardList } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSlip } from "@/contexts/SlipContext";
import { SlipItem } from "./SlipItem";
import { AccumulatorResult } from "./AccumulatorResult";
import { cn } from "@/lib/utils";

const AUTH_PAGES = ["/login", "/register"];

export function SlipDrawer() {
  const pathname = usePathname();
  const {
    picks,
    analysis,
    isAnalyzing,
    analyzeError,
    drawerOpen,
    clearSlip,
    analyzeAccumulator,
    setDrawerOpen,
  } = useSlip();

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && drawerOpen) setDrawerOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [drawerOpen, setDrawerOpen]);

  // Prevent body scroll when drawer is open on mobile
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // Don't render on auth pages
  if (AUTH_PAGES.includes(pathname)) return null;

  const pickCount = picks.length;
  const canAnalyze = pickCount >= 1 && !isAnalyzing;
  const label = pickCount === 0
    ? "Slip"
    : pickCount === 1
    ? "1 Pick"
    : `${pickCount} Picks`;

  return (
    <>
      {/* ── Floating trigger button ───────────────────────────────────────── */}
      <button
        onClick={() => setDrawerOpen(!drawerOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl",
          "border shadow-2xl font-semibold text-sm transition-all duration-200",
          "hover:scale-105 active:scale-95",
          drawerOpen
            ? "bg-white/10 border-white/20 text-white/70"
            : pickCount > 0
            ? "text-white border-[#D20A0A]/40"
            : "bg-white/[0.06] border-white/10 text-white/50 hover:text-white/70"
        )}
        style={!drawerOpen && pickCount > 0 ? {
          background: "linear-gradient(135deg, #1A0808, #1E0A0A)",
          boxShadow: "0 0 24px rgba(210,10,10,0.25), 0 8px 32px rgba(0,0,0,0.6)",
        } : {}}
        aria-label={`Prediction slip — ${label}`}
      >
        <ClipboardList size={16} className={pickCount > 0 && !drawerOpen ? "text-[#FF2525]" : ""} />
        <span>{label}</span>
        {pickCount > 0 && !drawerOpen && (
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white"
            style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
          >
            {pickCount}
          </span>
        )}
      </button>

      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Slide-in panel ────────────────────────────────────────────────── */}
      <div
        ref={panelRef}
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[400px] flex flex-col",
          "bg-[#0F1020] border-l border-white/8 shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          drawerOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D20A0A]/50 to-transparent" />

        {/* ── Panel header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
            >
              <ClipboardList size={14} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm leading-tight">
                Prediction Slip
              </h2>
              <p className="text-white/30 text-[10px]">
                {pickCount === 0
                  ? "No picks yet"
                  : pickCount === 1
                  ? "Accumulator · 1 fight"
                  : `Accumulator · ${pickCount} fights`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pickCount > 0 && (
              <button
                onClick={clearSlip}
                className="w-7 h-7 rounded-full flex items-center justify-center text-white/25 hover:text-red-400/70 hover:bg-red-400/8 transition-all"
                title="Clear all picks"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button
              onClick={() => setDrawerOpen(false)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/8 transition-all"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {pickCount === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-4">
                <ClipboardList size={22} className="text-white/20" />
              </div>
              <p className="text-white/50 font-semibold text-sm mb-1">Your slip is empty</p>
              <p className="text-white/25 text-xs leading-relaxed">
                Browse an event and tap{" "}
                <span className="text-white/40 font-medium">+ Add to Slip</span>{" "}
                on any fight to build your accumulator.
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* Picks list */}
              {picks.map((pick) => (
                <SlipItem key={pick.fightId} pick={pick} />
              ))}

              {/* Error */}
              {analyzeError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/8 p-3.5">
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-400 text-xs">{analyzeError}</p>
                </div>
              )}

              {/* Analysis result */}
              {analysis && <AccumulatorResult analysis={analysis} />}
            </div>
          )}
        </div>

        {/* ── Footer: analyze button ────────────────────────────────────── */}
        {pickCount > 0 && (
          <div className="px-4 pb-6 pt-3 border-t border-white/6 flex-shrink-0">
            {pickCount === 1 && (
              <p className="text-center text-[10px] text-white/25 mb-2">
                Single fight prediction
              </p>
            )}
            {pickCount >= 2 && (
              <p className="text-center text-[10px] text-white/25 mb-2">
                {pickCount}-fight accumulator
              </p>
            )}
            <button
              onClick={analyzeAccumulator}
              disabled={!canAnalyze}
              className={cn(
                "w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                canAnalyze
                  ? "text-white hover:opacity-90 active:scale-[0.98]"
                  : "text-white/30 cursor-not-allowed"
              )}
              style={{
                background: canAnalyze
                  ? "linear-gradient(135deg, #D20A0A, #FF2525)"
                  : "rgba(255,255,255,0.05)",
              }}
            >
              {isAnalyzing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  {analysis ? "Re-analyze" : "Analyze Accumulator"}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
