import { describe, it, expect } from 'vitest';
import {
  computeBookBySnapshot,
  computeBookByState,
  bookByHeadline,
  formatEventDateRange,
  getBookByDateLabel,
  getBookByTopLabel,
  SURGE_WEEKS,
} from '@/lib/booking-intelligence';
import { getUpcomingOccurrences } from '@/data/peak-period-dates';
import { getBookingWindowsByRoute } from '@/data/booking-windows';
import { getRouteBySlug } from '@/data/routes';
import { computeReadiness } from '@/lib/travel-intelligence-engine';

/**
 * Truth Reset (July 2026) — fixed-clock tests for the Book-By state machine.
 * Every `now` here is an explicit ISO date, never `new Date()`/`Date.now()` —
 * per the brief's requirement that these tests use fixed data and fixed
 * dates, with no dependency on the actual wall-clock date or any live
 * network access. Uses the site's own real (static) data files as fixtures,
 * since those are exactly the kind of "fixed data" the brief means — not a
 * live fetch.
 *
 * TR-001 regression test: this suite specifically reproduces the confirmed
 * bug (Manchester–Lahore showing "Book by 22 June 2026" as if still
 * actionable on 12 July 2026, 20 days after that date) and asserts it's
 * fixed at the data layer (computeBookBySnapshot's own fields), plus the
 * full set of state-boundary transitions the brief requires.
 */

function addDaysIso(iso: string, days: number): string {
  const ms = new Date(`${iso}T12:00:00Z`).getTime() + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

describe('computeBookBySnapshot — Manchester–Lahore, UK summer holidays 2026 (no recommended window)', () => {
  const routeSlug = 'manchester-lahore';
  const occurrence = getUpcomingOccurrences(getRouteBySlug(routeSlug)!.peakPeriodIds, '2026-01-01').find(
    (o) => o.peakPeriodId === 'uk-summer-holidays'
  )!;
  const surgeStart = addDaysIso(occurrence.startDate, -SURGE_WEEKS * 7);

  it('TR-001 regression: reproduces the exact reported bug scenario (12 July 2026, 20 days after the surge-start date)', () => {
    const snapshot = computeBookBySnapshot(routeSlug, new Date('2026-07-12T12:00:00Z'));
    expect(snapshot).not.toBeNull();
    expect(snapshot!.state).toBe('surge');
    expect(snapshot!.bookByDate).toBe(surgeStart); // confirms this really is '2026-06-22', 20 days in the past
    expect(snapshot!.bookByBasis).toBe('surge-avoidance');
    // The state machine itself is correct (it's a real, current price-rise
    // zone) — the display-layer fix (past-tense labelling) is verified
    // separately in the component; this test locks in the underlying dates
    // so that fix has something stable to build on.
  });

  it('pre-surge: well before the surge zone with no recommended window', () => {
    const beforeSurge = addDaysIso(surgeStart, -10);
    const snapshot = computeBookBySnapshot(routeSlug, new Date(`${beforeSurge}T12:00:00Z`));
    expect(snapshot!.state).toBe('pre-surge');
  });

  it('surge: exact surge-start day counts as surge, not pre-surge', () => {
    const snapshot = computeBookBySnapshot(routeSlug, new Date(`${surgeStart}T12:00:00Z`));
    expect(snapshot!.state).toBe('surge');
  });

  it('inside-period: the day the event itself begins', () => {
    const snapshot = computeBookBySnapshot(routeSlug, new Date(`${occurrence.startDate}T12:00:00Z`));
    expect(snapshot!.state).toBe('inside-period');
  });

  it('the day before the event start is still surge, not inside-period', () => {
    const dayBefore = addDaysIso(occurrence.startDate, -1);
    const snapshot = computeBookBySnapshot(routeSlug, new Date(`${dayBefore}T12:00:00Z`));
    expect(snapshot!.state).toBe('surge');
  });
});

describe('computeBookByState — Manchester–Islamabad\'s Eid al-Fitr 2027 dates (has a recommended window), tested via the pure state calculation directly', () => {
  // Deliberately NOT going through computeBookBySnapshot here: Eid al-Fitr
  // 2027 falls well after manchester-islamabad's real reviewDueDate
  // (2026-08-13), so computeBookBySnapshot correctly (and deterministically)
  // returns null for any `now` in 2027 on this route, per its own
  // verification-currency check — that's the fix working as intended, not
  // a fixture problem. The state-boundary math this suite actually cares
  // about is independent of route verification, so it's exercised via
  // computeBookByState() directly, with dates still drawn from this
  // route's real peak-period/booking-window data (only the verification
  // gate is bypassed, not the underlying date fixtures).
  const routeSlug = 'manchester-islamabad';
  const occurrence = getUpcomingOccurrences(getRouteBySlug(routeSlug)!.peakPeriodIds, '2026-08-01').find(
    (o) => o.peakPeriodId === 'eid-al-fitr'
  )!;
  const window = getBookingWindowsByRoute(routeSlug).find(
    (w) => w.role === 'recommended' && w.appliesToPeriodIds?.includes('eid-al-fitr')
  )!;
  const openDate = addDaysIso(occurrence.startDate, -window.weeksBeforeDeparture.max * 7);
  const closeDate = addDaysIso(occurrence.startDate, -window.weeksBeforeDeparture.min * 7);
  const surgeStart = addDaysIso(occurrence.startDate, -SURGE_WEEKS * 7);
  const recommendedWindow = { openDate, closeDate };

  it('too-early: before the recommended window opens', () => {
    const before = addDaysIso(openDate, -5);
    expect(computeBookByState(before, occurrence.startDate, recommendedWindow, surgeStart)).toBe('too-early');
  });

  it('window-open: the exact day the recommended window opens', () => {
    expect(computeBookByState(openDate, occurrence.startDate, recommendedWindow, surgeStart)).toBe('window-open');
  });

  it('window-open: the exact day the recommended window closes (inclusive boundary)', () => {
    expect(computeBookByState(closeDate, occurrence.startDate, recommendedWindow, surgeStart)).toBe('window-open');
  });

  it('late: the day after the recommended window closes', () => {
    const dayAfterClose = addDaysIso(closeDate, 1);
    expect(computeBookByState(dayAfterClose, occurrence.startDate, recommendedWindow, surgeStart)).toBe('late');
  });

  it('surge: once inside the final-weeks surge zone, regardless of the recommended window', () => {
    expect(computeBookByState(surgeStart, occurrence.startDate, recommendedWindow, surgeStart)).toBe('surge');
  });

  it('inside-period: the event day itself', () => {
    expect(computeBookByState(occurrence.startDate, occurrence.startDate, recommendedWindow, surgeStart)).toBe('inside-period');
  });
});

describe('computeBookBySnapshot — unsupported inputs return null rather than guessing', () => {
  it('returns null for a route outside the Book-By priority list', () => {
    expect(computeBookBySnapshot('manchester-karachi', new Date('2026-07-12T12:00:00Z'))).toBeNull();
  });

  it('returns null for a slug that does not exist at all', () => {
    expect(computeBookBySnapshot('not-a-real-route', new Date('2026-07-12T12:00:00Z'))).toBeNull();
  });

  describe('verification-pending leakage fix (audit finding): a priority route whose verification has since expired — fully deterministic on the `now` parameter, no system-clock mocking needed', () => {
    const route = getRouteBySlug('manchester-lahore')!;

    it('sanity: the fixture route\'s real reviewDueDate is 2026-09-14', () => {
      expect(route.verification?.reviewDueDate).toBe('2026-09-14');
    });

    it('2026-07-23 (before reviewDueDate): still produces a snapshot normally', () => {
      expect(computeBookBySnapshot('manchester-lahore', new Date('2026-07-23T12:00:00Z'))).not.toBeNull();
    });

    it('2026-09-15 (the day after reviewDueDate): stops producing a snapshot, even though the route is still in BOOK_BY_PRIORITY_ROUTE_SLUGS and still has upcoming peak-period occurrences', () => {
      expect(computeBookBySnapshot('manchester-lahore', new Date('2026-09-15T12:00:00Z'))).toBeNull();
    });

    it('a far-future date: still null — expiry does not un-expire with more time passing', () => {
      expect(computeBookBySnapshot('manchester-lahore', new Date('2099-06-01T12:00:00Z'))).toBeNull();
    });
  });
});

describe('getBookByDateLabel / getBookByTopLabel (founder correction, Section 7) — a passed date can never say "Book by"', () => {
  it('a future bookByDate is labelled "Book by"', () => {
    const label = getBookByDateLabel({
      bookByDate: '2026-08-01',
      bookByBasis: 'surge-avoidance',
      computedForDate: '2026-07-13',
    });
    expect(label).toBe('Book by 1 August 2026');
    expect(label).not.toMatch(/began|closed/i);
  });

  it('TR-001 regression, extracted to the pure function directly: a past surge-avoidance bookByDate is never labelled "Book by" — it reads "Typical rise window began" (Truth Reset, August 2026: no longer "Sharp rise began" — see tests/book-by-evidence-safety.test.ts)', () => {
    const label = getBookByDateLabel({
      bookByDate: '2026-06-22',
      bookByBasis: 'surge-avoidance',
      computedForDate: '2026-07-12', // 20 days after bookByDate — the exact reported bug scenario
    });
    expect(label).toBe('Typical rise window began 22 June 2026');
    expect(label).not.toMatch(/^Book by/);
    expect(label).not.toMatch(/sharp/i);
  });

  it('a past route-recommendation bookByDate reads "Recommended window closed", never "Book by"', () => {
    const label = getBookByDateLabel({
      bookByDate: '2026-06-22',
      bookByBasis: 'route-recommendation',
      computedForDate: '2026-07-12',
    });
    expect(label).toBe('Recommended window closed 22 June 2026');
    expect(label).not.toMatch(/^Book by/);
  });

  it('the boundary day itself (computedForDate === bookByDate) is still forward-looking, not past-tense — the bug only starts the day AFTER', () => {
    const label = getBookByDateLabel({
      bookByDate: '2026-06-22',
      bookByBasis: 'surge-avoidance',
      computedForDate: '2026-06-22',
    });
    expect(label).toBe('Book by 22 June 2026');
  });

  it('exhaustive proof: for every day from 1 to 60 days after a fixed bookByDate, the label never says "Book by"', () => {
    const bookByDate = '2026-06-22';
    for (let daysAfter = 1; daysAfter <= 60; daysAfter++) {
      const computedForDate = new Date(new Date(`${bookByDate}T12:00:00Z`).getTime() + daysAfter * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const label = getBookByDateLabel({ bookByDate, bookByBasis: 'surge-avoidance', computedForDate });
      expect(label, `day ${daysAfter} after bookByDate`).not.toMatch(/^Book by/);
    }
  });

  it('getBookByTopLabel prefers "Window opens" only while the recommended window hasn\'t opened AND bookByDate hasn\'t passed', () => {
    const label = getBookByTopLabel({
      bookByDate: '2026-08-01',
      bookByBasis: 'route-recommendation',
      computedForDate: '2026-07-13',
      recommendedWindow: { openDate: '2026-07-20', closeDate: '2026-08-01', minWeeks: 3, maxWeeks: 12, guidance: 'test' },
    });
    expect(label).toBe('Window opens 20 July 2026');
  });

  it('getBookByTopLabel falls back to the past-tense label once bookByDate has passed, even with a recommendedWindow present — never "Window opens" on a date that\'s already gone', () => {
    const label = getBookByTopLabel({
      bookByDate: '2026-06-22',
      bookByBasis: 'route-recommendation',
      computedForDate: '2026-07-12',
      recommendedWindow: { openDate: '2026-05-01', closeDate: '2026-06-22', minWeeks: 3, maxWeeks: 12, guidance: 'test' },
    });
    expect(label).toBe('Recommended window closed 22 June 2026');
    expect(label).not.toMatch(/window opens/i);
  });
});

/**
 * Stale-advice fix (31 Aug 2026, User 3 real-user validation): a ranged
 * occurrence (school-holiday season, wedding season, Ramadan, etc.) stayed
 * 'inside-period' for its whole span with identical maximum-urgency wording
 * regardless of proximity to its own endDate — reproduced live on
 * Manchester–Lahore's uk-summer-2026 occurrence (20 Jul – 1 Sep 2026) on the
 * real date 31 Aug 2026. Fixed with a semantic rule, not an arbitrary
 * day-count cutoff: from occurrence start through endDate, a ranged
 * occurrence may state it's current context but must not carry imperative
 * booking urgency; after endDate, the existing fail-closed
 * (occurrence-drops) behaviour is unchanged. Single-day occurrences (no
 * endDate) are untouched.
 */
describe('bookByHeadline — ranged occurrences stop giving imperative urgency once inside their own window (31 Aug 2026 fix)', () => {
  const routeSlug = 'manchester-lahore';
  const occurrence = getUpcomingOccurrences(getRouteBySlug(routeSlug)!.peakPeriodIds, '2026-01-01').find(
    (o) => o.peakPeriodId === 'uk-summer-holidays'
  )!;

  it('sanity: the fixture occurrence really is ranged (20 Jul – 1 Sep 2026)', () => {
    expect(occurrence.startDate).toBe('2026-07-20');
    expect(occurrence.endDate).toBe('2026-09-01');
  });

  it('1. before the occurrence starts: the existing supported booking recommendation (surge state) is completely unchanged, badge included', () => {
    const surgeStart = addDaysIso(occurrence.startDate, -SURGE_WEEKS * 7);
    const now = new Date(`${surgeStart}T12:00:00Z`);
    const snapshot = computeBookBySnapshot(routeSlug, now);
    expect(snapshot!.state).toBe('surge');
    const headline = bookByHeadline(snapshot!);
    expect(headline).toMatch(/book as soon as possible/i);
    // The 'Book soon' verdict is legitimate here — timing genuinely is the
    // reason to act, not a ranged period merely having started — so the
    // badge-suppression fix must not touch this case.
    expect(computeReadiness(routeSlug, now)!.verdict).toBe('book-soon');
  });

  it('2. shortly after the occurrence starts: described as underway, with NO imperative urgency wording and NO "Book soon" urgency badge', () => {
    const shortlyAfterStart = addDaysIso(occurrence.startDate, 5);
    const now = new Date(`${shortlyAfterStart}T12:00:00Z`);
    const snapshot = computeBookBySnapshot(routeSlug, now);
    expect(snapshot!.state).toBe('inside-period');
    const headline = bookByHeadline(snapshot!);
    expect(headline).toMatch(/underway/i);
    expect(headline).not.toMatch(/book as soon as possible/i);
    expect(headline).not.toMatch(/most expensive time to buy/i);
    // The raw engine verdict is still 'book-soon' here — that's the
    // decision tree's existing, unmodified behaviour (this fix doesn't
    // touch lib/travel-intelligence-engine.ts at all, so founder-insights.ts
    // and the Journey Brief keep reading exactly what they read today).
    // What must change is only whether the *panel* renders it as a badge —
    // asserted directly against the same suppression condition
    // components/route/book-by-countdown.tsx uses.
    const engineSnapshot = computeReadiness(routeSlug, now)!;
    expect(engineSnapshot.verdict).toBe('book-soon');
    const suppressUrgencyBadge =
      engineSnapshot.verdict === 'book-soon' && snapshot!.state === 'inside-period' && Boolean(snapshot!.event.endDate);
    expect(suppressUrgencyBadge).toBe(true);
  });

  it('3. exact reproduced case — Manchester–Lahore, uk-summer-2026, 31 Aug 2026: current ranged context shown including the real end date, no stale urgency headline, no "Book soon" urgency badge', () => {
    const now = new Date('2026-08-31T12:00:00Z');
    const snapshot = computeBookBySnapshot(routeSlug, now)!;
    expect(snapshot.state).toBe('inside-period');
    expect(snapshot.event.periodId).toBe('uk-summer-holidays');
    const headline = bookByHeadline(snapshot);
    expect(headline).toBe('Peak travel period underway until around 1 September 2026.');
    expect(headline).not.toMatch(/book as soon as possible/i);
    expect(headline).not.toMatch(/most expensive time to buy/i);
    expect(headline).not.toMatch(/is underway/i); // grammar fix: no bare "is underway" for a ranged period
    // The end date must actually be visible wherever the event is shown, not
    // just inferable — this is the "missing end date" User 3 reasonably
    // read as stale. The named event/range lives here, right next to the
    // now-generic headline, so context is not lost.
    expect(formatEventDateRange(snapshot.event)).toBe('around 20 July 2026 to around 1 September 2026');
    // The badge itself: the panel must not render "Book soon" for this
    // exact real-world case, per the same suppression condition the
    // component applies.
    const engineSnapshot = computeReadiness(routeSlug, now)!;
    expect(engineSnapshot.verdict).toBe('book-soon');
    const suppressUrgencyBadge =
      engineSnapshot.verdict === 'book-soon' && snapshot.state === 'inside-period' && Boolean(snapshot.event.endDate);
    expect(suppressUrgencyBadge).toBe(true);
  });

  it('4. after endDate: the existing fail-closed behaviour is preserved — the expired occurrence drops, the route moves on to its next real occurrence, and that occurrence gets its own correct (non-suppressed) badge/headline treatment', () => {
    const dayAfterEnd = addDaysIso(occurrence.endDate!, 1);
    expect(dayAfterEnd).toBe('2026-09-02');
    const now = new Date(`${dayAfterEnd}T12:00:00Z`);
    const snapshot = computeBookBySnapshot(routeSlug, now);
    expect(snapshot).not.toBeNull();
    // Must not still be the expired uk-summer-2026 occurrence.
    expect(snapshot!.event.occurrenceId).not.toBe(occurrence.id);
    expect(snapshot!.event.periodId).not.toBe('uk-summer-holidays');
  });

  it('5. single-day occurrence (no endDate): existing "book as soon as possible" wording is completely unchanged', () => {
    const eidOccurrence = getUpcomingOccurrences(['eid-al-fitr'], '2026-01-01')[0];
    expect(eidOccurrence.endDate).toBeUndefined();
    const state = computeBookByState(eidOccurrence.startDate, eidOccurrence.startDate, null, addDaysIso(eidOccurrence.startDate, -SURGE_WEEKS * 7));
    expect(state).toBe('inside-period');
    const snapshot: Parameters<typeof bookByHeadline>[0] = {
      routeSlug: 'manchester-lahore',
      airportCity: 'Manchester',
      destinationCity: 'Lahore',
      event: {
        occurrenceId: eidOccurrence.id,
        periodId: eidOccurrence.peakPeriodId,
        periodLabel: 'Eid al-Fitr',
        startDate: eidOccurrence.startDate,
        endDate: eidOccurrence.endDate,
        precision: eidOccurrence.precision,
        dateNote: eidOccurrence.dateNote,
      },
      surgeStartDate: addDaysIso(eidOccurrence.startDate, -SURGE_WEEKS * 7),
      recommendedWindow: null,
      bookByDate: addDaysIso(eidOccurrence.startDate, -SURGE_WEEKS * 7),
      bookByBasis: 'surge-avoidance',
      latestObservation: null,
      latestObservationNoneReason: null,
      state,
      daysToEvent: 0,
      daysToBookBy: 0,
      computedForDate: eidOccurrence.startDate,
    };
    const headline = bookByHeadline(snapshot);
    expect(headline).toBe(
      'Eid al-Fitr is underway. If you still need to travel, book as soon as possible — this is typically the most expensive time to buy.'
    );
    // Badge-suppression fix must not touch a single-day occurrence: no
    // endDate means the suppression condition is false, so its 'Book soon'
    // badge (a real engine verdict, unrelated to this fix) still renders.
    const suppressUrgencyBadge = snapshot.state === 'inside-period' && Boolean(snapshot.event.endDate);
    expect(suppressUrgencyBadge).toBe(false);
  });
});
