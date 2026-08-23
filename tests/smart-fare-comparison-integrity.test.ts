import { describe, it, expect } from 'vitest';
import { fareObservations, type FareObservation } from '@/data/fare-observations';
import { routes } from '@/data/routes';
import { selectComparableSmartFareOptions, getSmartFareComparisonForRoute } from '@/lib/smart-fare-route-adapter';
import { deriveSmartFareComparison } from '@/lib/smart-fare-comparison';

/**
 * Smart Fare Comparison integrity reset (23 Aug 2026) — founder-approved P0
 * fix, following an independent verification of a Sol Ultra Full Big
 * Review finding. Confirmed defect: getSmartFareComparisonForRoute() had
 * no invariant beyond "current, dated, known directness" — no cabin
 * check, no exact-date check, no passenger/profile check. Real production
 * data: 64 routes rendered a comparison, only manchester-islamabad was
 * genuinely like-for-like; 4 silently compared Economy against Business
 * (e.g. manchester-lahore: "£2,477 more takes 33h 25m longer overall"
 * between a £574 Economy fare, 6-20 Oct, and a £3,051 Business fare,
 * 17-31 Oct, with no cabin disclosed anywhere); 62 silently compared two
 * different travel-date windows.
 *
 * Standing rule this fix enforces: COMPARABLE OR NOT SHOWN. Two
 * observations are only comparable if they share IDENTICAL cabin,
 * departureDate, returnDate, profileId and currency — no fuzzy date
 * matching, no "approximately the same window". See
 * lib/smart-fare-route-adapter.ts's own doc comments for the full
 * reasoning, including why profileId is the correct, currently-available
 * proxy for passenger/trip-type identity (no separate structured field
 * exists on FareObservation today).
 */

const NOW_ISO = '2026-08-23';

function baseObservation(overrides: Partial<FareObservation> = {}): FareObservation {
  return {
    id: 'fixture-a',
    routeSlug: 'fixture-route',
    cabin: 'Economy',
    observedDate: '2026-08-20',
    price: 500,
    priceNote: 'return, per person',
    source: 'Example Airline',
    currency: 'GBP',
    departureDate: '2026-10-01',
    returnDate: '2026-10-15',
    profileId: 'fixture-route-economy-1adult-23kg-v1',
    fareDirectness: 'connecting',
    comparisonEligibility: 'current',
    outboundJourneyMinutes: 600,
    returnJourneyMinutes: 650,
    outboundStops: 1,
    returnStops: 1,
    ...overrides,
  };
}

describe('Negative fixtures — each of these must never produce a comparison', () => {
  it('A. same cabin, different travel dates => no comparison', () => {
    const a = baseObservation({ id: 'a1', departureDate: '2026-10-01', returnDate: '2026-10-15' });
    const b = baseObservation({ id: 'a2', departureDate: '2026-10-08', returnDate: '2026-10-22' });
    expect(selectComparableSmartFareOptions([a, b])).toHaveLength(0);
  });

  it('B. Economy vs Business => no comparison', () => {
    const a = baseObservation({ id: 'b1', cabin: 'Economy', profileId: 'fixture-route-economy-1adult-23kg-v1' });
    const b = baseObservation({ id: 'b2', cabin: 'Business', profileId: 'fixture-route-business-1adult-baseline-v1', price: 3000 });
    expect(selectComparableSmartFareOptions([a, b])).toHaveLength(0);
  });

  it('C. same dates/cabin, different profileId => no comparison', () => {
    const a = baseObservation({ id: 'c1', profileId: 'fixture-route-economy-1adult-23kg-v1' });
    const b = baseObservation({ id: 'c2', profileId: 'fixture-route-economy-1adult-30kg-v1' });
    expect(selectComparableSmartFareOptions([a, b])).toHaveLength(0);
  });

  it('D. different currency => no comparison', () => {
    // FareObservation.currency is typed 'GBP' only, but historic/malformed
    // entries could in principle lack it — the isComparable() gate requires
    // currency to be present at all, so a missing currency alone is enough
    // to exercise this without needing a non-GBP literal the type disallows.
    const a = baseObservation({ id: 'd1', currency: 'GBP' });
    const b = baseObservation({ id: 'd2', currency: undefined });
    expect(selectComparableSmartFareOptions([a, b])).toHaveLength(0);
  });

  it('E. different trip-type/passenger series (via profileId, the only structural proxy available) => no comparison', () => {
    // No separate trip-type or passenger-count field exists on
    // FareObservation — profileId is the one structured field that
    // already encodes it (e.g. "...-1adult-23kg-v1" vs a hypothetical
    // "...-2adults-23kg-v1"), so a profileId difference is the correct way
    // to exercise this case. Deliberately the same assertion shape as C
    // above, kept as its own named case because the founder's spec named
    // trip-type/passenger-series as a distinct invariant to prove.
    const a = baseObservation({ id: 'e1', profileId: 'fixture-route-economy-1adult-23kg-v1' });
    const b = baseObservation({ id: 'e2', profileId: 'fixture-route-economy-2adults-23kg-v1' });
    expect(selectComparableSmartFareOptions([a, b])).toHaveLength(0);
  });

  it('F. insufficient structured journey-time data => the pair renders, but produces no longer/shorter decision sentence', () => {
    // Missing journey-time data doesn't invalidate the comparison itself
    // (both options are otherwise genuinely comparable — real production
    // data confirms this exact shape on birmingham-amritsar and
    // london-heathrow-jeddah today) — it must only suppress the specific
    // claim it can't support. Unknown must never become zero or an
    // inferred duration.
    const a = baseObservation({ id: 'f1', price: 500, outboundJourneyMinutes: undefined, returnJourneyMinutes: undefined, outboundStops: undefined, returnStops: undefined });
    const b = baseObservation({ id: 'f2', price: 550, outboundJourneyMinutes: undefined, returnJourneyMinutes: undefined, outboundStops: undefined, returnStops: undefined });
    const options = selectComparableSmartFareOptions([a, b]);
    expect(options).toHaveLength(2);
    const comparison = deriveSmartFareComparison(options);
    expect(comparison.pairStatements.some((s: { kind: string }) => s.kind === 'price-time')).toBe(false);
    expect(comparison.statements.join(' ')).not.toMatch(/longer|shorter|saves|takes/i);
  });

  it('G. only one member of an otherwise-valid comparison group => no comparison', () => {
    const a = baseObservation({ id: 'g1' });
    expect(selectComparableSmartFareOptions([a])).toHaveLength(0);
  });

  it('H. multiple raw observations where only one exact group has >=2 members => only that group is compared', () => {
    const groupA1 = baseObservation({ id: 'h-a1', departureDate: '2026-10-01', returnDate: '2026-10-15' });
    const groupA2 = baseObservation({ id: 'h-a2', departureDate: '2026-10-01', returnDate: '2026-10-15', price: 520 });
    const groupB1 = baseObservation({ id: 'h-b1', departureDate: '2026-10-08', returnDate: '2026-10-22' }); // lone member, different date group
    const businessOutlier = baseObservation({ id: 'h-biz', cabin: 'Business', profileId: 'fixture-route-business-1adult-baseline-v1', price: 3000 }); // different cabin entirely

    const options = selectComparableSmartFareOptions([groupA1, groupA2, groupB1, businessOutlier]);
    expect(options.map((o) => o.id).sort()).toEqual(['h-a1', 'h-a2'].sort());
  });

  it('an observation missing profileId entirely can never be grouped with anything, even an otherwise-identical sibling', () => {
    const a = baseObservation({ id: 'i1', profileId: undefined });
    const b = baseObservation({ id: 'i2', profileId: undefined });
    // Two observations that both lack profileId must NOT be treated as
    // "probably compatible" just because they match on everything else —
    // isComparable() requires profileId to be present at all.
    expect(selectComparableSmartFareOptions([a, b])).toHaveLength(0);
  });

  it('a historical (non-current) observation is never pulled into a comparison, even if every other field matches', () => {
    const a = baseObservation({ id: 'j1', comparisonEligibility: 'current' });
    const b = baseObservation({ id: 'j2', comparisonEligibility: 'historical' });
    expect(selectComparableSmartFareOptions([a, b])).toHaveLength(0);
  });
});

describe('Positive regression — Manchester-Islamabad (the original, proven-valid pilot)', () => {
  it('remains a valid Smart Fare Comparison with its real production data, unchanged by this fix', () => {
    const comparison = getSmartFareComparisonForRoute('manchester-islamabad', NOW_ISO);
    expect(comparison).not.toBeNull();
    expect(comparison!.options).toHaveLength(3);
    expect(comparison!.options.every((o) => o.cabin === 'Economy')).toBe(true);
    const dates = new Set(comparison!.options.map((o) => `${o.departureDate}_${o.returnDate}`));
    expect(dates.size).toBe(1); // every option shares the exact same dates
    expect(comparison!.statements.join(' ')).toContain('£5 more saves 2h 45m of total journey time.');
  });
});

describe('Network-wide current truth — derived, not hardcoded, so this suite fails loudly if the archive or the invariant drifts', () => {
  it('reports the exact current valid-comparison route set', () => {
    const validRoutes = routes
      .filter((route) => getSmartFareComparisonForRoute(route.slug, NOW_ISO) !== null)
      .map((route) => route.slug)
      .sort();
    // Verified by independent audit (23 Aug 2026) as the true current
    // state: manchester-islamabad (the original pilot) plus two routes
    // that turn out to also have a genuine exact-match pair today
    // (birmingham-amritsar, london-heathrow-jeddah — both checked on
    // consecutive days, 18-19 Aug, landing on the same rolling travel
    // window by coincidence; both currently lack structured journey-time
    // data, so per case F above they render price/baggage facts only,
    // never a longer/shorter claim). This is a stronger, more precise
    // result than the founder's own rough "64 -> 1" prediction, and
    // exactly the outcome the founder's own instruction anticipated:
    // "all other currently-rendering routes: comparison disappears unless
    // the implementation proves they satisfy the exact contract."
    expect(validRoutes).toEqual(['birmingham-amritsar', 'london-heathrow-jeddah', 'manchester-islamabad'].sort());
  });

  it('every currently-valid route\'s options genuinely share identical cabin, dates and profileId', () => {
    for (const route of routes) {
      const comparison = getSmartFareComparisonForRoute(route.slug, NOW_ISO);
      if (!comparison) continue;
      const cabins = new Set(comparison.options.map((o) => o.cabin));
      const dates = new Set(comparison.options.map((o) => `${o.departureDate}_${o.returnDate}`));
      expect(cabins.size, route.slug).toBe(1);
      expect(dates.size, route.slug).toBe(1);
    }
  });
});

describe('Customer-facing regression — Manchester-Lahore can no longer render the confirmed-misleading comparison', () => {
  it('no longer renders a Smart Fare Comparison at all', () => {
    expect(getSmartFareComparisonForRoute('manchester-lahore', NOW_ISO)).toBeNull();
  });

  it('the exact misleading sentence from the live-verified defect is gone, because there is no comparison to produce it', () => {
    const comparison = getSmartFareComparisonForRoute('manchester-lahore', NOW_ISO);
    expect(comparison).toBeNull();
    // Sanity: this isn't gone because the underlying fares changed — both
    // the £574 Economy and £3,051 Business observations are untouched,
    // still logged, still publishable individually elsewhere on the page
    // (Fare Signal, Business Deal card, Fare History) — only this specific
    // cross-cabin, cross-date pairing is no longer constructed.
  });

  it('append-only fare history is completely untouched by this fix — same observation IDs, same prices, still present in the archive', () => {
    const economy = fareObservations.find((o) => o.id === 'obs-man-lhe-economy-20260818-8w-v1');
    const business = fareObservations.find((o) => o.id === 'obs-man-lhe-business-20260822-8w-v1');
    expect(economy?.price).toBe(628);
    expect(business?.price).toBe(3051);
  });
});

describe('Other three previously mixed-cabin routes also stop rendering a comparison', () => {
  it('london-heathrow-doha, manchester-karachi, london-heathrow-lahore all now return null', () => {
    for (const slug of ['london-heathrow-doha', 'manchester-karachi', 'london-heathrow-lahore']) {
      expect(getSmartFareComparisonForRoute(slug, NOW_ISO), slug).toBeNull();
    }
  });
});
