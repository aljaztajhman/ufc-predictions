import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRecord(wins: number, losses: number, draws: number, nc = 0): string {
  let record = `${wins}-${losses}`;
  if (draws > 0) record += `-${draws}`;
  if (nc > 0) record += ` (${nc} NC)`;
  return record;
}

export function getEventBadge(dateStr: string): "TONIGHT" | "TOMORROW" | "LIVE" | null {
  const now = new Date();
  const event = new Date(dateStr);
  const todayStr = now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (event.toDateString() === todayStr) return "TONIGHT";
  if (event.toDateString() === tomorrow.toDateString()) return "TOMORROW";
  return null;
}

export function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getFlagEmoji(countryCode?: string): string {
  if (!countryCode) return "🌐";
  const code = countryCode.toUpperCase().slice(0, 2);
  if (!/^[A-Z]{2}$/.test(code)) return "🌐";
  // Regional indicator symbols: A = 0x1F1E6
  const offset = 0x1f1e6 - 65;
  return [...code].map((c) => String.fromCodePoint(c.charCodeAt(0) + offset)).join("");
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 75) return "text-green-400";
  if (confidence >= 60) return "text-yellow-400";
  return "text-ufc-red";
}

export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 80) return "High Confidence";
  if (confidence >= 65) return "Moderate Confidence";
  if (confidence >= 50) return "Slight Edge";
  return "Too Close to Call";
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
