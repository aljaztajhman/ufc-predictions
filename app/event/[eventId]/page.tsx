import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, Shield } from "lucide-react";
import { fetchEventWithFights } from "@/lib/espn";
import { getCachedData, setCachedData, getCachedPrediction } from "@/lib/cache";
import { FightSection } from "@/components/event/FightCard";
import { FightCardSkeleton } from "@/components/ui/Skeleton";
import { Badge, EventTimeBadge } from "@/components/ui/Badge";
import { formatEventDate, getEventBadge } from "@/lib/utils";
import type { PredictionResult, EventWithFights } from "@/types";
import type { Metadata } from "next";

// Re-render event pages every 30 minutes so fight card changes are picked up.
export const revalidate = 1800;

interface PageProps {
  params: { eventId: string };
}

async function getEventData(eventId: string): Promise<EventWithFights | null> {
  const cacheKey = `event:${eventId}`;
  const cached = await getCachedData<EventWithFights>(cacheKey);
  if (cached) return cached;

  const data = await fetchEventWithFights(eventId);
  if (!data) return null;

  const result: EventWithFights = { ...data.event, fights: data.fights };
  await setCachedData(cacheKey, result, 1800);
  return result;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getEventData(params.eventId);
  if (!data) return { title: "Event Not Found" };

  return {
    title: data.name,
    description: `AI predictions for ${data.name} — ${data.mainEvent} and the full fight card`,
  };
}

async function EventContent({ eventId }: { eventId: string }) {
  const data = await getEventData(eventId);
  if (!data) notFound();

  const { fights } = data;
  const mainCard = fights.filter((f) => f.section === "main").sort((a, b) => a.order - b.order);
  const prelims = fights.filter((f) => f.section === "prelim").sort((a, b) => a.order - b.order);
  const earlyPrelims = fights.filter((f) => f.section === "early-prelim").sort((a, b) => a.order - b.order);

  // Load any cached predictions server-side
  const allFights = [...mainCard, ...prelims, ...earlyPrelims];
  const predictionEntries = await Promise.all(
    allFights.map(async (f) => [f.id, await getCachedPrediction(f.id)] as [string, PredictionResult | null])
  );
  const predictions = Object.fromEntries(predictionEntries);

  const timeBadge = getEventBadge(data.date);

  return (
    <>
      {/* Event hero */}
      <div className="relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A0808]/60 via-[#0D0F18]/40 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-ufc-red/50 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-ufc-red/6 blur-3xl rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6 sm:pt-10 sm:pb-8 relative">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/35 hover:text-white/80 text-sm mb-8 transition-colors group"
          >
            <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
            All Events
          </Link>

          {/* Event meta */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-2 flex-wrap">
              {timeBadge && <EventTimeBadge label={timeBadge} />}
              <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10 text-white/35 bg-white/4">
                <Shield size={9} className="inline-block mr-1 align-middle" />
                {fights.length} Fights
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-white leading-tight">
              {data.name}
            </h1>
            <div className="flex flex-wrap gap-4 text-white/35 text-sm">
              <span className="flex items-center gap-1.5">
                <Calendar size={12} />
                {formatEventDate(data.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={12} />
                {data.location}
              </span>
            </div>
          </div>

          {/* Main event matchup hero card */}
          {mainCard[0] && (
            <div className="relative rounded-2xl overflow-hidden border border-ufc-red/20 bg-gradient-to-br from-[#1E0808]/80 via-[#141520]/80 to-[#0D0F18]/80 backdrop-blur-sm p-5 sm:p-6">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-ufc-red/50 to-transparent" />
              <p className="text-white/30 text-[9px] uppercase tracking-widest mb-4 font-semibold">
                {mainCard[0].isTitleFight ? "🏆 Championship Bout" : "Main Event"}
                {" · "}{mainCard[0].weightClass}
              </p>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black text-2xl sm:text-3xl lg:text-4xl truncate leading-tight">
                    {mainCard[0].fighter1.name}
                  </p>
                  <p className="text-white/35 text-sm font-mono mt-1">
                    {mainCard[0].fighter1.record.wins}-{mainCard[0].fighter1.record.losses}-{mainCard[0].fighter1.record.draws}
                  </p>
                </div>
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                     style={{ background: "rgba(210,10,10,0.12)", border: "1px solid rgba(210,10,10,0.3)" }}>
                  <span className="text-ufc-red font-black text-xs tracking-widest">VS</span>
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-white font-black text-2xl sm:text-3xl lg:text-4xl truncate leading-tight">
                    {mainCard[0].fighter2.name}
                  </p>
                  <p className="text-white/35 text-sm font-mono mt-1">
                    {mainCard[0].fighter2.record.wins}-{mainCard[0].fighter2.record.losses}-{mainCard[0].fighter2.record.draws}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fight card sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <FightSection title="Main Card" fights={mainCard} predictions={predictions} accent />
        <FightSection title="Prelims" fights={prelims} predictions={predictions} />
        <FightSection title="Early Prelims" fights={earlyPrelims} predictions={predictions} />
      </div>
    </>
  );
}

export default function EventPage({ params }: PageProps) {
  return (
    <Suspense fallback={<EventPageSkeleton />}>
      <EventContent eventId={params.eventId} />
    </Suspense>
  );
}

function EventPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      <div className="skeleton h-4 w-24 rounded" />
      <div className="skeleton h-12 w-64 rounded" />
      <div className="skeleton h-5 w-48 rounded" />
      <div className="skeleton h-32 rounded-xl" />
      <div className="space-y-3 mt-10">
        {[...Array(5)].map((_, i) => <FightCardSkeleton key={i} />)}
      </div>
    </div>
  );
}
