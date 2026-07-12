'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, BellRing, CalendarClock } from 'lucide-react';
import {
  computeBookBySnapshot,
  bookByHeadline,
  formatBookByDate,
  formatEventDate,
  OBSERVATION_FRESH_DAYS,
  type BookBySnapshot,
} from '@/lib/booking-intelligence';
import { computeReadiness, VERDICT_COPY, type EngineSnapshot, type TravelReadySignal } from '@/lib/travel-intelligence-engine';
import { getRouteBySlug, getRouteAirport, getRouteDestination } from '@/data/routes';
import { getRouteBookingUrl, getPrimaryBookingProvider } from '@/lib/booking-providers';

/**
 * The Book-By Countdown panel — the route page's "when to book" intelligence
 * surface (JETSTASH_PRINCIPLES.md §14). Renders only for the V1 priority
 * routes; every date and state comes from lib/booking-intelligence.ts.
 *
 * This is also the customer-facing surface for the Travel Intelligence
 * Engine's readiness verdict (§14.2) — the small badge in the header row is
 * the engine's one-line answer to "Am I ready to book?", composed from this
 * panel's own booking-window state plus any active route warning. The
 * badge is additive to the existing, already-tested timeline/CTA logic
 * below it, never a replacement — the CTA still reasons purely from
 * booking-window state, since a warning changes what to be aware of, not
 * whether checking a live price is the right action.
 *
 * Rendering model: the server page computes `initialSnapshot` at build time,
 * so the static HTML carries the full advice for SEO and no-JS visitors
 * (absolute dates only — always true regardless of when they're read).
 * After mount the snapshot is recomputed against the visitor's clock, which
 * activates the now-dependent parts: day counts, the "today" marker, and
 * the state-dependent CTA emphasis.
 */

const DAY_MS = 86_400_000;
function t(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getTime();
}

const VERDICT_BADGE_STYLES: Record<EngineSnapshot['verdict'], string> = {
  'wait-critical': 'border-terracotta-300 bg-terracotta-50 text-terracotta-700',
  'not-yet': 'border-ink-200 bg-ink-50 text-ink-600',
  'book-soon': 'border-brass/40 bg-brass-50 text-brass-700',
  ready: 'border-brass/40 bg-brass-50 text-brass-700',
  'ready-with-caution': 'border-brass/40 bg-brass-50 text-brass-700',
};

export function BookByCountdown({
  initialSnapshot,
  initialEngineSnapshot,
  travelReadySignal = null,
}: {
  initialSnapshot: BookBySnapshot;
  initialEngineSnapshot: EngineSnapshot | null;
  /**
   * Supplied by components/route/route-readiness-panel.tsx once a visitor
   * completes a Travel Ready Check for this route (JETSTASH_PRINCIPLES.md
   * §14.3) — re-derives the verdict badge above without a server round trip.
   */
  travelReadySignal?: TravelReadySignal | null;
}) {
  const [snapshot, setSnapshot] = useState<BookBySnapshot | null>(initialSnapshot);
  const [engineSnapshot, setEngineSnapshot] = useState<EngineSnapshot | null>(initialEngineSnapshot);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const now = new Date();
    setSnapshot(computeBookBySnapshot(initialSnapshot.routeSlug, now));
    setEngineSnapshot(computeReadiness(initialSnapshot.routeSlug, now, travelReadySignal));
    setMounted(true);
  }, [initialSnapshot.routeSlug, travelReadySignal]);

  if (!snapshot) return null;

  const route = getRouteBySlug(snapshot.routeSlug);
  const airport = route ? getRouteAirport(route) : undefined;
  const destination = route ? getRouteDestination(route) : undefined;
  if (!route || !airport || !destination) return null;

  const provider = getPrimaryBookingProvider();
  const bookingUrl = getRouteBookingUrl(airport, destination, undefined, `bookby-${snapshot.state}`);

  // ── Timeline geometry ──────────────────────────────────────────────────
  // Span: from the recommended window's opening (or 8 weeks before the
  // surge, when no recommendation exists) to the event itself.
  const spanStart = snapshot.recommendedWindow
    ? t(snapshot.recommendedWindow.openDate)
    : t(snapshot.surgeStartDate) - 8 * 7 * DAY_MS;
  const spanEnd = t(snapshot.event.startDate);
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - spanStart) / (spanEnd - spanStart)) * 100));
  const surgePct = pct(t(snapshot.surgeStartDate));
  const windowOpenPct = snapshot.recommendedWindow ? pct(t(snapshot.recommendedWindow.openDate)) : null;
  const windowClosePct = snapshot.recommendedWindow ? pct(t(snapshot.recommendedWindow.closeDate)) : null;
  const bookByPct = pct(t(snapshot.bookByDate));
  const todayPct = mounted ? pct(t(snapshot.computedForDate)) : null;

  // ── CTA arrangement by state ───────────────────────────────────────────
  const watchPrimary = snapshot.state === 'too-early';
  const bookLabel =
    snapshot.state === 'window-open'
      ? 'Good time to book — check live price'
      : snapshot.state === 'surge' || snapshot.state === 'late' || snapshot.state === 'inside-period'
        ? 'Check live price now'
        : 'Check live price';
  const brassBook = snapshot.state !== 'too-early' && snapshot.state !== 'pre-surge';

  const observation = snapshot.latestObservation;
  const observationIsOld = observation ? observation.ageDays > OBSERVATION_FRESH_DAYS : false;

  const verdict = engineSnapshot?.verdict;
  const warningReasons =
    engineSnapshot?.reasons.filter((r) => r.source === 'route-warning' || r.source === 'travel-ready-check') ?? [];

  return (
    <section aria-label={`When to book ${airport.city} to ${destination.city}`} className="rounded-md border border-ink-100 bg-white p-6 shadow-card sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <CalendarClock className="h-4.5 w-4.5 text-terracotta-600" strokeWidth={2} />
          <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">
            When to book · {snapshot.event.periodLabel} {formatEventDate(snapshot.event)}
          </span>
        </div>
        {verdict && (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${VERDICT_BADGE_STYLES[verdict]}`}
          >
            {VERDICT_COPY[verdict].label}
          </span>
        )}
      </div>

      <h2 className="mt-3 max-w-2xl font-display text-2xl leading-snug text-ink-900 sm:text-[1.7rem]">
        {bookByHeadline(snapshot)}
      </h2>

      {warningReasons.length > 0 && (
        <p className="mt-2 text-sm text-terracotta-700">
          {warningReasons.length === 1 ? warningReasons[0].label : `${warningReasons.length} active notes on this route`} — see below before you book.
        </p>
      )}

      {mounted && snapshot.daysToEvent > 0 && (
        <p className="mt-2 text-sm text-ink-500">
          {snapshot.event.periodLabel} is {snapshot.daysToEvent} days away
          {snapshot.daysToBookBy > 0 ? ` — ${snapshot.daysToBookBy} days until the book-by date.` : '.'}
        </p>
      )}

      {/* ── Timeline (decorative; every fact it draws is stated in text) ── */}
      <div className="mt-6" aria-hidden="true">
        <div className="relative h-2.5 w-full rounded-full bg-ink-50">
          {windowOpenPct !== null && windowClosePct !== null && (
            <div
              className="absolute inset-y-0 rounded-full bg-brass-200"
              style={{ left: `${windowOpenPct}%`, width: `${Math.max(2, windowClosePct - windowOpenPct)}%` }}
            />
          )}
          <div
            className="absolute inset-y-0 rounded-r-full bg-terracotta-200"
            style={{ left: `${surgePct}%`, width: `${100 - surgePct}%` }}
          />
          {/* book-by marker */}
          <div className="absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-ink-900" style={{ left: `${bookByPct}%` }} />
          {/* today marker — only once the visitor's real clock is known */}
          {todayPct !== null && (
            <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${todayPct}%` }}>
              <span className="block h-4 w-4 rounded-full border-2 border-white bg-brass shadow-card" />
            </div>
          )}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-ink-400">
          <span>
            {snapshot.recommendedWindow
              ? `Window opens ${formatBookByDate(snapshot.recommendedWindow.openDate)}`
              : `Book by ${formatBookByDate(snapshot.bookByDate)}`}
          </span>
          <span className="text-terracotta-600">Typical sharp rise from {formatBookByDate(snapshot.surgeStartDate)}</span>
          <span>{snapshot.event.periodLabel}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-400">
          {snapshot.recommendedWindow && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded-full bg-brass-200" /> Recommended window
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-full bg-terracotta-200" /> Fares typically rising
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-[3px] rounded-full bg-ink-900" /> Book by {formatBookByDate(snapshot.bookByDate)}
          </span>
          {mounted && todayPct !== null && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-brass shadow-card" /> Today
            </span>
          )}
        </div>
      </div>

      {/* ── Latest verified fare context / honest degradation ─────────────── */}
      <p className="mt-5 text-sm text-ink-600">
        {observation ? (
          <>
            Last checked fare: <span className="font-semibold text-ink-900">£{observation.price.toLocaleString('en-GB')}</span>{' '}
            {observation.priceNote} ({observation.source}, {observation.cabin}) — checked {formatBookByDate(observation.observedDate)}.
            {observationIsOld && ' An older check, shown for context only — not an indication of today’s price.'}
          </>
        ) : (
          'No fare checks logged for this route yet — the guidance above is calendar-based, from this route’s stated booking pattern.'
        )}
      </p>

      {/* ── State-dependent CTAs ──────────────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {watchPrimary ? (
          <>
            <a
              href="#route-watch"
              data-analytics="bookby-watch"
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-6 text-sm font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985]"
            >
              <BellRing className="h-4 w-4" strokeWidth={2.25} />
              Watch this route
            </a>
            <a
              href={bookingUrl}
              target="_blank"
              rel={provider.rel}
              data-analytics={`bookby-cta-${snapshot.state}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 underline decoration-ink-300 underline-offset-4 transition-colors hover:text-brass-600 hover:decoration-brass-600"
            >
              Check live price anyway
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </a>
          </>
        ) : (
          <>
            <a
              href={bookingUrl}
              target="_blank"
              rel={provider.rel}
              data-analytics={`bookby-cta-${snapshot.state}`}
              className={
                brassBook
                  ? 'inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-brass px-6 text-sm font-semibold text-ink-900 transition-all hover:bg-brass-400 hover:shadow-brass-glow active:scale-[0.985]'
                  : 'inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-6 text-sm font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985]'
              }
            >
              {bookLabel}
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </a>
            <a
              href="#route-watch"
              data-analytics="bookby-watch"
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-sm border border-ink-200 px-5 text-sm font-semibold text-ink-900 transition-colors hover:bg-ink-50 active:scale-[0.985]"
            >
              <BellRing className="h-4 w-4" strokeWidth={2} />
              Watch this route
            </a>
          </>
        )}
      </div>
      <p className="mt-2.5 text-xs text-ink-400">
        Partner link, opens {provider.name} in a new tab. Booking there never costs you more.
      </p>

      {/* ── Why this advice? ──────────────────────────────────────────────── */}
      <details className="group mt-5 rounded-sm border border-ink-100 bg-sand-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink-700 transition-colors hover:text-ink-900">
          Why this advice?
        </summary>
        <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-ink-600">
          <li>
            <span className="font-medium text-ink-900">{snapshot.event.periodLabel}, {formatEventDate(snapshot.event)}.</span>{' '}
            {snapshot.event.dateNote}
          </li>
          {snapshot.recommendedWindow ? (
            <li>
              <span className="font-medium text-ink-900">
                This route&apos;s stated booking guidance: {snapshot.recommendedWindow.minWeeks}–{snapshot.recommendedWindow.maxWeeks} weeks before travel.
              </span>{' '}
              {snapshot.recommendedWindow.guidance}
            </li>
          ) : (
            <li>
              <span className="font-medium text-ink-900">No route-specific week-by-week guidance is logged for this event yet.</span>{' '}
              The book-by date above is simply the start of the typical late rise — not a claimed optimum.
            </li>
          )}
          <li>
            Fares on routes like this typically rise sharply within 3–4 weeks of a peak period — that&apos;s the shaded zone on the timeline, and the pattern this site documents per route rather than predicts.
          </li>
          {observation && (
            <li>
              The fare shown was checked by a person on {formatBookByDate(observation.observedDate)} — a dated observation, never a live price.
            </li>
          )}
        </ul>
      </details>

      <p className="mt-4 text-xs text-ink-400">
        Guidance, not a guarantee — based on this route&apos;s documented patterns and verified dates, not price prediction. Fares can move differently in any given year.
      </p>
    </section>
  );
}
