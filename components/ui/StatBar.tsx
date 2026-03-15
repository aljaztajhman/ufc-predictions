"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface StatBarProps {
  label: string;
  value1: number | undefined;
  value2: number | undefined;
  max?: number;
  unit?: string;
  higherIsBetter?: boolean;
  name1: string;
  name2: string;
  format?: (v: number) => string;
}

export function StatBar({
  label,
  value1,
  value2,
  max,
  unit = "",
  higherIsBetter = true,
  name1,
  name2,
  format,
}: StatBarProps) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setAnimated(true); },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  if (value1 === undefined || value2 === undefined) return null;

  const computedMax = max ?? Math.max(value1, value2) * 1.3 || 10;
  const pct1 = Math.min(100, (value1 / computedMax) * 100);
  const pct2 = Math.min(100, (value2 / computedMax) * 100);

  const isBetter1 = higherIsBetter ? value1 >= value2 : value1 <= value2;

  const fmt = format ?? ((v: number) => `${v.toFixed(1)}${unit}`);

  return (
    <div ref={ref} className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-white/50">
        <span className={cn("font-medium", isBetter1 ? "text-white" : "text-white/40")}>
          {fmt(value1)}
        </span>
        <span className="text-white/35 text-[10px] uppercase tracking-wider">{label}</span>
        <span className={cn("font-medium", !isBetter1 ? "text-white" : "text-white/40")}>
          {fmt(value2)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 h-2">
        {/* Fighter 1 bar — right-aligned */}
        <div className="flex-1 flex justify-end">
          <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out ml-auto",
                isBetter1 ? "bg-ufc-red" : "bg-white/20"
              )}
              style={{ width: animated ? `${pct1}%` : "0%" }}
            />
          </div>
        </div>
        {/* Divider */}
        <div className="w-px h-3 bg-white/20 flex-shrink-0" />
        {/* Fighter 2 bar — left-aligned */}
        <div className="flex-1">
          <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                !isBetter1 ? "bg-ufc-red" : "bg-white/20"
              )}
              style={{ width: animated ? `${pct2}%` : "0%", transitionDelay: "100ms" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatsComparisonProps {
  fighter1: {
    name: string;
    sigStrikesLandedPerMin?: number;
    sigStrikesAbsorbedPerMin?: number;
    sigStrikeAccuracy?: number;
    sigStrikeDefense?: number;
    takedownAvgPer15Min?: number;
    takedownAccuracy?: number;
    takedownDefense?: number;
    submissionAvgPer15Min?: number;
  };
  fighter2: {
    name: string;
    sigStrikesLandedPerMin?: number;
    sigStrikesAbsorbedPerMin?: number;
    sigStrikeAccuracy?: number;
    sigStrikeDefense?: number;
    takedownAvgPer15Min?: number;
    takedownAccuracy?: number;
    takedownDefense?: number;
    submissionAvgPer15Min?: number;
  };
}

export function StatsComparison({ fighter1, fighter2 }: StatsComparisonProps) {
  const hasStrikingStats =
    fighter1.sigStrikesLandedPerMin !== undefined ||
    fighter1.sigStrikeAccuracy !== undefined;

  const hasGrapplingStats =
    fighter1.takedownAvgPer15Min !== undefined ||
    fighter1.takedownAccuracy !== undefined;

  if (!hasStrikingStats && !hasGrapplingStats) {
    return (
      <p className="text-white/30 text-sm text-center py-4">
        Detailed stats unavailable for this matchup
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {hasStrikingStats && (
        <div className="space-y-3">
          <h4 className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">
            Striking
          </h4>
          <div className="space-y-2.5">
            <StatBar
              label="Sig. Strikes/Min"
              value1={fighter1.sigStrikesLandedPerMin}
              value2={fighter2.sigStrikesLandedPerMin}
              name1={fighter1.name}
              name2={fighter2.name}
              format={(v) => v.toFixed(2)}
            />
            <StatBar
              label="Str. Accuracy %"
              value1={fighter1.sigStrikeAccuracy}
              value2={fighter2.sigStrikeAccuracy}
              max={100}
              name1={fighter1.name}
              name2={fighter2.name}
              format={(v) => `${v.toFixed(0)}%`}
            />
            <StatBar
              label="Str. Defense %"
              value1={fighter1.sigStrikeDefense}
              value2={fighter2.sigStrikeDefense}
              max={100}
              name1={fighter1.name}
              name2={fighter2.name}
              format={(v) => `${v.toFixed(0)}%`}
            />
            <StatBar
              label="Absorbed/Min"
              value1={fighter1.sigStrikesAbsorbedPerMin}
              value2={fighter2.sigStrikesAbsorbedPerMin}
              name1={fighter1.name}
              name2={fighter2.name}
              higherIsBetter={false}
              format={(v) => v.toFixed(2)}
            />
          </div>
        </div>
      )}

      {hasGrapplingStats && (
        <div className="space-y-3">
          <h4 className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">
            Grappling
          </h4>
          <div className="space-y-2.5">
            <StatBar
              label="TD Avg/15min"
              value1={fighter1.takedownAvgPer15Min}
              value2={fighter2.takedownAvgPer15Min}
              name1={fighter1.name}
              name2={fighter2.name}
              format={(v) => v.toFixed(2)}
            />
            <StatBar
              label="TD Accuracy %"
              value1={fighter1.takedownAccuracy}
              value2={fighter2.takedownAccuracy}
              max={100}
              name1={fighter1.name}
              name2={fighter2.name}
              format={(v) => `${v.toFixed(0)}%`}
            />
            <StatBar
              label="TD Defense %"
              value1={fighter1.takedownDefense}
              value2={fighter2.takedownDefense}
              max={100}
              name1={fighter1.name}
              name2={fighter2.name}
              format={(v) => `${v.toFixed(0)}%`}
            />
            <StatBar
              label="Sub. Avg/15min"
              value1={fighter1.submissionAvgPer15Min}
              value2={fighter2.submissionAvgPer15Min}
              name1={fighter1.name}
              name2={fighter2.name}
              format={(v) => v.toFixed(2)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
