import { NextRequest, NextResponse } from "next/server";
import { fetchEventWithFights } from "@/lib/espn";
import { getCachedData, setCachedData } from "@/lib/cache";

export async function GET(
  _req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const cacheKey = `event:${params.eventId}`;
    const cached = await getCachedData(cacheKey);
    if (cached) return NextResponse.json(cached);

    const data = await fetchEventWithFights(params.eventId);
    if (!data) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await setCachedData(cacheKey, data, 3600);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Event API error:", err);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

export const runtime = "nodejs";
