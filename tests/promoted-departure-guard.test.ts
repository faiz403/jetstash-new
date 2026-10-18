import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { deals } from '@/data/deals';
import { getRouteBySlug, routes } from '@/data/routes';
import { getDestinationBySlug } from '@/data/destinations';
import { routeStatusEvents } from '@/data/route-status-events';
import {
  fareObservations,
  getFareRangeSummary,
  getObservationsByRoute,
  getPublishableObservationsByRoute,
  getPublishableObservationsByRouteAndCabin,
  type FareObservation,
} from '@/data/fare-observations';
import { deriveFareSignal, getFareSignalForRoute } from '@/lib/fare-signal';
import { isSelfTransferItinerary } from '@/lib/fare-self-transfer';
import { computeBookBySnapshot } from '@/lib/booking-intelligence';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getApprovedStandoutFare } from '@/lib/standout-fare';
import {
  MIN_PROMOTED_DEPARTURE_LEAD_DAYS,
  PROMOTED_DEPARTURE_GUARD_START_DATE,
  PROMOTED_DEPARTURE_SAFETY_MARGIN_DAYS,
  meetsPromotedDepartureLeadTime,
} from '@/lib/freshness-thresholds';
import { DealCard } from '@/components/ui/deal-card';

/**
 * 14-day departure guard (plus the one-day safety margin) and deal-card
 * trust fix (17 Oct 2026, founder-approved local correction). Fixed
 * reference date: 17 October 2026.
 */
const TODAY = '2026-10-17';

const UK_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
/** The visitor's UK calendar date for an instant. */
function ukDate(instant: Date): string {
  return UK_DATE.format(instant);
}
/** The date every page passes as nowIso: the UTC date at render time. */
function renderNowIso(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}
function daysFrom(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / 86_400_000);
}
const HOUR = 3_600_000;

describe('meetsPromotedDepartureLeadTime — 14 days plus a one-day safety margin', () => {
  it('uses one central 14-day threshold and a one-day margin', () => {
    expect(MIN_PROMOTED_DEPARTURE_LEAD_DAYS).toBe(14);
    expect(PROMOTED_DEPARTURE_SAFETY_MARGIN_DAYS).toBe(1);
    expect(PROMOTED_DEPARTURE_GUARD_START_DATE).toBe('2026-10-17');
  });

  it('rejects 13 and 14 days, accepts 15 and 16 days, measured from the departure date', () => {
    expect(meetsPromotedDepartureLeadTime('2026-10-30', TODAY)).toBe(false); // 13 days
    // Documented trade-off: exactly 14 days is excluded by the safety margin.
    expect(meetsPromotedDepartureLeadTime('2026-10-31', TODAY)).toBe(false); // 14 days
    expect(meetsPromotedDepartureLeadTime('2026-11-01', TODAY)).toBe(true); // 15 days
    expect(meetsPromotedDepartureLeadTime('2026-11-02', TODAY)).toBe(true); // 16 days
    expect(meetsPromotedDepartureLeadTime('2026-10-10', TODAY)).toBe(false); // already departed
  });

  it('crosses the UK autumn and spring clock changes without an off-by-one', () => {
    // 25 Oct 2026 BST→GMT; 28 Mar 2027 GMT→BST. Date-only arithmetic ignores both.
    expect(meetsPromotedDepartureLeadTime('2026-11-07', '2026-10-24')).toBe(false); // 14 days
    expect(meetsPromotedDepartureLeadTime('2026-11-08', '2026-10-24')).toBe(true); // 15 days
    expect(meetsPromotedDepartureLeadTime('2027-04-10', '2027-03-27')).toBe(false); // 14 days
    expect(meetsPromotedDepartureLeadTime('2027-04-11', '2027-03-27')).toBe(true); // 15 days
  });

  it('never infers a missing departure date', () => {
    expect(meetsPromotedDepartureLeadTime(undefined, TODAY)).toBe(false);
  });

  it('leaves dates before the guard start on their previous semantics', () => {
    expect(meetsPromotedDepartureLeadTime('2026-10-17', '2026-10-16')).toBe(true);
  });
});

describe('Fare Signal headline — synthetic 13/14/15/16-day observations', () => {
  const NOW = '2026-10-20';
  const base: FareObservation = {
    id: 'guard-fixture', routeSlug: 'manchester-delhi', cabin: 'Economy', observedDate: NOW,
    price: 450, priceNote: 'return, protected one-stop itinerary', source: 'Etihad', currency: 'GBP',
    comparisonEligibility: 'current', departureDate: '2026-11-03', returnDate: '2026-11-17',
    fareDirectness: 'connecting', outboundDirectness: 'connecting', returnDirectness: 'connecting',
  };
  const day13 = { ...base, id: 'guard-13', price: 400, departureDate: '2026-11-02', returnDate: '2026-11-16' };
  const day14 = { ...base, id: 'guard-14', price: 420 };
  const day15 = { ...base, id: 'guard-15', price: 500, departureDate: '2026-11-04', returnDate: '2026-11-18' };
  const day16 = { ...base, id: 'guard-16', price: 520, departureDate: '2026-11-05', returnDate: '2026-11-19' };

  it('never headlines the cheaper 13- or 14-day fares; the lowest qualifying fare wins under the unchanged rules', () => {
    const signal = deriveFareSignal([day13, day14, day15, day16], NOW);
    expect(signal.state).toBe('current');
    expect(signal.observation?.id).toBe('guard-15');
  });

  it('a 16-day fare qualifies on its own', () => {
    expect(deriveFareSignal([day16], NOW).observation?.id).toBe('guard-16');
  });

  it('a route whose only evidence departs in 13 or 14 days shows no headline rather than a substitute', () => {
    const signal = deriveFareSignal([day13, day14], NOW);
    expect(signal.state).toBe('none');
    expect(signal.observation).toBeNull();
  });
});

describe('UK midnight, UTC render dates and six-hour ISR caching', () => {
  // Real caching measured 17 Oct 2026: browsers do not cache route pages
  // (Cache-Control: max-age=0, must-revalidate); Vercel serves the ISR copy
  // (revalidate 21600 s) and regenerates it after 6 hours.

  it("the margin covers Codex's reproduction: 00:30 BST on 21 October is still 20 October in UTC", () => {
    const instant = new Date('2026-10-20T23:30:00Z');
    expect(renderNowIso(instant)).toBe('2026-10-20');
    expect(ukDate(instant)).toBe('2026-10-21');
    // Heathrow–Delhi £411 and Heathrow–Mumbai £396 depart 3 Nov: 13 UK days away.
    const cases = [
      { dealId: 'lhr-del-economy', routeSlug: 'london-heathrow-delhi', leakedPrice: '£411' },
      { dealId: 'lhr-bom-economy', routeSlug: 'london-heathrow-mumbai', leakedPrice: '£396' },
    ];
    const nowIso = renderNowIso(instant);
    for (const { dealId, routeSlug, leakedPrice } of cases) {
      const html = renderToStaticMarkup(DealCard({ deal: deals.find((d) => d.id === dealId)!, nowIso }));
      expect(html).not.toContain(leakedPrice);
      const range = getFareRangeSummary(routeSlug, 'Economy', nowIso);
      if (!range) continue;
      const minimum = getPublishableObservationsByRouteAndCabin(routeSlug, 'Economy', nowIso)
        .find((o) => o.price === range.min && o.observedDate === range.minimumObservedDate)!;
      expect(daysFrom(ukDate(instant), minimum.departureDate!)).toBeGreaterThanOrEqual(14);
      const signal = getFareSignalForRoute(routeSlug, nowIso);
      if (signal.observation) expect(daysFrom(ukDate(instant), signal.observation.departureDate!)).toBeGreaterThanOrEqual(14);
    }
  });

  it('a page served within 23 hours of rendering is never more than one UK day ahead of its render date, in BST and GMT', () => {
    // Render every 30 minutes across the autumn and spring clock changes and
    // a plain GMT and BST day; serve at every age from 0 to just under 23 h.
    const windows = [['2026-10-23T00:00:00Z', '2026-10-27T00:00:00Z'], ['2026-12-09T00:00:00Z', '2026-12-11T00:00:00Z'], ['2027-03-26T00:00:00Z', '2027-03-30T00:00:00Z'], ['2027-06-14T00:00:00Z', '2027-06-16T00:00:00Z']];
    let worst = 0;
    for (const [start, end] of windows) {
      for (let t = Date.parse(start); t < Date.parse(end); t += HOUR / 2) {
        const renderIso = renderNowIso(new Date(t));
        for (let ageMinutes = 0; ageMinutes < 23 * 60; ageMinutes += 30) {
          worst = Math.max(worst, daysFrom(renderIso, ukDate(new Date(t + ageMinutes * 60_000))));
        }
        // The exact edge: rendered at the last minute of a UTC day.
        worst = Math.max(worst, daysFrom(renderIso, ukDate(new Date(t + 23 * HOUR - 60_000))));
      }
    }
    expect(worst).toBe(PROMOTED_DEPARTURE_SAFETY_MARGIN_DAYS);
  }, 60_000);

  it('the six-hour revalidation window sits well inside that bound', () => {
    // Worst case: rendered 23:59 UTC in BST, served 6 h later at 06:59 BST next day.
    const rendered = new Date('2026-10-20T23:59:00Z');
    const served = new Date(rendered.getTime() + 6 * HOUR);
    expect(daysFrom(renderNowIso(rendered), ukDate(served))).toBe(1);
  });

  it('documents the limit: a copy first served 23+ hours after rendering can be two UK days ahead', () => {
    // An ISR copy left unvisited for more than a day keeps being served stale
    // until a background regeneration succeeds. The one-day margin does not
    // cover that case; it needs a separate cache-expiry decision.
    const rendered = new Date('2026-10-20T23:59:00Z');
    const served = new Date(rendered.getTime() + 23 * HOUR + 30 * 60_000);
    expect(daysFrom(renderNowIso(rendered), ukDate(served))).toBe(2);
  });

  it('every promoted price is 14+ UK days out for any page served up to one UK day after its render date (17 Oct – 30 Nov)', () => {
    const cabins = ['Economy', 'Premium Economy', 'Business'] as const;
    for (let t = Date.parse('2026-10-17T12:00:00Z'); t <= Date.parse('2026-11-30T12:00:00Z'); t += 24 * HOUR) {
      const nowIso = renderNowIso(new Date(t));
      const latestUkView = new Date(Date.parse(`${nowIso}T12:00:00Z`) + 24 * HOUR).toISOString().slice(0, 10);
      const promoted: { where: string; departureDate?: string }[] = [];
      for (const route of routes) {
        const signal = getFareSignalForRoute(route.slug, nowIso);
        if (signal.observation) promoted.push({ where: `${route.slug} headline`, departureDate: signal.observation.departureDate });
        if (signal.lowerSelfTransfer) promoted.push({ where: `${route.slug} secondary`, departureDate: signal.lowerSelfTransfer.departureDate });
        const standout = getApprovedStandoutFare(route.slug, 'Economy', fareObservations, nowIso);
        if (standout) promoted.push({ where: `${route.slug} standout`, departureDate: standout.observation.departureDate });
        for (const cabin of cabins) {
          const range = getFareRangeSummary(route.slug, cabin, nowIso);
          if (!range) continue;
          const pool = getPublishableObservationsByRouteAndCabin(route.slug, cabin, nowIso);
          const minimum = pool.find((o) => o.price === range.min && o.priceNote === range.priceNote && o.observedDate === range.minimumObservedDate);
          promoted.push({ where: `${route.slug} ${cabin} range min`, departureDate: minimum?.departureDate });
          const maxima = pool.filter((o) => o.price === range.max && meetsPromotedDepartureLeadTime(o.departureDate, nowIso));
          expect(maxima.length, `${route.slug} ${cabin} range max ${nowIso}`).toBeGreaterThan(0);
        }
      }
      for (const slug of ['manchester-lahore', 'manchester-islamabad', 'london-heathrow-delhi', 'london-heathrow-jeddah', 'birmingham-amritsar']) {
        const snapshot = computeBookBySnapshot(slug, new Date(t));
        const fare = snapshot?.latestObservation;
        if (fare) {
          const source = getPublishableObservationsByRoute(slug, nowIso).find((o) => o.price === fare.price && o.observedDate === fare.observedDate && meetsPromotedDepartureLeadTime(o.departureDate, nowIso));
          promoted.push({ where: `${slug} Book-By`, departureDate: source?.departureDate });
        }
      }
      for (const item of promoted) {
        expect(item.departureDate, `${item.where} ${nowIso}`).toBeDefined();
        expect(daysFrom(latestUkView, item.departureDate!), `${item.where} rendered ${nowIso}`).toBeGreaterThanOrEqual(14);
      }
    }
  }, 120_000);
});

describe('MAN→ISB on 17 October 2026', () => {
  const route = getRouteBySlug('manchester-islamabad')!;

  it('is re-verified against the Manchester Airport PIA operator page with a 30-day review', () => {
    expect(route.verification?.sourceUrl).toBe('https://www.manchesterairport.co.uk/flight-operators/pakistan-international-airlines/');
    expect(route.verification?.verifiedDate).toBe('2026-10-17');
    expect(route.verification?.reviewDueDate).toBe('2026-11-16');
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, TODAY).status).toBe('direct');
  });

  it('softens the exact 7h 45m duration to wording both current sources support', () => {
    expect(route.flightTime).not.toContain('7h 45m');
    expect(route.flightTime).toBe('About 7½ hours direct');
    expect(getDestinationBySlug('islamabad')?.flightTimeFromUK).toBe('About 7½ hours direct from Manchester');
  });

  it('headlines the 6 Oct £521 Etihad check, not the £480 check for a 20 Oct departure', () => {
    const signal = getFareSignalForRoute(route.slug, TODAY);
    expect(signal.state).toBe('current');
    expect(signal.observation?.id).toBe('obs-man-isb-economy-20261006-v1');
    expect(signal.observation?.price).toBe(521);
    expect(signal.observation?.isSelfTransfer).toBe(false);
    expect(signal.observation?.departureDate).toBe('2026-11-17');
  });

  it('keeps the £449 self-transfer check as the labelled secondary line with its own dates, never the headline', () => {
    const signal = getFareSignalForRoute(route.slug, TODAY);
    expect(signal.lowerSelfTransfer?.id).toBe('obs-man-isb-economy-20261006-selftransfer-v1');
    expect(signal.lowerSelfTransfer?.price).toBe(449);
    expect(signal.lowerSelfTransfer?.isSelfTransfer).toBe(true);
    expect(signal.lowerSelfTransfer?.journeyConsequences).toContain('Self-transfer');
  });

  it('Book-By uses the same £521 check', () => {
    const snapshot = computeBookBySnapshot(route.slug, new Date(`${TODAY}T12:00:00Z`));
    expect(snapshot?.latestObservation?.price).toBe(521);
  });

  it('the deal-card range excludes the £428 self-transfer and the £480 near-departure check, and its note describes the minimum', () => {
    const range = getFareRangeSummary(route.slug, 'Economy', TODAY)!;
    expect(range.min).toBe(521);
    expect(range.min).not.toBe(428);
    expect(isSelfTransferItinerary(range.priceNote)).toBe(false);
    expect(range.minimumObservedDate).toBe('2026-10-06');
    const html = renderToStaticMarkup(DealCard({ deal: deals.find((d) => d.id === 'man-isb-economy')!, nowIso: TODAY }));
    expect(html).toContain('£521');
    expect(html).not.toContain('£428');
    expect(html).not.toContain('£480');
  });

  it('keeps the excluded checks in the dated history rather than deleting them', () => {
    const history = getPublishableObservationsByRoute(route.slug, TODAY).map((o) => o.id);
    expect(history).toContain('obs-man-isb-economy-20260825-recheck-v1'); // £480
    expect(history).toContain('obs-man-isb-economy-20260908-8w-v1'); // £428
  });

  it('does not add the held £682 Gulf Air December check to the dataset', () => {
    expect(getObservationsByRoute(route.slug).some((o) => o.price === 682)).toBe(false);
  });

  it('still fails closed after the new review date', () => {
    expect(getFareSignalForRoute(route.slug, '2026-11-17').state).toBe('none');
    expect(getFareRangeSummary(route.slug, 'Economy', '2026-11-17')).toBeNull();
  });
});

describe('Deal-card range integrity across every route on 17 October 2026', () => {
  const cabins = ['Economy', 'Premium Economy', 'Business'] as const;

  it('every displayed minimum departs at least 14 days out, and its note comes from that same check', () => {
    for (const route of routes) {
      for (const cabin of cabins) {
        const range = getFareRangeSummary(route.slug, cabin, TODAY);
        if (!range) continue;
        const source = getPublishableObservationsByRouteAndCabin(route.slug, cabin, TODAY)
          .find((o) => o.price === range.min && o.priceNote === range.priceNote && o.observedDate === range.minimumObservedDate);
        expect(source, `${route.slug} ${cabin}`).toBeDefined();
        expect(meetsPromotedDepartureLeadTime(source!.departureDate, TODAY), `${route.slug} ${cabin}`).toBe(true);
      }
    }
  });

  it('a self-transfer minimum only appears when no clean check qualifies, and then carries its warning', () => {
    for (const route of routes) {
      for (const cabin of cabins) {
        const range = getFareRangeSummary(route.slug, cabin, TODAY);
        if (!range || !isSelfTransferItinerary(range.priceNote)) continue;
        const cleanQualifying = getPublishableObservationsByRouteAndCabin(route.slug, cabin, TODAY)
          .filter((o) => meetsPromotedDepartureLeadTime(o.departureDate, TODAY) && !isSelfTransferItinerary(o.priceNote));
        expect(cleanQualifying, `${route.slug} ${cabin}`).toEqual([]);
        expect(range.journeyConsequences, `${route.slug} ${cabin}`).toContain('Self-transfer');
      }
    }
  });

  it('every headline and secondary fare departs at least 14 days out', () => {
    for (const route of routes) {
      const signal = getFareSignalForRoute(route.slug, TODAY);
      if (signal.observation) expect(meetsPromotedDepartureLeadTime(signal.observation.departureDate, TODAY), route.slug).toBe(true);
      if (signal.lowerSelfTransfer) expect(meetsPromotedDepartureLeadTime(signal.lowerSelfTransfer.departureDate, TODAY), route.slug).toBe(true);
    }
  });

  it('does not change the archive itself', () => {
    expect(fareObservations.length).toBeGreaterThan(0);
    expect(fareObservations.find((o) => o.id === 'obs-man-isb-economy-20260825-recheck-v1')?.price).toBe(480);
  });
});

describe('Deal card when checks exist but none qualifies', () => {
  it('says there is no current fare instead of claiming no checks were logged', () => {
    // Manchester–Karachi Business: one publishable check, departing 17 Oct.
    const deal = deals.find((d) => d.id === 'man-khi-business')!;
    expect(getPublishableObservationsByRouteAndCabin('manchester-karachi', 'Business', TODAY).length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(DealCard({ deal, nowIso: TODAY }));
    expect(html).toContain('No current Business class fare to show');
    expect(html).not.toContain('fare checks logged yet');
    expect(html).not.toContain('£2,553');
  });
});
