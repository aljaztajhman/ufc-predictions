/**
 * UFCStats.com scraper for detailed fighter statistics.
 * Used to enrich fighter data before passing to Claude.
 */

import type { Fighter, RecentFight } from "@/types";

const UFCSTATS_BASE = "https://ufcstats.com";

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ufcstats fetch failed: ${res.status}`);
  return res.text();
}

// ─── Fighter search ───────────────────────────────────────────────────────────

export async function searchFighterOnUFCStats(name: string): Promise<string | null> {
  try {
    const parts = name.toLowerCase().split(/\s+/);
    const char = parts[parts.length - 1][0]; // search by last name first letter
    const url = `${UFCSTATS_BASE}/statistics/fighters?char=${char}&page=all`;
    const html = await fetchHTML(url);

    // Simple text parsing — find the fighter link
    const nameEscaped = name.toLowerCase();
    const lines = html.split("\n");

    for (const line of lines) {
      if (line.toLowerCase().includes(nameEscaped) && line.includes("fighter-details")) {
        const match = line.match(/href="([^"]+fighter-details[^"]+)"/i);
        if (match) return match[1];
      }
    }

    // Fallback: try to match individual name parts
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (parts.every((p) => lower.includes(p)) && line.includes("href=")) {
        const match = line.match(/href="([^"]+)"/);
        if (match && match[1].includes("fighter-details")) return match[1];
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function scrapeFighterStats(fighterUrl: string): Promise<Partial<Fighter>> {
  try {
    const html = await fetchHTML(fighterUrl);
    return parseFighterPage(html);
  } catch {
    return {};
  }
}

function parseFighterPage(html: string): Partial<Fighter> {
  const stats: Partial<Fighter> = {};

  // Height
  const heightMatch = html.match(/Height:<\/i>\s*<span[^>]*>([^<]+)</i);
  if (heightMatch) stats.height = heightMatch[1].trim();

  // Reach
  const reachMatch = html.match(/Reach:<\/i>\s*<span[^>]*>([^<]+)</i);
  if (reachMatch) stats.reach = reachMatch[1].trim();

  // Stance
  const stanceMatch = html.match(/STANCE:<\/i>\s*<span[^>]*>([^<]+)</i);
  if (stanceMatch) stats.stance = stanceMatch[1].trim() as Fighter["stance"];

  // DOB → age
  const dobMatch = html.match(/DOB:<\/i>\s*<span[^>]*>([^<]+)</i);
  if (dobMatch) {
    const dobStr = dobMatch[1].trim();
    // UFCStats uses "Month. DD, YYYY" or "Month DD, YYYY"
    const dob = new Date(dobStr);
    if (!isNaN(dob.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      stats.age = age;
    }
  }

  // Significant strikes landed per minute
  const slpmMatch = html.match(/SLpM[^>]*>[\s\S]*?<p[^>]*>([\d.]+)/i);
  if (slpmMatch) stats.sigStrikesLandedPerMin = parseFloat(slpmMatch[1]);

  // Sig. strike accuracy
  const strAccMatch = html.match(/Str\. Acc[^>]*>[\s\S]*?<p[^>]*>([\d.]+)/i);
  if (strAccMatch) stats.sigStrikeAccuracy = parseFloat(strAccMatch[1]);

  // Sig. strikes absorbed per minute
  const sabsMatch = html.match(/SApM[^>]*>[\s\S]*?<p[^>]*>([\d.]+)/i);
  if (sabsMatch) stats.sigStrikesAbsorbedPerMin = parseFloat(sabsMatch[1]);

  // Sig. strike defense
  const strDefMatch = html.match(/Str\. Def[^>]*>[\s\S]*?<p[^>]*>([\d.]+)/i);
  if (strDefMatch) stats.sigStrikeDefense = parseFloat(strDefMatch[1]);

  // Takedown average
  const tdAvgMatch = html.match(/TD Avg[^>]*>[\s\S]*?<p[^>]*>([\d.]+)/i);
  if (tdAvgMatch) stats.takedownAvgPer15Min = parseFloat(tdAvgMatch[1]);

  // Takedown accuracy
  const tdAccMatch = html.match(/TD Acc[^>]*>[\s\S]*?<p[^>]*>([\d.]+)/i);
  if (tdAccMatch) stats.takedownAccuracy = parseFloat(tdAccMatch[1]);

  // Takedown defense
  const tdDefMatch = html.match(/TD Def[^>]*>[\s\S]*?<p[^>]*>([\d.]+)/i);
  if (tdDefMatch) stats.takedownDefense = parseFloat(tdDefMatch[1]);

  // Submission average
  const subAvgMatch = html.match(/Sub\. Avg[^>]*>[\s\S]*?<p[^>]*>([\d.]+)/i);
  if (subAvgMatch) stats.submissionAvgPer15Min = parseFloat(subAvgMatch[1]);

  // Recent fights from fight history table (keep up to 5 most recent)
  const allFights = parseRecentFights(html);
  stats.recentFights = allFights.slice(0, 5);

  // careerStartDate: oldest fight date from the full history
  if (allFights.length > 0) {
    const oldest = allFights[allFights.length - 1];
    if (oldest.date) {
      const parsed = new Date(oldest.date);
      if (!isNaN(parsed.getTime())) {
        stats.careerStartDate = parsed.toISOString().split("T")[0];
      }
    }
  }

  return stats;
}

function parseRecentFights(html: string): RecentFight[] {
  const fights: RecentFight[] = [];

  // Match rows in the fight history table
  const tableMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/g);
  if (!tableMatch) return fights;

  for (const tbody of tableMatch) {
    const rows = tbody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];
    for (const row of rows) {
      try {
        const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
        if (cells.length < 7) continue;

        const getText = (cell: string | undefined) =>
          (cell ?? "").replace(/<[^>]+>/g, "").trim().replace(/\s+/g, " ");

        const rawResult = getText(cells[0]).charAt(0);
        const result = (rawResult === "N" ? "NC" : rawResult) as RecentFight["result"];
        const opponent = getText(cells[1]);
        const method = getText(cells[7] ?? cells[6] ?? "");
        const event = getText(cells[6] ?? cells[5] ?? "");
        const date = getText(cells[cells.length - 1]);

        if (opponent && ["W", "L", "D", "NC"].includes(result)) {
          fights.push({
            opponent,
            result,
            method,
            event,
            date,
          });
        }
      } catch {
        // skip malformed row
      }
    }
  }

  return fights;
}

/**
 * Enrich fighters with UFCStats data.
 * Gracefully skips if scraping fails.
 */
export async function enrichFighterWithUFCStats(fighter: Fighter): Promise<Fighter> {
  try {
    const url = await searchFighterOnUFCStats(fighter.name);
    if (!url) return fighter;
    const scraped = await scrapeFighterStats(url);
    return { ...fighter, ...scraped };
  } catch {
    return fighter;
  }
}
