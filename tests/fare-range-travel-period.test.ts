import { describe, expect, it, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DealCard } from '@/components/ui/deal-card';
import { deals, type Deal } from '@/data/deals';
import {
  fareObservations, getFareRangeSummary, getPublishableObservationsByRouteAndCabin,
  hasValidFareRangeTravelDates, selectFareRangeTravelPeriod, type FareObservation,
} from '@/data/fare-observations';
import { routes } from '@/data/routes';
import { meetsPromotedDepartureLeadTime } from '@/lib/freshness-thresholds';

const NOW = '2026-10-20';
const originalLength = fareObservations.length;
afterEach(() => { fareObservations.splice(originalLength); });
function observation(overrides: Partial<FareObservation> = {}): FareObservation {
  return { id: 'fixture', routeSlug: 'manchester-dubai', cabin: 'Economy',
    observedDate: '2026-10-19', price: 500, source: 'Fixture airline',
    priceNote: 'return, one adult; baggage not stated', currency: 'GBP',
    departureDate: '2026-11-17', returnDate: '2026-12-01', ...overrides };
}

describe('strict fare-range travel dates', () => {
  it.each([
    [undefined, '2026-12-01'], ['2026-11-17', undefined], ['', '2026-12-01'],
    ['17/11/2026', '2026-12-01'], ['2026-1-17', '2026-12-01'],
    ['2026-11-17T00:00:00Z', '2026-12-01'], ['2026-11-17 ', '2026-12-01'],
    ['2026-02-30', '2026-12-01'], ['2026-11-17', '2026-13-01'],
    ['2026-11-17', '2026-11-17'], ['2026-12-01', '2026-11-17'],
    ['2026-11-17', '01/12/2026'], ['2026-11-17', '2026-02-29'],
  ])('rejects %s / %s', (departureDate, returnDate) => {
    const o = observation({ departureDate, returnDate });
    expect(hasValidFareRangeTravelDates(o)).toBe(false);
    expect(selectFareRangeTravelPeriod([o])).toEqual([]);
  });
  it('accepts real leap days, same-month and cross-year journeys', () => {
    for (const [departureDate, returnDate] of [
      ['2028-02-29', '2028-03-14'], ['2026-11-10', '2026-11-24'], ['2026-12-22', '2027-01-05'],
    ]) expect(hasValidFareRangeTravelDates({ departureDate, returnDate })).toBe(true);
  });
});

describe('one exact travel period', () => {
  it('uses the newest check, not the cheapest period or latest departure', () => {
    const november = observation({ id: 'nov', price: 634, observedDate: '2026-10-06' });
    const december = observation({ id: 'dec', price: 1098, observedDate: '2026-10-16', departureDate: '2026-12-11', returnDate: '2026-12-25' });
    expect(selectFareRangeTravelPeriod([november, december])).toEqual([december]);
    expect(selectFareRangeTravelPeriod([december, { ...november, observedDate: '2026-10-19' }]).map(o => o.id)).toEqual(['nov']);
  });
  it('requires both dates to match and aggregates repeated checks of that pair', () => {
    const old = observation({ id: 'old', observedDate: '2026-10-18' });
    const latest = observation({ id: 'latest', returnDate: '2026-12-08' });
    const same = observation({ id: 'same', observedDate: '2026-10-17', returnDate: '2026-12-08' });
    expect(selectFareRangeTravelPeriod([old, latest, same]).map(o => o.id)).toEqual(['same', 'latest']);
  });
  it('uses lowest same-day price, then dates and ID, independently of input order', () => {
    const a = observation({ id: 'a', price: 400 });
    const b = observation({ id: 'b', price: 400, returnDate: '2026-12-08' });
    const c = observation({ id: 'c', price: 450, departureDate: '2026-12-11', returnDate: '2026-12-25' });
    for (const input of [[a,b,c], [c,b,a], [b,c,a]]) {
      expect(selectFareRangeTravelPeriod(input).map(o => o.id)).toEqual(['a']);
    }
    expect(selectFareRangeTravelPeriod([a, { ...a, id: 'z' }]).map(o => o.id)).toEqual(['a', 'z']);
  });
  it('keeps the global clean preference even when a newer period has only self-transfers', () => {
    const clean = observation({ id: 'clean', observedDate: '2026-10-18' });
    const flagged = observation({ id: 'self', price: 200, priceNote: 'return; self-transfer', departureDate: '2026-12-11', returnDate: '2026-12-25' });
    expect(selectFareRangeTravelPeriod([flagged, clean])).toEqual([clean]);
    expect(selectFareRangeTravelPeriod([flagged])).toEqual([flagged]);
    expect(selectFareRangeTravelPeriod([flagged, { ...clean, departureDate: undefined }])).toEqual([flagged]);
  });
});

describe('range metadata remains scoped and evidence-based', () => {
  it('keeps mixed directness unknown and qualifies different baggage notes within one date pair', () => {
    const dates = { departureDate: '2026-12-15', returnDate: '2026-12-29' };
    fareObservations.push(
      observation({ ...dates, id: 'new-low', price: 500, observedDate: '2026-10-19', source: 'Fixture A', priceNote: 'return; 25kg checked baggage included', fareDirectness: 'direct' }),
      observation({ ...dates, id: 'new-high', price: 600, observedDate: NOW, source: 'Fixture B', priceNote: 'return; baggage not stated', fareDirectness: 'unknown' }),
    );
    const range = getFareRangeSummary('manchester-dubai', 'Economy', NOW)!;
    expect(range).toMatchObject({ ...dates, count: 2, min: 500, max: 600, minimumObservedDate: '2026-10-19',
      earliestDate: '2026-10-19', latestDate: NOW, sources: ['Fixture A', 'Fixture B'], priceNote: 'return; 25kg checked baggage included' });
    expect(range.observedDirectness).toBeUndefined();
    const deal = deals.find(d => d.id === 'man-dxb-economy')!;
    const html = renderToStaticMarkup(DealCard({ deal, nowIso: NOW }));
    expect(html).toContain('Details of the minimum shown: return; 25kg checked baggage included');
    expect(html).toContain('Baggage and fare conditions may differ between checks');
  });

  it('preserves a self-transfer-only cabin and its warning', () => {
    fareObservations.push(observation({ id: 'flagged-business', cabin: 'Business', priceNote: 'return; self-transfer between separate tickets' }));
    const range = getFareRangeSummary('manchester-dubai', 'Business', NOW)!;
    expect(range).toMatchObject({ count: 1, min: 500, departureDate: '2026-11-17', returnDate: '2026-12-01' });
    expect(range.journeyConsequences).toContain('Self-transfer');
  });

  it('separates same-month and cross-year trips without grouping by month or stay length', () => {
    const sameMonth = observation({ id: 'same-month', observedDate: '2026-10-18', departureDate: '2026-11-10', returnDate: '2026-11-24' });
    const crossYear = observation({ id: 'cross-year', departureDate: '2026-12-22', returnDate: '2027-01-05' });
    expect(selectFareRangeTravelPeriod([sameMonth, crossYear])).toEqual([crossYear]);
  });
});

describe('real archive and publication safeguards', () => {
  it('separates Birmingham-Islamabad November and December checks', () => {
    expect(getFareRangeSummary('birmingham-islamabad', 'Economy', NOW)).toMatchObject({
      departureDate: '2026-12-11', returnDate: '2026-12-25', count: 1, min: 1098, max: 1098,
      sources: ['Qatar Airways'], earliestDate: '2026-10-16', latestDate: '2026-10-16', minimumObservedDate: '2026-10-16',
    });
  });
  it('preserves the Manchester-Dubai November range', () => {
    expect(getFareRangeSummary('manchester-dubai', 'Economy', NOW)).toMatchObject({
      departureDate: '2026-11-17', returnDate: '2026-12-01', count: 2, min: 380, max: 444,
      sources: ['Pegasus', 'SWISS'], observedDirectness: 'connecting',
    });
  });
  it('does not let future, incomplete, malformed, wrong-airport or near-departure checks select a period', () => {
    const before = getFareRangeSummary('manchester-dubai', 'Economy', NOW);
    fareObservations.push(
      observation({ id: 'future', observedDate: '2026-10-21' }),
      observation({ id: 'missing', returnDate: undefined }),
      observation({ id: 'invalid', returnDate: '2026-11-31' }),
      observation({ id: 'near', departureDate: '2026-10-30', returnDate: '2026-11-13' }),
      observation({ id: 'airport', sourceUrl: 'https://www.kayak.co.uk/flights/MAN-SHJ/2026-11-17/2026-12-01' }),
    );
    expect(getFareRangeSummary('manchester-dubai', 'Economy', NOW)).toEqual(before);
  });
  it('keeps pending, expired and methodology-excluded evidence blocked', () => {
    expect(getFareRangeSummary('london-gatwick-istanbul', 'Economy', NOW)).toBeNull();
    expect(getFareRangeSummary('manchester-islamabad', 'Economy', '2026-11-17')).toBeNull();
    expect(getPublishableObservationsByRouteAndCabin('london-gatwick-istanbul', 'Economy', NOW)
      .some(o => o.id === 'obs-lgw-ist-economy-20260818-8w-v1')).toBe(false);
  });
  it('returns only a subset of the existing eligible pool for all 89 routes and three cabins', () => {
    expect(routes).toHaveLength(89);
    for (const route of routes) for (const cabin of ['Economy', 'Premium Economy', 'Business'] as const) {
      const pool = getPublishableObservationsByRouteAndCabin(route.slug, cabin, NOW)
        .filter(o => meetsPromotedDepartureLeadTime(o.departureDate, NOW));
      const selected = selectFareRangeTravelPeriod(pool);
      const summary = getFareRangeSummary(route.slug, cabin, NOW);
      if (!selected.length) { expect(summary).toBeNull(); continue; }
      expect(summary?.count).toBe(selected.length);
      expect(new Set(selected.map(o => o.departureDate + '/' + o.returnDate)).size).toBe(1);
      expect(summary?.min).toBe(Math.min(...selected.map(o => o.price)));
      expect(summary?.max).toBe(Math.max(...selected.map(o => o.price)));
    }
  });
});

describe('deal-card travel wording', () => {
  it('separates travel dates from check dates and qualifies the minimum note and fare conditions', () => {
    const deal = deals.find(d => d.id === 'man-dxb-economy')
      ?? deals.find(d => d.fromAirportSlug === 'manchester' && d.toDestinationSlug === 'dubai' && d.cabin === 'Economy')!;
    expect(deal).toBeDefined();
    const html = renderToStaticMarkup(DealCard({ deal, nowIso: NOW }));
    expect(html).toContain('\u00a3380\u2013\u00a3444');
    expect(html).toContain('Travel 17 November 2026\u20131 December 2026');
    expect(html).toContain('From 2 checks since 22 September 2026');
    expect(html).toContain('Fare checks with Pegasus and SWISS');
    expect(html).toContain('Details of the minimum shown:');
    expect(html).toContain('Baggage and fare conditions may differ between checks');
    expect(html).not.toContain('25kg');
  });
  it('shows only the selected December fare with its own dates and attribution', () => {
    const deal: Deal = { id: 'fixture', category: 'flight', cabin: 'Economy', fromAirportSlug: 'birmingham',
      toDestinationSlug: 'islamabad', fromCity: 'Birmingham', toCity: 'Islamabad', toCountry: 'Pakistan', airline: 'Qatar Airways' };
    const html = renderToStaticMarkup(DealCard({ deal, nowIso: NOW }));
    expect(html).toContain('\u00a31,098'); expect(html).not.toContain('\u00a3634'); expect(html).not.toContain('\u00a3667');
    expect(html).toContain('Travel 11 December 2026\u201325 December 2026');
    expect(html).toContain('One check, 16 October 2026'); expect(html).toContain('Fare checked with Qatar Airways');
  });
});
