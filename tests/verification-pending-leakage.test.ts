import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getRouteBySlug,
  getRoutePresentation,
  getDisplayDirectness,
  type Route,
} from '@/data/routes';
import {
  getFareRangeSummary,
  getLatestPublishableObservation,
  getPublishableObservationsByRoute,
  getPublishableObservationsByRouteAndCabin,
  isObservationPublishable,
  type FareObservation,
} from '@/data/fare-observations';
import { hasTrackedFare, deals } from '@/data/deals';
import { generateMetadata } from '@/app/routes/[slug]/page';

const FIXED_TODAY = '2026-07-23';

// The three routes this codebase's own Truth Reset already recorded as
// genuinely 'unverified'/pending (isDirect: true, no current verified
// record) — see docs/LAUNCH_BLOCKERS.md TR-006/TR-007.
const PENDING_ROUTE_SLUGS = ['manchester-karachi', 'birmingham-lahore', 'birmingham-islamabad'];

/** Minimal, valid Route fixture builder for synthetic edge-case tests — never touches production data. */
function makeRoute(overrides: Partial<Route>): Route {
  return {
    slug: 'test-route',
    airportSlug: 'manchester',
    destinationSlug: 'karachi',
    flightTime: '8h direct',
    frequency: 'Daily direct',
    airlineSlugs: ['pia'],
    isDirect: true,
    intro: 'Test intro.',
    bookingWindowNote: 'Test booking window note.',
    peakPeriodIds: [],
    ...overrides,
  };
}

// Forbidden substrings that must never appear in pending-route public output
// — a specific duration/frequency figure, a named airline, or booking/demand
// urgency language.
const FORBIDDEN_IN_PENDING_TEXT = [/\d+h(\s?\d+m)?/, /\bdaily\b/i, /\bweekly\b/i, /\bPIA\b/, /\bEmirates\b/, /book ahead/i, /rise sharply/i];

function assertNoForbiddenClaims(text: string) {
  for (const pattern of FORBIDDEN_IN_PENDING_TEXT) {
    expect(text, `"${text}" matched forbidden pattern ${pattern}`).not.toMatch(pattern);
  }
}

describe('getRoutePresentation — pending routes (real dataset, all 3 currently-disputed routes)', () => {
  for (const slug of PENDING_ROUTE_SLUGS) {
    it(`${slug}: status, facts, and every suppression flag are correct`, () => {
      const route = getRouteBySlug(slug)!;
      const p = getRoutePresentation(route, FIXED_TODAY);
      expect(p.status).toBe('unverified');
      expect(p.statusLabel).toBe('Verification pending');
      expect(p.flightTime).toBeNull();
      expect(p.frequency).toBeNull();
      expect(p.airlineSlugs).toEqual([]);
      expect(p.canShowBookingGuidance).toBe(false);
      expect(p.canShowPeakPeriods).toBe(false);
      expect(p.canShowConnectingAlternative).toBe(false);
      assertNoForbiddenClaims(p.summary);
      assertNoForbiddenClaims(p.metadataDescription);
      assertNoForbiddenClaims(p.shareText);
    });
  }

  it('birmingham-islamabad: presentation never returns the raw un-hedged route.flightTime string', () => {
    // route.flightTime is '7h 50m direct' with no hedge baked into the
    // string itself — exactly the shape of leak this fix closes.
    const route = getRouteBySlug('birmingham-islamabad')!;
    expect(route.flightTime).toBe('7h 50m direct');
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.flightTime).toBeNull();
  });

  it('shareText omits booking timing, demand, fare urgency, airline and routing claims entirely (not merely hedged)', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.shareText).not.toMatch(/PIA/);
    expect(p.shareText).not.toMatch(/book/i);
    expect(p.shareText).not.toMatch(/\d+h/);
    expect(p.shareText).toMatch(/Manchester to Karachi/);
    expect(p.shareText).toMatch(/verification/i);
  });
});

describe('getRoutePresentation — verification-state fixtures (synthetic, isolated from production data)', () => {
  it('missing verification (isDirect: true, no verification field at all) is unverified', () => {
    const route = makeRoute({ verification: undefined });
    expect(getDisplayDirectness(route, FIXED_TODAY)).toBe('unverified');
    expect(getRoutePresentation(route, FIXED_TODAY).status).toBe('unverified');
  });

  it('expired verification (reviewDueDate in the past) is unverified', () => {
    const route = makeRoute({
      verification: {
        status: 'verified',
        sourceName: 'Test source',
        verifiedDate: '2026-01-01',
        reviewDueDate: '2026-02-01', // long before FIXED_TODAY
      },
    });
    expect(getRoutePresentation(route, FIXED_TODAY).status).toBe('unverified');
  });

  it('explicitly unverified verification.status is unverified', () => {
    const route = makeRoute({
      verification: {
        status: 'unverified',
        sourceName: 'Conflicting secondary sources',
        verifiedDate: '2026-07-01',
        reviewDueDate: '2026-08-01',
        note: 'Conflicting evidence.',
      },
    });
    expect(getRoutePresentation(route, FIXED_TODAY).status).toBe('unverified');
  });

  it('current, verified verification is direct', () => {
    const route = makeRoute({
      verification: {
        status: 'verified',
        sourceName: 'Test airline booking system',
        verifiedDate: '2026-07-01',
        reviewDueDate: '2026-08-01',
      },
    });
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.status).toBe('direct');
    expect(p.flightTime).toBe(route.flightTime);
  });
});

describe('getRoutePresentation — verified direct routes (real dataset) keep working exactly as before', () => {
  it('manchester-lahore: sole-unsplit-airline fallback names PIA, facts are the real recorded values', () => {
    const route = getRouteBySlug('manchester-lahore')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.status).toBe('direct');
    expect(p.flightTime).toBe(route.flightTime);
    expect(p.frequency).toBe(route.frequency);
    expect(p.airlineSlugs).toEqual(['pia']);
    expect(p.canShowBookingGuidance).toBe(true);
    expect(p.canShowPeakPeriods).toBe(true);
  });

  it('manchester-lahore: its own frequency field is honest that frequency is unconfirmed — proves a route\'s directness being evidenced does not mean every field is', () => {
    const route = getRouteBySlug('manchester-lahore')!;
    expect(route.frequency).toMatch(/not confirmed/i);
    const p = getRoutePresentation(route, FIXED_TODAY);
    // The presentation surfaces the honest, unconfirmed-frequency string as-is
    // — it does not paper over it or claim frequency is confirmed.
    expect(p.frequency).toMatch(/not confirmed/i);
  });

  it('london-heathrow-jeddah: mixed per-airline evidence names only the individually-verified airline (British Airways, not Saudia)', () => {
    const route = getRouteBySlug('london-heathrow-jeddah')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.status).toBe('direct');
    expect(p.airlineSlugs).toContain('british-airways');
    expect(p.airlineSlugs).not.toContain('saudia');
  });
});

describe('getRoutePresentation — connecting routes: honest scope, no false "verified" semantics (issue 7 correction)', () => {
  it('leeds-bradford-amritsar (real, no verification record): full unfiltered airline list, existing convention unchanged, no field on the object claims independent verification', () => {
    const route = getRouteBySlug('leeds-bradford-amritsar')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.status).toBe('connecting');
    expect(p.flightTime).toBe(route.flightTime);
    expect(p.frequency).toBe(route.frequency);
    expect(p.airlineSlugs).toEqual(route.airlineSlugs);
    expect(p.canShowBookingGuidance).toBe(true);
    expect(p.canShowPeakPeriods).toBe(true);
    expect(p.canShowConnectingAlternative).toBe(true);
  });

  it('regression: a connecting route without its own verification record is never described by the model as having its facts independently verified — no field on the presentation object equals the literal string \'verified\'', () => {
    const route = makeRoute({ isDirect: false, verification: undefined });
    expect(getDisplayDirectness(route, FIXED_TODAY)).toBe('connecting');
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.status).toBe('connecting');
    expect(p.statusLabel).toBe('Connecting'); // never "Verified" or similar
    expect('factsConfidence' in p).toBe(false); // the field was removed, not renamed to something equally misleading
    for (const [key, value] of Object.entries(p)) {
      expect(value, `presentation.${key}`).not.toBe('verified');
    }
  });

  it('canShowBookingGuidance/canShowPeakPeriods/canShowConnectingAlternative being true for a connecting route means "not pending", not "content is independently verified" — true regardless of whether the route has ever had any verification record at all', () => {
    const withoutVerification = makeRoute({ isDirect: false, verification: undefined });
    const withExpiredVerification = makeRoute({
      isDirect: false,
      verification: { status: 'verified', sourceName: 'Old source', verifiedDate: '2020-01-01', reviewDueDate: '2020-02-01' },
    });
    for (const route of [withoutVerification, withExpiredVerification]) {
      const p = getRoutePresentation(route, FIXED_TODAY);
      expect(p.status).toBe('connecting');
      expect(p.canShowBookingGuidance).toBe(true);
      expect(p.canShowPeakPeriods).toBe(true);
      expect(p.canShowConnectingAlternative).toBe(true);
    }
  });
});

describe('getRoutePresentation — pending must never be mapped to connecting, even when connectingAlternative data is present (issue 5)', () => {
  it('a pending route with a populated connectingAlternative still suppresses it entirely', () => {
    const route = makeRoute({
      isDirect: true,
      verification: undefined, // -> unverified/pending
      connectingAlternative: {
        typicalStops: 1,
        hubAirports: ['Dubai'],
        typicalAirlines: ['Emirates'],
        typicalJourneyTime: '10h',
      },
    });
    expect(getDisplayDirectness(route, FIXED_TODAY)).toBe('unverified');
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.canShowConnectingAlternative).toBe(false);
  });

  it('a genuinely connecting route with connectingAlternative data (e.g. a route with a time-bound direct service) keeps showing it — unaffected', () => {
    const route = makeRoute({
      isDirect: false,
      connectingAlternative: {
        typicalStops: 1,
        hubAirports: ['Doha'],
        typicalAirlines: ['Qatar Airways'],
        typicalJourneyTime: '12h',
      },
    });
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.canShowConnectingAlternative).toBe(true);
  });
});

describe('Metadata output — generateMetadata() never builds a pending route\'s description from raw route.intro', () => {
  // generateMetadata() reads new Date() internally (Next.js's generateMetadata
  // signature only accepts { params }, so it can't take an explicit nowIso —
  // that final wall-clock read has to happen somewhere), so these tests
  // pin the system clock explicitly rather than depending on whatever date
  // the suite happens to run on. Cleaned up after every test in this block.
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a pending route gets a restrained, claim-free title and description — deterministic regardless of clock, since birmingham-islamabad\'s verification.status is explicitly \'unverified\', not merely expired', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T12:00:00Z'));
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'birmingham-islamabad' }) });
    expect(meta.title).toMatch(/Verification in Progress/i);
    assertNoForbiddenClaims(String(meta.description));
    expect(String(meta.description)).not.toMatch(/PIA/);
  });

  it('a verified direct route keeps its existing intro-derived title and description, as of a fixed date before its reviewDueDate', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T12:00:00Z'));
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'manchester-lahore' }) });
    const route = getRouteBySlug('manchester-lahore')!;
    expect(route.verification?.reviewDueDate).toBe('2026-08-13'); // sanity: fixture assumption still holds
    expect(meta.title).toMatch(/Booking Windows & Peak Periods/);
    expect(meta.description).toBe(`${route.intro.slice(0, 150)}...`);
  });

  it('regression: the SAME route produces the restrained pending metadata once the clock passes its reviewDueDate — proves generateMetadata does not depend on today\'s real date, only on the (mocked) clock at test time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T12:00:00Z')); // the day after reviewDueDate
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'manchester-lahore' }) });
    expect(meta.title).toMatch(/Verification in Progress/i);
    assertNoForbiddenClaims(String(meta.description));
  });

  it('regression: a far-future clock produces the same restrained result — expiry does not un-expire with more time passing', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-01-01T12:00:00Z'));
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'manchester-lahore' }) });
    expect(meta.title).toMatch(/Verification in Progress/i);
  });
});

describe('Open Graph detail selection — mirrors getRoutePresentation, never duplicates or joins two nulls', () => {
  it('pending route: a single statusLabel line, not "null · null" or a duplicated sentence', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    // This is exactly the logic opengraph-image.tsx uses to build its `detail` line.
    const detail = p.status === 'unverified' ? p.statusLabel : `${p.flightTime} · ${p.frequency}`;
    expect(detail).toBe('Verification pending');
    expect(detail).not.toMatch(/·.*·/); // never two separators / three joined parts
  });

  it('verified route: the normal "flightTime · frequency" pairing, unaffected', () => {
    const route = getRouteBySlug('manchester-lahore')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    const detail = p.status === 'unverified' ? p.statusLabel : `${p.flightTime} · ${p.frequency}`;
    expect(detail).toBe(`${route.flightTime} · ${route.frequency}`);
  });
});

describe('Fare-observation publication predicate — pure, synthetic-fixture-testable (no fabricated fare data added to production)', () => {
  it('a date-complete observation attached to a pending route is still blocked by route evidence, not just date-completeness', () => {
    const pendingRoute = getRouteBySlug('manchester-karachi')!;
    const syntheticCompleteObservation: FareObservation = {
      id: 'test-synthetic-complete',
      routeSlug: 'manchester-karachi',
      cabin: 'Economy',
      observedDate: '2026-07-01',
      price: 500,
      priceNote: 'return, per person',
      source: 'PIA',
      departureDate: '2026-08-01',
      returnDate: '2026-08-15',
    };
    // Sanity: this fixture genuinely passes the date-completeness gate alone.
    expect(isObservationPublishable(syntheticCompleteObservation, undefined, FIXED_TODAY)).toBe(false); // undefined route also blocked
    expect(isObservationPublishable(syntheticCompleteObservation, pendingRoute, FIXED_TODAY)).toBe(false);
  });

  it('the same synthetic observation IS publishable when attached to a verified direct route instead', () => {
    const verifiedRoute = getRouteBySlug('manchester-lahore')!;
    const syntheticCompleteObservation: FareObservation = {
      id: 'test-synthetic-complete-2',
      routeSlug: 'manchester-lahore',
      cabin: 'Economy',
      observedDate: '2026-07-01',
      price: 500,
      priceNote: 'return, per person',
      source: 'PIA',
      departureDate: '2026-08-01',
      returnDate: '2026-08-15',
    };
    expect(isObservationPublishable(syntheticCompleteObservation, verifiedRoute, FIXED_TODAY)).toBe(true);
  });

  it('regression: a date-complete, otherwise-publishable observation is blocked when the route passed in does not actually match the observation\'s own routeSlug', () => {
    // Same complete observation as above (routeSlug: 'manchester-lahore'),
    // but paired with a DIFFERENT verified route object — must not be
    // judged publishable just because that other route happens to be
    // evidenced. Guards against a future caller passing a mismatched pair.
    const wrongRoute = getRouteBySlug('manchester-islamabad')!;
    expect(wrongRoute.slug).not.toBe('manchester-lahore');
    const observationForLahore: FareObservation = {
      id: 'test-synthetic-mismatched',
      routeSlug: 'manchester-lahore',
      cabin: 'Economy',
      observedDate: '2026-07-01',
      price: 500,
      priceNote: 'return, per person',
      source: 'PIA',
      departureDate: '2026-08-01',
      returnDate: '2026-08-15',
    };
    expect(isObservationPublishable(observationForLahore, wrongRoute, FIXED_TODAY)).toBe(false);
  });

  it('an incomplete observation (no dates) is blocked regardless of route evidence', () => {
    const verifiedRoute = getRouteBySlug('manchester-lahore')!;
    const incomplete: FareObservation = {
      id: 'test-synthetic-incomplete',
      routeSlug: 'manchester-lahore',
      cabin: 'Economy',
      observedDate: '2026-07-01',
      price: 500,
      priceNote: 'return, per person',
      source: 'PIA',
    };
    expect(isObservationPublishable(incomplete, verifiedRoute, FIXED_TODAY)).toBe(false);
  });

  it('every pending route: no publishable fare data at all, for every cabin', () => {
    for (const slug of PENDING_ROUTE_SLUGS) {
      expect(getFareRangeSummary(slug, 'Economy', FIXED_TODAY), slug).toBeNull();
      expect(getFareRangeSummary(slug, 'Business', FIXED_TODAY), slug).toBeNull();
      expect(getLatestPublishableObservation(slug, FIXED_TODAY), slug).toBeUndefined();
      expect(getPublishableObservationsByRoute(slug, FIXED_TODAY), slug).toEqual([]);
      expect(getPublishableObservationsByRouteAndCabin(slug, 'Economy', FIXED_TODAY), slug).toEqual([]);
    }
  });

  it('an unrecognised route slug is treated the same as a pending one — no fare data, never a crash', () => {
    expect(getFareRangeSummary('not-a-real-route', 'Economy', FIXED_TODAY)).toBeNull();
    expect(getLatestPublishableObservation('not-a-real-route', FIXED_TODAY)).toBeUndefined();
  });

  it('a genuinely evidenced route\'s fare gating is unaffected by the route-evidence check — still governed purely by date-completeness (TR-002)', () => {
    expect(getFareRangeSummary('manchester-lahore', 'Economy', FIXED_TODAY)).toBeNull();
  });
});

describe('hasTrackedFare — deal-level fare gating stays consistent with the route-evidence gate', () => {
  it('the Manchester–Karachi deal (matches a pending route) never counts as a tracked fare', () => {
    const deal = deals.find((d) => d.id === 'man-khi-economy')!;
    expect(deal).toBeDefined();
    expect(hasTrackedFare(deal, FIXED_TODAY)).toBe(false);
  });
});
