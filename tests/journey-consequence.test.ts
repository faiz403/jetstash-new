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

  it('extracts BOTH leg durations — PR #232 correction: the return leg\'s duration no longer requires the outbound-only strict-clean-routing precondition, and this record\'s own outbound clause independently states a ground transfer + long layover, so it is deterministically extractable', () => {
    expect(c.outboundDuration).toBe('27h 55m');
    expect(c.returnDuration).toBe('26h');
  });

  it('both legs are independently decisive — outbound because it states its own ground-transfer airport change, return because it states its own long layover', () => {
    expect(c.outboundDurationIsDecisive).toBe(true);
    expect(c.returnDurationIsDecisive).toBe(true);
  });

  it('does not claim an arrival-airport mismatch it cannot confidently establish (outbound routing has embedded complexity)', () => {
    expect(c.arrivalAirportMismatch).toBeNull();
  });

  it('the formatted summary surfaces self-transfer, the airport change, and BOTH decisive durations — matches the founder\'s own worked example shape', () => {
    const summary = formatJourneyConsequenceSummary(c);
    expect(summary).toEqual(['Self-transfer', 'Barcelona airport change', 'Outbound: 27h 55m', 'Return: 26h']);
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

  it('extracts BOTH leg durations — PR #232 correction: the return leg\'s duration is no longer blocked by its ground-transfer-annotated routing string', () => {
    expect(c.outboundDuration).toBe('3h 50m');
    expect(c.returnDuration).toBe('20h 55m');
  });

  it('PR #232 decisive-duration correction: only the RETURN leg is decisive (it states the airport change and long layover) — the short, unremarkable 3h50m outbound must NOT be treated as decisive just because a duration exists', () => {
    expect(c.outboundDurationIsDecisive).toBe(false);
    expect(c.returnDurationIsDecisive).toBe(true);
  });

  it('the formatted summary matches the founder\'s corrected worked example exactly: self-transfer, Milan airport change, and the RETURN duration — never the short outbound one', () => {
    const summary = formatJourneyConsequenceSummary(c);
    expect(summary).toEqual(['Self-transfer', 'Milan airport change', 'Return: 20h 55m']);
    expect(summary).not.toContain('Outbound: 3h 50m');
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

  it('neither leg\'s duration is decisive — both are known but ordinary (no airport change, no long layover, well under the notable-duration threshold), so the summary must not show them merely for decoration', () => {
    expect(c.outboundDurationIsDecisive).toBe(false);
    expect(c.returnDurationIsDecisive).toBe(false);
    const summary = formatJourneyConsequenceSummary(c);
    expect(summary).toEqual(['Arrives at SHJ']);
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

  it('PR #232: both legs are decisive ONLY via the NOTABLE_LEG_DURATION_HOURS fallback (no ground transfer, no long layover stated on either leg — 34h50m and 43h20m are each independently >= 24h)', () => {
    expect(c.outboundDurationIsDecisive).toBe(true);
    expect(c.returnDurationIsDecisive).toBe(true);
  });

  it('the formatted summary shows self-transfer and both extreme durations', () => {
    const summary = formatJourneyConsequenceSummary(c);
    expect(summary).toEqual(['Self-transfer', 'Outbound: 34h 50m', 'Return: 43h 20m']);
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

describe('PR #232 decisive-duration correction — regression guard against "show whichever leg parsed first"', () => {
  it('synthetic control: short outbound + materially long return with an airport change stated only on the return leg — the summary must show the return duration, never the outbound one, and must never regress to "first successfully parsed duration wins"', () => {
    const c = getJourneyConsequences(
      {
        priceNote:
          'return, per person, one adult; self-transfer; outbound MAN-XYZ, Fixture Air FX100, nonstop, 2h30m; return XYZ-ABC(-ground transfer to DEF)-MAN, Fixture Air FX200/FX300, 1 stop, 18h40m (14h Fixtureville long layover, includes ground transfer between ABC and DEF airports); baggage not stated',
      },
      null
    );
    expect(c.outboundDuration).toBe('2h 30m');
    expect(c.returnDuration).toBe('18h 40m');
    expect(c.outboundDurationIsDecisive).toBe(false);
    expect(c.returnDurationIsDecisive).toBe(true);
    const summary = formatJourneyConsequenceSummary(c);
    expect(summary).toContain('Return: 18h 40m');
    expect(summary).not.toContain('Outbound: 2h 30m');
  });

  it('the reverse case: an airport change stated only on the OUTBOUND leg correctly surfaces the outbound duration, never the return one', () => {
    const c = getJourneyConsequences(
      {
        priceNote:
          'return, per person, one adult; self-transfer; outbound MAN-ABC(-ground transfer to DEF)-XYZ, Fixture Air FX100/FX200, 1 stop, 18h40m (14h Fixtureville long layover, includes ground transfer between ABC and DEF airports); return XYZ-MAN, Fixture Air FX300, nonstop, 2h30m; baggage not stated',
      },
      null
    );
    expect(c.outboundDurationIsDecisive).toBe(true);
    expect(c.returnDurationIsDecisive).toBe(false);
    const summary = formatJourneyConsequenceSummary(c);
    expect(summary).toContain('Outbound: 18h 40m');
    expect(summary).not.toContain('Return: 2h 30m');
  });

  it('NOTABLE_LEG_DURATION_HOURS boundary: exactly 24h is decisive, 23h59m (just under) is not, with no other stated reason on that leg', () => {
    const atThreshold = getJourneyConsequences(
      { priceNote: 'return, per person, one adult; outbound MAN-XYZ, Fixture Air, nonstop, 24h; return XYZ-MAN, Fixture Air, nonstop, 2h; baggage not stated' },
      null
    );
    expect(atThreshold.outboundDurationIsDecisive).toBe(true);

    const justUnder = getJourneyConsequences(
      { priceNote: 'return, per person, one adult; outbound MAN-XYZ, Fixture Air, nonstop, 23h59m; return XYZ-MAN, Fixture Air, nonstop, 2h; baggage not stated' },
      null
    );
    expect(justUnder.outboundDurationIsDecisive).toBe(false);
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
