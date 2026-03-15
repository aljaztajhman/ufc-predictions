import Link from "next/link";
import { MapPin, ChevronRight, Zap } from "lucide-react";
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
        "group block relative overflow-hidden rounded-xl border transition-all duration-300",
        "card-hover",
        featured
          ? "bg-gradient-to-br from-[#1a0505] via-[#130202] to-[#0A0A0A] border-ufc-red/30"
          : "bg-ufc-dark-2 border-white/6 hover:border-white/12"
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Featured glow */}
      {featured && (
        <div className="absolute inset-0 bg-gradient-to-br from-ufc-red/8 via-transparent to-transparent pointer-events-none" />
      )}

      {/* Top accent line for featured */}
      {featured && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ufc-red to-transparent" />
      )}

      <div className="relative p-5 sm:p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
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
          <span className="text-white/30 text-xs flex-shrink-0">
            {event.status === "live" ? (
              <span className="text-ufc-red font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-ufc-red rounded-full animate-pulse inline-block" />
                LIVE
              </span>
            ) : (
              formatShortDate(event.date)
            )}
          </span>
        </div>

        {/* Event name */}
        <h3 className={cn(
          "font-black uppercase tracking-wide mb-1 transition-colors",
          featured ? "text-2xl sm:text-3xl text-white group-hover:text-ufc-red" : "text-xl text-white group-hover:text-white/80"
        )}>
          {event.shortName}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-white/40 text-sm mb-4">
          <MapPin size={12} className="flex-shrink-0" />
          <span className="truncate">{event.location}</span>
        </div>

        {/* Divider */}
        <div className="border-t border-white/5 pt-4">
          {/* Main event */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1.5">
              Main Event
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {event.mainEvent.split(" vs ").map((name, i, arr) => (
              <span key={`${name}-${i}`} className="flex items-center gap-2 sm:gap-3 min-w-0">
                <span className={cn(
                  "font-bold truncate text-sm sm:text-base",
                  featured ? "text-white" : "text-white/80"
                )}>
                  {name.trim()}
                </span>
                {i < arr.length - 1 && (
                  <span className="text-ufc-red font-black text-xs uppercase flex-shrink-0">
                    VS
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className={cn(
          "absolute right-5 bottom-5 transition-all duration-300",
          "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
        )}>
          <div className="w-7 h-7 bg-ufc-red/15 rounded-full flex items-center justify-center">
            <ChevronRight size={14} className="text-ufc-red" />
          </div>
        </div>
      </div>
    </Link>
  );
}
