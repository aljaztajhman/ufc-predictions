/**
 * The Odds API integration.
 * Fetches real MMA moneyline odds from https://the-odds-api.com
 * and matches them to our fight objects by fighter name.
 *
 * Env var required: ODDS_API_KEY
 * Sport key: mma_mixed_martial_arts
 * Regions: us + eu (wider bookmaker coverage)
 * Market: h2h (head-to-head / moneyline)
 */

import type { FightOdds } from "@/types";
import { Redis } from "@upstash/redis";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const ODDS_CACHE_KEY = "ufc:odds:all";
const ODDS_TTL = 60 * 60; // 1 hour

// ─── Raw API types ─────────────────────────────────────────────────────────────

interface OddsAPIOutcome {
  name: string;
  price: number; // decimal odds
}

interface OddsAPIMarket {
  key: string;
  outcomes: OddsAPIOutcome[];
}

interface OddsAPIBookmaker {
  key: string;
  title: string;
  markets: OddsAPIMarket[];
}

export interface OddsAPIEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsAPIBookmaker[];
}

// ─── Redis singleton (reuse from cache.ts pattern) ────────────────────────────

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    _redis = new Redis({ url, token });
    return _redis;
  } catch {
    return null;
  }
}

// ─── Odds API fetch ────────────────────────────────────────────────────────────

export async function fetchAllMMAOdds(): Promise<OddsAPIEvent[]> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];

  // Check Redis cache first
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<OddsAPIEvent[]>(ODDS_CACHE_KEY);
      if (cached) return cached;
    } catch {
      // fall through to fetch
    }
  }

  try {
    const url =
      `${ODDS_API_BASE}/sports/mma_mixed_martial_arts/odds/` +
      `?apiKey=${apiKey}&regions=us,eu&markets=h2h&oddsFormat=decimal`;

    const res = await fetch(url, {
      // Use short revalidation rather than no-store to avoid Next.js static-render errors.
      // Actual caching is handled by Redis above — this is just a fallback hint.
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error(`[odds] API error ${res.status}: ${await res.text()}`);
      return [];
    }

    const data: OddsAPIEvent[] = await res.json();

    // Cache in Redis
    if (redis) {
      try {
        await redis.set(ODDS_CACHE_KEY, data, { ex: ODDS_TTL });
      } catch {
        // non-fatal
      }
    }

    return data;
  } catch (err) {
    console.error("[odds] Fetch failed:", err);
    return [];
  }
}

// ─── Name matching ─────────────────────────────────────────────────────────────

/**
 * Normalise a fighter name for fuzzy comparison:
 * lowercase, remove diacritics, strip non-alpha, collapse spaces.
 */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (na === nb) return true;
  // One name contains the other (handles "Poirier" vs "Dustin Poirier")
  if (na.includes(nb) || nb.includes(na)) return true;
  // Last-name match (minimum 4 chars to avoid false positives)
  const lastA = na.split(" ").pop() ?? "";
  const lastB = nb.split(" ").pop() ?? "";
  if (lastA.length >= 4 && lastA === lastB) return true;
  return false;
}

// ─── Odds maths ────────────────────────────────────────────────────────────────

/** Decimal odds → American odds integer */
function decimalToAmerican(decimal: number): number {
  if (decimal >= 2.0) {
    return Math.round((decimal - 1) * 100); // positive underdog
  }
  return Math.round(-100 / (decimal - 1)); // negative favourite
}

/**
 * Remove bookmaker vig to get true implied probabilities.
 * raw1 + raw2 > 1.0 due to the vig; normalise to sum to 100%.
 */
function fairImpliedProb(odds1: number, odds2: number): [number, number] {
  const raw1 = 1 / odds1;
  const raw2 = 1 / odds2;
  const total = raw1 + raw2;
  return [
    Math.round((raw1 / total) * 100),
    Math.round((raw2 / total) * 100),
  ];
}

// ─── Main mapping function ─────────────────────────────────────────────────────

/**
 * Given a list of Odds API events and two fighter names,
 * find the matching bout and return aggregated FightOdds.
 * Returns null if no odds are available for this fight.
 */
export function mapOddsToFight(
  oddsEvents: OddsAPIEvent[],
  fighter1Name: string,
  fighter2Name: string
): FightOdds | null {
  for (const event of oddsEvents) {
    const f1IsHome = namesMatch(event.home_team, fighter1Name);
    const f2IsAway = namesMatch(event.away_team, fighter2Name);
    const f1IsAway = namesMatch(event.away_team, fighter1Name);
    const f2IsHome = namesMatch(event.home_team, fighter2Name);

    const matched = (f1IsHome && f2IsAway) || (f1IsAway && f2IsHome);
    if (!matched) continue;

    // Collect prices across all bookmakers
    const f1Prices: number[] = [];
    const f2Prices: number[] = [];

    for (const bookmaker of event.bookmakers) {
      const h2h = bookmaker.markets.find((m) => m.key === "h2h");
      if (!h2h) continue;

      for (const outcome of h2h.outcomes) {
        if (namesMatch(outcome.name, fighter1Name)) {
          f1Prices.push(outcome.price);
        } else if (namesMatch(outcome.name, fighter2Name)) {
          f2Prices.push(outcome.price);
        }
      }
    }

    if (f1Prices.length === 0 || f2Prices.length === 0) return null;

    const avgF1 = f1Prices.reduce((a, b) => a + b, 0) / f1Prices.length;
    const avgF2 = f2Prices.reduce((a, b) => a + b, 0) / f2Prices.length;

    const [impliedF1, impliedF2] = fairImpliedProb(avgF1, avgF2);

    return {
      fighter1: {
        name: fighter1Name,
        decimalOdds: Math.round(avgF1 * 100) / 100,
        americanOdds: decimalToAmerican(avgF1),
        impliedProbability: impliedF1,
      },
      fighter2: {
        name: fighter2Name,
        decimalOdds: Math.round(avgF2 * 100) / 100,
        americanOdds: decimalToAmerican(avgF2),
        impliedProbability: impliedF2,
      },
      bookmakerCount: Math.min(f1Prices.length, f2Prices.length),
    };
  }

  return null;
}

/** Format American odds for display: e.g. -165 → "-165", +130 → "+130" */
export function formatAmericanOdds(american: number): string {
  return american > 0 ? `+${american}` : `${american}`;
}
