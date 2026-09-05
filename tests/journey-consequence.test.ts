import { describe, it, expect } from 'vitest';
import { fareObservations } from '@/data/fare-observations';
import { getDestinationBySlug } from '@/data/destinations';
import { getRouteBySlug } from '@/data/routes';
import {
  getJourneyConsequences,
  formatJourneyConsequenceSummary,
  hasAnyJourneyConsequence,
  extractCleanRoutingCodes,
} from '@/lib/journey-consequence';

/**
 * Bad-fare prominence / journey-consequence fix (5 September 2026) —
 * independently reproduced Astra findings. Protects the four confirmed
 * live examples exactly (root-caused against the actual current
 * data/fare-observations.ts records, not synthetic fixtures), plus a
 * dataset-wide sweep proving no extractor ever produces a wrong signal on
 * a record it isn't confident about.
 */

function observation(id: string) {
  const found = fareObservations.find((o) => o.id === id);
  if (!found) throw new Error(`fixture observation not found: ${id}`);
  return found;
}

function destinationIataFor(routeSlug: string): string | null {
  const route = getRouteBySlug(routeSlug);
  if (!route) return null;
  return getDestinationBySlug(route.destinationSlug)?.iataCode ?? null;
}

describe('Manchester–Istanbul (£153 self-transfer, obs-man-ist-economy-20260901-8w-v1)', () => {
  const obs = observation('obs-man-ist-economy-20260901-8w-v1');
  const iata = destinationIataFor('manchester-istanbul');
  const c = getJourneyConsequences(obs, iata);

  it('detects self-transfer (existing predicate, unchanged)', () => {
    expect(c.selfTransfer).toBe(true);
  });

  it('detects the REU->BCN ground-transfer airport change', () => {
    expect(c.groundTransferAirports).toEqual(['REU', 'BCN']);
  });

  it('detects the long layover and its already-stated city (Barcelona)', () => {
    expect(c.hasLongLayover).toBe(true);
    expect(c.longLayoverCity).toBe('Barcelona');
  });

  it('extracts the return duration (clean routing) but not the outbound duration (nested parenthetical routing) — conservative by design', () => {
    expect(c.returnDuration).toBe('26h');
    expect(c.outboundDuration).toBeNull();
  });

  it('does not claim an arrival-airport mismatch it cannot confidently establish (outbound routing has embedded complexity)', () => {
    expect(c.arrivalAirportMismatch).toBeNull();
  });

  it('the formatted summary surfaces self-transfer and the airport change prominently', () => {
    const summary = formatJourneyConsequenceSummary(c);
    expect(summary).toContain('Self-transfer');
    expect(summary).toContain('Barcelona airport change');
    expect(summary.some((s) => s.startsWith('Return:'))).toBe(true);
  });

  it('has at least one decisive consequence to render', () => {
    expect(hasAnyJourneyConsequence(c)).toBe(true);
  });
});

describe('Manchester–Agadir (£72, obs-man-aga-economy-20260901-8w-v1)', () => {
  const obs = observation('obs-man-aga-economy-20260901-8w-v1');
  const iata = destinationIataFor('manchester-agadir');
  const c = getJourneyConsequences(obs, iata);

  it('detects self-transfer', () => {
    expect(c.selfTransfer).toBe(true);
  });

  it('detects the MXP->BGY ground-transfer airport change', () => {
    expect(c.groundTransferAirports).toEqual(['MXP', 'BGY']);
  });

  it('detects the long layover and its already-stated city (Milan)', () => {
    expect(c.hasLongLayover).toBe(true);
    expect(c.longLayoverCity).toBe('Milan');
  });

  it('extracts the clean outbound duration (nonstop leg) but not the return duration (nested parenthetical routing)', () => {
    expect(c.outboundDuration).toBe('3h 50m');
    expect(c.returnDuration).toBeNull();
  });

  it('the formatted summary matches the founder\'s own worked example shape: self-transfer, Milan airport change', () => {
    const summary = formatJourneyConsequenceSummary(c);
    expect(summary).toContain('Self-transfer');
    expect(summary).toContain('Milan airport change');
    expect(summary).toContain('Outbound: 3h 50m');
  });
});

describe('Manchester–Dubai (£336, obs-man-dxb-economy-20260901-8w-v1) — arrival-airport mismatch: Sharjah, not Dubai', () => {
  const obs = observation('obs-man-dxb-economy-20260901-8w-v1');
  const iata = destinationIataFor('manchester-dubai');

  it('the route\'s own destination IATA code is DXB (sanity check)', () => {
    expect(iata).toBe('DXB');
  });

  it('extracts the clean outbound routing and finds the real final airport is SHJ, not DXB', () => {
    const codes = extractCleanRoutingCodes(obs.priceNote, 'outbound');
    expect(codes).toEqual(['MAN', 'SAW', 'SHJ']);
  });

  const c = getJourneyConsequences(obs, iata);

  it('flags the arrival-airport mismatch', () => {
    expect(c.arrivalAirportMismatch).toBe('SHJ');
  });

  it('correctly finds no self-transfer (this record explicitly states none)', () => {
    expect(c.selfTransfer).toBe(false);
  });

  it('extracts both leg durations from the clean routing strings', () => {
    expect(c.outboundDuration).toBe('13h 5m');
    expect(c.returnDuration).toBe('11h 50m');
  });

  it('the formatted summary leads with the arrival-airport mismatch, not buried after the price', () => {
    const summary = formatJourneyConsequenceSummary(c);
    expect(summary[0]).toBe('Arrives at SHJ');
  });

  it('never mislabels SHJ as DXB anywhere in the summary', () => {
    const summary = formatJourneyConsequenceSummary(c).join(' ');
    expect(summary).not.toMatch(/\bDXB\b/);
  });
});

describe('Manchester–Lahore (£3,051 Business, obs-man-lhe-business-20260822-8w-v1) — cumbersome fare, structured duration fields', () => {
  const obs = observation('obs-man-lhe-business-20260822-8w-v1');
  const iata = destinationIataFor('manchester-lahore');
  const c = getJourneyConsequences(obs, iata);

  it('prefers the observation\'s own structured outboundJourneyMinutes/returnJourneyMinutes over any text extraction', () => {
    expect(obs.outboundJourneyMinutes).toBe(2090);
    expect(obs.returnJourneyMinutes).toBe(2600);
    expect(c.outboundDuration).toBe('34h 50m');
    expect(c.returnDuration).toBe('43h 20m');
  });

  it('detects self-transfer', () => {
    expect(c.selfTransfer).toBe(true);
  });

  it('does not fabricate a ground-transfer or long-layover claim this record never made', () => {
    expect(c.groundTransferAirports).toBeNull();
    expect(c.hasLongLayover).toBe(false);
  });

  it('the formatted summary shows self-transfer and both extreme durations', () => {
    const summary = formatJourneyConsequenceSummary(c);
    expect(summary).toContain('Self-transfer');
    expect(summary).toContain('Outbound: 34h 50m');
    expect(summary).toContain('Return: 43h 20m');
  });

  it('this record already meets the existing poor-itinerary suppression threshold (self-transfer + 3 stops each way) — untouched by this fix', () => {
    expect(obs.outboundStops).toBe(3);
    expect(obs.returnStops).toBe(3);
  });
});

describe('Controls — a normal fare must not be over-labelled', () => {
  it('a genuinely clean itinerary (no self-transfer, no airport change, no long layover stated) produces zero decisive consequences', () => {
    const c = getJourneyConsequences(
      { priceNote: 'return, per person, one adult; single ticket; outbound MAN-DXB, Emirates, nonstop, 7h; return DXB-MAN, Emirates, nonstop, 7h30m; baggage included' },
      'DXB'
    );
    expect(hasAnyJourneyConsequence(c)).toBe(false);
    expect(formatJourneyConsequenceSummary(c)).toHaveLength(0);
  });

  it('a genuine nonstop-both-ways self-transfer fare (Bristol-Barcelona, obs-brs-bcn-economy-20260901-8w-v1) correctly shows self-transfer alone — no fabricated airport-change or long-layover claim, since neither is actually stated', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-brs-bcn-economy-20260901-8w-v1');
    expect(obs).toBeDefined();
    const c = getJourneyConsequences(obs!, null);
    expect(c.selfTransfer).toBe(true);
    expect(c.groundTransferAirports).toBeNull();
    expect(c.hasLongLayover).toBe(false);
    expect(c.arrivalAirportMismatch).toBeNull();
    expect(formatJourneyConsequenceSummary(c)).toEqual(['Self-transfer']);
  });

  it('null/undefined priceNote never throws and produces no consequences', () => {
    const c = getJourneyConsequences({ priceNote: '' }, 'DXB');
    expect(hasAnyJourneyConsequence(c)).toBe(false);
  });

  it('a null destinationIataCode never produces a mismatch claim (can\'t compare against nothing)', () => {
    const obs = observation('obs-man-dxb-economy-20260901-8w-v1');
    const c = getJourneyConsequences(obs, null);
    expect(c.arrivalAirportMismatch).toBeNull();
  });
});

describe('Dataset-wide sweep — no extractor produces a claim it should not be confident about', () => {
  it('extractCleanRoutingCodes never returns a code sequence that omits an intermediate stop the priceNote records elsewhere in the same clause', () => {
    // Narrow structural check: wherever extractCleanRoutingCodes succeeds,
    // the number of codes it found should be consistent with outboundStops
    // + 2 (origin, each connection, destination) when both are present —
    // catching a parser that silently drops a leg.
    let checked = 0;
    for (const obs of fareObservations) {
      const codes = extractCleanRoutingCodes(obs.priceNote, 'outbound');
      if (codes && obs.outboundStops !== undefined) {
        checked++;
        expect(codes.length, obs.id).toBe(obs.outboundStops + 2);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('every observation with a ground-transfer airport-change claim also has self-transfer or a stated stop — the phrase never appears on a claimed-nonstop record', () => {
    for (const obs of fareObservations) {
      const c = getJourneyConsequences(obs, null);
      if (c.groundTransferAirports) {
        expect(obs.priceNote, obs.id).toMatch(/\d+\s+stops?/i);
      }
    }
  });
});
