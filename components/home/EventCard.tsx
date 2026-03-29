import Link from "next/link";
import { MapPin, ChevronRight, Zap, Calendar } from "lucide-react";
import type { UFCEvent } from "@/types";
import { Badge, EventTimeBadge } from "@/components/ui/Badge";
import { formatShortDate, getEventBadge } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: UFCEvent;
  featured?: boolean;
  index?: number;
}

export function EventCard({ event, featured = false, index = 0 }: EventCardProps) {
  const timeBadge = getEventBadge(event.date);
  const isPPV = event.name.match(/UFC\s+\d+/);

  return (
    <Link
      href={`/event/${event.id}`}
      className={cn(
        "group block relative overflow-hidden rounded-2xl border transition-all duration-300 card-hover",
        featured
          ? "border-ufc-red/30 bg-gradient-to-br from-[#1E0808] via-[#140A0A] to-[#0D0F18]"
          : "border-white/7 bg-ufc-dark-2 hover:border-white/14"
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Featured: ambient red glow overlay */}
      {featured && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-ufc-red/10 via-ufc-red/3 to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-ufc-red/70 to-transparent" />
        </>
      )}

      {/* Non-featured: subtle top line on hover */}
      {!featured && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/0 to-transparent group-hover:via-ufc-red/30 transition-all duration-500" />
      )}

      <div className="relative p-5 sm:p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {featured && (
              <Badge variant="red" size="sm">
                <Zap size={9} className="fill-current" />
                Next Event
              </Badge>
            )}
            {timeBadge && <EventTimeBadge label={timeBadge} />}
            {isPPV && !featured && (
              <Badge variant="gold" size="sm">PPV</Badge>
            )}
          </div>
          <span className="text-white/55 text-xs flex-shrink-0 font-medium">
            {event.status === "live" ? (
              <span className="text-ufc-red font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-ufc-red rounded-full animate-pulse inline-block" />
                LIVE
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Calendar size={11} className="opacity-70" />
                {formatShortDate(event.date)}
              </span>
            )}
          </span>
        </div>

        {/* Event name — full name for featured, shortName for grid cards */}
        <h3 className={cn(
          "font-black uppercase tracking-tight mb-2 transition-colors leading-tight",
          featured
            ? "text-2xl sm:text-3xl text-white group-hover:text-white"
            : "text-xl text-white/90 group-hover:text-white"
        )}>
          {featured ? event.name : event.shortName}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-white/55 text-xs mb-5">
          <MapPin size={11} className="flex-shrink-0" />
          <span className="truncate">{event.location}</span>
        </div>

        {/* Main event section */}
        <div className={cn(
          "rounded-xl p-3.5",
          featured
            ? "bg-black/25 border border-ufc-red/15"
            : "bg-black/20 border border-white/5"
        )}>
          <p className="text-white/50 text-xs uppercase tracking-widest mb-2.5 font-semibold">
            Main Event
          </p>
          <div className="flex items-center gap-2 sm:gap-3">
            {event.mainEvent.split(" vs ").map((name, i, arr) => (
              <span key={`${name}-${i}`} className="flex items-center gap-2 sm:gap-3 min-w-0">
                <span className={cn(
                  "font-bold truncate",
                  featured ? "text-white text-base sm:text-lg" : "text-white/85 text-sm sm:text-base"
                )}>
                  {name.trim()}
                </span>
                {i < arr.length - 1 && (
                  <span className="text-ufc-red font-black text-xs uppercase tracking-widest flex-shrink-0 px-1">
                    VS
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Arrow indicator */}
        <div className={cn(
          "absolute right-5 bottom-5 transition-all duration-300",
          "opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0"
        )}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center"
               style={{ background: "rgba(210,10,10,0.18)", border: "1px solid rgba(210,10,10,0.3)" }}>
            <ChevronRight size={13} className="text-ufc-red" />
          </div>
        </div>
      </div>
    </Link>
  );
}
