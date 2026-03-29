export interface UFCEvent {
  id: string;
  name: string;
  shortName: string;
  date: string; // ISO string
  location: string;
  venue: string;
  mainEvent: string; // "Fighter A vs Fighter B"
  imageUrl?: string;
  status: "upcoming" | "live" | "completed";
}

export interface Fighter {
  id: string;
  name: string;
  nickname?: string;
  record: FighterRecord;
  nationality?: string;
  countryCode?: string; // ISO 3166-1 alpha-2
  height?: string;
  reach?: string;
  stance?: "Orthodox" | "Southpaw" | "Switch" | string;
  imageUrl?: string;
  // Age / career context
  age?: number;              // computed from DOB
  careerStartDate?: string;  // ISO string — date of oldest known fight
  // Striking stats
  sigStrikesLandedPerMin?: number;
  sigStrikesAbsorbedPerMin?: number;
  sigStrikeAccuracy?: number;
  sigStrikeDefense?: number;
  // Grappling stats
  takedownAvgPer15Min?: number;
  takedownAccuracy?: number;
  takedownDefense?: number;
  submissionAvgPer15Min?: number;
  // Recent form
  recentFights?: RecentFight[];
}

export interface FighterRecord {
  wins: number;
  losses: number;
  draws: number;
  noContests?: number;
  winsByKO?: number;
  winsBySub?: number;
  winsByDec?: number;
}

export interface RecentFight {
  opponent: string;
  result: "W" | "L" | "D" | "NC";
  method: string;
  event: string;
  date: string;
}

export interface Fight {
  id: string;
  eventId: string;
  order: number;
  section: "main" | "prelim" | "early-prelim";
  weightClass: string;
  isTitleFight: boolean;
  isMainEvent: boolean;
  fighter1: Fighter;
  fighter2: Fighter;
}

export interface PredictionResult {
  fightId: string;
  winner: string;
  confidence: number; // 0-100
  method: "KO/TKO" | "Submission" | "Decision" | "Split Decision" | string;
  rounds?: number;
  fighter1Breakdown: FighterBreakdown;
  fighter2Breakdown: FighterBreakdown;
  narrative: string;
  generatedAt: string; // ISO string
}

export interface FighterBreakdown {
  name: string;
  keyAdvantages: string[];
  keyWeaknesses: string[];
}

export interface EventWithFights extends UFCEvent {
  fights: Fight[];
}

// ─── Signal types ─────────────────────────────────────────────────────────────

export interface FighterSignals {
  // Recent form
  currentStreak: { type: "W" | "L" | "D"; count: number };
  recentRecord: { wins: number; losses: number; total: number }; // last 5
  // Finish / durability
  knockoutVulnerable: boolean;  // finished by KO in recent fights
  recentFinishRate: number;     // 0-1 — share of recent wins by finish
  trajectory: "rising" | "declining" | "volatile" | "unknown";
  // Style classification
  styleTag: "Striker" | "Grappler" | "Wrestler" | "Balanced";
  // Computed differentials
  strikingDifferential: number;      // SLpM - SApM
  grapplingAggressionScore: number;  // TDAvg * TDAcc/100 + SubAvg
  // Layoff / ring rust
  daysSinceLastFight: number | null;
  ringRustFlag: boolean;             // >365 days since last fight
  // Age / career prime
  estimatedAge: number | null;
  careerYears: number | null;
  inPrime: boolean | null;           // true if 25-33, null if unknown
  // Human-readable summaries for the prompt
  formSummary: string;
  styleSummary: string;
  contextSummary: string;
}

export interface FightSignals {
  fighter1: FighterSignals;
  fighter2: FighterSignals;
  // Head-to-head edges
  grapplingEdge: "fighter1" | "fighter2" | "neutral";
  strikingEdge:  "fighter1" | "fighter2" | "neutral";
  reachEdge:     "fighter1" | "fighter2" | "neutral" | "unknown";
  momentumEdge:  "fighter1" | "fighter2" | "neutral";
  // Single-sentence matchup summary
  matchupSummary: string;
}

// ─── Odds types ───────────────────────────────────────────────────────────────

export interface FighterOdds {
  name: string;
  decimalOdds: number;        // e.g. 1.67
  americanOdds: number;       // e.g. -150 (favourite) or +130 (underdog)
  impliedProbability: number; // 0-100, vig-removed consensus probability
}

export interface FightOdds {
  fighter1: FighterOdds;
  fighter2: FighterOdds;
  bookmakerCount: number;     // how many bookmakers contributed to the average
}

// ─── Slip types ───────────────────────────────────────────────────────────────

export type SlipMethod = "any" | "KO/TKO" | "Submission" | "Decision";

export interface SlipPick {
  fightId: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  fighter1: { id: string; name: string; record: FighterRecord };
  fighter2: { id: string; name: string; record: FighterRecord };
  weightClass: string;
  isTitleFight: boolean;
  pickedFighterId: string;
  pickedFighterName: string;
  pickedMethod: SlipMethod;
  addedAt: number;
  // Enriched after accumulator analysis:
  aiPrediction?: PredictionResult;
  pickProbability?: number; // 0-100: P(this specific pick is correct)
  matchesAI?: boolean;      // does user's pick match AI's predicted winner?
  odds?: FightOdds;         // market odds for this fight
  aiEdge?: number;          // pickProbability - market implied probability (signed)
}

export interface AccumulatorAnalysis {
  picks: SlipPick[];           // enriched picks with probabilities + odds
  combinedProbability: number; // product of individual pick probabilities (0-100) — parlay math
  slipScore: number;           // average AI confidence across all picks (0-100) — primary display
  totalAiEdge?: number;        // sum of per-pick AI edges vs market (signed %)
  aiOverallScore: number;      // Claude's holistic assessment (0-100)
  riskLevel: "safe" | "risky" | "longshot" | "miracle";
  parlayOddsDecimal: number;   // theoretical payout multiplier
  narrative: string;           // Claude's written assessment
  generatedAt: string;         // ISO string
}
