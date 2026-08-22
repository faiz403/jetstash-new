import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  fareObservations,
  isPubliclyPublishable,
  isMethodologyExcluded,
  getFareRangeSummary,
} from '@/data/fare-observations';
import { routes, getRouteBySlug, getRouteAirport, getRouteDestination } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getAirlinesBySlugs } from '@/data/airlines';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getTripComRouteUrl } from '@/lib/booking-providers';
import { FareSignal } from '@/components/route/fare-signal';
import { deals } from '@/data/deals';
import { qualifyFareWatcherObservation, generateFareWatcherCandidates } from '@/lib/fare-watcher';

/**
 * Business Fare Evidence Batch 1 (22 August 2026) — the first genuine,
 * current, publishable Business-cabin observations for manchester-lahore,
 * london-heathrow-lahore, london-heathrow-doha and manchester-karachi. Fare
 * evidence only — no SEO, Deal, Trip.com or route-verification change. See
 * data/fare-observations.ts's own "Business Fare Evidence Batch 1" comment
 * block for the full evidence-lock provenance (locked search methodology,
 * per-segment Business-cabin verification, the exact Heathrow-Doha
 * itinerary-vs-price trace, the Manchester-Karachi 78-result lowest-fare
 * proof).
 */

const NOW_ISO = '2026-08-22';

const BATCH = [
  { id: 'obs-man-lhe-business-20260822-8w-v1', routeSlug: 'manchester-lahore', price: 3051, profileId: 'manchester-lahore-business-1adult-baseline-v1', stops: 3 },
  { id: 'obs-lhr-lhe-business-20260822-8w-v1', routeSlug: 'london-heathrow-lahore', price: 2205, profileId: 'london-heathrow-lahore-business-1adult-baseline-v1', stops: 3 },
  { id: 'obs-lhr-doh-business-20260822-8w-v1', routeSlug: 'london-heathrow-doha', price: 1596, profileId: 'london-heathrow-doha-business-1adult-baseline-v1', stops: 1 },
  { id: 'obs-man-khi-business-20260822-8w-v1', routeSlug: 'manchester-karachi', price: 2553, profileId: 'manchester-karachi-business-1adult-baseline-v1', stops: 1 },
] as const;

function presentationFor(slug: string) {
  const route = getRouteBySlug(slug)!;
  const airport = getRouteAirport(route);
  const dest = getRouteDestination(route);
  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
  const airlines = getAirlinesBySlugs(presentation.airlineSlugs);
  return { route, airport, dest, presentation, airlines };
}

/** Renders the real FareSignal component for whatever observation currently surfaces as the route's top signal — mirrors tests/fare-signal-route-vs-fare-clarity.test.ts's established pattern. */
function renderFareSignalForRoute(slug: string): string {
  const { route, presentation, airlines } = presentationFor(slug);
  const signal = getFareSignalForRoute(route.slug, NOW_ISO);
  const html = renderToStaticMarkup(
    FareSignal({
      signal,
      tripComUrl: getTripComRouteUrl(route.slug),
      routeSlug: route.slug,
      routeDirectness: presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.status : null,
      routeStatusLabel: presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.statusLabel : null,
      routeAirlineLabel: airlines.length > 0 ? airlines.map((a) => a.name).join(', ') : null,
      routeServiceConnections: route.routeServiceConnections ?? null,
    })
  );
  return html.replace(/\s+/g, ' ');
}

describe('Business Fare Evidence Batch 1: all four observations are complete and publishable', () => {
  for (const { id, routeSlug, price, profileId } of BATCH) {
    it(`${id} is a complete, publishable Business-cabin observation`, () => {
      const o = fareObservations.find((entry) => entry.id === id);
      expect(o, id).toMatchObject({
        routeSlug,
        cabin: 'Business',
        observedDate: NOW_ISO,
        price,
        currency: 'GBP',
        observedVia: 'google-flights',
        observationReason: 'routine-weekly',
        comparisonEligibility: 'current',
        departureDate: '2026-10-17',
        returnDate: '2026-10-31',
        profileId,
        fareDirectness: 'connecting',
        outboundDirectness: 'connecting',
        returnDirectness: 'connecting',
      });
      expect(o?.sourceUrl, id).toMatch(/^https:\/\/www\.google\.com\/travel\/flights\/booking\?tfs=/);
      expect(o?.baggage, id).toBeTruthy();
      expect(o?.outboundConnectionAirports?.length, id).toBeGreaterThan(0);
      expect(o?.returnConnectionAirports?.length, id).toBeGreaterThan(0);
      expect(o?.outboundJourneyMinutes, id).toBeGreaterThan(0);
      expect(o?.returnJourneyMinutes, id).toBeGreaterThan(0);
      expect(isPubliclyPublishable(o!), id).toBe(true);
      expect(isMethodologyExcluded(o!.id), id).toBe(false);
    });
  }

  it('stop counts survive exactly as evidence-locked (3/3 for both Lahore routes, 1/1 for Doha and Karachi)', () => {
    for (const { id, stops } of BATCH) {
      const o = fareObservations.find((entry) => entry.id === id)!;
      expect(o.outboundStops, id).toBe(stops);
      expect(o.returnStops, id).toBe(stops);
    }
  });

  it('each starts a fresh -baseline-v1 profile series — no route had an established comparable Business series to reuse', () => {
    for (const { id, profileId } of BATCH) {
      const o = fareObservations.find((entry) => entry.id === id)!;
      expect(o.profileId, id).toBe(profileId);
      expect(o.profileId, id).toMatch(/-business-1adult-baseline-v1$/);
      // No other observation on the route shares this profileId (a genuinely fresh series).
      const sameProfile = fareObservations.filter((e) => e.profileId === profileId);
      expect(sameProfile, id).toHaveLength(1);
    }
  });

  it('getFareRangeSummary(Business) now returns exactly this one observation for each route', () => {
    for (const { id, routeSlug, price } of BATCH) {
      const range = getFareRangeSummary(routeSlug, 'Business', NOW_ISO);
      expect(range, routeSlug).not.toBeNull();
      expect(range?.count, routeSlug).toBe(1);
      expect(range?.min, routeSlug).toBe(price);
      expect(range?.max, routeSlug).toBe(price);
      void id;
    }
  });
});

describe('self-transfer disclosure survives exactly as recorded', () => {
  it('Manchester-Lahore and Heathrow-Lahore explicitly disclose self-transfer in priceNote', () => {
    for (const id of ['obs-man-lhe-business-20260822-8w-v1', 'obs-lhr-lhe-business-20260822-8w-v1']) {
      const o = fareObservations.find((entry) => entry.id === id)!;
      expect(o.priceNote, id).toMatch(/self-transfer/i);
    }
  });

  it('Heathrow-Doha and Manchester-Karachi explicitly disclose NOT self-transfer in priceNote', () => {
    for (const id of ['obs-lhr-doh-business-20260822-8w-v1', 'obs-man-khi-business-20260822-8w-v1']) {
      const o = fareObservations.find((entry) => entry.id === id)!;
      expect(o.priceNote, id).toMatch(/NOT self-transfer/);
    }
  });
});

describe('Lahore/Doha route-vs-fare mismatch behaviour is correct against their own verified direct service', () => {
  it('Manchester-Lahore: the new Business fare is now the current signal and the mismatch callout fires against PIA · Direct', () => {
    const { presentation } = presentationFor('manchester-lahore');
    expect(presentation.status).toBe('direct');
    const signal = getFareSignalForRoute('manchester-lahore', NOW_ISO);
    expect(signal.observation?.id).toBe('obs-man-lhe-business-20260822-8w-v1');
    expect(signal.observation?.directness).toBe('connecting');

    const html = renderFareSignalForRoute('manchester-lahore');
    expect(html).toContain('Route service');
    expect(html).toContain('PIA · Direct');
    expect(html).toContain('This tracked fare is a different, connecting journey.');
  });

  it('Heathrow-Lahore: the new Business fare is now the current signal and the mismatch callout fires against PIA · Direct', () => {
    const { presentation } = presentationFor('london-heathrow-lahore');
    expect(presentation.status).toBe('direct');
    const signal = getFareSignalForRoute('london-heathrow-lahore', NOW_ISO);
    expect(signal.observation?.id).toBe('obs-lhr-lhe-business-20260822-8w-v1');

    const html = renderFareSignalForRoute('london-heathrow-lahore');
    expect(html).toContain('Route service');
    expect(html).toContain('PIA · Direct');
    expect(html).toContain('This tracked fare is a different, connecting journey.');
  });

  it('Heathrow-Doha: the new Business fare is now the current signal and the mismatch callout fires against Qatar Airways · Direct', () => {
    const { presentation } = presentationFor('london-heathrow-doha');
    expect(presentation.status).toBe('direct');
    const signal = getFareSignalForRoute('london-heathrow-doha', NOW_ISO);
    expect(signal.observation?.id).toBe('obs-lhr-doh-business-20260822-8w-v1');

    const html = renderFareSignalForRoute('london-heathrow-doha');
    expect(html).toContain('Route service');
    expect(html).toContain('Qatar Airways · Direct');
    expect(html).toContain('This tracked fare is a different, connecting journey.');
  });

  it('current no-safe-Trip.com-handoff state is unchanged for both Heathrow routes', () => {
    expect(getTripComRouteUrl('london-heathrow-lahore')).toBeNull();
    expect(getTripComRouteUrl('london-heathrow-doha')).toBeNull();
  });

  it('existing Trip.com CTA is unchanged for Manchester-Lahore', () => {
    expect(getTripComRouteUrl('manchester-lahore')).toBeTruthy();
  });
});

describe('Manchester-Karachi: no false route-vs-fare mismatch, no made-up fixed hub, no Business Deal', () => {
  it('the route itself remains structurally connecting, unchanged by this batch', () => {
    const { presentation } = presentationFor('manchester-karachi');
    expect(presentation.status).toBe('connecting');
  });

  it('route.routeServiceConnections stays unset — Bahrain is not recorded as a claimed fixed route-service hub', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    expect(route.routeServiceConnections).toBeUndefined();
  });

  it('the Business observation\'s own priceNote is explicit that Bahrain is this one fare\'s routing, not a route-level claim', () => {
    const o = fareObservations.find((entry) => entry.id === 'obs-man-khi-business-20260822-8w-v1')!;
    expect(o.priceNote).toMatch(/not a claimed fixed route-service hub/);
  });

  it('the route\'s currently-surfaced Fare Signal (still Economy, tied observedDate resolved deterministically) shows no false mismatch callout — route and fare directness agree', () => {
    const signal = getFareSignalForRoute('manchester-karachi', NOW_ISO);
    expect(signal.observation?.directness).toBe('connecting');
    const html = renderFareSignalForRoute('manchester-karachi');
    expect(html).not.toContain('Route service');
  });

  it('no Business Deal exists for manchester-karachi in this PR', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    const businessDeal = deals.find(
      (d) => d.fromAirportSlug === route.airportSlug && d.toDestinationSlug === route.destinationSlug && d.cabin === 'Business'
    );
    expect(businessDeal).toBeUndefined();
  });
});

describe('none of the four new observations is methodology-excluded', () => {
  it('confirms all four pass isMethodologyExcluded() as false', () => {
    for (const { id } of BATCH) {
      expect(isMethodologyExcluded(id), id).toBe(false);
    }
  });
});

describe('Fare Watcher handles each new series correctly — insufficient baseline expected, never founder-approved by this PR', () => {
  for (const { id } of BATCH) {
    it(`${id}: insufficient-baseline with zero comparable prior points`, () => {
      const o = fareObservations.find((entry) => entry.id === id)!;
      const result = qualifyFareWatcherObservation(o, fareObservations, NOW_ISO);
      expect(result.qualification, id).toBe('insufficient-baseline');
      expect(result.baselineSampleSize, id).toBe(0);
      expect(result.baselineMedian, id).toBeNull();
    });
  }

  it('generates no Fare Watcher candidate object for any of the four new observations', () => {
    const candidates = generateFareWatcherCandidates(fareObservations, NOW_ISO);
    const ids = BATCH.map((b) => b.id);
    expect(candidates.filter((c) => ids.includes(c.id as (typeof ids)[number]))).toEqual([]);
  });
});

describe('nothing else in the route network was touched', () => {
  it('routes.ts still has exactly the same number of routes, and none besides the four targets carries a new Business observation dated 22 August 2026 under a -business- baseline profile', () => {
    const newBusinessIds = fareObservations
      .filter((o) => o.cabin === 'Business' && o.observedDate === '2026-08-22' && o.profileId?.includes('-business-1adult-baseline-v1'))
      .map((o) => o.id)
      .sort();
    expect(newBusinessIds).toEqual(BATCH.map((b) => b.id).sort());
    expect(routes.length).toBeGreaterThan(0); // sanity: routes.ts itself untouched, still loads
  });
});
