import { describe, it, expect } from 'vitest';
import { fareObservations, isPubliclyPublishable, getFareRangeSummary } from '@/data/fare-observations';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getTripComFlightHandoffUrl, hasTripComRoute } from '@/lib/booking-providers';
import { getRouteBySlug } from '@/data/routes';
import { generateFareWatcherCandidates } from '@/lib/fare-watcher';

/**
 * Fare Coverage Batch 1 (22 August 2026) — regression coverage for the four
 * newly appended observations (Leeds Bradford-Bodrum's first-ever fare, plus
 * fresh rechecks of Manchester-Karachi, Birmingham-Lahore and
 * Birmingham-Islamabad following the 21 August COV-001 reclassification).
 * Both legs were independently reviewed for every entry here — see
 * FARE_COLLECTION_CHECKLIST.md and the Fare Coverage Batch 1B audit for the
 * full evidence trail. Birmingham-Delhi is deliberately excluded from this
 * batch, held pending a separate connecting-vs-connecting journey
 * presentation decision — see tests below proving it stays untouched.
 */

const nowIso = '2026-08-22';

const APPROVED = [
  { id: 'obs-lba-bjv-economy-20260822-8w-v1', routeSlug: 'leeds-bradford-bodrum', price: 614, source: 'Jet2', directness: 'direct' as const },
  { id: 'obs-man-khi-economy-20260822-8w-v1', routeSlug: 'manchester-karachi', price: 539, source: 'Pegasus', directness: 'connecting' as const },
  { id: 'obs-bhx-lhe-economy-20260822-8w-v1', routeSlug: 'birmingham-lahore', price: 896, source: 'Turkish Airlines', directness: 'connecting' as const },
  { id: 'obs-bhx-isb-economy-20260822-8w-v1', routeSlug: 'birmingham-islamabad', price: 906, source: 'Turkish Airlines', directness: 'connecting' as const },
];

describe('the four approved observations are structurally publishable and both-leg evidenced', () => {
  for (const { id, routeSlug, directness } of APPROVED) {
    it(`${id}: exists, is structurally complete, both legs recorded, publishable`, () => {
      const obs = fareObservations.find((o) => o.id === id);
      expect(obs, id).toBeDefined();
      expect(obs!.routeSlug).toBe(routeSlug);
      expect(obs!.observedDate).toBe('2026-08-22');
      expect(obs!.departureDate).toBeTruthy();
      expect(obs!.returnDate).toBeTruthy();
      expect(obs!.currency).toBe('GBP');
      expect(obs!.cabin).toBe('Economy');
      expect(obs!.fareDirectness).toBe(directness);
      // Both legs independently reviewed — never one inferred from the other.
      expect(obs!.outboundDirectness).toBe(directness);
      expect(obs!.returnDirectness).toBe(directness);
      expect(isPubliclyPublishable(obs!)).toBe(true);
    });
  }

  it('the connecting three record stops and connection airports for both legs (not inferred)', () => {
    for (const id of ['obs-man-khi-economy-20260822-8w-v1', 'obs-bhx-lhe-economy-20260822-8w-v1', 'obs-bhx-isb-economy-20260822-8w-v1']) {
      const obs = fareObservations.find((o) => o.id === id)!;
      expect(obs.outboundStops, id).toBe(1);
      expect(obs.returnStops, id).toBe(1);
      expect(obs.outboundConnectionAirports?.length, id).toBeGreaterThan(0);
      expect(obs.returnConnectionAirports?.length, id).toBeGreaterThan(0);
    }
  });

  it('leeds-bradford-bodrum priceNote does not contain the volatile "often delayed" operational-performance statement', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-lba-bjv-economy-20260822-8w-v1')!;
    expect(obs.priceNote).not.toMatch(/often delayed/i);
    // What it should contain instead: price, itinerary, directness, baggage.
    expect(obs.priceNote).toMatch(/nonstop/i);
    expect(obs.priceNote).toMatch(/baggage not stated/i);
  });

  it('manchester-karachi keeps the source overhead-bin caveat as a factual note, never converted into a checked-baggage claim', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-man-khi-economy-20260822-8w-v1')!;
    expect(obs.priceNote).toMatch(/does not include overhead bin access/i);
    expect(obs.baggage).toBe('not stated');
  });

  it('birmingham-lahore records that a same-price alternative existed at the tie, per the deterministic tie-break rule', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-bhx-lhe-economy-20260822-8w-v1')!;
    expect(obs.priceNote).toMatch(/same-price.*alternative existed/i);
  });
});

describe('all four approved routes now show the correct current Fare Signal', () => {
  for (const { routeSlug, price, source, directness } of APPROVED) {
    it(`${routeSlug}: Fare Signal is current, correct price/airline/directness`, () => {
      const signal = getFareSignalForRoute(routeSlug, nowIso);
      expect(signal.state, routeSlug).toBe('current');
      expect(signal.observation?.price, routeSlug).toBe(price);
      expect(signal.observation?.airline, routeSlug).toBe(source);
      expect(signal.observation?.directness, routeSlug).toBe(directness);

      const range = getFareRangeSummary(routeSlug, 'Economy', nowIso);
      expect(range, routeSlug).not.toBeNull();
      expect(range!.min, routeSlug).toBe(price);
      expect(range!.max, routeSlug).toBe(price);
    });
  }

  it('route directness (verified service) vs fare directness (this specific observation) is truthful for all four — no mismatch introduced', () => {
    for (const { routeSlug, directness } of APPROVED) {
      const route = getRouteBySlug(routeSlug)!;
      const routeDirectness = route.isDirect ? 'direct' : 'connecting';
      expect(routeDirectness, routeSlug).toBe(directness);
    }
  });
});

describe('the four evidence-insufficient 18 August observations remain excluded — not unlocked by this batch', () => {
  const stillExcluded = [
    'obs-man-khi-economy-20260818-8w-v1',
    'obs-bhx-lhe-economy-20260818-8w-v1',
    'obs-bhx-isb-economy-20260818-8w-v1',
    'obs-bhx-del-economy-20260818-8w-v1',
  ];

  it('all four still resolve as not publicly publishable', () => {
    for (const id of stillExcluded) {
      const obs = fareObservations.find((o) => o.id === id);
      expect(obs, id).toBeDefined();
      expect(isPubliclyPublishable(obs!), id).toBe(false);
    }
  });

  it('the legacy manchester-karachi observation (obs-man-khi-economy-1) remains non-publishable — structurally incomplete, unrelated to this batch', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-man-khi-economy-1');
    expect(obs).toBeDefined();
    expect(obs!.departureDate).toBeUndefined();
    expect(obs!.returnDate).toBeUndefined();
    expect(isPubliclyPublishable(obs!)).toBe(false);
  });

  it('all six historical/excluded records are preserved, not deleted or overwritten (append-only)', () => {
    const preserved = [...stillExcluded, 'obs-man-khi-economy-1'];
    for (const id of preserved) {
      expect(fareObservations.some((o) => o.id === id), id).toBe(true);
    }
  });
});

describe('birmingham-delhi remains held — untouched by this batch', () => {
  it('no fresh 22 August observation was appended for birmingham-delhi', () => {
    const has22Aug = fareObservations.some((o) => o.routeSlug === 'birmingham-delhi' && o.observedDate === '2026-08-22');
    expect(has22Aug).toBe(false);
  });

  it('both existing birmingham-delhi observations remain excluded — neither unsuppressed', () => {
    for (const id of ['obs-bhx-del-economy-20260813-8w-v1', 'obs-bhx-del-economy-20260818-8w-v1']) {
      const obs = fareObservations.find((o) => o.id === id)!;
      expect(isPubliclyPublishable(obs), id).toBe(false);
    }
  });

  it('birmingham-delhi Fare Signal stays "none" — no fare renders', () => {
    const signal = getFareSignalForRoute('birmingham-delhi', nowIso);
    expect(signal.state).toBe('none');
    expect(signal.observation).toBeNull();
  });

  it('birmingham-delhi route data is untouched — still verified-connecting via Amritsar, per COV-001', () => {
    const route = getRouteBySlug('birmingham-delhi')!;
    expect(route.isDirect).toBe(false);
    expect(route.verification?.status).toBe('verified');
  });
});

describe('no unresolved verification-blocked route became publishable as a side effect', () => {
  const verificationBlocked = [
    'birmingham-ahmedabad',
    'london-gatwick-ahmedabad',
    'london-heathrow-dhaka',
    'manchester-sylhet',
    'london-heathrow-sylhet',
  ];

  it('all five remain unverified and show no current Fare Signal', () => {
    for (const slug of verificationBlocked) {
      const route = getRouteBySlug(slug)!;
      expect(route.verification?.status, slug).toBe('unverified');
      const signal = getFareSignalForRoute(slug, nowIso);
      expect(signal.state, slug).not.toBe('current');
    }
  });
});

describe('CTA resolution is unchanged by this batch — no Trip.com/affiliate logic touched', () => {
  it('all four approved routes keep their pre-existing safe Trip.com CTA, resolved the same way as before', () => {
    for (const { routeSlug } of APPROVED) {
      expect(hasTripComRoute(routeSlug), routeSlug).toBe(true);
      expect(getTripComFlightHandoffUrl(routeSlug), routeSlug).not.toBeNull();
    }
  });

  it('birmingham-delhi keeps its existing fallback-only CTA state — not a primary map entry, unaffected by this batch', () => {
    expect(hasTripComRoute('birmingham-delhi')).toBe(false);
    const route = getRouteBySlug('birmingham-delhi')!;
    expect(getTripComFlightHandoffUrl('birmingham-delhi', route.airportSlug, route.destinationSlug)).not.toBeNull();
  });

  it('no generic London-origin fallback was introduced for any route in this batch (none of the four approved routes are London-origin)', () => {
    for (const { routeSlug } of APPROVED) {
      expect(routeSlug.startsWith('london-')).toBe(false);
    }
  });
});

describe('no Fare Watcher candidate is created merely because this PR adds an observation', () => {
  it('each of the four routes has only 1 comparable publishable observation — below FARE_WATCHER_MIN_BASELINE (3), so no candidate can form', () => {
    const publishable = fareObservations.filter((o) => isPubliclyPublishable(o));
    for (const { routeSlug } of APPROVED) {
      const comparable = publishable.filter((o) => o.routeSlug === routeSlug && o.cabin === 'Economy');
      expect(comparable.length, routeSlug).toBe(1);
    }
  });

  it('generateFareWatcherCandidates produces no candidate for any of the four routes', () => {
    const candidates = generateFareWatcherCandidates(fareObservations, nowIso);
    for (const { routeSlug } of APPROVED) {
      expect(candidates.some((c) => c.routeSlug === routeSlug), routeSlug).toBe(false);
    }
  });
});
