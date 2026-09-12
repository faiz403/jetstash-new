import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { deals } from '@/data/deals';
import { getRouteByAirportAndDestination } from '@/data/routes';
import { DealCard } from '@/components/ui/deal-card';

/**
 * Astra bounded trust review (10 Sept 2026) — finding #4, Mumbai unavailable
 * live-price wording.
 *
 * Root cause, traced through source (not guessed): DealCard's no-range
 * branch unconditionally said "No <cabin> fare checks logged yet — check
 * the live price below", regardless of whether a live-price action actually
 * renders beneath it. For manchester-mumbai (IndiGo's direct service
 * confirmed `service-ended`, 2 Sept 2026):
 *
 *  - every one of its fare observations becomes unpublishable the moment
 *    the route's effective status is 'service-ended'
 *    (isObservationPublishable, data/fare-observations.ts, only allows
 *    'direct' | 'connecting') — so `range` is null even though real
 *    observations exist in the archive;
 *  - getTripComFlightHandoff() (lib/booking-providers.ts) also returns null
 *    for a 'service-ended' route — so `tripComUrl` is null too, and the
 *    card's own fail-closed branch renders "Direct flight comparison is
 *    not available for this airport yet" immediately below.
 *
 * The man-bom-economy DealCard therefore promised "check the live price
 * below" directly above a message saying comparison isn't available — the
 * exact contradiction this fix closes. Fixed by gating the "check the live
 * price below" clause on the same `tripComUrl` the card already computes
 * for its own CTA, so the promise can never outrun what actually renders
 * beneath it. No new CTA or booking handoff was added.
 *
 * Commercial Funnel Fix update (12 Sept 2026, founder-approved): the
 * service-ended Trip.com gate was deliberately loosened so a service-ended
 * route with BOTH a canonical `connectingAlternative` AND an exact verified
 * Trip.com link (manchester-delhi, manchester-mumbai specifically) now DOES
 * get a handoff — see lib/booking-providers.ts's getTripComFlightHandoff()
 * doc comment. man-bom-economy therefore no longer demonstrates the
 * contradiction this file was written to catch; it now correctly promises
 * and delivers a live CTA (see tests/service-ended-commercial-funnel.test.ts
 * for that new, current behaviour). This file's fixture moved to
 * lhr-isb-economy, a deal with no matching Route entry at all — a case this
 * policy change does not and should not touch — so the "no live-price
 * action renders beneath it" scenario stays genuinely tested.
 */

const NOW_ISO = '2026-09-10';

describe('DealCard never promises "check the live price below" when no live-price action renders beneath it', () => {
  it('sanity check: lhr-isb-economy has no matching Route entry, so no fare range and no Trip.com handoff can exist — the exact conditions this fix targets', () => {
    const dealDef = deals.find((d) => d.id === 'lhr-isb-economy')!;
    expect(getRouteByAirportAndDestination(dealDef.fromAirportSlug, dealDef.toDestinationSlug)).toBeUndefined();
  });

  it('lhr-isb-economy no longer promises "check the live price below"', () => {
    const dealDef = deals.find((d) => d.id === 'lhr-isb-economy')!;
    const html = renderToStaticMarkup(DealCard({ deal: dealDef, nowIso: NOW_ISO }));
    expect(html).not.toContain('check the live price below');
  });

  it('lhr-isb-economy states plainly that live-price comparison is not available, matching the fail-closed CTA it sits above', () => {
    const dealDef = deals.find((d) => d.id === 'lhr-isb-economy')!;
    const html = renderToStaticMarkup(DealCard({ deal: dealDef, nowIso: NOW_ISO }));
    expect(html).toContain('No Economy fare checks logged yet, and live-price comparison isn&#x27;t available for this airport');
    expect(html).toContain('Direct flight comparison is not available for this airport yet.');
  });

  it('a genuinely live, no-fare route (manchester-islamabad, man-isb-business) keeps the original promise unchanged — this fix is additive, not a rewrite', () => {
    const dealDef = deals.find((d) => d.id === 'man-isb-business')!;
    const html = renderToStaticMarkup(DealCard({ deal: dealDef }));
    expect(html).toContain('No Business class fare checks logged yet — check the live price below');
    expect(html).toContain('Compare flights on Trip.com');
  });

  it('a deal with no matching route at all also gets the honest "not available" wording, never the live-price promise', () => {
    const syntheticDeal = {
      id: 'synthetic-no-route',
      category: 'flight' as const,
      cabin: 'Economy' as const,
      fromAirportSlug: 'does-not-exist',
      toDestinationSlug: 'does-not-exist',
      fromCity: 'Nowhere',
      toCity: 'Nowhere',
      toCountry: 'Nowhere',
      airline: 'Test Airline',
    };
    const html = renderToStaticMarkup(DealCard({ deal: syntheticDeal }));
    expect(html).not.toContain('check the live price below');
  });
});
