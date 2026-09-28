import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PAKISTAN_AIRPORTS, PAKISTAN_AIRPORT_CODES, getPakistanAirport } from '@/lib/arrive-by-pakistan/airports';
import { localDateTimeToIso, isoToClock } from '@/lib/arrive-by-pakistan/timezone';
import { classifyOutcome, outcomeVerdict, PROVISIONAL_TIGHT_MARGIN_THRESHOLD_MINUTES } from '@/lib/arrive-by-pakistan/outcomes';
import { geocodeDestination, computeDriveRoute } from '@/lib/arrive-by-pakistan/google-routes';
import { computePakistanJourney } from '@/lib/arrive-by-pakistan/journey';
import { deriveResolvedPrimaryPlace, extractPrimaryInputPlace, placesMatch } from '@/lib/arrive-by-pakistan/destination-identity';

describe('airport configuration', () => {
  it('configures exactly ISB, LHE and KHI', () => {
    expect(PAKISTAN_AIRPORT_CODES.sort()).toEqual(['ISB', 'KHI', 'LHE']);
  });

  it('every airport uses Asia/Karachi and a free-text routing address, never a hand-typed coordinate', () => {
    for (const code of PAKISTAN_AIRPORT_CODES) {
      const airport = getPakistanAirport(code);
      expect(airport.timeZone).toBe('Asia/Karachi');
      expect(typeof airport.routingAddress).toBe('string');
      expect(airport.routingAddress.length).toBeGreaterThan(5);
      expect(airport.routingAddress).not.toMatch(/^-?\d+\.\d+,\s*-?\d+\.\d+$/);
    }
  });

  it('ISB is configured as Islamabad International Airport', () => {
    expect(PAKISTAN_AIRPORTS.ISB.displayName).toBe('Islamabad International Airport');
  });

  it('LHE and KHI are valid configured origins (configuration only — road behaviour is not claimed to be validated by this)', () => {
    expect(PAKISTAN_AIRPORTS.LHE.displayName).toContain('Lahore');
    expect(PAKISTAN_AIRPORTS.KHI.displayName).toContain('Karachi');
  });
});

describe('timezone handling — Asia/Karachi, no DST', () => {
  it('converts a local Pakistan date/time to the correct UTC instant', () => {
    // Pakistan Standard Time is UTC+5 year-round.
    const iso = localDateTimeToIso('2026-11-17T12:00', 'Asia/Karachi');
    expect(iso).toBe('2026-11-17T07:00:00.000Z');
  });

  it('formats an ISO instant back into Pakistan local clock time', () => {
    expect(isoToClock('2026-11-17T07:00:00.000Z', 'Asia/Karachi')).toBe('12:00');
  });

  it('rejects a malformed date/time string rather than silently misparsing it', () => {
    expect(() => localDateTimeToIso('not-a-date', 'Asia/Karachi')).toThrow();
  });

  it('does not depend on the server/browser\'s own local timezone', () => {
    const iso = localDateTimeToIso('2026-06-01T09:30', 'Asia/Karachi');
    // 09:30 PKT (UTC+5) is 04:30 UTC, regardless of what zone this test runs in.
    expect(iso).toBe('2026-06-01T04:30:00.000Z');
  });
});

describe('outcome classification', () => {
  it('classifies a confirmed destination with no deadline as ETA_ONLY', () => {
    expect(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: false })).toBe('ETA_ONLY');
  });

  it('classifies a comfortable margin as BEFORE_DEADLINE', () => {
    expect(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: true, marginMinutes: 45 })).toBe(
      'BEFORE_DEADLINE',
    );
  });

  it('classifies a margin at the tight threshold as TIGHT_MARGIN, not BEFORE_DEADLINE', () => {
    expect(
      classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: true, marginMinutes: PROVISIONAL_TIGHT_MARGIN_THRESHOLD_MINUTES }),
    ).toBe('TIGHT_MARGIN');
  });

  it('classifies a negative margin as AFTER_DEADLINE', () => {
    expect(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: true, marginMinutes: -5 })).toBe(
      'AFTER_DEADLINE',
    );
  });

  it('classifies a needs-clarification destination as DESTINATION_NEEDS_CLARIFICATION regardless of route/deadline state', () => {
    expect(classifyOutcome({ destinationConfidence: 'NEEDS_CLARIFICATION', routeAvailable: true, hasDeadline: true, marginMinutes: 100 })).toBe(
      'DESTINATION_NEEDS_CLARIFICATION',
    );
  });

  it('classifies an unresolved destination as ROUTE_UNAVAILABLE', () => {
    expect(classifyOutcome({ destinationConfidence: 'UNRESOLVED', routeAvailable: false, hasDeadline: false })).toBe('ROUTE_UNAVAILABLE');
  });

  it('classifies a confirmed destination with no usable route as ROUTE_UNAVAILABLE', () => {
    expect(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: false, hasDeadline: false })).toBe('ROUTE_UNAVAILABLE');
  });

  it('never uses forbidden overstated wording', () => {
    for (const outcome of [
      'ETA_ONLY', 'BEFORE_DEADLINE', 'TIGHT_MARGIN', 'AFTER_DEADLINE', 'DESTINATION_NEEDS_CLARIFICATION', 'ROUTE_UNAVAILABLE',
    ] as const) {
      const verdict = outcomeVerdict({ outcome, destination: 'Mirpur', arrivalClock: '16:40', deadlineClock: '17:00', marginMinutes: 20 });
      const lower = verdict.toLowerCase();
      for (const forbidden of ['guaranteed', 'definitely', 'impossible', 'safe']) {
        expect(lower, `${outcome}: "${verdict}"`).not.toContain(forbidden);
      }
    }
  });
});

const originalFetch = global.fetch;

function mockGeocode(payload: unknown) {
  global.fetch = vi.fn(async (url: string | URL) => {
    if (String(url).includes('maps.googleapis.com/maps/api/geocode')) {
      return new Response(JSON.stringify(payload), { status: 200 });
    }
    return new Response(JSON.stringify({ routes: [{ duration: '3600s', distanceMeters: 90000 }] }), { status: 200 });
  }) as unknown as typeof fetch;
}

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('destination geocoding confidence', () => {
  it('classifies a clean, single, precisely-typed result as CONFIRMED', async () => {
    mockGeocode({
      status: 'OK',
      results: [{ formatted_address: 'Mirpur, AJK, Pakistan', place_id: 'abc', types: ['locality'], geometry: { location_type: 'APPROXIMATE' } }],
    });
    const result = await geocodeDestination('test-key', 'Mirpur');
    expect(result.confidence).toBe('CONFIRMED');
  });

  it('classifies a partial match as NEEDS_CLARIFICATION', async () => {
    mockGeocode({
      status: 'OK',
      results: [{ formatted_address: 'Somewhere else', partial_match: true, types: ['locality'], geometry: { location_type: 'APPROXIMATE' } }],
    });
    const result = await geocodeDestination('test-key', 'a vague place');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
  });

  it('classifies an overly broad place type (country/province) as NEEDS_CLARIFICATION', async () => {
    mockGeocode({ status: 'OK', results: [{ formatted_address: 'Pakistan', types: ['country'], geometry: { location_type: 'APPROXIMATE' } }] });
    const result = await geocodeDestination('test-key', 'Pakistan');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
  });

  it('classifies multiple ambiguous candidates as NEEDS_CLARIFICATION', async () => {
    mockGeocode({
      status: 'OK',
      results: [
        { formatted_address: 'Candidate A', types: ['locality'], geometry: { location_type: 'APPROXIMATE' } },
        { formatted_address: 'Candidate B', types: ['locality'], geometry: { location_type: 'APPROXIMATE' } },
      ],
    });
    const result = await geocodeDestination('test-key', 'ambiguous name');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
  });

  it('classifies zero results as UNRESOLVED', async () => {
    mockGeocode({ status: 'ZERO_RESULTS', results: [] });
    const result = await geocodeDestination('test-key', 'gibberish nonsense place');
    expect(result.confidence).toBe('UNRESOLVED');
  });

  it('classifies a network failure as UNRESOLVED, never throwing', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const result = await geocodeDestination('test-key', 'Mirpur');
    expect(result.confidence).toBe('UNRESOLVED');
  });

  it('classifies a district-level match (administrative_area_level_2) alone as NEEDS_CLARIFICATION', async () => {
    mockGeocode({
      status: 'OK',
      results: [{ formatted_address: 'Mirpur District, AJK, Pakistan', types: ['administrative_area_level_2', 'political'], geometry: { location_type: 'APPROXIMATE' } }],
    });
    const result = await geocodeDestination('test-key', 'Mirpur District');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('TOO_BROAD_TYPE');
  });

  it('an APPROXIMATE location_type with a correctly-matching locality is still CONFIRMED — APPROXIMATE alone is not a failure signal', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'New Mirpur City',
        types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [{ long_name: 'New Mirpur City', short_name: 'New Mirpur City', types: ['locality', 'political'] }],
      }],
    });
    const result = await geocodeDestination('test-key', 'Mirpur, Azad Jammu and Kashmir, Pakistan');
    expect(result.confidence).toBe('CONFIRMED');
    expect(result.locationType).toBe('APPROXIMATE');
  });
});

describe('primary-place identity guard — live ISB evidence: Chakswari resolved to New Mirpur City', () => {
  it('extractPrimaryInputPlace takes only the first comma-separated segment, normalized', () => {
    expect(extractPrimaryInputPlace('Chakswari, Mirpur, Azad Kashmir, Pakistan')).toBe('chakswari');
    expect(extractPrimaryInputPlace('Mirpur, Azad Jammu and Kashmir, Pakistan')).toBe('mirpur');
    expect(extractPrimaryInputPlace('Dadyal')).toBe('dadyal');
  });

  it('deriveResolvedPrimaryPlace prefers sublocality over locality — real Saddar/Rawalpindi data has both', () => {
    const components = [
      { long_name: 'Saddar', short_name: 'Saddar', types: ['political', 'sublocality', 'sublocality_level_1'] },
      { long_name: 'Rawalpindi', short_name: 'Rawalpindi', types: ['locality', 'political'] },
      { long_name: 'Punjab', short_name: 'Punjab', types: ['administrative_area_level_1', 'political'] },
    ];
    // Locality alone would wrongly pick "Rawalpindi" (the parent city) over
    // "Saddar" (the specific neighbourhood the traveller actually named).
    expect(deriveResolvedPrimaryPlace(components)).toBe('Saddar');
  });

  it('placesMatch is normalized substring containment, not a whole-string token-overlap check', () => {
    expect(placesMatch('mirpur', 'New Mirpur City')).toBe(true);
    expect(placesMatch('dadyal', 'Dadyal')).toBe(true);
    expect(placesMatch('saddar', 'Saddar')).toBe(true);
    // The exact live failure: "Chakswari" must NOT match "New Mirpur City"
    // even though the whole input string shares the word "Mirpur".
    expect(placesMatch('chakswari', 'New Mirpur City')).toBe(false);
  });

  it('Mirpur resolving to New Mirpur City is CONFIRMED — the requested identity is retained', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'New Mirpur City',
        types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [{ long_name: 'New Mirpur City', short_name: 'New Mirpur City', types: ['locality', 'political'] }],
      }],
    });
    const result = await geocodeDestination('test-key', 'Mirpur, Azad Jammu and Kashmir, Pakistan');
    expect(result.confidence).toBe('CONFIRMED');
    expect(result.resolvedPrimaryPlace).toBe('New Mirpur City');
  });

  it('Dadyal resolving to bare Dadyal is CONFIRMED', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Dadyal',
        types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [{ long_name: 'Dadyal', short_name: 'Dadyal', types: ['locality', 'political'] }],
      }],
    });
    const result = await geocodeDestination('test-key', 'Dadyal, Azad Jammu and Kashmir, Pakistan');
    expect(result.confidence).toBe('CONFIRMED');
  });

  it('Saddar resolving to Saddar, Rawalpindi is CONFIRMED — the sublocality match, not the parent locality', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Saddar, Rawalpindi, 46000, Pakistan',
        types: ['political', 'sublocality', 'sublocality_level_1'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [
          { long_name: 'Saddar', short_name: 'Saddar', types: ['political', 'sublocality', 'sublocality_level_1'] },
          { long_name: 'Rawalpindi', short_name: 'Rawalpindi', types: ['locality', 'political'] },
        ],
      }],
    });
    const result = await geocodeDestination('test-key', 'Saddar, Rawalpindi, Pakistan');
    expect(result.confidence).toBe('CONFIRMED');
  });

  it('Chakswari resolving to New Mirpur City is NEEDS_CLARIFICATION — the exact live failure this guard exists for', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'New Mirpur City',
        types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [{ long_name: 'New Mirpur City', short_name: 'New Mirpur City', types: ['locality', 'political'] }],
      }],
    });
    const result = await geocodeDestination('test-key', 'Chakswari, Mirpur, Azad Kashmir, Pakistan');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('PRIMARY_PLACE_MISMATCH');
    expect(result.formattedAddress).toBe('New Mirpur City');
  });

  it('a misspelling Google itself auto-corrects ("Mirpore" -> "Mirpur") still returns NEEDS_CLARIFICATION — known, deliberate, safe-direction founder-beta limitation, not a bug to silently fix', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Mirpur',
        types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [{ long_name: 'Mirpur', short_name: 'Mirpur', types: ['locality', 'political'] }],
      }],
    });
    const result = await geocodeDestination('test-key', 'Mirpore, Azad Kashmir, Pakistan');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('PRIMARY_PLACE_MISMATCH');
  });
});

describe('drive route computation', () => {
  it('returns AVAILABLE with parsed duration/distance on a normal response', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ routes: [{ duration: '5400s', distanceMeters: 120000 }] }), { status: 200 })) as unknown as typeof fetch;
    const result = await computeDriveRoute('test-key', 'Islamabad International Airport, Pakistan', 'Mirpur, AJK, Pakistan', '2026-11-17T07:00:00.000Z');
    expect(result.status).toBe('AVAILABLE');
    expect(result.durationSeconds).toBe(5400);
    expect(result.distanceMeters).toBe(120000);
  });

  it('fails closed to UNAVAILABLE on a malformed response rather than inventing a duration', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ routes: [] }), { status: 200 })) as unknown as typeof fetch;
    const result = await computeDriveRoute('test-key', 'origin', 'destination', '2026-11-17T07:00:00.000Z');
    expect(result.status).toBe('UNAVAILABLE');
    expect(result.durationSeconds).toBeUndefined();
  });

  it('fails closed to UNAVAILABLE on a network error, never throwing', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('timeout');
    }) as unknown as typeof fetch;
    const result = await computeDriveRoute('test-key', 'origin', 'destination', '2026-11-17T07:00:00.000Z');
    expect(result.status).toBe('UNAVAILABLE');
  });
});

describe('full journey calculation', () => {
  beforeEach(() => {
    mockGeocode({
      status: 'OK',
      results: [{ formatted_address: 'Mirpur, AJK, Pakistan', place_id: 'abc', types: ['locality'], geometry: { location_type: 'APPROXIMATE' } }],
    });
  });

  it('returns an ETA-only outcome with no deadline supplied', async () => {
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Mirpur',
      pickupMode: 'family',
      pickupWaitMinutes: 0,
    });
    expect(result.outcome).toBe('ETA_ONLY');
    expect(result.expectedArrival).toBeDefined();
    expect(result.marginMinutes).toBeUndefined();
    expect(result.deadline).toBeUndefined();
  });

  it('computes readyOutsideAirport and roadDeparture from landing time, exit buffer and pickup wait, in Pakistan time', async () => {
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Mirpur',
      pickupMode: 'arrange-after-landing',
      pickupWaitMinutes: 20,
    });
    expect(result.readyOutsideAirport).toBe('2026-11-17T08:00:00.000Z'); // 12:00 + 60min landing, minus 5h PKT offset = 07:00Z; +60min = 08:00Z
    expect(result.roadDeparture).toBe('2026-11-17T08:20:00.000Z');
  });

  it('produces a deadline judgement with margin when a deadline is supplied', async () => {
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Mirpur',
      pickupMode: 'family',
      pickupWaitMinutes: 0,
      deadline: '2026-11-17T17:00',
      destinationReadinessBufferMinutes: 30,
    });
    // ready 13:00 -> drive 3600s (1h, from the shared mock) -> expected arrival 14:00
    // latest acceptable = 17:00 - 30min = 16:30 -> margin = 150 minutes
    expect(result.outcome).toBe('BEFORE_DEADLINE');
    expect(result.marginMinutes).toBe(150);
  });

  it('does not issue a deadline verdict when the destination needs clarification — fails closed instead', async () => {
    mockGeocode({ status: 'OK', results: [{ formatted_address: 'Pakistan', types: ['country'], geometry: { location_type: 'APPROXIMATE' } }] });
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'somewhere vague',
      pickupMode: 'family',
      deadline: '2026-11-17T17:00',
    });
    expect(result.outcome).toBe('DESTINATION_NEEDS_CLARIFICATION');
    expect(result.expectedArrival).toBeUndefined();
    expect(result.marginMinutes).toBeUndefined();
  });

  it('fails closed to ROUTE_UNAVAILABLE when Google cannot geocode the destination at all', async () => {
    mockGeocode({ status: 'ZERO_RESULTS', results: [] });
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'gibberish',
      pickupMode: 'family',
    });
    expect(result.outcome).toBe('ROUTE_UNAVAILABLE');
  });

  it('carries Google\'s resolved destination through to the result for CONFIRMED cases', async () => {
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Mirpur',
      pickupMode: 'family',
      pickupWaitMinutes: 0,
    });
    expect(result.resolvedDestination).toBe('Mirpur, AJK, Pakistan');
  });

  it('a primary-place mismatch (Chakswari -> New Mirpur City) fails closed: NEEDS_CLARIFICATION, no Routes call, no deadline verdict', async () => {
    let routesCalls = 0;
    global.fetch = vi.fn(async (url: string | URL) => {
      if (String(url).includes('maps.googleapis.com/maps/api/geocode')) {
        return new Response(JSON.stringify({
          status: 'OK',
          results: [{
            formatted_address: 'New Mirpur City',
            types: ['locality', 'political'],
            geometry: { location_type: 'APPROXIMATE' },
            address_components: [{ long_name: 'New Mirpur City', short_name: 'New Mirpur City', types: ['locality', 'political'] }],
          }],
        }), { status: 200 });
      }
      routesCalls += 1;
      return new Response(JSON.stringify({ routes: [{ duration: '3600s', distanceMeters: 90000 }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Chakswari, Mirpur, Azad Kashmir, Pakistan',
      pickupMode: 'family',
      pickupWaitMinutes: 0,
      deadline: '2026-11-17T17:00',
      destinationReadinessBufferMinutes: 30,
    });

    expect(result.outcome).toBe('DESTINATION_NEEDS_CLARIFICATION');
    expect(result.destinationConfidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('PRIMARY_PLACE_MISMATCH');
    expect(result.resolvedDestination).toBe('New Mirpur City');
    // Both halves of the transparency requirement: what the traveller typed
    // is preserved verbatim, alongside what Google actually resolved.
    expect(result.destination).toBe('Chakswari, Mirpur, Azad Kashmir, Pakistan');
    expect(routesCalls).toBe(0); // computeDriveRoute must never be reached
    expect(result.expectedArrival).toBeUndefined();
    expect(result.deadline).toBeUndefined();
    expect(result.marginMinutes).toBeUndefined();
  });

  it('echoes the deadline reason back for display but never derives calculations from it', async () => {
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Mirpur',
      pickupMode: 'family',
      deadline: '2026-11-17T17:00',
      deadlineReason: 'wedding starts',
    });
    expect(result.deadlineReason).toBe('wedding starts');
  });
});

describe('privacy — no destination or free-text reason is logged anywhere in the API/library code', () => {
  it('the API route and library modules never call console.log/console.error with the destination or reason', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const files = [
      'app/api/founder/arrive-by-pakistan/google/route.ts',
      'lib/arrive-by-pakistan/journey.ts',
      'lib/arrive-by-pakistan/google-routes.ts',
      'lib/arrive-by-pakistan/destination-identity.ts',
    ];
    for (const file of files) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      expect(src, file).not.toMatch(/console\.(log|error|warn|info)\(/);
    }
  });

  it('no file writes to a database, KV store, or persists the journey anywhere', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    for (const file of ['lib/arrive-by-pakistan/journey.ts', 'app/api/founder/arrive-by-pakistan/google/route.ts']) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      expect(src, file).not.toMatch(/brevo|prisma|supabase|\.insert\(|\.save\(/i);
    }
  });
});

describe('founder-beta finishing pass', () => {
  it('the outcome vocabulary has exactly six reachable members — no dead GOOGLE_UNAVAILABLE state', () => {
    const reachable = new Set<string>();
    reachable.add(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: false }));
    reachable.add(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: true, marginMinutes: 45 }));
    reachable.add(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: true, marginMinutes: 10 }));
    reachable.add(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: true, marginMinutes: -5 }));
    reachable.add(classifyOutcome({ destinationConfidence: 'NEEDS_CLARIFICATION', routeAvailable: true, hasDeadline: false }));
    reachable.add(classifyOutcome({ destinationConfidence: 'UNRESOLVED', routeAvailable: false, hasDeadline: false }));
    expect(reachable).toEqual(new Set(['ETA_ONLY', 'BEFORE_DEADLINE', 'TIGHT_MARGIN', 'AFTER_DEADLINE', 'DESTINATION_NEEDS_CLARIFICATION', 'ROUTE_UNAVAILABLE']));
    expect(reachable.has('GOOGLE_UNAVAILABLE' as never)).toBe(false);
  });

  it('the constant name makes the tight-margin threshold\'s provisional status explicit', () => {
    expect(PROVISIONAL_TIGHT_MARGIN_THRESHOLD_MINUTES).toBe(20);
  });

  it('the founder page clearly labels itself as a founder beta with a scope note', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(join(process.cwd(), 'components', 'founder', 'arrive-by-pakistan.tsx'), 'utf8');
    expect(src).toMatch(/Founder Beta/);
    expect(src).toMatch(/ISB/);
    expect(src).toMatch(/LHE/);
    expect(src).toMatch(/KHI/);
    expect(src).toMatch(/estimate, not a guarantee/i);
  });

  it('the founder page shows a known-limitations note', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(join(process.cwd(), 'components', 'founder', 'arrive-by-pakistan.tsx'), 'utf8');
    expect(src).toMatch(/Known limitations/i);
    expect(src).toMatch(/taxi/i);
    expect(src).toMatch(/flight tracking/i);
  });

  it('the founder page shows the assumptions used (landing time, exit buffer, pickup, road departure)', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(join(process.cwd(), 'components', 'founder', 'arrive-by-pakistan.tsx'), 'utf8');
    expect(src).toMatch(/Landing time/);
    expect(src).toMatch(/Airport-exit buffer/);
    expect(src).toMatch(/Ready outside airport/);
    expect(src).toMatch(/Road departure/);
  });
});
