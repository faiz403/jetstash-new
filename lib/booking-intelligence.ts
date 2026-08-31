import { getRouteBySlug, getRouteAirport, getRouteDestination } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getPeakPeriodById } from '@/data/peak-periods';
import { getUpcomingOccurrences, type PeakDatePrecision } from '@/data/peak-period-dates';
import { getBookingWindowsByRoute } from '@/data/booking-windows';
import { getPublishableObservationsByRoute } from '@/data/fare-observations';
import { selectRepresentativeObservation } from '@/lib/fare-signal';

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
 *    (basis 'route-recommendation'). Otherwise the fallback is a single
 *    editorial planning assumption, stated as such — that fares on
 *    peak-period routes often move in the final 3–4 weeks before travel —
 *    so the book-by date is simply the start of that window (basis
 *    'surge-avoidance') and no route-specific optimum is invented.
 *  - Truth Reset (August 2026): this is conservative planning guidance, not
 *    fare prediction. JetStash's own fare archive is not yet large enough to
 *    prove a route-specific price curve, so no surface here claims to
 *    forecast a fare rise for a specific route — see copy functions below
 *    and JETSTASH_PRINCIPLES.md §14 for the standing rule.
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
 * The universal planning-window boundary: the site's editorial assumption
 * that fares on peak-period routes often move within 3–4 weeks of the date —
 * a general travel-demand pattern, not a per-route forecast. This uses the
 * outer (cautious) edge.
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
  /** Inside the final ~4 weeks before the event, when fares often move — planning guidance, not a forecast. */
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
  /** ISO date the site's editorial planning window begins (event start − SURGE_WEEKS). */
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
  /**
   * Kept the field name for a minimal diff (Book-By cabin safety, 23 Aug
   * 2026), but this is no longer literally "the latest observation" — it's
   * the same cabin-safe representative-fare selection the generic Fare
   * Signal uses (selectRepresentativeObservation() in lib/fare-signal.ts):
   * a current Economy observation when one exists, otherwise the latest
   * observation regardless of cabin. See computeBookBySnapshot's own doc
   * comment above where this is built.
   */
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
 * Pure state-machine calculation, extracted from computeBookBySnapshot so
 * the boundary logic can be tested with explicit date fixtures, independent
 * of any route's own verification currency. `nowIso` is the only clock
 * input, matching this whole file's "pure function of (routeSlug, now)"
 * contract — never reads the wall clock itself.
 */
export function computeBookByState(
  nowIso: string,
  occurrenceStartDate: string,
  recommendedWindow: { openDate: string; closeDate: string } | null,
  surgeStartDate: string
): BookByState {
  if (nowIso >= occurrenceStartDate) return 'inside-period';
  if (nowIso >= surgeStartDate) return 'surge';
  if (recommendedWindow) {
    if (nowIso < recommendedWindow.openDate) return 'too-early';
    if (nowIso <= recommendedWindow.closeDate) return 'window-open';
    return 'late';
  }
  return 'pre-surge';
}

/**
 * The full intelligence snapshot for one priority route, or null when the
 * route isn't in the V1 rollout / has no upcoming dated occurrence / isn't
 * currently evidenced as of `now` — every surface renders nothing in that
 * case rather than degrading to a guess.
 *
 * Verification-pending leakage fix (audit finding): the priority-route
 * allowlist alone doesn't mean a route stays safe forever — if a currently-
 * verified priority route's verification record ever expires or is
 * downgraded, every Book-By surface site-wide (route panel, destination
 * strip, homepage ribbon, route-map layer, WhatsApp share text, Founder
 * cadence section — this file's own header comment lists them) would
 * otherwise keep rendering full booking-window guidance for it, bypassing
 * the route page's own canShowBookingGuidance gate entirely, since that
 * gate is only consulted in the page's *fallback* branch. Checking
 * directness here, once, protects every one of those surfaces at the root.
 *
 * Deliberately checked against the SAME `nowIso` used for every other
 * calculation in this function, per this file's own stated contract
 * ("everything is a pure function of (routeSlug, now)") — never the real
 * wall clock. A route whose stored `reviewDueDate` is in the past relative
 * to `now` is correctly treated as unverified as of that `now`; this is
 * deterministic, not a live lookup, so it produces the same result for the
 * same inputs regardless of when the test (or the real deploy) runs.
 *
 * Final audit fix: goes through getEffectiveRoutePresentation() rather than
 * the legacy getDisplayDirectness() directly. None of the current
 * BOOK_BY_PRIORITY_ROUTE_SLUGS are ledger-managed today, but if that ever
 * changes, this must not keep publishing Book-By guidance for a route whose
 * effective status has become 'unverified' (pending reverification) or
 * 'service-ended' merely because the legacy, inclusive gate still reads
 * 'direct'.
 */
export function computeBookBySnapshot(routeSlug: string, now: Date): BookBySnapshot | null {
  if (!isBookByRoute(routeSlug)) return null;
  const route = getRouteBySlug(routeSlug);
  if (!route) return null;
  const airport = getRouteAirport(route);
  const destination = getRouteDestination(route);
  if (!airport || !destination) return null;

  const nowIso = now.toISOString().slice(0, 10);
  const effectiveStatus = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso).status;
  if (effectiveStatus === 'unverified' || effectiveStatus === 'service-ended') return null;

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

  const state = computeBookByState(nowIso, occurrence.startDate, recommendedWindow, surgeStartDate);

  // Book-By cabin safety (23 August 2026, founder-approved): this used to
  // call getLatestPublishableObservation() directly — "whichever
  // observation was checked most recently, any cabin" — a second,
  // independently-drifting policy from the generic Fare Signal's own
  // Economy-preference fix (PR #167, lib/fare-signal.ts). That let
  // Book-By's "Verified check" show a newer Business fare (e.g.
  // manchester-lahore's £3,051) directly beneath booking-timing guidance
  // while the same route's Fare Signal correctly led with a current
  // Economy fare (£628). selectRepresentativeObservation() is the one
  // canonical policy both surfaces now share — see its own doc comment in
  // lib/fare-signal.ts for the full reasoning and the confirmed defect.
  const { observation: representative } = selectRepresentativeObservation(
    getPublishableObservationsByRoute(routeSlug, nowIso),
    nowIso
  );
  const latestObservation = representative
    ? {
        price: representative.price,
        priceNote: representative.priceNote,
        observedDate: representative.observedDate,
        source: representative.source,
        cabin: representative.cabin,
        ageDays: daysBetweenIso(representative.observedDate, nowIso),
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

/**
 * TR-001 regression (Truth Reset, founder correction): the exact
 * visitor-facing label for `bookByDate`, extracted as a pure function so it
 * can be regression-tested without a DOM/rendering harness. A past
 * `bookByDate` must NEVER be labelled "Book by" — that phrasing presents a
 * date as an upcoming instruction, and once `computedForDate` has passed it,
 * the label must switch to a past-tense form instead. Used verbatim by
 * `BookByCountdown`'s legend row.
 */
export function getBookByDateLabel(snapshot: Pick<BookBySnapshot, 'bookByDate' | 'bookByBasis' | 'computedForDate'>): string {
  const hasPassed = snapshot.bookByDate < snapshot.computedForDate;
  if (!hasPassed) return `Book by ${formatBookByDate(snapshot.bookByDate)}`;
  return snapshot.bookByBasis === 'route-recommendation'
    ? `Recommended window closed ${formatBookByDate(snapshot.bookByDate)}`
    : `Typical rise window began ${formatBookByDate(snapshot.bookByDate)}`;
}

/**
 * The top-of-card label — same rule as `getBookByDateLabel`, but prefers
 * "Window opens X" when there's a recommended window that hasn't opened yet
 * (and `bookByDate` itself hasn't passed). Once `bookByDate` has passed,
 * this always defers to the past-tense label — a "Window opens" framing on
 * a date that's already gone would be exactly the same bug this fixes.
 */
export function getBookByTopLabel(
  snapshot: Pick<BookBySnapshot, 'bookByDate' | 'bookByBasis' | 'computedForDate' | 'recommendedWindow'>
): string {
  const hasPassed = snapshot.bookByDate < snapshot.computedForDate;
  if (!hasPassed && snapshot.recommendedWindow) {
    return `Window opens ${formatBookByDate(snapshot.recommendedWindow.openDate)}`;
  }
  return getBookByDateLabel(snapshot);
}

/** "expected 10 March 2027" vs "8 November 2026" vs "around 20 July 2026" — precision stays visible. */
function formatPrecisionDate(iso: string, precision: PeakDatePrecision): string {
  const date = formatBookByDate(iso);
  if (precision === 'estimated-lunar') return `expected ${date}`;
  if (precision === 'approximate-seasonal') return `around ${date}`;
  return date;
}

/** "expected 10 March 2027" vs "8 November 2026" vs "around 20 July 2026" — precision stays visible. */
export function formatEventDate(event: BookByEvent): string {
  return formatPrecisionDate(event.startDate, event.precision);
}

/**
 * Same as formatEventDate, but includes the occurrence's end date for a
 * ranged period (e.g. a school-holiday season, wedding season, Ramadan) —
 * "around 20 July 2026 to around 1 September 2026" rather than just the
 * start. Falls back to formatEventDate unchanged for a single-day
 * occurrence (no endDate).
 *
 * Stale-advice fix (31 Aug 2026, User 3 real-user validation): every
 * surface that names an event previously showed only its start date, which
 * reads as stale once well inside a multi-week ranged period — nothing on
 * the page otherwise showed when the period actually ends. Used wherever an
 * event is displayed to a visitor, in place of formatEventDate.
 */
export function formatEventDateRange(event: BookByEvent): string {
  const start = formatEventDate(event);
  if (!event.endDate) return start;
  return `${start} to ${formatPrecisionDate(event.endDate, event.precision)}`;
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
      return `Flying for ${event}? The recommended window (by ${bookBy}) has passed — book as soon as you can, before fares often move further in the final weeks.`;
    case 'pre-surge':
      return `Flying for ${event}? Aim to book before ${bookBy} — on peak-period routes like this, fares often start moving in the final 3–4 weeks.`;
    case 'surge':
      return `${event} is close. Fares on peak-period routes often move in these final weeks — if you still need to travel, book as soon as possible.`;
    case 'inside-period':
      // Stale-advice fix (31 Aug 2026, User 3 validation): a ranged
      // occurrence (school-holiday season, wedding season, Ramadan, etc.)
      // stays 'inside-period' for its whole span — sometimes six weeks or
      // more — and the old wording below ("is underway... book as soon as
      // possible... most expensive time to buy") was written for a
      // single-day event. Near the tail of a long range it's genuinely
      // unsupported advice: there's no "as soon as possible" window left to
      // act on, and JetStash has no evidence the remaining days are still
      // the most expensive time to buy. Per the founder's semantic rule
      // (not an arbitrary day-count cutoff): once ranged (endDate present),
      // state the period as current context only — no imperative urgency,
      // no invented replacement recommendation — and show the real end date
      // so the date shown is never stale-looking on its own. A single-day
      // event (no endDate) keeps the original wording unchanged; the
      // occurrence disappears entirely once its own endDate passes (see
      // getUpcomingOccurrences in data/peak-period-dates.ts) — that
      // fail-closed behaviour is untouched by this fix.
      //
      // Deliberately generic, not "${event} is/are underway": periodLabel
      // is a data string ("UK summer holidays", "Wedding season", "Ramadan")
      // with no stored grammatical number, so a name-specific sentence can't
      // agree its verb correctly for every label without a pluralisation
      // system this fix isn't building. The named event/range stays visible
      // immediately next to this headline (the eyebrow line and "Why this
      // advice?" disclosure both show it via formatEventDateRange), so
      // context isn't lost by leaving the name out of this one sentence.
      return s.event.endDate
        ? `Peak travel period underway until ${formatPrecisionDate(s.event.endDate, s.event.precision)}.`
        : `${event} is underway. If you still need to travel, book as soon as possible — this is typically the most expensive time to buy.`;
  }
}

/**
 * WhatsApp share text — the advice itself, built to be genuinely useful in a
 * family group chat. Absolute dates only (no day counts), so text generated
 * at build time can never go stale mid-conversation.
 */
export function buildBookByShareText(s: BookBySnapshot): string {
  const lines = [
    `Flying ${s.airportCity} to ${s.destinationCity} for ${s.event.periodLabel} (${formatEventDateRange(s.event)})?`,
    s.recommendedWindow
      ? `JetStash's guidance: book by ${formatBookByDate(s.bookByDate)} — fares on this route often move in the final weeks before ${s.event.periodLabel}. Planning guidance, not a fare prediction.`
      : `JetStash's guidance: aim to book before ${formatBookByDate(s.bookByDate)} — fares on peak-period routes often move in the final 3–4 weeks. Planning guidance, not a fare prediction.`,
  ];
  return lines.join('\n');
}
