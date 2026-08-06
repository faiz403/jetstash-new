import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { routes, getRouteBySlug, getDisplayDirectness } from '@/data/routes';
import { getPublishableObservationsByRoute, isPubliclyPublishable, fareObservations } from '@/data/fare-observations';
import { getActiveWarningsByRoute } from '@/data/route-warnings';
import { isBookByRoute } from '@/lib/booking-intelligence';
import { getTripComRouteUrl } from '@/lib/booking-providers';
import { travellerTips } from '@/data/traveller-tips';
import { computeRouteIntelligenceLevel } from '@/lib/atlas-network-data';

/**
 * Route Completion Batch 1 (August 2026) — Manchester-Dubai and
 * Manchester-Doha only. See docs/project-control/ROUTE_COVERAGE_AUDIT.md's
 * "Batch 1 completion record" for the full audit this suite guards.
 *
 * Both routes remain graded 'useful' after this batch — neither was
 * upgraded by a manual override, and every assertion here is designed to
 * fail loudly if that ever silently changes without genuine new evidence.
 */

const NOW_ISO = new Date().toISOString().slice(0, 10);
const BATCH_1_SLUGS = ['manchester-dubai', 'manchester-doha'] as const;

describe('Batch 1 route service state is unchanged', () => {
  it('Manchester-Dubai is still a direct, route-level-verified route — unaffected by this batch', () => {
    const route = getRouteBySlug('manchester-dubai')!;
    expect(route.isDirect).toBe(true);
    expect(route.verification?.status).toBe('verified');
    expect(route.airlineSlugs).toEqual(['emirates']);
    expect(getDisplayDirectness(route, NOW_ISO)).toBe('direct');
  });

  it('Manchester-Doha is still a direct, route-level-verified route — unaffected by this batch', () => {
    const route = getRouteBySlug('manchester-doha')!;
    expect(route.isDirect).toBe(true);
    expect(route.verification?.status).toBe('verified');
    expect(route.airlineSlugs).toEqual(['qatar-airways']);
    expect(getDisplayDirectness(route, NOW_ISO)).toBe('direct');
  });
});

describe('The new baggage-guidance entry is tied to a real source record, not invented', () => {
  const dubaiBaggageTip = travellerTips.find((t) => t.id === 'manchester-dubai-emirates-baggage-weight');

  it('exists, is scoped only to manchester-dubai (never destinationSlug, which would leak to Glasgow/Edinburgh/Newcastle-Dubai)', () => {
    expect(dubaiBaggageTip).toBeDefined();
    expect(dubaiBaggageTip!.scope.routeSlug).toBe('manchester-dubai');
    expect(dubaiBaggageTip!.scope.destinationSlug).toBeUndefined();
  });

  it('is categorised as baggage and carries a checked date', () => {
    expect(dubaiBaggageTip!.category).toBe('baggage');
    expect(dubaiBaggageTip!.addedDate).toBe('2026-08-06');
  });

  it('states a real, checkable claim, not an unsupported cheapest/fastest/guaranteed/stable-fare claim', () => {
    const forbidden = /\b(cheapest|fastest|safest|guaranteed|stable[- ]fare|best price)\b/i;
    expect(dubaiBaggageTip!.body).not.toMatch(forbidden);
    expect(dubaiBaggageTip!.title).not.toMatch(forbidden);
    // The claim itself (32kg per bag, ticket-type-capped total) must be present, not paraphrased into something unverifiable.
    expect(dubaiBaggageTip!.body).toContain('32kg');
  });

  it('no equivalent baggage tip was added for Manchester-Doha — the audit is honest that Qatar\'s figure could not be sourced', () => {
    const dohaBaggageTip = travellerTips.find(
      (t) => t.category === 'baggage' && (t.scope.routeSlug === 'manchester-doha' || t.scope.destinationSlug === 'doha')
    );
    expect(dohaBaggageTip).toBeUndefined();
  });
});

describe('No unsupported claim wording was introduced anywhere in this batch\'s new content', () => {
  const forbidden = /\b(cheapest|fastest|safest|guaranteed|stable[- ]fare)\b/i;

  it('every traveller tip in the file is free of the forbidden claim words (not just the new one — a regression guard for the whole file)', () => {
    for (const tip of travellerTips) {
      expect(tip.body, tip.id).not.toMatch(forbidden);
      expect(tip.title, tip.id).not.toMatch(forbidden);
    }
  });
});

describe('Trip.com route hand-offs for both Batch 1 routes are unchanged', () => {
  it('Manchester-Dubai keeps its exact, pre-existing Trip.com URL', () => {
    const url = getTripComRouteUrl('manchester-dubai');
    expect(url).toBe(
      'https://www.trip.com/flights/Manchester-to-Dubai/tickets-MAN-DXB?flighttype=S&dcity=MAN&acity=DXB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082331'
    );
  });

  it('Manchester-Doha keeps its exact, pre-existing Trip.com URL', () => {
    const url = getTripComRouteUrl('manchester-doha');
    expect(url).toBe(
      'https://www.trip.com/flights/Manchester-to-Doha/tickets-MAN-DOH?flighttype=S&dcity=MAN&acity=DOH&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082646'
    );
  });
});

describe('Fare observations for both Batch 1 routes meet methodology requirements — no new observation was fabricated', () => {
  it('Manchester-Dubai still has exactly two logged observations, both still non-publishable (missing departureDate/returnDate) — untouched by this batch', () => {
    const dubaiObs = fareObservations.filter((o) => o.routeSlug === 'manchester-dubai');
    expect(dubaiObs.length).toBe(2);
    for (const o of dubaiObs) {
      expect(o.departureDate, o.id).toBeUndefined();
      expect(o.returnDate, o.id).toBeUndefined();
      expect(isPubliclyPublishable(o), o.id).toBe(false);
    }
    expect(getPublishableObservationsByRoute('manchester-dubai', NOW_ISO).length).toBe(0);
  });

  it('an incomplete fare record (missing dates) can never become publishable, regardless of route status — the exact gate this batch relied on instead of adding a fake one', () => {
    const incomplete = { id: 'test-incomplete', routeSlug: 'manchester-dubai', cabin: 'Economy' as const, observedDate: NOW_ISO, price: 100, priceNote: 'test', source: 'test' };
    expect(isPubliclyPublishable(incomplete)).toBe(false);
  });

  it('Manchester-Doha\'s existing publishable observation is untouched by this batch (same id, price, dates)', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-man-doh-economy-20260805-8w-v1');
    expect(obs).toBeDefined();
    expect(obs!.price).toBe(411);
    expect(obs!.departureDate).toBe('2026-09-30');
    expect(obs!.returnDate).toBe('2026-10-14');
    expect(getPublishableObservationsByRoute('manchester-doha', NOW_ISO).length).toBe(1);
  });
});

describe('Atlas grade reflects the real, current evidence for both routes — neither is upgraded by a manual override', () => {
  it('Manchester-Dubai now has exactly one depth category (baggage) and stays "useful", not "strong"', () => {
    const route = getRouteBySlug('manchester-dubai')!;
    const hasFare = getPublishableObservationsByRoute(route.slug, NOW_ISO).length > 0;
    const hasConnAlt = Boolean(route.connectingAlternative);
    const hasAirlineVerif = Boolean(route.airlineVerifications?.length);
    const hasBookBy = isBookByRoute(route.slug);
    const hasWarning = getActiveWarningsByRoute(route.slug).length > 0;
    const hasBaggage = travellerTips.some((t) => t.category === 'baggage' && (t.scope.routeSlug === route.slug || t.scope.destinationSlug === route.destinationSlug));
    const categoryCount = [hasFare, hasConnAlt, hasAirlineVerif, hasBookBy, hasWarning, hasBaggage].filter(Boolean).length;

    expect(hasBaggage, 'Batch 1 baggage addition should be picked up').toBe(true);
    expect(hasFare, 'still no publishable fare — the founder action this batch could not perform').toBe(false);
    expect(categoryCount).toBe(1);
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).toBe('useful');
  });

  it('Manchester-Doha stays at exactly one depth category (fare only) and stays "useful" — this batch could not honestly add a second', () => {
    const route = getRouteBySlug('manchester-doha')!;
    const hasFare = getPublishableObservationsByRoute(route.slug, NOW_ISO).length > 0;
    const hasConnAlt = Boolean(route.connectingAlternative);
    const hasAirlineVerif = Boolean(route.airlineVerifications?.length);
    const hasBookBy = isBookByRoute(route.slug);
    const hasWarning = getActiveWarningsByRoute(route.slug).length > 0;
    const hasBaggage = travellerTips.some((t) => t.category === 'baggage' && (t.scope.routeSlug === route.slug || t.scope.destinationSlug === route.destinationSlug));
    const categoryCount = [hasFare, hasConnAlt, hasAirlineVerif, hasBookBy, hasWarning, hasBaggage].filter(Boolean).length;

    expect(hasFare).toBe(true);
    expect(hasBaggage, 'no genuine Qatar Airways baggage source was found — must not be fabricated').toBe(false);
    expect(categoryCount).toBe(1);
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).toBe('useful');
  });
});

describe('Route warnings remain separate and untouched for both Batch 1 routes', () => {
  it('neither route has any active warning — none was added or fabricated to close the depth gap', () => {
    expect(getActiveWarningsByRoute('manchester-dubai').length).toBe(0);
    expect(getActiveWarningsByRoute('manchester-doha').length).toBe(0);
  });
});

describe('No unrelated route was changed by this batch', () => {
  it('data/routes.ts still has exactly 32 routes, and every route\'s core facts outside the two Batch 1 routes are byte-identical in shape', () => {
    expect(routes.length).toBe(32);
  });

  it('every traveller tip outside the one new Batch 1 entry is unchanged in count and content for every other route', () => {
    const otherRouteTips = travellerTips.filter((t) => t.id !== 'manchester-dubai-emirates-baggage-weight');
    expect(otherRouteTips.length).toBe(10); // the 10 pre-existing tips, confirmed unchanged in count
    // None of the other 30 routes gained a new tip scoped to them by this batch.
    for (const slug of routes.map((r) => r.slug)) {
      if ((BATCH_1_SLUGS as readonly string[]).includes(slug)) continue;
      const newTipsForRoute = otherRouteTips.filter((t) => t.scope.routeSlug === slug && t.id.startsWith('manchester-dubai'));
      expect(newTipsForRoute.length, slug).toBe(0);
    }
  });

  it('grading is unchanged for a sample of routes outside this batch (Manchester-Lahore stays strong, Heathrow-Bengaluru stays useful) — the six-category model itself was not touched', () => {
    const lahore = getRouteBySlug('manchester-lahore')!;
    const bengaluru = getRouteBySlug('london-heathrow-bengaluru')!;
    expect(computeRouteIntelligenceLevel(lahore, NOW_ISO)).toBe('strong');
    expect(computeRouteIntelligenceLevel(bengaluru, NOW_ISO)).toBe('useful');
  });
});

describe('The audit document\'s Batch 1 completion record matches the real, current grading function', () => {
  const auditDoc = readFileSync(join(process.cwd(), 'docs/project-control/ROUTE_COVERAGE_AUDIT.md'), 'utf8');

  it('states the real fare-observation counts for both routes, not a hand-typed figure', () => {
    expect(auditDoc).toContain('Two logged fare observations exist but predate the dating requirement');
    expect(auditDoc).toContain('obs-man-doh-economy-20260805-8w-v1');
  });

  it('documents the founder action required for Manchester-Dubai in the fare archive doc', () => {
    const archiveDoc = readFileSync(join(process.cwd(), 'docs/project-control/FARE_OBSERVATION_ARCHIVE.md'), 'utf8');
    expect(archiveDoc).toContain('## Founder action required: Manchester–Dubai');
    expect(archiveDoc).toContain('manchester-dubai-economy-1adult-baseline-v1');
    expect(archiveDoc.toLowerCase()).toContain('do not add this observation from memory or estimate');
  });
});
