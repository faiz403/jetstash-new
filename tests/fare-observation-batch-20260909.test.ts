import { describe, expect, it } from 'vitest';
import { fareObservations, isObservationPublishable, isPubliclyPublishable } from '@/data/fare-observations';
import { getRouteBySlug } from '@/data/routes';

const batch = fareObservations.filter((o) => o.id.includes('20260909-8w-v1'));

describe('9 September fixed-date routine evidence', () => {
  it('contains only the four authorised routes in collection order', () => {
    expect(batch.map((o) => [o.routeSlug, o.price])).toEqual([
      ['manchester-dubai', 256],
      ['manchester-lahore', 416],
      ['manchester-islamabad', 420],
      ['birmingham-mumbai', 446],
    ]);
    expect(new Set(batch.map((o) => o.id)).size).toBe(4);
  });

  it.each(batch)('$routeSlug retains the fixed baseline dimensions and complete leg evidence', (o) => {
    const prior = fareObservations.find((p) => p.routeSlug === o.routeSlug && p.id.includes('20260908-8w-v1'));
    expect(prior).toBeDefined();
    expect(o.profileId).toBe(prior!.profileId);
    expect(o.departureDate).toBe('2026-11-03');
    expect(o.returnDate).toBe('2026-11-17');
    expect(o.observedDate).toBe('2026-09-09');
    expect(o.observationReason).toBe('routine-weekly');
    expect(o.cabin).toBe('Economy');
    expect(o.currency).toBe('GBP');
    expect(o.observedVia).toBe('google-flights');
    expect(o.fareDirectness).toBe('connecting');
    expect(o.outboundDirectness).toBe('connecting');
    expect(o.returnDirectness).toBe('connecting');
    expect(o.outboundConnectionAirports).toHaveLength(o.outboundStops!);
    expect(o.returnConnectionAirports).toHaveLength(o.returnStops!);
    expect(o.outboundLayoverMinutes).toHaveLength(o.outboundStops!);
    expect(o.returnLayoverMinutes).toHaveLength(o.returnStops!);
    expect(o.outboundJourneyMinutes).toBeGreaterThan(0);
    expect(o.returnJourneyMinutes).toBeGreaterThan(0);
    expect(o.priceNote).toContain('self-transfer on both legs');
    expect(o.baggage).toContain('available for a fee');
    expect(o.baggage).toContain('total baggage cost not stated');
    expect(isPubliclyPublishable(o)).toBe(true);
    expect(isObservationPublishable(o, getRouteBySlug(o.routeSlug), '2026-09-09')).toBe(true);
  });
});
