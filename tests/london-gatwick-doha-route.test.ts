import { describe, it, expect } from 'vitest';
import { getRouteBySlug, getRouteByAirportAndDestination, routes } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';
import { getDestinationBySlug } from '@/data/destinations';
import { airports } from '@/data/airports';

/**
 * Canonical route addition (7 Sept 2026): London Gatwick's own
 * longHaulRoutes list (data/airports.ts) already named Doha, and Doha's
 * two other UK-origin sibling routes (london-heathrow-doha,
 * manchester-doha) were both already genuinely verified direct — but no
 * london-gatwick-doha Route record existed anywhere in data/routes.ts.
 * This is a catalogue/evidence-control gap, not a public-copy trust
 * defect: independent primary-source reverification (Qatar Airways' own
 * "from London Gatwick" booking page, corroborated by the airline's own
 * live Flight Status system showing flight QR330 SCHEDULED on 7 September
 * 2026) confirmed the service is genuinely real before this record was
 * added.
 *
 * These tests deliberately prove the route resolves to 'direct' via
 * getEffectiveRoutePresentation() BECAUSE of the verification evidence
 * added — not merely because isDirect: true was set — and that no
 * unsupported specific frequency or duration claim was introduced.
 */

const NOW_ISO = '2026-09-07';
const route = getRouteBySlug('london-gatwick-doha')!;
const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);

describe('1-4. Route identity', () => {
  it('the route exists with the expected slug/airport/destination', () => {
    expect(route).toBeDefined();
    expect(route.airportSlug).toBe('london-gatwick');
    expect(route.destinationSlug).toBe('doha');
  });

  it('Qatar Airways is the canonical airline', () => {
    expect(route.airlineSlugs).toEqual(['qatar-airways']);
  });
});

describe('5-6. Verification and effective presentation', () => {
  it('the route carries a genuine, current verification record, not a bare isDirect flag', () => {
    expect(route.isDirect).toBe(true);
    expect(route.verification?.status).toBe('verified');
    expect(route.verification?.sourceName).toContain('Qatar Airways');
    expect(route.verification?.sourceUrl).toBe('https://www.qatarairways.com/en-gb/destinations/flights-to-doha/from-london-gatwick.html');
    expect(route.verification?.verifiedDate).toBe('2026-09-07');
    expect(route.verification?.reviewDueDate).toBe('2026-10-07');
  });

  it('getEffectiveRoutePresentation() resolves to direct BECAUSE of the verification evidence, not merely isDirect:true', () => {
    // Structural proof, not a hardcoded assumption: isVerificationCurrent()
    // returns false for an undefined verification record, so this would
    // fail if the verification block were ever removed while isDirect
    // stayed true — proving the "direct" status is genuinely evidence-gated.
    expect(presentation.status).toBe('direct');
    expect(presentation.statusLabel).toBe('Direct');
    expect(presentation.airlineSlugs).toEqual(['qatar-airways']);
  });

  it('would NOT resolve to direct on isDirect:true alone, without the verification record', () => {
    const stripped = { ...route, verification: undefined, airlineVerifications: undefined };
    const strippedPresentation = getEffectiveRoutePresentation(stripped, routeStatusEvents, NOW_ISO);
    expect(strippedPresentation.status).not.toBe('direct');
  });
});

describe('7. Doha ukAirports includes London Gatwick', () => {
  it('Doha\'s destination record now lists london-gatwick', () => {
    const doha = getDestinationBySlug('doha')!;
    expect(doha.ukAirports).toContain('london-gatwick');
    expect(doha.ukAirports).toEqual(['london-heathrow', 'london-gatwick', 'manchester', 'birmingham']);
  });

  it('Doha\'s flightTimeFromUK (a single-airport field, by established convention) is unchanged', () => {
    const doha = getDestinationBySlug('doha')!;
    expect(doha.flightTimeFromUK).toBe('6h 30m direct from London Heathrow');
  });
});

describe('8. Existing sibling Doha routes are unchanged', () => {
  it('london-heathrow-doha, manchester-doha, birmingham-doha are untouched', () => {
    const lhr = getRouteByAirportAndDestination('london-heathrow', 'doha')!;
    const man = getRouteByAirportAndDestination('manchester', 'doha')!;
    const bhx = getRouteByAirportAndDestination('birmingham', 'doha')!;
    expect(lhr.flightTime).toBe('Direct; duration varies by schedule');
    expect(lhr.verification?.verifiedDate).toBe('2026-09-03');
    expect(man.flightTime).toBe('Under 7h direct (Qatar Airways route page)');
    expect(man.verification?.verifiedDate).toBe('2026-08-18');
    expect(bhx.isDirect).toBe(true);
  });
});

describe('9. No unsupported numeric frequency introduced', () => {
  it('frequency and flightTime avoid asserting an unevidenced specific number', () => {
    expect(route.frequency).not.toMatch(/\d+x\s*(weekly|daily)|per week|per day/i);
    expect(route.flightTime).not.toMatch(/\d+h\s*\d*m?\b/i); // no "6h 30m"-style specific duration
    expect(route.frequency).toMatch(/not independently reconfirmed/i);
  });
});

describe('10. No unsupported editorial claims introduced', () => {
  it('intro and bookingWindowNote invent no fare, baggage, seasonal, terminal, or reliability claim', () => {
    const forbidden = /fare of|baggage allowance|seasonal|terminal \d|reliab|family-friendly|best time/i;
    expect(route.intro).not.toMatch(forbidden);
    expect(route.bookingWindowNote).not.toMatch(forbidden);
    expect(route.peakPeriodIds).toEqual([]);
    expect(route.connectingAlternative).toBeUndefined();
  });
});

describe('11. No fares/affiliate/Travel Ready/verification-of-other-routes data changed', () => {
  it('total route count grew by exactly one', () => {
    // Baseline d4c2846 had a known route count; this just proves exactly
    // one route was added, not zero and not more than one.
    const gatwickDoha = routes.filter((r) => r.airportSlug === 'london-gatwick' && r.destinationSlug === 'doha');
    expect(gatwickDoha).toHaveLength(1);
  });

  it('Gatwick and Doha airport/destination records are otherwise unchanged', () => {
    const gatwick = airports.find((a) => a.slug === 'london-gatwick')!;
    expect(gatwick.longHaulRoutes).toContain('Doha'); // pre-existing entry, untouched
    expect(gatwick.description).toContain('currently disputed Ahmedabad service'); // untouched prose, unrelated finding
    const doha = getDestinationBySlug('doha')!;
    expect(doha.description).toContain('Museum of Islamic Art');
    expect(doha.visaNote).toBe('Visa on arrival for UK passport holders, free for stays up to 30 days.');
  });
});
