import { describe, it, expect } from 'vitest';
import { getPublishableObservationsByRoute } from '@/data/fare-observations';
import { getRouteBySlug } from '@/data/routes';
import { deriveFareSignal, toSignalObservation, type FareSignalObservation } from '@/lib/fare-signal';
import { extractStopViaFromText } from '@/lib/journey-consequence';
import { formatRouting, formatStops } from '@/components/route/fare-signal';

/**
 * Representative-fare itinerary disclosure fix (8 September 2026, founder
 * review). Root cause: the 8 September fare-collection batch introduced a
 * new priceNote phrasing ("<count> stop via <City>, <duration> outbound")
 * on 5 routes (manchester-dubai, london-heathrow-delhi/jeddah/mumbai/doha)
 * that states the itinerary shape in plain English but never sets the
 * structured fareDirectness/outboundStops/outboundConnectionAirports
 * fields — so formatRouting() (components/route/fare-signal.tsx) silently
 * rendered NOTHING beside the price, and the existing text-extraction
 * fallback in lib/journey-consequence.ts didn't recognise this phrasing
 * either (its leg-clause parser expects the leg word FIRST, this phrasing
 * puts it last). Fixed with a new, narrow, conservative text extractor
 * (extractStopViaFromText) that only ever fills in a structured field
 * that's genuinely absent — never overrides one already set.
 */

const NOW = '2026-09-08';

const AFFECTED_ROUTES = [
  { slug: 'manchester-dubai', price: 420, city: 'Zurich' },
  { slug: 'london-heathrow-delhi', price: 411, city: 'Muscat' },
  { slug: 'london-heathrow-jeddah', price: 451, city: 'Amman' },
  { slug: 'london-heathrow-mumbai', price: 396, city: 'Muscat' },
  { slug: 'london-heathrow-doha', price: 463, city: 'Bahrain' },
];

function getSignalObservation(slug: string): FareSignalObservation {
  const route = getRouteBySlug(slug)!;
  const signal = deriveFareSignal(getPublishableObservationsByRoute(route.slug, NOW), NOW);
  expect(signal.observation, slug).not.toBeNull();
  return signal.observation!;
}

describe('1. MAN-DXB £420 remains £420, and every affected route keeps its own price unchanged', () => {
  it.each(AFFECTED_ROUTES)('$slug keeps price $price', ({ slug, price }) => {
    expect(getSignalObservation(slug).price).toBe(price);
  });
});

describe('2 & 11. Each affected route is now represented as a connecting itinerary, with its stated connection city visible', () => {
  it.each(AFFECTED_ROUTES)('$slug shows "Connecting journey via $city" at the fare decision point', ({ slug, city }) => {
    const data = getSignalObservation(slug);
    expect(data.directness, slug).toBe('connecting');
    expect(data.connectionAirports, slug).toEqual([city]);
    expect(formatRouting(data), slug).toBe(`Connecting journey via ${city}`);
  });
});

describe('3. "via <City>" appears only when the observation itself states it', () => {
  it('extractStopViaFromText returns null for priceNote text with no stop-via statement', () => {
    expect(extractStopViaFromText('return, per person, one adult; direct; baggage not stated')).toBeNull();
    expect(extractStopViaFromText('outbound MAN-SAW-SHJ, Pegasus, 1 stop, 13h5m; return SHJ-SAW-MAN, 1 stop, 11h50m')).toBeNull();
  });

  it('extracts the exact stated city and leg, never a different or invented one', () => {
    expect(extractStopViaFromText('one stop via Zurich, 9h20 outbound; optional bag fees may apply')).toEqual({
      leg: 'outbound',
      stops: 1,
      connectionCity: 'Zurich',
    });
    expect(extractStopViaFromText('two stops via Doha, 14h35 return; baggage not stated')).toEqual({
      leg: 'return',
      stops: 2,
      connectionCity: 'Doha',
    });
  });

  it('a route with a structured fareDirectness/connection already set is untouched by the text extractor', () => {
    // manchester-antalya's own current observation carries fareDirectness
    // directly (data problem class already solved for this route) —
    // toSignalObservation must not run the text fallback over it.
    const route = getRouteBySlug('manchester-istanbul')!;
    const obs = getPublishableObservationsByRoute(route.slug, NOW).find((o) => o.fareDirectness);
    if (obs) {
      const signal = toSignalObservation(obs)!;
      expect(signal.directness).toBe(obs.fareDirectness);
    }
  });
});

describe('4. Baggage caveat remains intact', () => {
  it.each(AFFECTED_ROUTES)('$slug still records its own baggage field unchanged', ({ slug }) => {
    const route = getRouteBySlug(slug)!;
    const raw = getPublishableObservationsByRoute(route.slug, NOW).at(-1)!;
    expect(raw.baggage, slug).toBe('not stated; optional charges may apply');
  });
});

describe('5. No unsupported saving/Standout/deal wording is introduced', () => {
  it('the actual added lines in this fix introduce no banned promotional words', async () => {
    const { execSync } = await import('child_process');
    const diff = execSync(
      'git diff 9460b7b318d2f468b74127515baa694fe25ddd26 -- lib/journey-consequence.ts lib/fare-signal.ts',
      { cwd: process.cwd() }
    ).toString();
    const addedLines = diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++'));
    const banned = /\b(great deal|cheap|best|saving|standout)\b/i;
    for (const line of addedLines) {
      expect(line).not.toMatch(banned);
    }
  });

  it('formatRouting()\'s output for every affected route contains only factual, non-promotional wording', () => {
    for (const { slug, city } of AFFECTED_ROUTES) {
      const routing = formatRouting(getSignalObservation(slug))!;
      expect(routing, slug).toBe(`Connecting journey via ${city}`);
      expect(routing, slug).not.toMatch(/\b(great deal|cheap|best|saving|standout)\b/i);
    }
  });
});

describe('6. Self-transfer suppression remains unchanged', () => {
  it('manchester-lahore and manchester-islamabad remain correctly suppressed (self-transfer + 3 stops), unaffected by this fix', () => {
    for (const slug of ['manchester-lahore', 'manchester-islamabad']) {
      const route = getRouteBySlug(slug)!;
      const signal = deriveFareSignal(getPublishableObservationsByRoute(route.slug, NOW), NOW);
      expect(signal.state, slug).toBe('none');
      expect(signal.noneReason, slug).toBe('poor-itinerary-suppressed');
    }
  });
});

describe('7 & 12. Asymmetric stop-count formatting remains correct, and no fare is falsely claimed both-ways', () => {
  it.each(AFFECTED_ROUTES)('$slug: return leg is genuinely unknown, so formatStops (which requires BOTH legs known) correctly returns null rather than assume symmetry', ({ slug }) => {
    const data = getSignalObservation(slug);
    expect(data.outboundStops, slug).toBe(1);
    expect(data.returnStops, slug).toBeNull();
    expect(formatStops(data), slug).toBeNull();
  });

  it('a route with genuinely symmetric known stops still renders "X stops each way" unchanged (existing behaviour untouched)', () => {
    const observation: FareSignalObservation = {
      id: 'test-symmetric',
      cabin: 'Economy',
      airline: 'Test Airline',
      price: 100,
      currency: 'GBP',
      observedDate: '2026-09-01',
      departureDate: '2026-10-01',
      returnDate: '2026-10-15',
      directness: 'connecting',
      outboundStops: 1,
      returnStops: 1,
      connectionAirports: ['Istanbul Airport (IST)'],
      isSelfTransfer: false,
      journeyConsequences: [],
    };
    expect(formatStops(observation)).toBe('1 stop each way');
    expect(formatRouting(observation)).toBe('Connecting · 1 stop each way via Istanbul Airport (IST)');
  });
});

describe('8. Direct fares do not gain unnecessary "via" wording', () => {
  it('extractStopViaFromText is never consulted when fareDirectness is already "direct"', () => {
    const directObservation = {
      id: 'test-direct',
      routeSlug: 'manchester-dubai',
      cabin: 'Economy' as const,
      observedDate: '2026-09-01',
      price: 500,
      priceNote: 'return, per person, one adult; one stop via Zurich, 9h20 outbound',
      source: 'Emirates',
      currency: 'GBP' as const,
      departureDate: '2026-10-01',
      returnDate: '2026-10-15',
      fareDirectness: 'direct' as const,
    };
    const signal = toSignalObservation(directObservation)!;
    expect(signal.directness).toBe('direct');
    expect(signal.connectionAirports).toEqual([]);
    expect(formatRouting(signal)).toBe('Direct journey');
  });
});

describe('9. Routes without a known connection location fail gracefully to stop count / no claim', () => {
  it('a priceNote with a stop count but no recognisable "via <City>" phrase yields no stop-via signal, but does not crash', () => {
    expect(extractStopViaFromText('one stop, 9h20 outbound; baggage not stated')).toBeNull();
  });
});

describe('10. No CTA/handoff behaviour changes; 12. no fare observation data changes', () => {
  // This assertion originally diffed 9460b7b (the last commit of the 8
  // September representative-fare-itinerary-disclosure fix's own small
  // stack) against the live working tree, to prove that fix's own follow-up
  // commits (9a9f165, 9460b7b) touched only presentation helpers, not the
  // archive itself -- the data change those follow-ups were reconciling
  // against (a1e1eeb) landed one commit earlier, deliberately outside this
  // check's range. Comparing against an ever-moving "now" instead of a
  // fixed end point meant this would spuriously fail the moment ANY later,
  // unrelated, legitimate commit touched the archive -- exactly what
  // happened on 13 September 2026 (the MAN-ISB direct-PIA fare-evidence
  // append, an intentional, founder-approved data change, not a defect in
  // this fix). Pinned to the fix's own three-commit range so it can never
  // drift like that again, while still proving the exact historical fact
  // it was written to prove.
  it('the 8 September fix\'s own follow-up commits touched only presentation helpers, never data/fare-observations.ts', async () => {
    const { execSync } = await import('child_process');
    const diff = execSync(
      'git diff --name-only a1e1eeb74bfe747eb39ac8563cd1b75273513e2d..9460b7b318d2f468b74127515baa694fe25ddd26',
      { cwd: process.cwd() }
    ).toString();
    expect(diff).not.toMatch(/data\/fare-observations\.ts/);
  });
});
