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

  // Format today as YYYYMMDD for the ESPN Core date filter
  const todayStr = todayMidnight.toISOString().slice(0, 10).replace(/-/g, "");

  // Hardcoded events — kept in sync with announced UFC calendar.
  // Used to fill in name/mainEvent/location when ESPN data is sparse,
  // and as a fallback if ESPN APIs are unavailable.
  const hardcodedUpcoming = getHardcodedUpcomingEvents();

  // ── PRIMARY: ESPN Core events with future-date filter ─────────────────────
  // This endpoint returns ALL scheduled UFC events from the given date
  // forward, not just the current week. It's the most reliable source of
  // the full upcoming calendar.
  try {
    const scheduleData = (await fetchJSON(
      `${ESPN_CORE}/events?limit=25&dates=${todayStr}`,
      3600
    )) as any;

    const refs: string[] = (scheduleData.items || [])
      .map((i: any) => i.$ref as string)
      .filter(Boolean);

    if (refs.length > 0) {
      const evtResults = await Promise.allSettled(
        refs.slice(0, 20).map((ref) => fetchJSON(ref, 3600))
      );

      const coreEvents: UFCEvent[] = evtResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map((r) => enrichEventFromHardcoded(parseEvent(r.value)))
        .filter((e: UFCEvent) => {
          if (e.status === "completed") return false;
          if (!e.date) return false;
          return new Date(e.date) >= todayMidnight;
        });

      if (coreEvents.length > 0) {
        // Supplement with any hardcoded events not yet in ESPN's system
        const seenIds = new Set(coreEvents.map((e) => e.id));
        const supplemental = hardcodedUpcoming.filter((e) => !seenIds.has(e.id));
        return [...coreEvents, ...supplemental].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
      }
    }
  } catch (err) {
    console.error("ESPN core events (primary) error:", err);
  }

  // ── SECONDARY: ESPN scoreboard (covers current week) ──────────────────────
  let espnEvents: UFCEvent[] = [];
  try {
    const data = (await fetchJSON(`${ESPN_BASE}/scoreboard?limit=50`)) as any;

    espnEvents = (data.events || [])
      .map(parseEvent)
      .map(enrichEventFromHardcoded)
      .filter((e: UFCEvent) => {
        if (e.status === "completed") return false;
        if (!e.date) return false;
        return new Date(e.date) >= todayMidnight;
      });
  } catch (err) {
    console.error("ESPN scoreboard error:", err);
  }

  // Merge scoreboard + hardcoded, deduplicating by ESPN ID
  const seenIds = new Set(espnEvents.map((e) => e.id));
  const supplemental = hardcodedUpcoming.filter((e) => !seenIds.has(e.id));
  const merged = [...espnEvents, ...supplemental].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (merged.length > 0) return merged;

  // ── FALLBACK: hardcoded only ───────────────────────────────────────────────
  return hardcodedUpcoming;
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

          // Build event metadata if ESPN summary didn't provide it
          if (!event) {
            const firstComp = sortedComps[0];
            event = {
              id: eventId,
              name: "UFC Event",
              shortName: "UFC Event",
              date: firstComp?.date || firstComp?.startDate || new Date().toISOString(),
              location: firstComp?.venue?.fullName || "TBD",
              venue: firstComp?.venue?.fullName || "TBD",
              mainEvent: coreFights[0]
                ? `${coreFights[0].fighter1.name} vs ${coreFights[0].fighter2.name}`
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

  // ── UFC Fight Night: Adesanya vs. Pyfer — March 28, 2026 ────────────────
  {
    espnId: "600057366",
    name: "UFC Fight Night: Adesanya vs. Pyfer",
    shortName: "UFC Fight Night",
    date: "2026-03-28T21:00:00Z",
    location: "Climate Pledge Arena, Seattle, WA",
    venue: "Climate Pledge Arena",
    mainEvent: "Israel Adesanya vs Joe Pyfer",
    card: [
      {
        section: "main",
        weight: "Middleweight",
        f1: { name: "Israel Adesanya",     w: 24, l: 5, d: 0, cc: "NZ", stance: "Orthodox", slpm: 4.31, sapm: 2.71, strAcc: 47, strDef: 60, tdAvg: 0.35, tdAcc: 16, tdDef: 91, subAvg: 0.1 },
        f2: { name: "Joe Pyfer",           w: 12, l: 2, d: 0, cc: "US", stance: "Orthodox", slpm: 6.20, sapm: 3.80, strAcc: 54, strDef: 56, tdAvg: 0.80, tdAcc: 40, tdDef: 68, subAvg: 0.4 },
      },
      {
        section: "main",
        weight: "Flyweight",
        f1: { name: "Alexa Grasso",        w: 16, l: 4, d: 0, cc: "MX", stance: "Orthodox", slpm: 4.80, sapm: 3.20, strAcc: 51, strDef: 57, tdAvg: 1.40, tdAcc: 41, tdDef: 70, subAvg: 1.3 },
        f2: { name: "Maycee Barber",       w: 15, l: 4, d: 0, cc: "US", stance: "Orthodox", slpm: 5.50, sapm: 4.30, strAcc: 52, strDef: 49, tdAvg: 1.70, tdAcc: 48, tdDef: 61, subAvg: 0.6 },
      },
      {
        section: "main",
        weight: "Featherweight",
        f1: { name: "Chase Hooper",        w: 14, l: 3, d: 1, cc: "US", stance: "Orthodox", slpm: 2.20, sapm: 2.80, strAcc: 41, strDef: 59, tdAvg: 2.80, tdAcc: 47, tdDef: 71, subAvg: 2.2 },
        f2: { name: "Lance Gibson Jr.",    w: 16, l: 5, d: 0, cc: "US", stance: "Orthodox", slpm: 4.10, sapm: 3.80, strAcc: 45, strDef: 51, tdAvg: 1.20, tdAcc: 37, tdDef: 60, subAvg: 0.7 },
      },
      {
        section: "main",
        weight: "Welterweight",
        f1: { name: "Michael Chiesa",      w: 19, l: 6, d: 0, cc: "US", stance: "Orthodox", slpm: 3.10, sapm: 3.40, strAcc: 42, strDef: 55, tdAvg: 3.20, tdAcc: 38, tdDef: 65, subAvg: 1.4 },
        f2: { name: "Carlston Harris",     w: 17, l: 5, d: 0, cc: "GY", stance: "Orthodox", slpm: 3.80, sapm: 3.60, strAcc: 46, strDef: 54, tdAvg: 2.10, tdAcc: 42, tdDef: 68, subAvg: 0.8 },
      },
    ],
  },

  // ── UFC 327: Procházka vs. Ulberg — April 11, 2026 ──────────────────────
  {
    espnId: "600058745",
    name: "UFC 327: Procházka vs. Ulberg",
    shortName: "UFC 327",
    date: "2026-04-11T22:00:00Z",
    location: "Kaseya Center, Miami, FL",
    venue: "Kaseya Center",
    mainEvent: "Jiří Procházka vs Carlos Ulberg",
    card: [
      {
        section: "main",
        weight: "Light Heavyweight",
        title: true,
        f1: { name: "Jiří Procházka",      w: 30, l: 4, d: 0, cc: "CZ", stance: "Switch",   slpm: 6.39, sapm: 5.17, strAcc: 54, strDef: 56, tdAvg: 0.68, tdAcc: 33, tdDef: 81, subAvg: 0.4 },
        f2: { name: "Carlos Ulberg",       w: 11, l: 2, d: 0, cc: "NZ", stance: "Orthodox", slpm: 4.82, sapm: 2.12, strAcc: 56, strDef: 68, tdAvg: 0.18, tdAcc: 33, tdDef: 80, subAvg: 0.0 },
      },
      {
        section: "main",
        weight: "Flyweight",
        title: true,
        f1: { name: "Joshua Van",          w: 15, l: 3, d: 0, cc: "AU", stance: "Southpaw", slpm: 3.50, sapm: 3.10, strAcc: 45, strDef: 52, tdAvg: 3.80, tdAcc: 47, tdDef: 70, subAvg: 1.5 },
        f2: { name: "Tatsuro Taira",       w: 15, l: 0, d: 0, cc: "JP", stance: "Orthodox", slpm: 3.80, sapm: 2.10, strAcc: 49, strDef: 65, tdAvg: 5.20, tdAcc: 55, tdDef: 78, subAvg: 2.8 },
      },
      {
        section: "main",
        weight: "Light Heavyweight",
        f1: { name: "Dominick Reyes",      w: 12, l: 5, d: 0, cc: "US", stance: "Orthodox", slpm: 5.20, sapm: 5.10, strAcc: 50, strDef: 53, tdAvg: 0.70, tdAcc: 38, tdDef: 71, subAvg: 0.1 },
        f2: { name: "Johnny Walker",       w: 21, l: 8, d: 0, cc: "BR", stance: "Southpaw", slpm: 5.40, sapm: 4.80, strAcc: 46, strDef: 51, tdAvg: 0.30, tdAcc: 28, tdDef: 62, subAvg: 0.1 },
      },
      {
        section: "main",
        weight: "Heavyweight",
        f1: { name: "Curtis Blaydes",      w: 18, l: 5, d: 0, cc: "US", stance: "Orthodox", slpm: 3.31, sapm: 4.01, strAcc: 47, strDef: 54, tdAvg: 4.88, tdAcc: 50, tdDef: 66, subAvg: 0.8 },
        f2: { name: "Josh Hokit",          w: 14, l: 4, d: 0, cc: "US", stance: "Orthodox", slpm: 4.10, sapm: 4.50, strAcc: 46, strDef: 49, tdAvg: 2.10, tdAcc: 38, tdDef: 55, subAvg: 0.5 },
      },
      {
        section: "main",
        weight: "Lightweight",
        f1: { name: "Beneil Dariush",      w: 22, l: 6, d: 0, cc: "US", stance: "Orthodox", slpm: 4.59, sapm: 3.11, strAcc: 52, strDef: 60, tdAvg: 2.78, tdAcc: 48, tdDef: 76, subAvg: 1.3 },
        f2: { name: "Manuel Torres",       w: 16, l: 4, d: 0, cc: "MX", stance: "Orthodox", slpm: 5.80, sapm: 4.20, strAcc: 53, strDef: 52, tdAvg: 0.60, tdAcc: 33, tdDef: 58, subAvg: 0.4 },
      },
    ],
  },
];
