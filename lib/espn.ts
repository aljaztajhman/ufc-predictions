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
// Athlete endpoints live at the sport level, NOT under /leagues/ufc/.
// e.g. /v2/sports/mma/athletes/{id}/statistics — NOT /leagues/ufc/athletes/{id}/statistics
const ESPN_MMA = "https://sports.core.api.espn.com/v2/sports/mma";

async function fetchJSON(url: string, revalidate = 3600): Promise<unknown> {
  const res = await fetch(url, {
    next: { revalidate },
    headers: { "User-Agent": "Mozilla/5.0 (compatible; UFC-Predictions/1.0)" },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  return res.json();
}

// ─── Safe string extractor ─────────────────────────────────────────────────────
// ESPN Core often returns fields as {id, text} objects rather than plain strings.
// This helper safely unwraps those, preventing React from crashing when an object
// is accidentally passed as a JSX child.
function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.displayName === "string") return obj.displayName;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj.description === "string") return obj.description;
  }
  return "";
}

// ─── Event parsing ─────────────────────────────────────────────────────────────

// ESPN names upcoming events as "UFC 327: Procházka vs. Ulberg" or
// "UFC Fight Night: Adesanya vs. Pyfer". The main event matchup is
// everything after the colon — no extra API calls needed.
function extractMainEventFromName(name: string): string {
  const colonIdx = name.indexOf(":");
  if (colonIdx !== -1) {
    const after = name.slice(colonIdx + 1).trim();
    if (after) return after;
  }
  return "";
}

function parseEvent(e: any): UFCEvent {
  const competition = e.competitions?.[0];
  const competitors = competition?.competitors || [];
  const competitorNames = competitors.map(
    (c: any) => c.athlete?.displayName || c.displayName || "TBD"
  );

  const eventName: string = e.name || e.shortName || "UFC Event";

  // Main event: always prefer the event name first — it's the most reliable
  // source for upcoming events (e.g. "UFC Fight Night: Evloev vs. Murphy").
  // ESPN's competitions[0] from the scoreboard is often a prelim fight, not
  // the headliner, so we only fall back to it when the name has no colon.
  const nameBasedMainEvent = extractMainEventFromName(eventName);
  const mainEvent =
    nameBasedMainEvent ||
    (competitorNames.length >= 2
      ? `${competitorNames[0]} vs ${competitorNames[1]}`
      : "TBD");

  const dateStr: string = e.date || competition?.date || "";

  // Location: ESPN Core uses a `venues` array; ESPN site API uses competitions[0].venue
  const venue =
    e.venues?.[0]?.fullName ||
    e.venue?.fullName ||
    competition?.venue?.fullName ||
    "";
  const city =
    e.venues?.[0]?.address?.city ||
    competition?.venue?.address?.city ||
    e.location ||
    "";
  const location = venue || city || "TBD";

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
    name: eventName,
    shortName: e.shortName || eventName,
    date: dateStr,
    location,
    venue: venue || "TBD",
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

// ─── Upcoming events ───────────────────────────────────────────────────────────

export async function fetchUpcomingEvents(): Promise<UFCEvent[]> {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const year = todayMidnight.getFullYear();

  const isUpcoming = (e: UFCEvent) =>
    e.status !== "completed" && !!e.date && new Date(e.date) >= todayMidnight;

  // ── PRIMARY: ESPN Core /events?dates=YYYY ──────────────────────────────────
  // Use the YEAR format (e.g. dates=2026) — confirmed to return all events in
  // the year. We fetch all refs in parallel, then filter to future dates.
  // The 8-digit format (dates=YYYYMMDD) is treated as a specific date, not a
  // range, so it returns 0 results when there's no event on that exact day.
  try {
    const scheduleData = (await fetchJSON(
      `${ESPN_CORE}/events?limit=100&dates=${year}`,
      3600
    )) as any;

    const refs: string[] = (scheduleData.items || [])
      .map((i: any) => i.$ref as string)
      .filter(Boolean);

    if (refs.length > 0) {
      // Fetch all event objects in parallel — Next.js ISR caches this server-side
      const evtResults = await Promise.allSettled(
        refs.map((ref) => fetchJSON(ref, 3600))
      );

      const events: UFCEvent[] = evtResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map((r) => parseEvent(r.value))
        .filter(isUpcoming)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (events.length > 0) return events;
    }
  } catch (err) {
    console.error("ESPN Core events error:", err);
  }

  // ── SECONDARY: ESPN site scoreboard (covers current week only) ────────────
  try {
    const data = (await fetchJSON(`${ESPN_BASE}/scoreboard?limit=50`)) as any;
    const events: UFCEvent[] = (data.events || [])
      .map(parseEvent)
      .filter(isUpcoming)
      .sort((a: UFCEvent, b: UFCEvent) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    if (events.length > 0) return events;
  } catch (err) {
    console.error("ESPN scoreboard error:", err);
  }

  return [];
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

  // ── Step 2: ESPN Core competitions API — full card with real athlete stats ──
  // Strategy:
  //   a) Fetch the list of competition $refs for this event.
  //   b) Fetch each competition to get the two competitor IDs.
  //   c) Collect all unique athlete IDs across all bouts.
  //   d) Fetch bio + stats + record for every athlete in parallel.
  //   e) Build Fight objects from the real ESPN data.
  // This gives us real career stats (strikeLPM, strikeAccuracy, etc.) for
  // every fighter instead of hardcoded or estimated values.
  if (fights.length <= 1) {
    try {
      const coreList = (await fetchJSON(
        `${ESPN_CORE}/events/${eventId}/competitions?limit=50`,
        3600
      )) as any;

      const compRefs: string[] = (coreList.items || [])
        .map((i: any) => i.$ref as string)
        .filter(Boolean);

      if (compRefs.length > 0) {
        // Fetch all competition objects in parallel
        const compResults = await Promise.allSettled(
          compRefs.slice(0, 20).map((ref) => fetchJSON(ref, 7200))
        );

        const validComps = compResults
          .filter(
            (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled"
          )
          .map((r) => r.value as any)
          .filter((comp) => (comp.competitors || []).length >= 2);

        // Collect unique athlete IDs from all competitions.
        // ESPN Core competition objects have:
        //   competitors[].id — the athlete's ESPN ID (what we need)
        //   competitors[].athlete.$ref — a URL link (name NOT embedded)
        const athleteIds = new Set<string>();
        for (const comp of validComps) {
          for (const c of comp.competitors || []) {
            const id = String(c.id || "").trim();
            if (id && id !== "0") athleteIds.add(id);
          }
        }

        // Fetch real bio + stats + record for every athlete in parallel
        const athleteIdArray = Array.from(athleteIds);
        const athleteResults = await Promise.allSettled(
          athleteIdArray.map((id) => fetchAthleteWithStats(id))
        );

        const athleteMap: Record<string, Fighter> = {};
        athleteIdArray.forEach((id, idx) => {
          const r = athleteResults[idx];
          if (r.status === "fulfilled" && r.value.name !== "Unknown") {
            athleteMap[id] = r.value;
          }
        });

        // Sort competitions: matchNumber 1 = main event, higher = earlier on card
        const sortedComps = [...validComps].sort(
          (a, b) => (a.matchNumber ?? 99) - (b.matchNumber ?? 99)
        );

        const coreFights: Fight[] = sortedComps
          .map((comp, idx) => {
            const [c1, c2] = comp.competitors as any[];
            if (!c1 || !c2) return null;

            const id1 = String(c1.id || "");
            const id2 = String(c2.id || "");
            const f1 = athleteMap[id1] ?? blankFighter(c1.athlete?.displayName || "TBD");
            const f2 = athleteMap[id2] ?? blankFighter(c2.athlete?.displayName || "TBD");

            // Determine card section from cardSegment.name
            // Use toStr() because cardSegment may be an {id, text, name} object
            const seg: string = toStr(comp.cardSegment?.name || comp.cardSegment).toLowerCase();
            let section: Fight["section"] = "main";
            if (seg.includes("early") || seg === "prelims2") {
              section = "early-prelim";
            } else if (seg.includes("prelim")) {
              section = "prelim";
            } else if (!seg && idx >= 5) {
              section = idx >= 10 ? "early-prelim" : "prelim";
            }

            // comp.type is typically {id, text} — extract just the text
            const wcText: string = toStr(comp.type?.text) || toStr(comp.type) || toStr(comp.typeText) || "";

            return {
              id: `${eventId}-core-${comp.matchNumber ?? idx}`,
              eventId,
              order: comp.matchNumber ?? idx,
              section,
              weightClass: wcText || "Catchweight",
              isTitleFight:
                wcText.toLowerCase().includes("title") || comp.title === true,
              isMainEvent: idx === 0,
              fighter1: f1,
              fighter2: f2,
            } as Fight;
          })
          .filter((f): f is Fight => f !== null);

        // Accept the ESPN Core card if at least half the fighters are named
        const namedCount = coreFights.filter(
          (f) => f.fighter1.name !== "TBD" && f.fighter2.name !== "TBD"
        ).length;
        const coreIsUsable =
          coreFights.length > 0 &&
          namedCount >= Math.ceil(coreFights.length / 2);

        if (coreIsUsable && coreFights.length > fights.length) {
          fights = coreFights;

          // Build event metadata from competitions data if summary didn't provide it
          if (!event) {
            const firstComp = sortedComps[0];
            const mainEventStr = coreFights[0]
              ? `${coreFights[0].fighter1.name} vs ${coreFights[0].fighter2.name}`
              : "TBD";
            event = {
              id: eventId,
              name: `UFC Event: ${mainEventStr}`,
              shortName: "UFC Event",
              date: firstComp?.date || firstComp?.startDate || new Date().toISOString(),
              location: firstComp?.venue?.fullName || "TBD",
              venue: firstComp?.venue?.fullName || "TBD",
              mainEvent: mainEventStr,
              status: "upcoming",
            };
          }
        }
      }
    } catch (err) {
      console.error("ESPN Core competitions error for", eventId, err);
    }
  }

  // Filter out TBD vs TBD placeholders with no useful data
  const namedFights = fights.filter(
    (f) => f.fighter1.name !== "Unknown" && f.fighter2.name !== "Unknown"
  );

  // If we have no event metadata at all, nothing useful to show
  if (!event) return null;

  // Return what we have — empty fights = "Fight card not yet announced" in UI
  return { event, fights: namedFights };
}

// ─── ESPN Core athlete data fetcher ───────────────────────────────────────────
// Fetches real career stats for a fighter by ESPN athlete ID.
// Uses 3 ESPN Core endpoints in parallel:
//   /athletes/{id}            → bio (name, height, reach, stance, nationality)
//   /athletes/{id}/statistics → career stats (strikeLPM, strikeAccuracy, tdAvg, …)
//   /athletes/{id}/records    → W-L-D record with win breakdown

async function fetchAthleteWithStats(athleteId: string): Promise<Fighter> {
  const base = `${ESPN_MMA}/athletes/${athleteId}`;

  const [bioResult, statsResult, recordResult] = await Promise.allSettled([
    fetchJSON(base, 7200),
    fetchJSON(`${base}/statistics`, 7200),
    fetchJSON(`${base}/records`, 7200),
  ]);

  const bio =
    bioResult.status === "fulfilled" ? (bioResult.value as any) : {};
  const statsData =
    statsResult.status === "fulfilled" ? (statsResult.value as any) : {};
  const recordData =
    recordResult.status === "fulfilled" ? (recordResult.value as any) : {};

  // ── Record ──────────────────────────────────────────────────────────────────
  const recordSummary: string =
    recordData?.items?.[0]?.summary || "0-0-0";
  const recordStats: any[] = recordData?.items?.[0]?.stats || [];
  const parsedRecord = parseRecord(recordSummary);

  const getRecordStat = (name: string): number | undefined =>
    recordStats.find((s: any) => s.name === name)?.value ?? undefined;

  // ── Career stats ────────────────────────────────────────────────────────────
  const statsCategories: any[] = statsData?.splits?.categories || [];
  const careerStats: Record<string, number> = {};
  for (const category of statsCategories) {
    for (const stat of category.stats || []) {
      if (stat.name && stat.value !== undefined && stat.value !== null) {
        careerStats[stat.name] = Number(stat.value);
      }
    }
  }

  // ESPN Core may return accuracy as 0-1 decimal or 0-100 integer.
  // Values > 1 are already percentages; ≤ 1 need to be multiplied by 100.
  const normalizeAccuracy = (v: number | undefined): number | undefined => {
    if (v === undefined || v === 0) return undefined;
    return v <= 1 ? Math.round(v * 100) : Math.round(v);
  };

  // ── Height & Reach ───────────────────────────────────────────────────────────
  // Use toStr() since ESPN Core may return these as objects too.
  let height: string | undefined;
  const rawDisplayHeight = toStr(bio.displayHeight);
  const rawHeight = toStr(bio.height);
  if (rawDisplayHeight) {
    height = rawDisplayHeight;
  } else if (rawHeight) {
    const inches = Number(rawHeight);
    height = isNaN(inches) ? rawHeight : formatHeight(inches);
  }

  const rawReach = toStr(bio.reach);
  const reach = rawReach ? (rawReach.includes('"') ? rawReach : `${rawReach}"`) : undefined;

  // Use toStr() on every field that could come back as an ESPN {id, text} object.
  // If any of these reach React as non-strings, we get Minified Error #31.
  const name = toStr(bio.displayName) || toStr(bio.fullName) || "Unknown";
  const nationality = toStr(bio.flag?.alt) || toStr(bio.birthPlace?.country) || undefined;
  const stance = (toStr(bio.stance) || undefined) as Fighter["stance"] | undefined;
  const flagHref = toStr(bio.flag?.href) || toStr(bio.flag?.$ref) || "";
  const imageUrl = toStr(bio.headshot?.href) || undefined;

  return {
    id: athleteId,
    name,
    nickname: toStr(bio.nickname) || undefined,
    record: {
      wins: parsedRecord.wins,
      losses: parsedRecord.losses,
      draws: parsedRecord.draws,
      noContests: getRecordStat("noContests"),
      winsByKO: getRecordStat("tkos"),
      winsBySub: getRecordStat("submissions"),
      winsByDec: Math.max(
        0,
        parsedRecord.wins -
          (getRecordStat("tkos") ?? 0) -
          (getRecordStat("submissions") ?? 0)
      ),
    },
    nationality,
    countryCode: flagHref ? extractCountryCode(flagHref) : undefined,
    height,
    reach,
    stance,
    imageUrl,
    // Real ESPN Core stats — only populated when ESPN has data for this fighter.
    // We never estimate or make up values; missing stats show as undefined in the UI.
    sigStrikesLandedPerMin:
      careerStats.strikeLPM || undefined,
    sigStrikeAccuracy:
      normalizeAccuracy(careerStats.strikeAccuracy),
    takedownAvgPer15Min:
      careerStats.takedownAvg || undefined,
    takedownAccuracy:
      normalizeAccuracy(careerStats.takedownAccuracy),
    submissionAvgPer15Min:
      careerStats.submissionAvg || undefined,
    // ESPN Core does not expose SApM, StrDef%, or TDDef%.
    // Leave as undefined — the StatBar component skips bars with undefined values.
    sigStrikesAbsorbedPerMin: undefined,
    sigStrikeDefense: undefined,
    takedownDefense: undefined,
  };
}

// ─── Fighter parsing (ESPN site API) ──────────────────────────────────────────

// Minimal placeholder when we have a name but no stats yet
function blankFighter(name: string): Fighter {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    record: { wins: 0, losses: 0, draws: 0 },
  };
}

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

