import { NextResponse } from "next/server";
import { fetchUpcomingEvents } from "@/lib/espn";
import { getCachedEvents, setCachedEvents } from "@/lib/cache";

export async function GET() {
  try {
    const cached = await getCachedEvents();
    if (cached) return NextResponse.json(cached);

    const events = await fetchUpcomingEvents();
    if (events.length > 0) await setCachedEvents(events);

    return NextResponse.json(events);
  } catch (err) {
    console.error("Events API error:", err);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const revalidate = 3600;
