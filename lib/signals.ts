/**
 * Signal computation module.
 *
 * Pure functions — no I/O, no side effects, no external imports except @/types.
 * Computes pre-digested analytical signals from raw Fighter data so that
 * the Claude prompt doesn't have to re-derive them from raw numbers.
 *
 * Entry point:  computeFightSignals(fighter1, fighter2) → FightSignals
 */

import type { Fighter, FighterSignals, FightSignals, RecentFight } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const RING_RUST_DAYS = 365;
const PRIME_AGE_LOW  = 25;
const PRIME_AGE_HIGH = 33;
const RECENCY_WINDOW = 5; // look at last N fights for form signals

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFightDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Compute the streak from the start of recentFights array (most-recent first).
 * Skips NC (no contest) results — they don't break or extend streaks.
 */
function computeStreak(
  fights: RecentFight[]
): { type: "W" | "L" | "D"; count: number } {
  let type: "W" | "L" | "D" | null = null;
  let count = 0;

  for (const fight of fights) {
    if (fight.result === "NC") continue; // NC doesn't count
    const r = fight.result as "W" | "L" | "D";
    if (type === null) {
      type = r;
      count = 1;
    } else if (r === type) {
      count++;
    } else {
      break;
    }
  }

  return { type: type ?? "W", count };
}

/**
 * Count W/L over the last `n` non-NC fights.
 */
function recentRecord(
  fights: RecentFight[],
  n = RECENCY_WINDOW
): { wins: number; losses: number; total: number } {
  const relevant = fights.filter((f) => f.result !== "NC").slice(0, n);
  const wins   = relevant.filter((f) => f.result === "W").length;
  const losses = relevant.filter((f) => f.result === "L").length;
  return { wins, losses, total: relevant.length };
}

/**
 * Has the fighter been stopped by KO in their last `n` fights?
 */
function isKOVulnerable(fights: RecentFight[], n = 5): boolean {
  return fights
    .slice(0, n)
    .some(
      (f) =>
        f.result === "L" &&
        /ko|tko|knockout/i.test(f.method)
    );
}

/**
 * Share of recent wins that ended in a finish (KO, TKO, Sub).
 */
function recentFinishRate(fights: RecentFight[], n = 5): number {
  const wins = fights.slice(0, n).filter((f) => f.result === "W");
  if (wins.length === 0) return 0;
  const finishes = wins.filter((f) => /ko|tko|sub|submission/i.test(f.method));
  return finishes.length / wins.length;
}

/**
 * Rising / declining / volatile / unknown based on last 5 non-NC fights.
 */
function computeTrajectory(
  fights: RecentFight[]
): FighterSignals["trajectory"] {
  const relevant = fights.filter((f) => f.result !== "NC").slice(0, 5);
  if (relevant.length < 3) return "unknown";

  // First half vs second half (more recent first)
  const half = Math.floor(relevant.length / 2);
  const recentWins = relevant.slice(0, half + 1).filter((f) => f.result === "W").length;
  const olderWins  = relevant.slice(half + 1).filter((f) => f.result === "W").length;
  const recentTotal = half + 1;
  const olderTotal  = relevant.length - recentTotal;

  if (olderTotal === 0) return "unknown";

  const recentRate = recentWins / recentTotal;
  const olderRate  = olderWins  / olderTotal;
  const diff = recentRate - olderRate;

  if (diff >= 0.4) return "rising";
  if (diff <= -0.4) return "declining";

  // High variance = volatile
  const results = relevant.map((f) => (f.result === "W" ? 1 : 0));
  const alternating = results
    .slice(0, -1)
    .filter((r, i) => r !== results[i + 1]).length;
  if (alternating >= relevant.length - 2) return "volatile";

  return diff > 0 ? "rising" : "declining";
}

/**
 * Classify a fighter's primary style from their stats.
 */
function computeStyleTag(fighter: Fighter): FighterSignals["styleTag"] {
  const tdAvg   = fighter.takedownAvgPer15Min ?? 0;
  const subAvg  = fighter.submissionAvgPer15Min ?? 0;
  const slpm    = fighter.sigStrikesLandedPerMin ?? 0;
  const tdAcc   = (fighter.takedownAccuracy ?? 0) / 100;

  const grapplingScore = tdAvg * tdAcc + subAvg * 1.5;
  const strikingScore  = slpm;

  if (grapplingScore > 2.5 && subAvg > 0.5) return "Grappler";
  if (grapplingScore > 2.0 && subAvg <= 0.5) return "Wrestler";
  if (strikingScore > 4.0 && grapplingScore < 1.5) return "Striker";
  return "Balanced";
}

/**
 * Striking differential: how much more does the fighter land than absorb?
 * Positive = net aggressor; negative = absorbs more than lands.
 */
function computeStrikingDifferential(fighter: Fighter): number {
  const slpm = fighter.sigStrikesLandedPerMin ?? 0;
  const sapm = fighter.sigStrikesAbsorbedPerMin ?? 0;
  return Math.round((slpm - sapm) * 100) / 100;
}

/**
 * Grappling aggression score: weighted combination of takedown threat + submission threat.
 */
function computeGrapplingScore(fighter: Fighter): number {
  const tdAvg  = fighter.takedownAvgPer15Min ?? 0;
  const tdAcc  = (fighter.takedownAccuracy ?? 0) / 100;
  const subAvg = fighter.submissionAvgPer15Min ?? 0;
  return Math.round((tdAvg * tdAcc + subAvg) * 100) / 100;
}

/**
 * Days since the most recent fight.
 */
function daysSinceLastFight(fights: RecentFight[]): number | null {
  if (!fights.length) return null;
  const last = fights[0]; // most recent first
  if (!last.date) return null;
  const d = parseFightDate(last.date);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Career years: from careerStartDate to today.
 */
function computeCareerYears(careerStartDate?: string): number | null {
  if (!careerStartDate) return null;
  const start = parseFightDate(careerStartDate);
  if (!start) return null;
  return Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 365));
}

// ─── Summary builders ─────────────────────────────────────────────────────────

function buildFormSummary(
  name: string,
  streak: { type: "W" | "L" | "D"; count: number },
  rec: { wins: number; losses: number; total: number },
  trajectory: FighterSignals["trajectory"]
): string {
  const streakStr =
    streak.count > 1
      ? `on a ${streak.count}-fight ${streak.type === "W" ? "win" : streak.type === "L" ? "loss" : "draw"} streak`
      : streak.type === "W"
      ? "coming off a win"
      : "coming off a loss";
  const recStr =
    rec.total > 0
      ? `${rec.wins}W-${rec.losses}L in their last ${rec.total}`
      : "limited recent data";
  const trajStr =
    trajectory !== "unknown" ? `; trajectory: ${trajectory}` : "";
  return `${name} is ${streakStr} (${recStr}${trajStr}).`;
}

function buildStyleSummary(
  name: string,
  style: FighterSignals["styleTag"],
  strikingDiff: number,
  grapplingScore: number,
  finishRate: number
): string {
  const parts: string[] = [`${name} is classified as a ${style}.`];
  if (strikingDiff > 1) parts.push(`Net striking differential: +${strikingDiff} (lands more than absorbs).`);
  if (strikingDiff < -1) parts.push(`Net striking differential: ${strikingDiff} (absorbs more than lands — defensive risk).`);
  if (grapplingScore > 1.5) parts.push(`Grappling aggression score: ${grapplingScore} (active threat).`);
  if (finishRate > 0.6) parts.push(`High finish rate in recent wins (${Math.round(finishRate * 100)}%).`);
  return parts.join(" ");
}

function buildContextSummary(
  name: string,
  age: number | null,
  inPrime: boolean | null,
  careerYears: number | null,
  ringRust: boolean,
  koVulnerable: boolean
): string {
  const parts: string[] = [];
  if (age !== null) {
    const primeNote = inPrime === true ? " (in prime age range)" : inPrime === false ? " (outside prime)" : "";
    parts.push(`Age: ${age}${primeNote}.`);
  }
  if (careerYears !== null) parts.push(`Career length: ~${careerYears} years.`);
  if (ringRust) parts.push(`⚠️ Ring rust concern: >12 months since last fight.`);
  if (koVulnerable) parts.push(`⚠️ KO vulnerability: has been stopped by strikes in recent fights.`);
  return parts.length > 0 ? parts.join(" ") : `No notable context concerns for ${name}.`;
}

// ─── Per-fighter computation ──────────────────────────────────────────────────

export function computeFighterSignals(fighter: Fighter): FighterSignals {
  const fights = fighter.recentFights ?? [];

  const streak        = computeStreak(fights);
  const rec           = recentRecord(fights);
  const koVulnerable  = isKOVulnerable(fights);
  const finishRate    = recentFinishRate(fights);
  const trajectory    = computeTrajectory(fights);
  const styleTag      = computeStyleTag(fighter);
  const strikingDiff  = computeStrikingDifferential(fighter);
  const grapplingScore = computeGrapplingScore(fighter);
  const daysSince     = daysSinceLastFight(fights);
  const ringRust      = daysSince !== null ? daysSince > RING_RUST_DAYS : false;
  const age           = fighter.age ?? null;
  const careerYears   = computeCareerYears(fighter.careerStartDate);
  const inPrime       =
    age !== null ? age >= PRIME_AGE_LOW && age <= PRIME_AGE_HIGH : null;

  return {
    currentStreak:         streak,
    recentRecord:          rec,
    knockoutVulnerable:    koVulnerable,
    recentFinishRate:      finishRate,
    trajectory,
    styleTag,
    strikingDifferential:  strikingDiff,
    grapplingAggressionScore: grapplingScore,
    daysSinceLastFight:    daysSince,
    ringRustFlag:          ringRust,
    estimatedAge:          age,
    careerYears,
    inPrime,
    formSummary:    buildFormSummary(fighter.name, streak, rec, trajectory),
    styleSummary:   buildStyleSummary(fighter.name, styleTag, strikingDiff, grapplingScore, finishRate),
    contextSummary: buildContextSummary(fighter.name, age, inPrime, careerYears, ringRust, koVulnerable),
  };
}

// ─── Head-to-head edge computation ───────────────────────────────────────────

function parseReachInches(reach?: string): number | null {
  if (!reach) return null;
  const m = reach.match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

function grapplingEdge(
  s1: FighterSignals,
  s2: FighterSignals
): FightSignals["grapplingEdge"] {
  const diff = s1.grapplingAggressionScore - s2.grapplingAggressionScore;
  if (diff > 0.8) return "fighter1";
  if (diff < -0.8) return "fighter2";
  return "neutral";
}

function strikingEdge(
  s1: FighterSignals,
  s2: FighterSignals
): FightSignals["strikingEdge"] {
  const diff = s1.strikingDifferential - s2.strikingDifferential;
  if (diff > 1.0) return "fighter1";
  if (diff < -1.0) return "fighter2";
  return "neutral";
}

function reachEdge(
  f1: Fighter,
  f2: Fighter
): FightSignals["reachEdge"] {
  const r1 = parseReachInches(f1.reach);
  const r2 = parseReachInches(f2.reach);
  if (r1 === null || r2 === null) return "unknown";
  const diff = r1 - r2;
  if (diff >= 2) return "fighter1";
  if (diff <= -2) return "fighter2";
  return "neutral";
}

function momentumEdge(
  s1: FighterSignals,
  s2: FighterSignals
): FightSignals["momentumEdge"] {
  // Combine streak + trajectory
  let score1 = 0;
  let score2 = 0;

  if (s1.currentStreak.type === "W") score1 += s1.currentStreak.count;
  else if (s1.currentStreak.type === "L") score1 -= s1.currentStreak.count;
  if (s2.currentStreak.type === "W") score2 += s2.currentStreak.count;
  else if (s2.currentStreak.type === "L") score2 -= s2.currentStreak.count;

  if (s1.trajectory === "rising") score1 += 1;
  if (s1.trajectory === "declining") score1 -= 1;
  if (s2.trajectory === "rising") score2 += 1;
  if (s2.trajectory === "declining") score2 -= 1;

  const diff = score1 - score2;
  if (diff >= 2) return "fighter1";
  if (diff <= -2) return "fighter2";
  return "neutral";
}

function buildMatchupSummary(
  f1: Fighter,
  f2: Fighter,
  s: Pick<FightSignals, "grapplingEdge" | "strikingEdge" | "reachEdge" | "momentumEdge">
): string {
  const edges: string[] = [];

  if (s.strikingEdge === "fighter1")   edges.push(`${f1.name} has the striking edge`);
  if (s.strikingEdge === "fighter2")   edges.push(`${f2.name} has the striking edge`);
  if (s.grapplingEdge === "fighter1")  edges.push(`${f1.name} is the grappling threat`);
  if (s.grapplingEdge === "fighter2")  edges.push(`${f2.name} is the grappling threat`);
  if (s.reachEdge === "fighter1")      edges.push(`${f1.name} has the reach advantage`);
  if (s.reachEdge === "fighter2")      edges.push(`${f2.name} has the reach advantage`);
  if (s.momentumEdge === "fighter1")   edges.push(`${f1.name} has the momentum`);
  if (s.momentumEdge === "fighter2")   edges.push(`${f2.name} has the momentum`);

  if (edges.length === 0) return "This is an even matchup across all measured dimensions.";
  return edges.join("; ") + ".";
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function computeFightSignals(fighter1: Fighter, fighter2: Fighter): FightSignals {
  const s1 = computeFighterSignals(fighter1);
  const s2 = computeFighterSignals(fighter2);

  const gEdge = grapplingEdge(s1, s2);
  const sEdge = strikingEdge(s1, s2);
  const rEdge = reachEdge(fighter1, fighter2);
  const mEdge = momentumEdge(s1, s2);

  return {
    fighter1: s1,
    fighter2: s2,
    grapplingEdge:  gEdge,
    strikingEdge:   sEdge,
    reachEdge:      rEdge,
    momentumEdge:   mEdge,
    matchupSummary: buildMatchupSummary(fighter1, fighter2, {
      grapplingEdge: gEdge,
      strikingEdge:  sEdge,
      reachEdge:     rEdge,
      momentumEdge:  mEdge,
    }),
  };
}
