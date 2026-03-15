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
  await setCachedData(cacheKey, result, 3600);
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
      <div className="relative overflow-hidden bg-gradient-to-b from-[#120000] to-transparent">
        <div className="absolute inset-0 bg-gradient-to-br from-ufc-red/6 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ufc-red/40 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            All Events
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {timeBadge && <EventTimeBadge label={timeBadge} />}
                <Badge variant="gray" size="sm">
                  <Shield size={9} />
                  {fights.length} Fights
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-white">
                {data.name}
              </h1>
              <div className="flex flex-wrap gap-4 text-white/40 text-sm">
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} />
                  {formatEventDate(data.date)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} />
                  {data.location}
                </span>
              </div>
            </div>
          </div>

          {/* Main event matchup hero */}
          {mainCard[0] && (
            <div className="mt-8 p-5 bg-black/30 border border-white/6 rounded-xl backdrop-blur-sm">
              <p className="text-white/30 text-[10px] uppercase tracking-widest mb-3">
                {mainCard[0].isTitleFight ? "🏆 Championship Bout" : "Main Event"}
                {" · "}{mainCard[0].weightClass}
              </p>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black text-xl sm:text-2xl lg:text-3xl truncate">
                    {mainCard[0].fighter1.name}
                  </p>
                  <p className="text-white/40 text-sm font-mono">
                    {mainCard[0].fighter1.record.wins}-{mainCard[0].fighter1.record.losses}-{mainCard[0].fighter1.record.draws}
                  </p>
                </div>
                <div className="flex-shrink-0 px-3 py-1.5 bg-ufc-red/10 border border-ufc-red/20 rounded-lg">
                  <span className="text-ufc-red font-black text-sm">VS</span>
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-white font-black text-xl sm:text-2xl lg:text-3xl truncate">
                    {mainCard[0].fighter2.name}
                  </p>
                  <p className="text-white/40 text-sm font-mono">
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
