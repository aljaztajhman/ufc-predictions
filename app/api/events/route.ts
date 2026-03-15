import { NextResponse } from "next/server";
import { fetchUpcomingEvents } from "@/lib/espn";
import { getCachedData, setCachedData } from "@/lib/cache";
import type { UFCEvent } from "@/types";

export async function GET() {
  try {
    const cacheKey = "events:upcoming";
    const cached = await getCachedData<UFCEvent[]>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const events = await fetchUpcomingEvents();
    if (events.length > 0) await setCachedData(cacheKey, events);

    return NextResponse.json(events);
  } catch (err) {
    console.error("Events API error:", err);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const revalidate = 3600;
