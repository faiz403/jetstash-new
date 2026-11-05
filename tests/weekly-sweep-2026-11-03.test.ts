import { describe, expect, it } from 'vitest';
import { routes, getRouteBySlug, getRouteAirport, getRouteDestination } from '@/data/routes';
import { fareObservations, isObservationPublishable } from '@/data/fare-observations';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getAirportPairEvidence } from '@/lib/fare-airport-pair';
import { daysBetweenIso } from '@/lib/freshness-thresholds';
import { generateFareWatcherCandidates } from '@/lib/fare-watcher';
import { toTravellerFareNote } from '@/lib/fare-note-display';

/**
 * Weekly sweep, 3 November 2026 (fare recovery after the 3 November mass expiry). 42 routes were searched for
 * 29 December 2026 to 12 January 2027; 24 clean round trips were ingested, with both legs read and every booking option
 * checked. Evidence and selection rules: docs/project-control/fare-evidence/weekly-sweep-2026-11-03.md.
 * Evaluated on 3 November 2026: observations logged later are not publishable on that date.
 */
const DAY = '2026-11-03';
const sweep = fareObservations.filter((o) => o.observedDate === DAY);

const INGESTED = [
  'manchester-islamabad', 'manchester-dubai', 'birmingham-delhi', 'manchester-lahore', 'london-heathrow-delhi', 'london-heathrow-jeddah',
  'london-heathrow-bengaluru', 'birmingham-dubai', 'birmingham-doha', 'birmingham-mumbai', 'london-heathrow-mumbai', 'london-heathrow-dubai',
  'manchester-dhaka', 'birmingham-lahore', 'manchester-karachi', 'birmingham-madinah', 'birmingham-istanbul', 'manchester-istanbul',
  'birmingham-athens', 'birmingham-dalaman', 'birmingham-rome', 'bristol-rome', 'bristol-marrakech', 'birmingham-barcelona',
];
// Searched but held (no airline offer, a 10%+ single-agent outlier, or not a useful example) or no usable result.
const NOT_INGESTED = [
  'birmingham-amritsar', 'birmingham-jeddah', 'manchester-doha', 'birmingham-islamabad', 'leeds-bradford-islamabad', 'manchester-amritsar',
  'manchester-madinah', 'london-gatwick-tangier', 'birmingham-faro', 'london-gatwick-dubai', 'manchester-marrakech', 'leeds-bradford-amritsar',
  'manchester-ahmedabad', 'bristol-antalya', 'bristol-faro', 'glasgow-antalya', 'glasgow-dalaman', 'bristol-barcelona',
];

describe('3 November 2026 sweep records', () => {
  it('appends exactly one Economy observation for each ingested route and none for held or no-result routes', () => {
    expect(sweep.map((o) => o.routeSlug).sort()).toEqual([...INGESTED].sort());
    for (const slug of NOT_INGESTED) expect(sweep.some((o) => o.routeSlug === slug), slug).toBe(false);
    expect(new Set(sweep.map((o) => o.id)).size).toBe(sweep.length);
  });

  it('records the method window, both legs, baggage and itinerary classification on every record', () => {
    for (const o of sweep) {
      expect(o.cabin, o.id).toBe('Economy');
      expect([o.departureDate, o.returnDate], o.id).toEqual(['2026-12-29', '2027-01-12']);
      expect(o.currency, o.id).toBe('GBP');
      expect(o.observationReason, o.id).toBe('routine-weekly');
      expect(o.observedVia, o.id).toBe('google-flights');
      expect(o.baggage, o.id).toBeTruthy();
      expect(o.outboundDirectness, o.id).toMatch(/^(direct|connecting)$/);
      expect(o.returnDirectness, o.id).toMatch(/^(direct|connecting)$/);
      expect(o.fareDirectness, o.id).toBe(o.outboundDirectness === 'direct' && o.returnDirectness === 'direct' ? 'direct' : 'connecting');
      expect(o.outboundStops === 0, o.id).toBe(o.outboundDirectness === 'direct');
      expect(o.returnStops === 0, o.id).toBe(o.returnDirectness === 'direct');
      expect(o.outboundJourneyMinutes, o.id).toBeGreaterThan(0);
      expect(o.returnJourneyMinutes, o.id).toBeGreaterThan(0);
      expect(o.priceNote, o.id).toMatch(/Fare is a checked-date observation, not a live price\.$/);
    }
  });

  it('the traveller-facing note keeps itinerary facts and drops collection wording', () => {
    for (const o of sweep) {
      const note = toTravellerFareNote(o.priceNote);
      expect(note, o.id).not.toMatch(/Google Flights|airport pair|unlabelled|booking option/i);
      expect(note, o.id).toMatch(/^return, per person, one adult; /);
      expect(note, o.id).toMatch(/booking direct with .+ was £[\d,]+ for the same flights/);
    }
  });

  it('every record\'s own search URL names exactly the route airports on both legs (search-form evidence, never a mismatch)', () => {
    for (const o of sweep) {
      const route = getRouteBySlug(o.routeSlug)!;
      const from = getRouteAirport(route)!.code;
      const to = getRouteDestination(route)!.iataCode!;
      const evidence = getAirportPairEvidence(o.sourceUrl, from, to);
      expect(evidence.source, o.id).toBe('google-flights-tfs');
      expect(evidence.status, o.id).not.toBe('mismatch');
      expect(evidence.legs.map((l) => [l.searchOrigins, l.searchDestinations]), o.id).toEqual([[[from], [to]], [[to], [from]]]);
    }
  });
});

describe('a peak-season window is never compared with other windows', () => {
  it('every record carries its own Christmas and New Year 2026 profile, not the route\'s routine series', () => {
    for (const o of sweep) expect(o.profileId, o.id).toBe(`${o.routeSlug}-economy-1adult-christmas-new-year-2026-v1`);
    const peakProfiles = new Set(sweep.map((o) => o.profileId));
    const earlier = fareObservations.filter((o) => o.observedDate < DAY && o.profileId && peakProfiles.has(o.profileId));
    expect(earlier).toEqual([]);
  });

  it('so Fare Watcher builds no baseline from autumn fares and raises no candidate from these records', () => {
    const ids = new Set(sweep.map((o) => o.id));
    for (const day of [DAY, '2026-11-10', '2026-12-01']) {
      const candidates = generateFareWatcherCandidates(fareObservations, day).filter((c) => ids.has(c.id) || sweep.some((o) => o.routeSlug === c.routeSlug && c.travelDates.departureDate === '2026-12-29'));
      expect(candidates, day).toEqual([]);
    }
  });
});

describe('what visitors see on 3 November 2026', () => {
  it('each ingested route publishes and shows its new fare as the current example', () => {
    for (const o of sweep) {
      expect(isObservationPublishable(o, getRouteBySlug(o.routeSlug), DAY), o.id).toBe(true);
      const signal = getFareSignalForRoute(o.routeSlug, DAY);
      expect(signal.state, o.routeSlug).toBe('current');
      expect(signal.observation?.id, o.routeSlug).toBe(o.id);
    }
  });

  it('25 routes have a current fare (the 24 new ones plus Birmingham-Islamabad)', () => {
    const current = routes.filter((r) => getFareSignalForRoute(r.slug, DAY).state === 'current').map((r) => r.slug);
    expect(current.length).toBe(25);
    expect(current).toContain('birmingham-islamabad');
  });

  it('the new fares leave the site on 15 December 2026, 15 days before the 29 December departure, as the guard requires', () => {
    expect(daysBetweenIso('2026-12-14', '2026-12-29')).toBe(15);
    for (const o of sweep) expect(getFareSignalForRoute(o.routeSlug, '2026-12-15').observation?.id, o.routeSlug).not.toBe(o.id);
  });
});
