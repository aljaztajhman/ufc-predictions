import { Suspense } from "react";
import { fetchUpcomingEvents } from "@/lib/espn";
import { getCachedData, setCachedData } from "@/lib/cache";
import { EventCard } from "@/components/home/EventCard";
import { EventCardSkeleton } from "@/components/ui/Skeleton";
import type { UFCEvent } from "@/types";
import { Zap, Calendar } from "lucide-react";

async function getEvents(): Promise<UFCEvent[]> {
  const cacheKey = "events:upcoming";
  const cached = await getCachedData<UFCEvent[]>(cacheKey);
  if (cached) return cached;

  const events = await fetchUpcomingEvents();
  if (events.length > 0) await setCachedData(cacheKey, events);
  return events;
}

function EventsGrid({ events }: { events: UFCEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
          <Calendar size={24} className="text-white/30" />
        </div>
        <h3 className="text-white/40 text-lg font-semibold mb-2">No upcoming events found</h3>
        <p className="text-white/25 text-sm">Check back soon for the latest UFC schedule.</p>
      </div>
    );
  }

  const [featured, ...rest] = events;

  return (
    <div className="space-y-8">
      {/* Featured next event */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-ufc-red/50 to-transparent" />
          <span className="text-ufc-red text-[10px] uppercase tracking-widest font-semibold px-2">
            Next Up
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-ufc-red/50 to-transparent" />
        </div>
        <div className="animate-fade-in-up">
          <EventCard event={featured} featured index={0} />
        </div>
      </section>

      {/* Upcoming events grid */}
      {rest.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-white/30 text-[10px] uppercase tracking-widest font-semibold px-2">
              Upcoming Events
            </span>
            <div className="h-px flex-1 bg-white/5" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {rest.map((event, i) => (
              <EventCard key={event.id} event={event} index={i + 1} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-8">
      <div>
        <EventCardSkeleton />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <EventCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

async function EventsSection() {
  const events = await getEvents();
  return <EventsGrid events={events} />;
}

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Hero header */}
      <div className="mb-12 text-center relative">
        {/* Subtle background glow */}
        <div className="absolute inset-0 -top-8 flex items-center justify-center pointer-events-none">
          <div className="w-96 h-32 bg-ufc-red/8 blur-3xl rounded-full" />
        </div>

        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-ufc-red/10 border border-ufc-red/20 rounded-full px-3 py-1 mb-5">
            <Zap size={12} className="text-ufc-red fill-current" />
            <span className="text-ufc-red text-xs font-semibold uppercase tracking-wider">
              AI-Powered Analysis
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white mb-3">
            UFC Fight<br />
            <span className="text-gradient-red">Predictions</span>
          </h1>
          <p className="text-white/40 text-base sm:text-lg max-w-xl mx-auto">
            Deep-dive fighter analytics and AI-generated matchup breakdowns for every fight on the card.
          </p>
        </div>
      </div>

      {/* Events */}
      <Suspense fallback={<SkeletonGrid />}>
        <EventsSection />
      </Suspense>
    </div>
  );
}
