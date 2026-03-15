import { NextRequest, NextResponse } from "next/server";
import { generatePrediction } from "@/lib/claude";
import { getCachedPrediction } from "@/lib/cache";
import type { Fight } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { fightId: string } }
) {
  const cached = await getCachedPrediction(params.fightId);
  if (!cached) {
    return NextResponse.json({ error: "Prediction not found" }, { status: 404 });
  }
  return NextResponse.json(cached);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { fightId: string } }
) {
  try {
    // Always check cache first — never re-generate
    const cached = await getCachedPrediction(params.fightId);
    if (cached) {
      return NextResponse.json(cached);
    }

    const body = await req.json();
    const fight: Fight = body.fight;

    if (!fight || !fight.fighter1 || !fight.fighter2) {
      return NextResponse.json(
        { error: "Invalid fight data provided" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const prediction = await generatePrediction(fight);
    return NextResponse.json(prediction);
  } catch (err) {
    console.error("Prediction API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const maxDuration = 30;
