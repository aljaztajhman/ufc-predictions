"use client";

/**
 * /my-predictions — the user's personal prediction history.
 *
 * Shows every fight the user has ever clicked "Show AI Prediction" on,
 * grouped by event, newest first. Each row shows the AI's pick, confidence,
 * method, when they last viewed it, and a link back to the event page so
 * they can re-read the full breakdown.
 *
 * Auth gating: /api/predictions/history returns 401 for anonymous users.
 * We also client-side redirect to /login if the session is unauthenticated.
 *
 * Data source: GET /api/predictions/history?limit=200 — pulls from
 * user_prediction_views joined to predictions (see lib/predictions.ts).
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Calendar,
  ChevronRight,
  Loader2,
  History as HistoryIcon,
  Eye,
} from "lucide-react";
import type { PredictionResult } from "@/types";
import { formatEventDate, formatShortDate, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

// Matches UserPredictionViewRow from lib/predictions.ts. We duplicate the
// shape here (instead of importing the server type) because this file is a
// client component and importing server code would pull in the Postgres
// driver into the client bundle.
interface HistoryRow {
  userId: string;
  fightId: string;
  fighter1Id: string;
  fighter2Id: string;
  fighter1Name: string | null;
  fighter2Name: string | null;
  weightClass: string | null;
  eventId: string | null;
  eventName: string | null;
  eventDate: string | null;
  isTitleFight: boolean;
  isMainEvent: boolean;
  modelVersion: string;
  firstViewedAt: string;
  lastViewedAt: string;
  viewCount: number;
  prediction: PredictionResult | null;
}

interface HistoryResponse {
  views: HistoryRow[];
}

export default function MyPredictionsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect anonymous users to /login — matches the pattern used on other
  // auth-gated pages. The API would return 401 anyway, but a redirect is a
  // nicer UX than an error page.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/my-predictions");
    }
  }, [status, router]);

  // Fetch history once we know the session is authenticated.
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/predictions/history?limit=200", {
          // Cache: 'no-store' because history should reflect the latest click.
          cache: "no-store",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Request failed: ${res.status}`);
        }
        const data: HistoryResponse = await res.json();
        if (!cancelled) setRows(data.views);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load history");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  // ─── Loading / unauthenticated guard ────────────────────────────────────
  if (status === "loading" || (status === "authenticated" && rows === null && !error)) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-white/40" size={28} />
        </div>
      </main>
    );
  }
  if (status !== "authenticated") {
    // About to redirect; render nothing so there's no flash.
    return null;
  }

  // ─── Error ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Header />
        <div className="mt-8 p-6 bg-red-500/8 border border-red-500/20 rounded-xl">
          <p className="text-red-400 font-semibold">Couldn&apos;t load your history</p>
          <p className="text-red-400/60 text-sm mt-1">{error}</p>
        </div>
      </main>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────────────
  if (!rows || rows.length === 0) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Header />
        <EmptyState />
      </main>
    );
  }

  // ─── Populated: group by event, newest-first ────────────────────────────
  const groups = groupByEvent(rows);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <Header count={rows.length} />

      <div className="mt-8 space-y-10">
        {groups.map((group) => (
          <section key={group.key}>
            <EventHeader
              eventId={group.eventId}
              eventName={group.eventName}
              eventDate={group.eventDate}
              rowCount={group.rows.length}
            />
            <div className="mt-3 grid grid-cols-1 gap-3">
              {group.rows.map((row) => (
                <HistoryCard key={`${row.fightId}-${row.fighter1Id}-${row.fighter2Id}`} row={row} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Header({ count }: { count?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-ufc-red/15 border border-ufc-red/30 flex items-center justify-center">
          <HistoryIcon size={14} className="text-ufc-red" />
        </div>
        <span className="text-ufc-red text-xs uppercase tracking-widest font-semibold">
          My Predictions
        </span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
        Your AI Prediction History
      </h1>
      <p className="text-white/55 text-sm max-w-2xl">
        Every fight you&apos;ve viewed an AI prediction for, grouped by event.
        {typeof count === "number" && count > 0 && (
          <> <span className="text-white/75 font-medium">{count}</span> fight{count === 1 ? "" : "s"} viewed.</>
        )}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 flex flex-col items-center justify-center text-center py-20 px-6 rounded-2xl border border-white/8 bg-white/[0.02]">
      <div className="w-14 h-14 rounded-2xl bg-ufc-red/10 border border-ufc-red/25 flex items-center justify-center mb-4">
        <Sparkles size={22} className="text-ufc-red" />
      </div>
      <h2 className="text-white font-bold text-lg mb-1">
        No predictions viewed yet
      </h2>
      <p className="text-white/55 text-sm max-w-sm">
        Click <span className="text-white/85 font-medium">&ldquo;Show AI Prediction&rdquo;</span> on any
        fight to see Claude&apos;s pick and start building your history.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-[#D20A0A] to-[#FF2525] hover:brightness-110 transition"
      >
        Browse upcoming events
        <ChevronRight size={14} />
      </Link>
    </div>
  );
}

function EventHeader({
  eventId,
  eventName,
  eventDate,
  rowCount,
}: {
  eventId: string | null;
  eventName: string | null;
  eventDate: string | null;
  rowCount: number;
}) {
  const title = eventName ?? "Unknown event";
  const dateLabel = eventDate ? formatEventDate(eventDate) : null;
  const content = (
    <div className="flex items-center justify-between gap-4 group">
      <div className="min-w-0">
        <p className="text-white font-bold text-lg truncate group-hover:text-ufc-red transition-colors">
          {title}
        </p>
        {dateLabel && (
          <p className="text-white/45 text-xs flex items-center gap-1 mt-0.5">
            <Calendar size={11} />
            {dateLabel}
          </p>
        )}
      </div>
      <span className="text-white/50 text-xs font-mono flex-shrink-0">
        {rowCount} fight{rowCount === 1 ? "" : "s"}
      </span>
    </div>
  );

  if (eventId) {
    return (
      <Link href={`/event/${eventId}`} className="block">
        {content}
      </Link>
    );
  }
  return <div>{content}</div>;
}

function HistoryCard({ row }: { row: HistoryRow }) {
  const matchup =
    row.fighter1Name && row.fighter2Name
      ? `${row.fighter1Name} vs ${row.fighter2Name}`
      : "Matchup unavailable";

  const pred = row.prediction;
  const pickName = pred?.winner ?? null;
  const confidence = typeof pred?.confidence === "number" ? Math.round(pred.confidence) : null;

  return (
    <Link
      href={row.eventId ? `/event/${row.eventId}` : "#"}
      className={cn(
        "block rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15 transition-all",
        "p-4 sm:p-5 group",
      )}
    >
      <div className="flex items-center gap-4">
        {/* Confidence block (or placeholder when prediction payload was lost) */}
        <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-ufc-red/8 border border-ufc-red/20 flex flex-col items-center justify-center">
          {confidence !== null ? (
            <>
              <span className="text-ufc-red font-black text-lg leading-none">{confidence}</span>
              <span className="text-ufc-red/70 text-[10px] uppercase tracking-wider mt-0.5">%</span>
            </>
          ) : (
            <Sparkles size={16} className="text-ufc-red/60" />
          )}
        </div>

        {/* Matchup + prediction */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-semibold text-sm sm:text-base truncate">
              {matchup}
            </p>
            {row.isTitleFight && <Badge variant="outline" size="sm">Title</Badge>}
            {row.isMainEvent && !row.isTitleFight && (
              <Badge variant="gray" size="sm">Main</Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            {pickName ? (
              <>
                <span className="text-white/45">AI pick:</span>
                <span className="text-white/85 font-semibold">{pickName}</span>
                {pred?.method && (
                  <span className="text-white/45">&middot; {pred.method}</span>
                )}
                {pred?.rounds && (
                  <span className="text-white/45">&middot; Rd {pred.rounds}</span>
                )}
              </>
            ) : (
              <span className="text-white/40 italic">
                Prediction unavailable (may have been invalidated)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-white/40 pt-0.5">
            {row.weightClass && <span>{row.weightClass}</span>}
            {row.weightClass && <span>&middot;</span>}
            <span>Last viewed {formatShortDate(row.lastViewedAt)}</span>
            {row.viewCount > 1 && (
              <>
                <span>&middot;</span>
                <span className="flex items-center gap-1">
                  <Eye size={10} />
                  {row.viewCount}× viewed
                </span>
              </>
            )}
          </div>
        </div>

        <ChevronRight
          size={16}
          className="flex-shrink-0 text-white/25 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all"
        />
      </div>
    </Link>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

interface EventGroup {
  key: string;
  eventId: string | null;
  eventName: string | null;
  eventDate: string | null;
  rows: HistoryRow[];
}

/**
 * Group rows by event. Rows without an event_id land in an "Other" bucket.
 * Events sorted by the date of their most-recently viewed row (so "what I
 * was just looking at" is at the top), then by event date as a tiebreak.
 */
function groupByEvent(rows: HistoryRow[]): EventGroup[] {
  const byEvent = new Map<string, EventGroup>();

  for (const row of rows) {
    const key = row.eventId ?? "__no_event__";
    let group = byEvent.get(key);
    if (!group) {
      group = {
        key,
        eventId: row.eventId,
        eventName: row.eventName,
        eventDate: row.eventDate,
        rows: [],
      };
      byEvent.set(key, group);
    }
    // If a later row has better metadata (non-null event_name/date), use it.
    if (!group.eventName && row.eventName) group.eventName = row.eventName;
    if (!group.eventDate && row.eventDate) group.eventDate = row.eventDate;
    group.rows.push(row);
  }

  // Sort rows inside each group by last_viewed (newest first).
  for (const group of byEvent.values()) {
    group.rows.sort(
      (a, b) => +new Date(b.lastViewedAt) - +new Date(a.lastViewedAt),
    );
  }

  // Sort groups by the most-recent view inside them.
  return Array.from(byEvent.values()).sort((a, b) => {
    const aMax = Math.max(...a.rows.map((r) => +new Date(r.lastViewedAt)));
    const bMax = Math.max(...b.rows.map((r) => +new Date(r.lastViewedAt)));
    return bMax - aMax;
  });
}
