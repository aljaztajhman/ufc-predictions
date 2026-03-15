"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ConfidenceRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
}

export function ConfidenceRing({
  value,
  size = 80,
  strokeWidth = 6,
  className,
  showLabel = true,
}: ConfidenceRingProps) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setAnimated(true); },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = animated ? (value / 100) * circumference : 0;
  const offset = circumference - progress;

  const color =
    value >= 75 ? "#22c55e" :
    value >= 60 ? "#f59e0b" :
    "#D20A0A";

  const label =
    value >= 80 ? "High" :
    value >= 65 ? "Moderate" :
    value >= 50 ? "Slight" :
    "Close";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
            filter: `drop-shadow(0 0 6px ${color}80)`,
          }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-white font-black text-lg leading-none" style={{ color }}>
            {value}%
          </span>
          <span className="text-white/40 text-[9px] uppercase tracking-wider mt-0.5">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

export function ConfidenceBar({ value, name }: { value: number; name: string }) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setAnimated(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const color =
    value >= 75 ? "bg-emerald-500" :
    value >= 60 ? "bg-amber-500" :
    "bg-ufc-red";

  return (
    <div ref={ref} className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-white/60 truncate max-w-[60%]">{name}</span>
        <span className="text-white font-semibold">{value}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-1000 ease-out", color)}
          style={{ width: animated ? `${value}%` : "0%" }}
        />
      </div>
    </div>
  );
}
