import { describe, it, expect } from 'vitest';
import { computeBookBySnapshot, getBookByDateLabel, getBookByTopLabel, SURGE_WEEKS } from '@/lib/booking-intelligence';
import { getUpcomingOccurrences } from '@/data/peak-period-dates';
import { getBookingWindowsByRoute } from '@/data/booking-windows';
import { getRouteBySlug } from '@/data/routes';

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

describe('computeBookBySnapshot — Manchester–Islamabad, Eid al-Fitr 2027 (has a recommended window)', () => {
  // manchester-islamabad's peakPeriodIds are eid-al-fitr/eid-al-adha/uk-summer-holidays
  // only (no wedding-season) — unlike manchester-lahore, this means Eid al-Fitr 2027
  // is genuinely the *soonest* occurrence throughout its whole run-up window, so
  // computeBookBySnapshot's own "soonest upcoming occurrence" pick matches what this
  // test expects. (manchester-lahore also has wedding-season 2026-27, which falls
  // chronologically between "now" and Eid al-Fitr 2027 during the run-up period this
  // suite needs to test, so it would be picked instead — a test-fixture-selection
  // detail, not a production bug.)
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

  it('too-early: before the recommended window opens', () => {
    const before = addDaysIso(openDate, -5);
    const snapshot = computeBookBySnapshot(routeSlug, new Date(`${before}T12:00:00Z`));
    expect(snapshot!.state).toBe('too-early');
  });

  it('window-open: the exact day the recommended window opens', () => {
    const snapshot = computeBookBySnapshot(routeSlug, new Date(`${openDate}T12:00:00Z`));
    expect(snapshot!.state).toBe('window-open');
  });

  it('window-open: the exact day the recommended window closes (inclusive boundary)', () => {
    const snapshot = computeBookBySnapshot(routeSlug, new Date(`${closeDate}T12:00:00Z`));
    expect(snapshot!.state).toBe('window-open');
  });

  it('late: the day after the recommended window closes', () => {
    const dayAfterClose = addDaysIso(closeDate, 1);
    const snapshot = computeBookBySnapshot(routeSlug, new Date(`${dayAfterClose}T12:00:00Z`));
    expect(snapshot!.state).toBe('late');
    expect(snapshot!.bookByDate).toBe(closeDate);
    expect(snapshot!.bookByBasis).toBe('route-recommendation');
  });

  it('surge: once inside the final-weeks surge zone, regardless of the recommended window', () => {
    const snapshot = computeBookBySnapshot(routeSlug, new Date(`${surgeStart}T12:00:00Z`));
    expect(snapshot!.state).toBe('surge');
  });

  it('inside-period: the event day itself', () => {
    const snapshot = computeBookBySnapshot(routeSlug, new Date(`${occurrence.startDate}T12:00:00Z`));
    expect(snapshot!.state).toBe('inside-period');
  });
});

describe('computeBookBySnapshot — unsupported inputs return null rather than guessing', () => {
  it('returns null for a route outside the Book-By priority list', () => {
    expect(computeBookBySnapshot('manchester-karachi', new Date('2026-07-12T12:00:00Z'))).toBeNull();
  });

  it('returns null for a slug that does not exist at all', () => {
    expect(computeBookBySnapshot('not-a-real-route', new Date('2026-07-12T12:00:00Z'))).toBeNull();
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

  it('TR-001 regression, extracted to the pure function directly: a past surge-avoidance bookByDate is never labelled "Book by" — it reads "Sharp rise began"', () => {
    const label = getBookByDateLabel({
      bookByDate: '2026-06-22',
      bookByBasis: 'surge-avoidance',
      computedForDate: '2026-07-12', // 20 days after bookByDate — the exact reported bug scenario
    });
    expect(label).toBe('Sharp rise began 22 June 2026');
    expect(label).not.toMatch(/^Book by/);
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
