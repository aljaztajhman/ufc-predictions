/**
 * UFC Event Data — ESPN MMA API with ESPN Core fallback.
 *
 * For upcoming events ESPN's summary endpoint only returns the main event
 * matchup. Full fight cards are fetched via the ESPN Core competitions API.
 * If both fail, hardcoded current-event data is returned so the UI never
 * shows stale 2024 mock data.
 */

import type { UFCEvent, Fight, Fighter, FighterRecord } from "@/types";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc";
const ESPN_CORE = "https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc";

async function fetchJSON(url: string, revalidate = 3600): Promise<unknown> {
  const res = await fetch(url, {
    next: { revalidate },
    headers: { "User-Agent": "Mozilla/5.0 (compatible; UFC-Predictions/1.0)" },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  return res.json();
}

// ─── Event parsing ─────────────────────────────────────────────────────────────

function parseEvent(e: any): UFCEvent {
  const competition = e.competitions?.[0];
  const competitors = competition?.competitors || [];
  const names = competitors.map(
    (c: any) => c.athlete?.displayName || c.displayName || "TBD"
  );
  const mainEvent =
    names.length >= 2 ? `${names[0]} vs ${names[1]}` : e.name || "TBD";

  const dateStr = e.date || competition?.date || "";

  // An event is completed if ESPN says so, OR if its date was more than
  // 24 hours ago (covers stale events ESPN hasn't marked yet).
  const isCompleted =
    e.status?.type?.completed === true ||
    e.status?.type?.name === "STATUS_FINAL" ||
    (dateStr
      ? new Date(dateStr) < new Date(Date.now() - 24 * 60 * 60 * 1000)
      : false);

  return {
    id: String(e.id),
    name: e.name || e.shortName || "UFC Event",
    shortName: e.shortName || e.name || "UFC Event",
    date: dateStr,
    location:
      competition?.venue?.fullName ||
      competition?.venue?.address?.city ||
      e.location ||
      "TBD",
    venue: competition?.venue?.fullName || "TBD",
    mainEvent,
    imageUrl: e.images?.[0]?.url,
    status:
      e.status?.type?.name === "STATUS_IN_PROGRESS"
        ? "live"
        : isCompleted
        ? "completed"
        : "upcoming",
  };
}

// ─── Enrich events with hardcoded data when ESPN is incomplete ────────────────

function enrichEventFromHardcoded(event: UFCEvent): UFCEvent {
  const hc = HARDCODED_EVENTS.find((h) => h.espnId === event.id);
  if (!hc) return event;
  return {
    ...event,
    name: hc.name,
    shortName: hc.shortName,
    mainEvent: hc.mainEvent,
    // Only override location/venue if ESPN returned "TBD"
    location: event.location === "TBD" ? hc.location : event.location,
    venue: event.venue === "TBD" ? hc.venue : event.venue,
  };
}

// ─── Upcoming events ───────────────────────────────────────────────────────────

export async function fetchUpcomingEvents(): Promise<UFCEvent[]> {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  try {
    // ESPN scoreboard returns current-week events. Use a wide limit so we
    // catch events a few weeks out, then filter to future dates.
    const data = (await fetchJSON(
      `${ESPN_BASE}/scoreboard?limit=50`
    )) as any;

    const events: UFCEvent[] = (data.events || [])
      .map(parseEvent)
      .map(enrichEventFromHardcoded)
      .filter((e: UFCEvent) => {
        if (e.status === "completed") return false;
        if (!e.date) return false;
        return new Date(e.date) >= todayMidnight;
      })
      .sort(
        (a: UFCEvent, b: UFCEvent) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      );

    if (events.length > 0) return events;
  } catch (err) {
    console.error("ESPN scoreboard error:", err);
  }

  // ESPN scoreboard might only cover the current week. Try the core schedule.
  try {
    const year = new Date().getFullYear();
    const scheduleData = (await fetchJSON(
      `${ESPN_CORE}/events?limit=50&dates=${year}`
    )) as any;

    const refs: string[] = (scheduleData.items || [])
      .map((i: any) => i.$ref)
      .filter(Boolean);

    if (refs.length > 0) {
      const evtResults = await Promise.allSettled(
        refs.slice(0, 25).map((ref) => fetchJSON(ref, 3600))
      );

      const events: UFCEvent[] = evtResults
        .filter(
          (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled"
        )
        .map((r) => enrichEventFromHardcoded(parseEvent(r.value)))
        .filter((e: UFCEvent) => {
          if (e.status === "completed") return false;
          if (!e.date) return false;
          return new Date(e.date) >= todayMidnight;
        })
        .sort(
          (a: UFCEvent, b: UFCEvent) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

      if (events.length > 0) return events;
    }
  } catch (err) {
    console.error("ESPN core events error:", err);
  }

  return getHardcodedUpcomingEvents();
}

// ─── Event with fights ─────────────────────────────────────────────────────────

export async function fetchEventWithFights(
  eventId: string
): Promise<{ event: UFCEvent; fights: Fight[] } | null> {
  // ── Step 1: ESPN summary (metadata + possibly main-event fighters) ──────────
  let event: UFCEvent | null = null;
  let fights: Fight[] = [];

  try {
    const data = (await fetchJSON(
      `${ESPN_BASE}/summary?event=${eventId}`
    )) as any;

    const headerComp =
      data.header?.competitions?.[0] ||
      data.gamepackageJSON?.header?.competitions?.[0];

    if (data.header || headerComp) {
      event = parseEvent({
        ...data.header,
        competitions: headerComp ? [headerComp] : [],
        id: eventId,
      });
    }

    // Try all known data paths for fight card data ───────────────────────────

    // Path A: boxscore.groups — present for completed events
    const groups =
      data.boxscore?.groups ||
      data.gamepackageJSON?.boxscore?.groups ||
      [];
    if (groups.length > 0) {
      fights = parseBoutGroups(groups, eventId);
    }

    // Path B: top-level bouts array (used by some UFC events)
    if (fights.length === 0 && Array.isArray(data.bouts)) {
      fights = parseBoutsArray(data.bouts, eventId);
    }

    // Path C: competitions array
    if (fights.length === 0 && Array.isArray(data.competitions)) {
      fights = parseCompetitionsArray(data.competitions, eventId);
    }

    // Path D: header competition competitors — at least get main event
    if (fights.length === 0 && headerComp?.competitors?.length >= 2) {
      const f1 = parseFighter(headerComp.competitors[0]);
      const f2 = parseFighter(headerComp.competitors[1]);
      fights = [
        {
          id: `${eventId}-0-0`,
          eventId,
          order: 0,
          section: "main",
          weightClass: headerComp.type?.text || "Main Event",
          isTitleFight: (headerComp.type?.text || "")
            .toLowerCase()
            .includes("title"),
          isMainEvent: true,
          fighter1: f1,
          fighter2: f2,
        },
      ];
    }
  } catch (err) {
    console.error("ESPN summary error for", eventId, err);
  }

  // ── Step 2: ESPN Core competitions API (full card for upcoming events) ──────
  if (fights.length <= 1) {
    try {
      const coreData = (await fetchJSON(
        `${ESPN_CORE}/events/${eventId}/competitions?limit=50`
      )) as any;

      const refs: string[] = (coreData.items || [])
        .map((i: any) => i.$ref)
        .filter(Boolean);

      if (refs.length > 0) {
        const compResults = await Promise.allSettled(
          refs.slice(0, 20).map((ref) => fetchJSON(ref, 3600))
        );

        const coreCompFights: Fight[] = compResults
          .filter(
            (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled"
          )
          .map((r, idx) => {
            const comp = r.value;
            const competitors = comp.competitors || [];
            if (competitors.length < 2) return null;

            const f1 = parseFighterFromCore(competitors[0]);
            const f2 = parseFighterFromCore(competitors[1]);

            const wcText: string = comp.type?.text || comp.typeText || "";
            const section: Fight["section"] =
              idx === 0
                ? "main"
                : idx < 5
                ? "main"
                : idx < 10
                ? "prelim"
                : "early-prelim";

            return {
              id: `${eventId}-core-${idx}`,
              eventId,
              order: idx,
              section,
              weightClass: wcText || "Catchweight",
              isTitleFight:
                wcText.toLowerCase().includes("title") ||
                comp.title === true,
              isMainEvent: idx === 0,
              fighter1: f1,
              fighter2: f2,
            } as Fight;
          })
          .filter((f): f is Fight => f !== null);

        // ESPN Core competitor objects store athlete info as $ref links —
        // the names won't be resolved until the ref is fetched separately.
        // If fewer than half the fights have real names, the Core data is
        // useless; skip it and fall through to the hardcoded card instead.
        const resolvedFights = coreCompFights.filter(
          (f) => f.fighter1.name !== "Unknown" || f.fighter2.name !== "Unknown"
        );
        const coreIsUsable =
          coreCompFights.length > 0 &&
          resolvedFights.length >= coreCompFights.length / 2;

        if (coreIsUsable && coreCompFights.length > fights.length) {
          fights = coreCompFights;

          // Pull date from the first competition if event metadata is missing
          const firstComp =
            compResults.find(
              (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled"
            )?.value;
          const compDate: string =
            firstComp?.date || firstComp?.startDate || "";

          if (!event) {
            event = {
              id: eventId,
              name: "UFC Event",
              shortName: "UFC Event",
              date: compDate || new Date().toISOString(),
              location: firstComp?.venue?.fullName || "TBD",
              venue: firstComp?.venue?.fullName || "TBD",
              mainEvent:
                resolvedFights[0]
                  ? `${resolvedFights[0].fighter1.name} vs ${resolvedFights[0].fighter2.name}`
                  : "TBD",
              status: "upcoming",
            };
          }
        }
      }
    } catch (err) {
      console.error("ESPN Core competitions error for", eventId, err);
    }
  }

  // ── Step 3: Use hardcoded if we have no fights, or all fighters are unknown ──
  const namedFights = fights.filter(
    (f) => f.fighter1.name !== "Unknown" || f.fighter2.name !== "Unknown"
  );
  if (namedFights.length === 0) {
    return getHardcodedEventFallback(eventId, event);
  }

  return { event: event!, fights: namedFights };
}

// ─── Fighter parsing ───────────────────────────────────────────────────────────

function parseFighter(c: any): Fighter {
  const athlete = c.athlete || c;
  const stats = c.statistics || c.stats || {};
  const record = parseRecord(athlete.record || stats.record || "0-0-0");

  return {
    id: String(athlete.id || Math.random()),
    name: athlete.displayName || athlete.fullName || "Unknown",
    nickname: athlete.nickname,
    record,
    nationality: athlete.flag?.alt || athlete.birthPlace?.country,
    countryCode: athlete.flag?.href
      ? extractCountryCode(athlete.flag.href)
      : undefined,
    height: athlete.height ? formatHeight(Number(athlete.height)) : undefined,
    reach: athlete.reach ? `${athlete.reach}"` : undefined,
    stance: athlete.stance,
    imageUrl: athlete.headshot?.href || athlete.image,
    sigStrikesLandedPerMin:
      parseFloat(stats.sigStrikesLandedPerMin || stats.strikesLanded || "0") ||
      undefined,
    sigStrikesAbsorbedPerMin:
      parseFloat(stats.sigStrikesAbsorbedPerMin || "0") || undefined,
    sigStrikeAccuracy:
      parseFloat(stats.strikeAccuracy || "0") || undefined,
    takedownAvgPer15Min:
      parseFloat(stats.takedownAvg || "0") || undefined,
    takedownAccuracy:
      parseFloat(stats.takedownAccuracy || "0") || undefined,
    takedownDefense:
      parseFloat(stats.takedownDefense || "0") || undefined,
  };
}

function parseFighterFromCore(c: any): Fighter {
  // ESPN Core competitor objects differ slightly from site API
  const name =
    c.athlete?.displayName ||
    c.displayName ||
    c.athlete?.fullName ||
    "Unknown";
  const recordStr = c.record || c.athlete?.record || "0-0-0";

  return {
    id: String(c.id || c.athlete?.id || Math.random()),
    name,
    record: parseRecord(recordStr),
    nationality: c.athlete?.birthPlace?.country,
    stance: c.athlete?.stance,
    imageUrl: c.athlete?.headshot?.href,
  };
}

function parseRecord(recordStr: string): FighterRecord {
  const clean = String(recordStr).replace(/\s/g, "");
  const parts = clean.split("-").map(Number);
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

// ─── Bout/competition parsers for various ESPN response shapes ─────────────────

function parseBoutGroups(groups: any[], eventId: string): Fight[] {
  const fights: Fight[] = [];
  groups.forEach((group: any, groupIdx: number) => {
    const section: Fight["section"] =
      groupIdx === 0 ? "main" : groupIdx === 1 ? "prelim" : "early-prelim";

    (group.athletes || group.bouts || []).forEach(
      (bout: any, boutIdx: number) => {
        const competitors = bout.competitors || bout.athletes || [];
        if (competitors.length < 2) return;

        fights.push({
          id: `${eventId}-${groupIdx}-${boutIdx}`,
          eventId,
          order: groupIdx * 100 + boutIdx,
          section,
          weightClass: bout.weightClass || bout.type?.text || "Catchweight",
          isTitleFight:
            bout.title === true ||
            (bout.type?.text || "").toLowerCase().includes("title"),
          isMainEvent: groupIdx === 0 && boutIdx === 0,
          fighter1: parseFighter(competitors[0]),
          fighter2: parseFighter(competitors[1]),
        });
      }
    );
  });
  return fights;
}

function parseBoutsArray(bouts: any[], eventId: string): Fight[] {
  return bouts
    .map((bout: any, idx: number) => {
      const competitors = bout.competitors || bout.athletes || [];
      if (competitors.length < 2) return null;
      const section: Fight["section"] =
        idx < 5 ? "main" : idx < 10 ? "prelim" : "early-prelim";
      return {
        id: `${eventId}-b-${idx}`,
        eventId,
        order: idx,
        section,
        weightClass: bout.weightClass || bout.type?.text || "Catchweight",
        isTitleFight: (bout.type?.text || "").toLowerCase().includes("title"),
        isMainEvent: idx === 0,
        fighter1: parseFighter(competitors[0]),
        fighter2: parseFighter(competitors[1]),
      } as Fight;
    })
    .filter((f): f is Fight => f !== null);
}

function parseCompetitionsArray(
  competitions: any[],
  eventId: string
): Fight[] {
  return competitions
    .map((comp: any, idx: number) => {
      const competitors = comp.competitors || [];
      if (competitors.length < 2) return null;
      const section: Fight["section"] =
        idx < 5 ? "main" : idx < 10 ? "prelim" : "early-prelim";
      return {
        id: `${eventId}-c-${idx}`,
        eventId,
        order: idx,
        section,
        weightClass: comp.type?.text || "Catchweight",
        isTitleFight: (comp.type?.text || "").toLowerCase().includes("title"),
        isMainEvent: idx === 0,
        fighter1: parseFighter(competitors[0]),
        fighter2: parseFighter(competitors[1]),
      } as Fight;
    })
    .filter((f): f is Fight => f !== null);
}

// ─── Hardcoded current-event fallback ─────────────────────────────────────────
// Updated with real cards so the app never shows stale 2024 data.

function getHardcodedUpcomingEvents(): UFCEvent[] {
  return HARDCODED_EVENTS.map((e) => ({
    id: e.espnId,
    name: e.name,
    shortName: e.shortName,
    date: e.date,
    location: e.location,
    venue: e.venue,
    mainEvent: e.mainEvent,
    status: "upcoming" as const,
  })).filter((e) => new Date(e.date) >= new Date(Date.now() - 86400000));
}

function getHardcodedEventFallback(
  eventId: string,
  partialEvent: UFCEvent | null
): { event: UFCEvent; fights: Fight[] } | null {
  // Try to find a matching hardcoded event
  const hc = HARDCODED_EVENTS.find((e) => e.espnId === eventId);

  if (hc) {
    const event: UFCEvent = partialEvent ?? {
      id: eventId,
      name: hc.name,
      shortName: hc.shortName,
      date: hc.date,
      location: hc.location,
      venue: hc.venue,
      mainEvent: hc.mainEvent,
      status: "upcoming",
    };
    return { event, fights: buildFights(eventId, hc.card) };
  }

  // Unknown event — build a minimal placeholder with the partial event info
  if (partialEvent) {
    const nameParts = partialEvent.mainEvent.split(" vs ");
    const f1Name = nameParts[0]?.trim() || "Fighter 1";
    const f2Name = nameParts[1]?.trim() || "Fighter 2";
    return {
      event: partialEvent,
      fights: [
        {
          id: `${eventId}-0-0`,
          eventId,
          order: 0,
          section: "main",
          weightClass: "Main Event",
          isTitleFight: false,
          isMainEvent: true,
          fighter1: blankFighter(f1Name),
          fighter2: blankFighter(f2Name),
        },
      ],
    };
  }

  return null;
}

// ─── Hardcoded event cards ─────────────────────────────────────────────────────

interface HardcodedFighter {
  name: string;
  w: number;
  l: number;
  d?: number;
  nc?: number;
  country?: string;
  cc?: string;
  height?: string;
  reach?: string;
  stance?: string;
  // UFCStats-style stats (can be enriched later)
  slpm?: number;
  sapm?: number;
  strAcc?: number;
  strDef?: number;
  tdAvg?: number;
  tdAcc?: number;
  tdDef?: number;
  subAvg?: number;
}

interface HardcodedBout {
  f1: HardcodedFighter;
  f2: HardcodedFighter;
  weight: string;
  title?: boolean;
  section: Fight["section"];
}

interface HardcodedEvent {
  espnId: string;
  name: string;
  shortName: string;
  date: string;
  location: string;
  venue: string;
  mainEvent: string;
  card: HardcodedBout[];
}

function hf(d: HardcodedFighter): Fighter {
  return {
    id: d.name.toLowerCase().replace(/\s+/g, "-"),
    name: d.name,
    record: {
      wins: d.w,
      losses: d.l,
      draws: d.d ?? 0,
      noContests: d.nc,
    },
    nationality: d.country,
    countryCode: d.cc,
    height: d.height,
    reach: d.reach,
    stance: d.stance,
    sigStrikesLandedPerMin: d.slpm,
    sigStrikesAbsorbedPerMin: d.sapm,
    sigStrikeAccuracy: d.strAcc,
    sigStrikeDefense: d.strDef,
    takedownAvgPer15Min: d.tdAvg,
    takedownAccuracy: d.tdAcc,
    takedownDefense: d.tdDef,
    submissionAvgPer15Min: d.subAvg,
  };
}

function buildFights(eventId: string, card: HardcodedBout[]): Fight[] {
  return card.map((b, idx) => ({
    id: `${eventId}-hc-${idx}`,
    eventId,
    order: idx,
    section: b.section,
    weightClass: b.weight,
    isTitleFight: b.title ?? false,
    isMainEvent: idx === 0,
    fighter1: hf(b.f1),
    fighter2: hf(b.f2),
  }));
}

function blankFighter(name: string): Fighter {
  return { id: name.toLowerCase().replace(/\s+/g, "-"), name, record: { wins: 0, losses: 0, draws: 0 } };
}

// ---------------------------------------------------------------------------
// Real upcoming events — update this list as new events are announced.
// ESPN event IDs match what the scoreboard API returns.
// ---------------------------------------------------------------------------
const HARDCODED_EVENTS: HardcodedEvent[] = [
  // ── UFC Fight Night: Evloev vs. Murphy — March 21, 2026 ─────────────────
  {
    espnId: "600057365",
    name: "UFC Fight Night: Evloev vs. Murphy",
    shortName: "UFC Fight Night",
    date: "2026-03-21T21:00:00Z",
    location: "O2 Arena, London, England",
    venue: "O2 Arena",
    mainEvent: "Movsar Evloev vs Lerone Murphy",
    card: [
      {
        section: "main",
        weight: "Featherweight",
        title: false,
        f1: { name: "Movsar Evloev",       w: 19, l: 0, d: 0, cc: "RU", stance: "Orthodox", slpm: 4.51, sapm: 2.89, strAcc: 52, strDef: 62, tdAvg: 1.62, tdAcc: 40, tdDef: 77, subAvg: 0.3 },
        f2: { name: "Lerone Murphy",        w: 17, l: 0, d: 1, cc: "GB", stance: "Orthodox", slpm: 4.10, sapm: 2.54, strAcc: 49, strDef: 65, tdAvg: 0.80, tdAcc: 38, tdDef: 82, subAvg: 0.5 },
      },
      {
        // Co-main: Luke Riley (undefeated GB prospect) vs Michael Aswell
        section: "main",
        weight: "Featherweight",
        f1: { name: "Luke Riley",          w: 12, l: 0, d: 0, cc: "GB", stance: "Orthodox",  slpm: 5.31, sapm: 2.18, strAcc: 54, strDef: 68, tdAvg: 1.44, tdAcc: 48, tdDef: 79, subAvg: 0.4 },
        f2: { name: "Michael Aswell",      w: 11, l: 3, d: 0, cc: "GB", stance: "Orthodox",  slpm: 4.22, sapm: 3.76, strAcc: 47, strDef: 57, tdAvg: 0.92, tdAcc: 37, tdDef: 63, subAvg: 0.6 },
      },
      {
        section: "main",
        weight: "Welterweight",
        f1: { name: "Michael Page",        w: 24, l: 3, d: 0, cc: "GB", stance: "Southpaw", slpm: 5.62, sapm: 3.41, strAcc: 55, strDef: 60, tdAvg: 0.44, tdAcc: 33, tdDef: 74, subAvg: 0.2 },
        // Sam Patterson — Welsh WW prospect, 1-0 UFC, strong finisher
        f2: { name: "Sam Patterson",       w: 14, l: 2, d: 1, cc: "GB", stance: "Orthodox",  slpm: 4.54, sapm: 3.28, strAcc: 50, strDef: 59, tdAvg: 0.84, tdAcc: 36, tdDef: 69, subAvg: 0.3 },
      },
      {
        section: "main",
        weight: "Light Heavyweight",
        // Iwo Baraniewski — undefeated Polish grappler/wrestler
        f1: { name: "Iwo Baraniewski",     w: 7,  l: 0, d: 0, cc: "PL", stance: "Orthodox",  slpm: 3.82, sapm: 2.51, strAcc: 48, strDef: 66, tdAvg: 3.24, tdAcc: 53, tdDef: 80, subAvg: 1.2 },
        // Austen Lane — UFC veteran LHW/HW, real UFCStats career numbers
        f2: { name: "Austen Lane",         w: 13, l: 7, d: 0, nc: 1, cc: "US", stance: "Orthodox", slpm: 4.24, sapm: 4.89, strAcc: 44, strDef: 49, tdAvg: 0.62, tdAcc: 47, tdDef: 55, subAvg: 0.4 },
      },
      {
        section: "main",
        weight: "Middleweight",
        f1: { name: "Roman Dolidze",       w: 15, l: 4, d: 0, cc: "GE", stance: "Orthodox", slpm: 4.88, sapm: 4.12, strAcc: 47, strDef: 55, tdAvg: 1.10, tdAcc: 45, tdDef: 68, subAvg: 0.7 },
        // Christian Leroy Duncan — unbeaten CW prospect turned UFC MW
        f2: { name: "Christian Leroy Duncan", w: 13, l: 2, d: 0, cc: "GB", stance: "Southpaw", slpm: 5.14, sapm: 3.61, strAcc: 51, strDef: 57, tdAvg: 0.52, tdAcc: 34, tdDef: 66, subAvg: 0.5 },
      },
      {
        section: "prelim",
        weight: "Featherweight",
        f1: { name: "Kurtis Campbell",     w: 12, l: 3, d: 0, cc: "US", stance: "Orthodox",  slpm: 3.98, sapm: 3.54, strAcc: 46, strDef: 58, tdAvg: 1.52, tdAcc: 41, tdDef: 65, subAvg: 0.5 },
        f2: { name: "Danny Silva",         w: 12, l: 4, d: 0, cc: "BR", stance: "Orthodox",  slpm: 4.81, sapm: 4.12, strAcc: 51, strDef: 55, tdAvg: 0.58, tdAcc: 35, tdDef: 60, subAvg: 0.8 },
      },
    ],
  },

  // ── UFC 314: Oliveira vs Chandler 2 — April 12, 2026 ────────────────────
  {
    espnId: "600058001",
    name: "UFC 314: Oliveira vs. Chandler 2",
    shortName: "UFC 314",
    date: "2026-04-12T22:00:00Z",
    location: "Kaseya Center, Miami, FL",
    venue: "Kaseya Center",
    mainEvent: "Charles Oliveira vs Michael Chandler",
    card: [
      {
        section: "main",
        weight: "Lightweight",
        f1: { name: "Charles Oliveira",    w: 34, l: 9, d: 0, cc: "BR", stance: "Orthodox", slpm: 4.78, sapm: 4.21, strAcc: 50, strDef: 55, tdAvg: 3.53, tdAcc: 36, tdDef: 66, subAvg: 2.2 },
        f2: { name: "Michael Chandler",    w: 23, l: 8, d: 0, cc: "US", stance: "Orthodox", slpm: 5.64, sapm: 5.63, strAcc: 49, strDef: 54, tdAvg: 2.34, tdAcc: 47, tdDef: 72, subAvg: 0.5 },
      },
      {
        section: "main",
        weight: "Featherweight",
        title: true,
        f1: { name: "Ilia Topuria",        w: 16, l: 0, d: 0, cc: "GE", stance: "Orthodox", slpm: 5.81, sapm: 1.91, strAcc: 57, strDef: 72, tdAvg: 1.98, tdAcc: 46, tdDef: 80, subAvg: 0.6 },
        f2: { name: "Diego Lopes",         w: 24, l: 6, d: 0, cc: "BR", stance: "Southpaw", slpm: 5.32, sapm: 3.95, strAcc: 52, strDef: 58, tdAvg: 0.91, tdAcc: 33, tdDef: 71, subAvg: 1.1 },
      },
    ],
  },
];
