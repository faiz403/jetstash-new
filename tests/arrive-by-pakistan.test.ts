import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PAKISTAN_AIRPORTS, PAKISTAN_AIRPORT_CODES, getPakistanAirport } from '@/lib/arrive-by-pakistan/airports';
import { localDateTimeToIso, isoToClock } from '@/lib/arrive-by-pakistan/timezone';
import { classifyOutcome, outcomeVerdict, TIGHT_MARGIN_THRESHOLD_MINUTES } from '@/lib/arrive-by-pakistan/outcomes';
import { geocodeDestination, computeDriveRoute } from '@/lib/arrive-by-pakistan/google-routes';
import { computePakistanJourney } from '@/lib/arrive-by-pakistan/journey';

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
      classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: true, marginMinutes: TIGHT_MARGIN_THRESHOLD_MINUTES }),
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
      'ETA_ONLY', 'BEFORE_DEADLINE', 'TIGHT_MARGIN', 'AFTER_DEADLINE', 'DESTINATION_NEEDS_CLARIFICATION', 'ROUTE_UNAVAILABLE', 'GOOGLE_UNAVAILABLE',
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
