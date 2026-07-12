import Link from 'next/link';
import { ArrowUpRight, CalendarClock } from 'lucide-react';
import { formatEventDate, type BookBySnapshot } from '@/lib/booking-intelligence';

/**
 * Homepage "next travel moment" ribbon — the first, restrained statement of
 * JetStash's repositioned value proposition ("TravelUp shows a price,
 * JetStash shows whether to act on it" — JETSTASH_PRINCIPLES.md §14). Leads
 * with the single soonest event across the priority routes and which of
 * those routes currently have an open booking window, then one link into
 * the feature. Server-rendered, absolute dates only — no client JS, no
 * countdown ticking, matching the homepage's existing "no invented
 * urgency" trust strip immediately below it.
 */
export function NextTravelMomentRibbon({ snapshots }: { snapshots: BookBySnapshot[] }) {
  if (snapshots.length === 0) return null;

  const soonest = snapshots[0];
  const openNow = snapshots.filter((s) => s.state === 'window-open');

  return (
    <section className="border-b border-white/5 bg-ink-950 py-8 sm:py-10">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <div className="flex flex-col gap-4 rounded-md border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brass/40 text-brass-300">
              <CalendarClock className="h-4.5 w-4.5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brass-300">Next travel moment</p>
              <p className="mt-1.5 font-display text-lg leading-snug text-sand-50 sm:text-xl">
                {soonest.event.periodLabel} — {formatEventDate(soonest.event)}
              </p>
              <p className="mt-1 text-sm text-ink-300">
                {openNow.length > 0
                  ? `Booking windows are open now on ${openNow.length} of our ${snapshots.length} tracked ${snapshots.length === 1 ? 'route' : 'routes'}.`
                  : `Track when to book, not just what it costs today, across ${snapshots.length} UK routes.`}
              </p>
            </div>
          </div>
          <Link
            href={`/routes/${soonest.routeSlug}`}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-sm bg-brass px-5 py-3 text-sm font-semibold text-ink-900 transition-all hover:bg-brass-400 hover:shadow-brass-glow active:scale-[0.985]"
          >
            See when to book
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
          </Link>
        </div>
      </div>
    </section>
  );
}
