import Link from 'next/link';
import { ArrowUpRight, CalendarClock } from 'lucide-react';
import { formatEventDate, type BookBySnapshot } from '@/lib/booking-intelligence';

/**
 * Compact booking-intelligence strip for destination pages — one line per
 * priority route serving this destination: the next travel moment, whether
 * its booking window is currently open, and a link into the full Book-By
 * panel on the route page. Deliberately absolute-dated and server-rendered
 * (no countdown, no client JS): everything it states stays true whenever
 * it's read. The route page's panel is the live surface.
 */
export function BookingMomentStrip({ snapshots }: { snapshots: BookBySnapshot[] }) {
  if (snapshots.length === 0) return null;

  return (
    <div className="rounded-md border border-brass/30 bg-brass-50 p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <CalendarClock className="h-4.5 w-4.5 text-brass-700" strokeWidth={2} />
        <span className="text-xs font-semibold uppercase tracking-wide text-brass-700">Booking intelligence</span>
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        {snapshots.map((s) => (
          <div key={s.routeSlug} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-700">
              <span className="font-semibold text-ink-900">
                {s.airportCity} → {s.destinationCity}:
              </span>{' '}
              next big travel moment is {s.event.periodLabel}, {formatEventDate(s.event)}
              {s.state === 'window-open' && ' — the recommended booking window is open now'}
              {(s.state === 'surge' || s.state === 'late') && ' — fares typically rise sharply from here'}
              .
            </p>
            <Link
              href={`/routes/${s.routeSlug}`}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ink-900 transition-colors hover:text-brass-700"
            >
              When to book
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
