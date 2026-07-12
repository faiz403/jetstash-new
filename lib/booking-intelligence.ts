import { getRouteBySlug, getRouteAirport, getRouteDestination } from '@/data/routes';
import { getPeakPeriodById } from '@/data/peak-periods';
import { getUpcomingOccurrences, type PeakDatePrecision } from '@/data/peak-period-dates';
import { getBookingWindowsByRoute } from '@/data/booking-windows';
import { getLatestObservation } from '@/data/fare-observations';

/**
 * Book-By Countdown — the single derivation layer for every booking-
 * intelligence surface (route panel, destination strip, homepage ribbon,
 * route-map layer, WhatsApp share text, Founder cadence section). Nothing
 * outside this file computes a booking state or a book-by date; see
 * JETSTASH_PRINCIPLES.md §14 for the feature's standing rules.
 *
 * Honesty model, in code:
 *  - Every date comes from data/peak-period-dates.ts (verified) or
 *    data/booking-windows.ts (restructured from each route's own stated
 *    prose) — nothing is predicted.
 *  - Two advice tiers. Where a route has a stated 'recommended' window that
 *    applies to the upcoming event, the book-by date comes from it
 *    (basis 'route-recommendation'). Otherwise the only claim made is the
 *    one peak-periods.ts already states site-wide — fares rise sharply in
 *    the final 3–4 weeks — so the book-by date is simply the start of that
 *    surge zone (basis 'surge-avoidance') and no route-specific optimum is
 *    invented.
 *  - Everything is a pure function of (routeSlug, now). Pages compute a
 *    build-time snapshot for static HTML/SEO; client components recompute
 *    with the visitor's real clock after mount, so a page built weeks ago
 *    still shows the correct state.
 */

/** The approved V1 rollout — the only routes any Book-By surface renders for. */
export const BOOK_BY_PRIORITY_ROUTE_SLUGS: readonly string[] = [
  'manchester-lahore',
  'manchester-islamabad',
  'london-heathrow-delhi',
  'london-heathrow-jeddah',
  'birmingham-amritsar',
];

/**
 * The universal surge boundary: peak-periods.ts states fares "rise sharply
 * within 3–4 weeks" of a peak period — this uses the outer (cautious) edge.
 */
export const SURGE_WEEKS = 4;

export type BookByState =
  /** Before the route's recommended window opens. */
  | 'too-early'
  /** Inside the route's stated recommended booking window. */
  | 'window-open'
  /** Past the recommended window but before the surge zone. */
  | 'late'
  /** No route-specific recommendation exists; before the surge zone. */
  | 'pre-surge'
  /** Inside the final ~4 weeks before the event, where fares typically rise sharply. */
  | 'surge'
  /** The event/period has started (and, for ranges, not yet ended). */
  | 'inside-period';

export interface BookByEvent {
  occurrenceId: string;
  periodId: string;
  periodLabel: string;
  /** ISO date the event/period begins — the travel-demand anchor. */
  startDate: string;
  endDate?: string;
  precision: PeakDatePrecision;
  dateNote: string;
}

export interface BookBySnapshot {
  routeSlug: string;
  airportCity: string;
  destinationCity: string;
  event: BookByEvent;
  /** ISO date the typical sharp-rise zone begins (event start − SURGE_WEEKS). */
  surgeStartDate: string;
  /** Present only when the route has a stated recommended window applying to this event. */
  recommendedWindow: {
    openDate: string;
    closeDate: string;
    minWeeks: number;
    maxWeeks: number;
    guidance: string;
  } | null;
  /** The one date the panel leads with. */
  bookByDate: string;
  bookByBasis: 'route-recommendation' | 'surge-avoidance';
  latestObservation: {
    price: number;
    priceNote: string;
    observedDate: string;
    source: string;
    cabin: string;
    /** Age in days at snapshot time — callers add the caveat past OBSERVATION_FRESH_DAYS. */
    ageDays: number;
  } | null;
  state: BookByState;
  daysToEvent: number;
  daysToBookBy: number;
  /** ISO date this snapshot was computed for — client recomputes make it current. */
  computedForDate: string;
}

const DAY_MS = 86_400_000;

/** Date-only maths at UTC noon, immune to timezone/DST edges. */
function toUtcNoon(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getTime();
}

function addDaysIso(iso: string, days: number): string {
  return new Date(toUtcNoon(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetweenIso(fromIso: string, toIso: string): number {
  return Math.round((toUtcNoon(toIso) - toUtcNoon(fromIso)) / DAY_MS);
}

export function isBookByRoute(routeSlug: string): boolean {
  return BOOK_BY_PRIORITY_ROUTE_SLUGS.includes(routeSlug);
}

/**
 * The full intelligence snapshot for one priority route, or null when the
 * route isn't in the V1 rollout / has no upcoming dated occurrence — every
 * surface renders nothing in that case rather than degrading to a guess.
 */
export function computeBookBySnapshot(routeSlug: string, now: Date): BookBySnapshot | null {
  if (!isBookByRoute(routeSlug)) return null;
  const route = getRouteBySlug(routeSlug);
  if (!route) return null;
  const airport = getRouteAirport(route);
  const destination = getRouteDestination(route);
  if (!airport || !destination) return null;

  const nowIso = now.toISOString().slice(0, 10);
  const upcoming = getUpcomingOccurrences(route.peakPeriodIds, nowIso);
  if (upcoming.length === 0) return null;

  const occurrence = upcoming[0];
  const period = getPeakPeriodById(occurrence.peakPeriodId);
  if (!period) return null;

  const surgeStartDate = addDaysIso(occurrence.startDate, -SURGE_WEEKS * 7);

  const recommended = getBookingWindowsByRoute(routeSlug).find(
    (w) =>
      w.role === 'recommended' &&
      (!w.appliesToPeriodIds || w.appliesToPeriodIds.includes(occurrence.peakPeriodId))
  );
  const recommendedWindow = recommended
    ? {
        openDate: addDaysIso(occurrence.startDate, -recommended.weeksBeforeDeparture.max * 7),
        closeDate: addDaysIso(occurrence.startDate, -recommended.weeksBeforeDeparture.min * 7),
        minWeeks: recommended.weeksBeforeDeparture.min,
        maxWeeks: recommended.weeksBeforeDeparture.max,
        guidance: recommended.guidance,
      }
    : null;

  const bookByDate = recommendedWindow ? recommendedWindow.closeDate : surgeStartDate;
  const bookByBasis: BookBySnapshot['bookByBasis'] = recommendedWindow
    ? 'route-recommendation'
    : 'surge-avoidance';

  let state: BookByState;
  if (nowIso >= occurrence.startDate) {
    state = 'inside-period';
  } else if (nowIso >= surgeStartDate) {
    state = 'surge';
  } else if (recommendedWindow) {
    if (nowIso < recommendedWindow.openDate) state = 'too-early';
    else if (nowIso <= recommendedWindow.closeDate) state = 'window-open';
    else state = 'late';
  } else {
    state = 'pre-surge';
  }

  const latest = getLatestObservation(routeSlug);
  const latestObservation = latest
    ? {
        price: latest.price,
        priceNote: latest.priceNote,
        observedDate: latest.observedDate,
        source: latest.source,
        cabin: latest.cabin,
        ageDays: daysBetweenIso(latest.observedDate, nowIso),
      }
    : null;

  return {
    routeSlug,
    airportCity: airport.city,
    destinationCity: destination.city,
    event: {
      occurrenceId: occurrence.id,
      periodId: occurrence.peakPeriodId,
      periodLabel: period.label,
      startDate: occurrence.startDate,
      endDate: occurrence.endDate,
      precision: occurrence.precision,
      dateNote: occurrence.dateNote,
    },
    surgeStartDate,
    recommendedWindow,
    bookByDate,
    bookByBasis,
    latestObservation,
    state,
    daysToEvent: daysBetweenIso(nowIso, occurrence.startDate),
    daysToBookBy: daysBetweenIso(nowIso, bookByDate),
    computedForDate: nowIso,
  };
}

/** Snapshots for every priority route serving a destination (destination strips). */
export function computeBookBySnapshotsForDestination(destinationSlug: string, now: Date): BookBySnapshot[] {
  return BOOK_BY_PRIORITY_ROUTE_SLUGS.map((slug) => getRouteBySlug(slug))
    .filter((r): r is NonNullable<typeof r> => Boolean(r && r.destinationSlug === destinationSlug))
    .map((r) => computeBookBySnapshot(r.slug, now))
    .filter((s): s is BookBySnapshot => s !== null);
}

/** Snapshots for every priority route, soonest event first (homepage ribbon, founder cadence). */
export function computeAllBookBySnapshots(now: Date): BookBySnapshot[] {
  return BOOK_BY_PRIORITY_ROUTE_SLUGS.map((slug) => computeBookBySnapshot(slug, now))
    .filter((s): s is BookBySnapshot => s !== null)
    .sort((a, b) => a.event.startDate.localeCompare(b.event.startDate));
}

/** en-GB long date — the one date format every Book-By surface uses. */
export function formatBookByDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "expected 10 March 2027" vs "8 November 2026" vs "around 20 July 2026" — precision stays visible. */
export function formatEventDate(event: BookByEvent): string {
  const date = formatBookByDate(event.startDate);
  if (event.precision === 'estimated-lunar') return `expected ${date}`;
  if (event.precision === 'approximate-seasonal') return `around ${date}`;
  return date;
}

/**
 * The advice sentence every surface leads with — one recommendation, plain
 * English, state-aware, no urgency theatre. Kept here so the panel, strip
 * and share text can never phrase the same state differently.
 */
export function bookByHeadline(s: BookBySnapshot): string {
  const event = s.event.periodLabel;
  const bookBy = formatBookByDate(s.bookByDate);
  switch (s.state) {
    case 'too-early':
      return `Flying for ${event}? The recommended booking window opens ${formatBookByDate(s.recommendedWindow!.openDate)} — watching this route now costs nothing.`;
    case 'window-open':
      return `Flying for ${event}? The recommended booking window is open now — book by ${bookBy}.`;
    case 'late':
      return `Flying for ${event}? The recommended window (by ${bookBy}) has passed — book as soon as you can, before the final-weeks rise.`;
    case 'pre-surge':
      return `Flying for ${event}? Aim to book before ${bookBy} — fares on peak-period routes typically rise sharply in the final 3–4 weeks.`;
    case 'surge':
      return `${event} is close. Fares typically rise sharply in these final weeks — if you still need to travel, book as soon as possible.`;
    case 'inside-period':
      return `${event} is underway. If you still need to travel, book as soon as possible — this is typically the most expensive time to buy.`;
  }
}

/**
 * WhatsApp share text — the advice itself, built to be genuinely useful in a
 * family group chat. Absolute dates only (no day counts), so text generated
 * at build time can never go stale mid-conversation.
 */
export function buildBookByShareText(s: BookBySnapshot): string {
  const lines = [
    `Flying ${s.airportCity} to ${s.destinationCity} for ${s.event.periodLabel} (${formatEventDate(s.event)})?`,
    s.recommendedWindow
      ? `JetStash's guidance: book by ${formatBookByDate(s.bookByDate)} — fares on this route typically jump in the final weeks before ${s.event.periodLabel}.`
      : `JetStash's guidance: aim to book before ${formatBookByDate(s.bookByDate)} — fares typically rise sharply in the final 3–4 weeks.`,
  ];
  return lines.join('\n');
}
