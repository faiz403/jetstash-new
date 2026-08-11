import { describe, expect, it } from 'vitest';
import { deriveTripValueVerdict, type TripOptionForValueVerdict } from '@/lib/trip-value-verdict';
import { fareObservations } from '@/data/fare-observations';

const option = (overrides: Partial<TripOptionForValueVerdict> = {}): TripOptionForValueVerdict => ({
  id: 'option-a',
  price: 520,
  baggage: { included: true, fee: null },
  totalJourneyMinutes: 900,
  stops: 1,
  ...overrides,
});

describe('deriveTripValueVerdict', () => {
  it('refuses to compare when baggage cost is unknown', () => {
    const result = deriveTripValueVerdict([
      option({ id: 'cheap', price: 520, baggage: { included: false, fee: null } }),
      option({ id: 'complete', price: 590, baggage: { included: true, fee: null } }),
    ]);

    expect(result.kind).toBe('insufficient-evidence');
    expect(result.optionId).toBeNull();
  });

  it('refuses to compare when journey facts are missing', () => {
    const result = deriveTripValueVerdict([
      option({ id: 'a', totalJourneyMinutes: null }),
      option({ id: 'b', totalJourneyMinutes: 800 }),
    ]);

    expect(result.kind).toBe('insufficient-evidence');
  });

  it('identifies an option that is cheaper and faster', () => {
    const result = deriveTripValueVerdict([
      option({ id: 'better', price: 590, totalJourneyMinutes: 720 }),
      option({ id: 'worse', price: 620, totalJourneyMinutes: 900 }),
    ]);

    expect(result.kind).toBe('dominant');
    expect(result.optionId).toBe('better');
    expect(result.totalCost).toBe(590);
  });

  it('includes a known baggage fee in the total cost', () => {
    const result = deriveTripValueVerdict([
      option({ id: 'bagged', price: 520, baggage: { included: false, fee: 70 }, totalJourneyMinutes: 900 }),
      option({ id: 'included', price: 590, baggage: { included: true, fee: null }, totalJourneyMinutes: 780 }),
    ]);

    expect(result.kind).toBe('dominant');
    expect(result.optionId).toBe('included');
    expect(result.totalCost).toBe(590);
  });

  it('describes a genuine price-versus-time trade-off without choosing for the traveller', () => {
    const result = deriveTripValueVerdict([
      option({ id: 'cheap', price: 520, totalJourneyMinutes: 1020 }),
      option({ id: 'fast', price: 590, totalJourneyMinutes: 780 }),
    ]);

    expect(result.kind).toBe('trade-off');
    expect(result.optionId).toBeNull();
    expect(result.comparison).toContain('£70 more');
    expect(result.comparison).toContain('4h');
  });

  it('does not invent a recommendation when only one option is supplied', () => {
    const result = deriveTripValueVerdict([option()]);

    expect(result.kind).toBe('insufficient-evidence');
    expect(result.comparison).toContain('at least two');
  });
});

describe('Manchester–Islamabad evidence-backed observations', () => {
  const observations = fareObservations.filter(
    (observation) => observation.routeSlug === 'manchester-islamabad' && observation.observedDate === '2026-08-10'
  );

  it('records three comparable current Economy options with complete reviewed journey fields', () => {
    expect(observations).toHaveLength(3);
    expect(observations.map((observation) => observation.price)).toEqual([621, 626, 645]);
    for (const observation of observations) {
      expect(observation.cabin).toBe('Economy');
      expect(observation.departureDate).toBe('2026-10-06');
      expect(observation.returnDate).toBe('2026-10-20');
      expect(observation.currency).toBe('GBP');
      expect(observation.observedVia).toBe('google-flights');
      expect(observation.sourceUrl).toContain('October%206%202026%20return%20October%2020%202026');
      expect(observation.fareDirectness).toBe('connecting');
      expect(observation.outboundDirectness).toBe('connecting');
      expect(observation.returnDirectness).toBe('connecting');
      expect(observation.outboundJourneyMinutes).toBeTypeOf('number');
      expect(observation.returnJourneyMinutes).toBeTypeOf('number');
      expect(observation.outboundStops).toBe(1);
      expect(observation.returnStops).toBe(1);
      expect(observation.outboundConnectionAirports).toHaveLength(1);
      expect(observation.returnConnectionAirports).toHaveLength(1);
      expect(observation.outboundLayoverMinutes).toHaveLength(1);
      expect(observation.returnLayoverMinutes).toHaveLength(1);
      expect(observation.baggage).toContain('not stated');
      expect(observation.baggage).toContain('optional charges may apply');
    }
  });

  it('keeps the value verdict fail-closed because baggage cost is not evidenced', () => {
    const options: TripOptionForValueVerdict[] = observations.map((observation) => ({
      id: observation.id,
      price: observation.price,
      baggage: { included: false, fee: null },
      totalJourneyMinutes: (observation.outboundJourneyMinutes ?? 0) + (observation.returnJourneyMinutes ?? 0),
      stops: (observation.outboundStops ?? 0) + (observation.returnStops ?? 0),
    }));

    const result = deriveTripValueVerdict(options);

    expect(result.kind).toBe('insufficient-evidence');
    expect(result.optionId).toBeNull();
    expect(result.totalCost).toBeNull();
    expect(result.comparison).toContain('missing verified baggage');
    expect(result.comparison).not.toMatch(/best|cheapest|better value|savings/i);
  });
});
