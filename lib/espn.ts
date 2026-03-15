/**
 * ESPN MMA API — unofficial but stable.
 * Endpoints:
 *   https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard
 *   https://site.api.espn.com/apis/site/v2/sports/mma/ufc/news
 *   https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/{id}
 */

import type { UFCEvent, Fight, Fighter, FighterRecord } from "@/types";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc";
const ESPN_CORE = "https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc";

async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    headers: { "User-Agent": "Mozilla/5.0 (compatible; UFC-Predictions/1.0)" },
  });
  if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status} ${url}`);
  return res.json();
}

// ─── Events ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseEvent(e: any): UFCEvent {
  const competition = e.competitions?.[0];
  const competitors = competition?.competitors || [];
  const names = competitors.map((c: any) => c.athlete?.displayName || c.displayName || "TBD");
  const mainEvent = names.length >= 2 ? `${names[0]} vs ${names[1]}` : e.name;

  return {
    id: e.id,
    name: e.name || e.shortName,
    shortName: e.shortName || e.name,
    date: e.date,
    location: competition?.venue?.fullName || e.location || "TBD",
    venue: competition?.venue?.fullName || "TBD",
    mainEvent,
    imageUrl: e.images?.[0]?.url,
    status: e.status?.type?.name === "STATUS_IN_PROGRESS" ? "live"
      : e.status?.type?.completed ? "completed"
      : "upcoming",
  };
}

export async function fetchUpcomingEvents(): Promise<UFCEvent[]> {
  try {
    // Get events for the next 6 months
    const now = new Date();
    const future = new Date();
    future.setMonth(future.getMonth() + 6);
    const dates = `${now.toISOString().split("T")[0]}%2C${future.toISOString().split("T")[0]}`;

    const data = await fetchJSON(
      `${ESPN_BASE}/scoreboard?limit=50&dates=${dates}`
    ) as any;

    const events: UFCEvent[] = (data.events || [])
      .map(parseEvent)
      .filter((e: UFCEvent) => e.status !== "completed")
      .sort((a: UFCEvent, b: UFCEvent) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return events;
  } catch (err) {
    console.error("fetchUpcomingEvents error:", err);
    return getMockEvents();
  }
}

export async function fetchEventWithFights(eventId: string): Promise<{ event: UFCEvent; fights: Fight[] } | null> {
  try {
    const data = await fetchJSON(`${ESPN_BASE}/summary?event=${eventId}`) as any;

    const eventData = data.header?.competitions?.[0] || data.gamepackageJSON?.header?.competitions?.[0];
    if (!eventData) throw new Error("No event data");

    const event = parseEvent({ ...data.header, competitions: [eventData], id: eventId });

    // Parse fight card from boxscore/competition
    const fights: Fight[] = [];
    const bouts = data.boxscore?.groups || data.gamepackageJSON?.boxscore?.groups || [];

    bouts.forEach((group: any, groupIdx: number) => {
      const section: Fight["section"] =
        groupIdx === 0 ? "main" : groupIdx === 1 ? "prelim" : "early-prelim";

      (group.athletes || group.bouts || []).forEach((bout: any, boutIdx: number) => {
        const competitors = bout.competitors || bout.athletes || [];
        if (competitors.length < 2) return;

        const f1 = parseFighter(competitors[0]);
        const f2 = parseFighter(competitors[1]);

        fights.push({
          id: `${eventId}-${groupIdx}-${boutIdx}`,
          eventId,
          order: groupIdx * 100 + boutIdx,
          section,
          weightClass: bout.weightClass || bout.type?.text || "Catchweight",
          isTitleFight: bout.title === true || (bout.type?.text || "").toLowerCase().includes("title"),
          isMainEvent: groupIdx === 0 && boutIdx === 0,
          fighter1: f1,
          fighter2: f2,
        });
      });
    });

    return { event, fights };
  } catch (err) {
    console.error("fetchEventWithFights error:", err);
    return getMockEventWithFights(eventId);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFighter(c: any): Fighter {
  const athlete = c.athlete || c;
  const stats = c.statistics || c.stats || {};
  const record = parseRecord(athlete.record || stats.record || "0-0-0");

  return {
    id: athlete.id || String(Math.random()),
    name: athlete.displayName || athlete.fullName || "Unknown",
    nickname: athlete.nickname,
    record,
    nationality: athlete.flag?.alt || athlete.birthPlace?.country,
    countryCode: athlete.flag?.href ? extractCountryCode(athlete.flag.href) : undefined,
    height: athlete.height ? formatHeight(athlete.height) : undefined,
    reach: athlete.reach ? `${athlete.reach}"` : undefined,
    stance: athlete.stance,
    imageUrl: athlete.headshot?.href || athlete.image,
    // Stats from ESPN where available
    sigStrikesLandedPerMin: parseFloat(stats.sigStrikesLandedPerMin || stats.strikesLanded || "0") || undefined,
    sigStrikesAbsorbedPerMin: parseFloat(stats.sigStrikesAbsorbedPerMin || "0") || undefined,
    sigStrikeAccuracy: parseFloat(stats.strikeAccuracy || "0") || undefined,
    takedownAvgPer15Min: parseFloat(stats.takedownAvg || "0") || undefined,
    takedownAccuracy: parseFloat(stats.takedownAccuracy || "0") || undefined,
    takedownDefense: parseFloat(stats.takedownDefense || "0") || undefined,
  };
}

function parseRecord(recordStr: string): FighterRecord {
  const parts = recordStr.replace(/\s/g, "").split("-").map(Number);
  return {
    wins: parts[0] || 0,
    losses: parts[1] || 0,
    draws: parts[2] || 0,
  };
}

function formatHeight(inches: number): string {
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
}

function extractCountryCode(flagUrl: string): string | undefined {
  const match = flagUrl.match(/\/flags\/([a-z]{2})\./i);
  return match ? match[1].toUpperCase() : undefined;
}

// ─── Mock data for fallback ───────────────────────────────────────────────────

function getMockEvents(): UFCEvent[] {
  const now = new Date();
  const nextSat = new Date(now);
  nextSat.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));

  return [
    {
      id: "mock-1",
      name: "UFC 310",
      shortName: "UFC 310",
      date: nextSat.toISOString(),
      location: "T-Mobile Arena, Las Vegas, NV",
      venue: "T-Mobile Arena",
      mainEvent: "Alexandre Pantoja vs Kai Asakura",
      status: "upcoming",
    },
    {
      id: "mock-2",
      name: "UFC Fight Night",
      shortName: "UFC Fight Night",
      date: new Date(nextSat.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      location: "UFC Apex, Las Vegas, NV",
      venue: "UFC Apex",
      mainEvent: "TBA vs TBA",
      status: "upcoming",
    },
  ];
}

function getMockEventWithFights(eventId: string): { event: UFCEvent; fights: Fight[] } {
  const event: UFCEvent = {
    id: eventId,
    name: "UFC 310",
    shortName: "UFC 310",
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    location: "T-Mobile Arena, Las Vegas, NV",
    venue: "T-Mobile Arena",
    mainEvent: "Alexandre Pantoja vs Kai Asakura",
    status: "upcoming",
  };

  const mockFighter = (name: string, w: number, l: number): Fighter => ({
    id: name.toLowerCase().replace(/\s/g, "-"),
    name,
    record: { wins: w, losses: l, draws: 0, winsByKO: Math.floor(w * 0.4), winsBySub: Math.floor(w * 0.2), winsByDec: Math.floor(w * 0.4) },
    nationality: "United States",
    countryCode: "US",
    height: `5'8"`,
    reach: `70"`,
    stance: "Orthodox",
    sigStrikesLandedPerMin: 4.2 + Math.random() * 2,
    sigStrikesAbsorbedPerMin: 3.1 + Math.random() * 1.5,
    sigStrikeAccuracy: 45 + Math.random() * 20,
    sigStrikeDefense: 55 + Math.random() * 20,
    takedownAvgPer15Min: 1.5 + Math.random() * 2,
    takedownAccuracy: 35 + Math.random() * 30,
    takedownDefense: 60 + Math.random() * 25,
    submissionAvgPer15Min: 0.5 + Math.random(),
    recentFights: [
      { opponent: "Fighter A", result: "W", method: "KO/TKO", event: "UFC 300", date: "2024-04-13" },
      { opponent: "Fighter B", result: "W", method: "Decision", event: "UFC 295", date: "2023-11-11" },
      { opponent: "Fighter C", result: "L", method: "Submission", event: "UFC 285", date: "2023-03-04" },
    ],
  });

  const fights: Fight[] = [
    {
      id: `${eventId}-0-0`, eventId, order: 0, section: "main",
      weightClass: "Flyweight", isTitleFight: true, isMainEvent: true,
      fighter1: mockFighter("Alexandre Pantoja", 27, 5),
      fighter2: mockFighter("Kai Asakura", 20, 4),
    },
    {
      id: `${eventId}-0-1`, eventId, order: 1, section: "main",
      weightClass: "Welterweight", isTitleFight: false, isMainEvent: false,
      fighter1: mockFighter("Colby Covington", 17, 4),
      fighter2: mockFighter("Joaquin Buckley", 21, 6),
    },
    {
      id: `${eventId}-1-0`, eventId, order: 100, section: "prelim",
      weightClass: "Lightweight", isTitleFight: false, isMainEvent: false,
      fighter1: mockFighter("Renato Moicano", 20, 5),
      fighter2: mockFighter("David Onama", 14, 2),
    },
    {
      id: `${eventId}-1-1`, eventId, order: 101, section: "prelim",
      weightClass: "Bantamweight", isTitleFight: false, isMainEvent: false,
      fighter1: mockFighter("Deiveson Figueiredo", 22, 4),
      fighter2: mockFighter("Cody Garbrandt", 12, 6),
    },
    {
      id: `${eventId}-2-0`, eventId, order: 200, section: "early-prelim",
      weightClass: "Featherweight", isTitleFight: false, isMainEvent: false,
      fighter1: mockFighter("Leandro Silva", 12, 2),
      fighter2: mockFighter("Carlos Hernandez", 10, 3),
    },
  ];

  return { event, fights };
}
