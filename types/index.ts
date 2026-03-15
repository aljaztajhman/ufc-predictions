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
