import { describe, expect, it } from 'vitest';
import { fareObservations, isObservationPublishable, isPubliclyPublishable } from '@/data/fare-observations';
import { getRouteBySlug } from '@/data/routes';

const batch = fareObservations.filter((o) => o.id.includes('20260910-8w-v1'));

describe('10 September fixed-date routine evidence', () => {
  it('contains only the four authorised routes in collection order', () => {
    expect(batch.map((o) => [o.routeSlug, o.price])).toEqual([
      ['manchester-dubai', 252],
      ['manchester-lahore', 418],
      ['manchester-islamabad', 421],
      ['birmingham-mumbai', 446],
    ]);
  });

  it.each(batch)('$routeSlug is complete, comparable, and remains poor-itinerary evidence', (o) => {
    const prior = fareObservations.find((p) => p.routeSlug === o.routeSlug && p.id.includes('20260909-8w-v1'));
    expect(prior).toBeDefined();
    expect(o.profileId).toBe(prior!.profileId);
    expect([o.departureDate, o.returnDate, o.observedDate]).toEqual(['2026-11-03', '2026-11-17', '2026-09-10']);
    expect(o.observationReason).toBe('routine-weekly');
    expect(o.cabin).toBe('Economy');
    expect(o.currency).toBe('GBP');
    expect(o.observedVia).toBe('google-flights');
    expect(o.fareDirectness).toBe('connecting');
    expect(o.outboundDirectness).toBe('connecting');
    expect(o.returnDirectness).toBe('connecting');
    expect(o.outboundConnectionAirports).toHaveLength(o.outboundStops!);
    expect(o.returnConnectionAirports).toHaveLength(o.returnStops!);
    expect(o.outboundStops).toBeGreaterThanOrEqual(2);
    expect(o.returnStops).toBeGreaterThanOrEqual(2);
    expect(o.priceNote).toContain('self-transfer on both legs');
    expect(o.baggage).toContain('total baggage cost not stated');
    expect(isPubliclyPublishable(o)).toBe(true);
    expect(isObservationPublishable(o, getRouteBySlug(o.routeSlug), '2026-09-10')).toBe(true);
  });
});
