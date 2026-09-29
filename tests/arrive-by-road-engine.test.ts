import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest } from 'next/server';
import { POST as postRoad } from '@/app/api/arrive-by/road/route';
import { POST as postPakistan } from '@/app/api/arrive-by-pakistan/google/route';
import { computeRoadJourney } from '@/lib/arrive-by-shared/road-journey';
import { cleanRoadInput } from '@/lib/arrive-by-shared/clean-road-input';
import { computePakistanJourney } from '@/lib/arrive-by-pakistan/journey';
import { ROAD_CAPABILITY_EVIDENCE, assertValidCapabilityEvidence, getAirportCapability, getRoadAirportInfo, getShellAirportLookup, type CapabilityEvidence } from '@/lib/arrive-by-shared/airport-capability';
import { getCatalogueAirport } from '@/lib/arrive-by-shared/airport-catalogue';
import { searchCatalogue } from '@/lib/arrive-by-shared/catalogue-search';
import { resolveShellDispatch } from '@/lib/arrive-by-shared/shell-dispatch';
import { ARRIVE_BY_RATE_LIMIT_MAX } from '@/lib/arrive-by-shared/rate-limit';
import { MAX_IDENTITY_DISTANCE_KM, evaluateAirportIdentity, verifyAirportIdentity, type IdentityGeocodeResult } from '@/lib/arrive-by-shared/airport-identity';

/**
 * Phase B: the generic worldwide road-first engine and API. Google is always
 * mocked (fetch is stubbed) -- nothing here touches the network, and none of
 * the "road_supported" airports below are real evidence: the shipped evidence
 * table is empty, and these tests inject entries only for the test's duration.
 */

const evidenceTable = ROAD_CAPABILITY_EVIDENCE as Record<string, CapabilityEvidence>;
const passedChecks = { identityVerified: true, routeProbed: true };
const supported = (): CapabilityEvidence => ({ status: 'road_supported', verifiedDate: '2026-09-30', note: 'test-only evidence', checks: passedChecks });

const originalFetch = global.fetch;
const originalKey = process.env.GOOGLE_ROUTES_API_KEY;
let ipCounter = 0;
const uniqueIp = () => `192.0.2.${(ipCounter += 1) % 250}.${Math.floor(Math.random() * 1e6)}`;

interface Captured { geocodeUrls: string[]; routeBodies: Array<Record<string, unknown>> }

function localityResult(countryCode: string, countryName: string, city = 'Testtown') {
  return {
    formatted_address: `${city}, ${countryName}`,
    place_id: `place-${city}-${countryCode}`,
    types: ['locality', 'political'],
    geometry: { location_type: 'APPROXIMATE' },
    address_components: [
      { long_name: city, short_name: city, types: ['locality', 'political'] },
      { long_name: countryName, short_name: countryCode, types: ['country', 'political'] },
    ],
  };
}

function venueResult(countryCode: string, placeId = 'venue-1') {
  return {
    formatted_address: '1 Test Street, Testtown',
    place_id: placeId,
    types: ['establishment', 'point_of_interest'],
    geometry: { location_type: 'ROOFTOP' },
    address_components: [{ long_name: 'Country', short_name: countryCode, types: ['country', 'political'] }],
  };
}

function mockGoogle(geocodeResults: unknown[], driveSeconds = 3600): Captured {
  const captured: Captured = { geocodeUrls: [], routeBodies: [] };
  global.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    if (String(url).includes('maps.googleapis.com/maps/api/geocode')) {
      captured.geocodeUrls.push(String(url));
      return new Response(JSON.stringify({ status: geocodeResults.length ? 'OK' : 'ZERO_RESULTS', results: geocodeResults }), { status: 200 });
    }
    captured.routeBodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ routes: [{ duration: `${driveSeconds}s`, staticDuration: `${driveSeconds - 60}s`, distanceMeters: 30000 }] }), { status: 200 });
  }) as unknown as typeof fetch;
  return captured;
}

function post(body: Record<string, unknown>, ip = uniqueIp()) {
  return postRoad(new NextRequest('http://localhost/api/arrive-by/road', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

const journey = (airportCode: string, extra: Record<string, unknown> = {}) => ({
  airportCode,
  landingAt: '2026-11-17T12:00',
  airportExitBufferMinutes: 60,
  destination: 'Testtown',
  pickupMode: 'family',
  ...extra,
});

beforeEach(() => {
  process.env.GOOGLE_ROUTES_API_KEY = 'test-key';
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GOOGLE_ROUTES_API_KEY;
  else process.env.GOOGLE_ROUTES_API_KEY = originalKey;
  for (const code of Object.keys(evidenceTable)) delete evidenceTable[code];
  vi.restoreAllMocks();
});

describe('generic road API — the capability gate fails closed before any Google call', () => {
  it('a catalogued-only airport cannot journey: 404, and Google is never called', async () => {
    const captured = mockGoogle([localityResult('GB', 'United Kingdom')]);
    for (const code of ['LHR', 'DEL', 'DXB', 'JFK', 'SYD', 'DAC']) {
      const response = await post(journey(code));
      expect(response.status, code).toBe(404);
      expect(((await response.json()) as { error: string }).error).toBe("Arrive By can't calculate this airport journey yet.");
    }
    expect(captured.geocodeUrls).toHaveLength(0);
    expect(captured.routeBodies).toHaveLength(0);
  });

  it('an unknown code and a catalogued-only code are indistinguishable to the caller', async () => {
    mockGoogle([]);
    const unknown = await post(journey('ZZZ'));
    const catalogued = await post(journey('LHR'));
    expect(unknown.status).toBe(catalogued.status);
    expect(await unknown.json()).toEqual(await catalogued.json());
  });

  it('IKO and BEK are catalogued (not name-filtered out) but not journey-eligible', async () => {
    for (const code of ['IKO', 'BEK']) {
      expect(getCatalogueAirport(code), code).toBeDefined();
      expect(getAirportCapability(code)).toEqual({ code, status: 'catalogued', journeyEligible: false });
      expect((await post(journey(code))).status).toBe(404);
    }
  });

  it('route_testable and temporarily_unsupported airports also fail closed', async () => {
    mockGoogle([localityResult('GB', 'United Kingdom')]);
    evidenceTable.LHR = { status: 'route_testable', verifiedDate: '2026-09-30', note: 'x', checks: { identityVerified: true, routeProbed: false } };
    expect((await post(journey('LHR'))).status).toBe(404);
    evidenceTable.LHR = { status: 'temporarily_unsupported', verifiedDate: '2026-09-30', note: 'blocked' };
    expect((await post(journey('LHR'))).status).toBe(404);
    // The kill switch also beats a special profile.
    evidenceTable.ISB = { status: 'temporarily_unsupported', verifiedDate: '2026-09-30', note: 'blocked' };
    expect((await post(journey('ISB'))).status).toBe(404);
  });

  it('a road_supported airport can journey', async () => {
    evidenceTable.LHR = supported();
    mockGoogle([localityResult('GB', 'United Kingdom', 'Reading')]);
    const response = await post(journey('LHR', { destination: 'Reading' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome).toBe('ETA_ONLY');
    expect(body.airport).toEqual({ code: 'LHR', displayName: 'London Heathrow Airport', timeZone: 'Europe/London' });
  });

  it('MAN is journey-eligible but transit-first, so the road API refuses it (its own engine serves it)', async () => {
    mockGoogle([localityResult('GB', 'United Kingdom')]);
    expect((await post(journey('MAN'))).status).toBe(404);
  });

  it('a malformed airport code fails validation before any lookup', async () => {
    mockGoogle([]);
    for (const airportCode of ['', 'LH', 'LHRR', '12A', "L'R", 42]) {
      const response = await post(journey(airportCode as string));
      expect(response.status, String(airportCode)).toBe(422);
    }
  });
});

describe('generic road API — the server, not the client, decides the origin', () => {
  it('routes from the catalogue coordinates and labels the result airport-level, ignoring client-supplied coordinates/timezone/country', async () => {
    evidenceTable.LHR = supported();
    const captured = mockGoogle([localityResult('GB', 'United Kingdom', 'Reading')]);
    const lhr = getCatalogueAirport('LHR')!;
    const response = await post(journey('LHR', {
      destination: 'Reading',
      originLat: 40.6413, originLng: -73.7781, latitude: 1, longitude: 2, origin: { address: 'Times Square' },
      timeZone: 'Asia/Tokyo', countryCode: 'JP', expectedCountryCodes: ['JP'], regionBias: 'jp',
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(captured.routeBodies).toHaveLength(1);
    expect(captured.routeBodies[0].origin).toEqual({ location: { latLng: { latitude: lhr.lat, longitude: lhr.lng } } });
    expect(body.airport.timeZone).toBe('Europe/London');
    expect(body.estimateLabel).toBe('Airport-level estimate');
    // Country gate came from the profile (GB), not the client's 'JP'.
    expect(captured.geocodeUrls[0]).toMatch(/region=uk/);
  });

  it('cleanRoadInput copies only journey fields — no coordinates, timezone or country can be smuggled through', () => {
    const cleaned = cleanRoadInput({ ...journey('LHR'), originLat: 1, originLng: 2, timeZone: 'Asia/Tokyo', countryCode: 'JP', origin: { address: 'x' } }, () => true);
    expect(Object.keys(cleaned).sort()).toEqual(['airportCode', 'airportExitBufferMinutes', 'confirmedPlaceId', 'deadline', 'deadlineReason', 'destination', 'destinationReadinessBufferMinutes', 'landingAt', 'pickupMode', 'pickupWaitMinutes', 'selectedPlaceId']);
    expect(JSON.stringify(cleaned)).not.toMatch(/Tokyo|originLat|JP/);
  });

  it('an override beats the catalogue default: ISB via the generic road API uses the validated Pakistan profile, not catalogue coordinates', async () => {
    const captured = mockGoogle([localityResult('PK', 'Pakistan', 'Mirpur')]);
    const response = await post(journey('ISB', { destination: 'Mirpur' }));
    expect(response.status).toBe(200);
    expect(captured.routeBodies[0].origin).toEqual({ address: 'Islamabad International Airport, Pakistan' });
    expect(captured.geocodeUrls[0]).toMatch(/region=pk/);
    expect((await response.json()).estimateLabel).toBe('Airport-level estimate');
  });

  it('a missing API key is a 503, after the rate limit and before any Google call', async () => {
    delete process.env.GOOGLE_ROUTES_API_KEY;
    evidenceTable.LHR = supported();
    const captured = mockGoogle([]);
    expect((await post(journey('LHR'))).status).toBe(503);
    expect(captured.geocodeUrls).toHaveLength(0);
  });
});

describe('destination policy on the generic road API', () => {
  it('SAME_COUNTRY gate: a Delhi airport journey to a US destination is refused before any drive request', async () => {
    evidenceTable.DEL = supported();
    const captured = mockGoogle([localityResult('US', 'United States', 'Springfield')]);
    const body = await (await post(journey('DEL', { destination: 'Springfield' }))).json();
    expect(body.outcome).toBe('DESTINATION_NEEDS_CLARIFICATION');
    expect(body.clarificationReason).toBe('WRONG_COUNTRY');
    expect(captured.routeBodies).toHaveLength(0);
  });

  it('SAME_COUNTRY gate accepts an in-country destination', async () => {
    evidenceTable.DEL = supported();
    mockGoogle([localityResult('IN', 'India', 'Gurugram')]);
    expect((await (await post(journey('DEL', { destination: 'Gurugram' }))).json()).outcome).toBe('ETA_ONLY');
  });

  it('cross-border override: Geneva accepts a French destination, but Delhi-style same-country airports do not', async () => {
    evidenceTable.GVA = supported();
    mockGoogle([localityResult('FR', 'France', 'Annecy')]);
    expect((await (await post(journey('GVA', { destination: 'Annecy' }))).json()).outcome).toBe('ETA_ONLY');
    // ...but not an unlisted country.
    mockGoogle([localityResult('IT', 'Italy', 'Milan')]);
    expect((await (await post(journey('GVA', { destination: 'Milan' }))).json()).clarificationReason).toBe('WRONG_COUNTRY');
  });

  it('a multi-country policy sends no region bias (the country gate alone enforces it)', async () => {
    evidenceTable.BSL = supported();
    const captured = mockGoogle([localityResult('CH', 'Switzerland', 'Basel')]);
    await post(journey('BSL', { destination: 'Basel' }));
    expect(captured.geocodeUrls[0]).not.toMatch(/region=/);
  });
});

describe('stale / forged place IDs are still not trusted on the generic engine', () => {
  const airport = { code: 'LHR', displayName: 'London Heathrow Airport', timeZone: 'Europe/London', origin: { kind: 'coordinate' as const, lat: 51.47, lng: -0.4543 } };
  const rules = { expectedCountryCodes: ['GB'], regionBias: 'uk' };
  const base = { airportCode: 'LHR', landingAt: '2026-11-17T12:00', airportExitBufferMinutes: 60, destination: 'Some Venue', pickupMode: 'family' as const };

  it('a venue stops at NEEDS_CONFIRMATION; a matching confirmedPlaceId proceeds; a stale/forged one does not', async () => {
    const captured = mockGoogle([venueResult('GB', 'venue-1')]);
    expect((await computeRoadJourney('k', airport, base, rules)).outcome).toBe('DESTINATION_NEEDS_CONFIRMATION');
    expect((await computeRoadJourney('k', airport, { ...base, confirmedPlaceId: 'venue-1' }, rules)).outcome).toBe('ETA_ONLY');
    expect((await computeRoadJourney('k', airport, { ...base, confirmedPlaceId: 'forged-id' }, rules)).outcome).toBe('DESTINATION_NEEDS_CONFIRMATION');
    expect(captured.routeBodies).toHaveLength(1);
  });

  it('a selectedPlaceId that Google no longer offers falls through to NEEDS_SELECTION', async () => {
    mockGoogle([
      { ...venueResult('GB', 'one'), formatted_address: '1 Main Rd, Testtown', partial_match: true },
      { ...venueResult('GB', 'two'), formatted_address: '9 Other Rd, Testtown', partial_match: true },
    ]);
    const stale = await computeRoadJourney('k', airport, { ...base, selectedPlaceId: 'no-longer-offered' }, rules);
    expect(stale.outcome).toBe('DESTINATION_NEEDS_SELECTION');
    const picked = await computeRoadJourney('k', airport, { ...base, selectedPlaceId: 'two' }, rules);
    expect(picked.outcome).toBe('ETA_ONLY');
    expect(picked.resolvedDestination).toBe('9 Other Rd, Testtown');
  });

  it('oversized placeIds are rejected at validation', () => {
    expect(() => cleanRoadInput({ ...journey('LHR'), confirmedPlaceId: 'x'.repeat(201) }, () => true)).toThrow(/not valid/);
    expect(() => cleanRoadInput({ ...journey('LHR'), selectedPlaceId: 'x'.repeat(201) }, () => true)).toThrow(/not valid/);
  });
});

describe('timezone and midnight logic stays explicit on the generic engine', () => {
  const at = (origin = { kind: 'coordinate' as const, lat: -33.94, lng: 151.17 }, timeZone = 'Australia/Sydney') => ({ code: 'X', displayName: 'X', timeZone, origin });

  it('a journey that crosses local midnight: landing 23:30 + 45 exit + 30 pickup + 60 drive arrives next day (Sydney, UTC+11)', async () => {
    mockGoogle([localityResult('AU', 'Australia', 'Parramatta')], 3600);
    const airport = at();
    const result = await computeRoadJourney('k', airport, { airportCode: 'SYD', landingAt: '2027-01-10T23:30', airportExitBufferMinutes: 45, pickupWaitMinutes: 30, destination: 'Parramatta', pickupMode: 'family' }, { expectedCountryCodes: ['AU'] });
    expect(result.readyOutsideAirport).toBe('2027-01-10T13:15:00.000Z');
    expect(result.roadDeparture).toBe('2027-01-10T13:45:00.000Z');
    expect(result.expectedArrival).toBe('2027-01-10T14:45:00.000Z');
    expect(new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(result.expectedArrival!))).toBe('2027-01-11, 01:45');
  });

  it('a deadline across midnight in a half-hour zone (Delhi, +5:30) is judged on real instants', async () => {
    mockGoogle([localityResult('IN', 'India', 'Noida')], 5400);
    const airport = at({ kind: 'coordinate', lat: 28.55, lng: 77.1 }, 'Asia/Kolkata');
    const result = await computeRoadJourney('k', airport, { airportCode: 'DEL', landingAt: '2026-06-01T23:00', airportExitBufferMinutes: 30, destination: 'Noida', pickupMode: 'family', deadline: '2026-06-02T02:00', destinationReadinessBufferMinutes: 15 }, { expectedCountryCodes: ['IN'] });
    // 23:00 IST = 17:30Z; +30 exit = 18:00Z; +90 min drive = 19:30Z (01:00 IST). Latest = 02:00 - 15 = 01:45 IST = 20:15Z; margin 45.
    expect(result.expectedArrival).toBe('2026-06-01T19:30:00.000Z');
    expect(result.latestAcceptableArrival).toBe('2026-06-01T20:15:00.000Z');
    expect(result.marginMinutes).toBe(45);
    expect(result.outcome).toBe('BEFORE_DEADLINE');
  });

  it('London DST: a landing on the spring-forward day is converted with the correct offset (Europe/London, 2027-03-28)', async () => {
    mockGoogle([localityResult('GB', 'United Kingdom', 'Slough')], 1800);
    const airport = at({ kind: 'coordinate', lat: 51.47, lng: -0.45 }, 'Europe/London');
    const result = await computeRoadJourney('k', airport, { airportCode: 'LHR', landingAt: '2027-03-28T12:00', airportExitBufferMinutes: 0, destination: 'Slough', pickupMode: 'family' }, { expectedCountryCodes: ['GB'] });
    expect(result.roadDeparture).toBe('2027-03-28T11:00:00.000Z'); // BST (+1) already in force at noon
  });

  it('the server never reads the machine timezone: the result is the same whatever TZ is set', async () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Kiritimati';
      mockGoogle([localityResult('AU', 'Australia', 'Parramatta')], 600);
      const result = await computeRoadJourney('k', at(), { airportCode: 'SYD', landingAt: '2027-01-10T12:00', airportExitBufferMinutes: 0, destination: 'Parramatta', pickupMode: 'family' }, { expectedCountryCodes: ['AU'] });
      expect(result.roadDeparture).toBe('2027-01-10T01:00:00.000Z');
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it('a deadline before landing is rejected at validation', () => {
    expect(() => cleanRoadInput({ ...journey('LHR'), deadline: '2026-11-17T11:00' }, () => true)).toThrow(/after your flight lands/);
  });
});

describe('Pakistan and Manchester regression', () => {
  it('computePakistanJourney still routes from the address origin with the PK gate and region bias', async () => {
    const captured = mockGoogle([localityResult('PK', 'Pakistan', 'Mirpur')], 5400);
    const result = await computePakistanJourney('k', { airportCode: 'LHE', landingAt: '2026-11-17T12:00', airportExitBufferMinutes: 60, destination: 'Mirpur', pickupMode: 'family', pickupWaitMinutes: 15 });
    expect(captured.routeBodies[0].origin).toEqual({ address: 'Allama Iqbal International Airport, Lahore, Pakistan' });
    expect(captured.geocodeUrls[0]).toMatch(/region=pk/);
    expect(result.airport).toEqual({ code: 'LHE', displayName: 'Allama Iqbal International Airport, Lahore', timeZone: 'Asia/Karachi' });
    expect(result.roadDeparture).toBe('2026-11-17T08:15:00.000Z');
    expect(result.expectedArrival).toBe('2026-11-17T09:45:00.000Z');
    expect(result.outcome).toBe('ETA_ONLY');
  });

  it('Pakistan still refuses a non-PK destination (WRONG_COUNTRY) and never reaches the route request', async () => {
    const captured = mockGoogle([localityResult('IN', 'India', 'Amritsar')]);
    const result = await computePakistanJourney('k', { airportCode: 'ISB', landingAt: '2026-11-17T12:00', airportExitBufferMinutes: 60, destination: 'Amritsar', pickupMode: 'family' });
    expect(result.clarificationReason).toBe('WRONG_COUNTRY');
    expect(captured.routeBodies).toHaveLength(0);
  });

  it("Pakistan's own public route is unchanged and its own airport list still gates it", async () => {
    mockGoogle([localityResult('PK', 'Pakistan', 'Mirpur')]);
    const ok = await postPakistan(new NextRequest('http://localhost/x', { method: 'POST', headers: { 'x-forwarded-for': uniqueIp() }, body: JSON.stringify(journey('KHI', { destination: 'Mirpur' })) }));
    expect(ok.status).toBe(200);
    const bad = await postPakistan(new NextRequest('http://localhost/x', { method: 'POST', headers: { 'x-forwarded-for': uniqueIp() }, body: JSON.stringify(journey('LHR')) }));
    expect(bad.status).toBe(422);
  });

  it('MAN stays the explicit transit-first special profile, unchanged by the road engine', () => {
    const dispatch = resolveShellDispatch('MAN', getShellAirportLookup('MAN'));
    expect(dispatch.kind).toBe('journey');
    if (dispatch.kind === 'journey') {
      expect(dispatch.profile.journeyEngine).toBe('TRANSIT_FIRST');
      expect(dispatch.profile.destinationRules.expectedCountryCodes).toEqual(['GB']);
    }
  });
});

describe('rate limiting — one product-wide budget; search costs nothing', () => {
  it('the generic road API shares the arrive-by:<client> budget (5 / 60 s) and returns 429 after it', async () => {
    evidenceTable.LHR = supported();
    mockGoogle([localityResult('GB', 'United Kingdom', 'Reading')]);
    const ip = uniqueIp();
    for (let i = 0; i < ARRIVE_BY_RATE_LIMIT_MAX; i += 1) expect((await post(journey('LHR', { destination: 'Reading' }), ip)).status).toBe(200);
    const limited = await post(journey('LHR', { destination: 'Reading' }), ip);
    expect(limited.status).toBe(429);
    // Switching to the Pakistan endpoint with the same client gains no fresh allowance.
    const pk = await postPakistan(new NextRequest('http://localhost/x', { method: 'POST', headers: { 'x-forwarded-for': ip }, body: JSON.stringify(journey('KHI')) }));
    expect(pk.status).toBe(429);
  });

  it('local airport search never consumes the journey budget', async () => {
    evidenceTable.LHR = supported();
    mockGoogle([localityResult('GB', 'United Kingdom', 'Reading')]);
    const ip = uniqueIp();
    for (let i = 0; i < 50; i += 1) searchCatalogue('heathrow');
    for (let i = 0; i < ARRIVE_BY_RATE_LIMIT_MAX; i += 1) expect((await post(journey('LHR', { destination: 'Reading' }), ip)).status).toBe(200);
    expect(ARRIVE_BY_RATE_LIMIT_MAX).toBe(5);
  });

  it('a validation failure and a capability refusal still count against the budget (no free probing of the API)', async () => {
    mockGoogle([]);
    const ip = uniqueIp();
    for (let i = 0; i < ARRIVE_BY_RATE_LIMIT_MAX; i += 1) await post(journey('LHR'), ip);
    expect((await post(journey('LHR'), ip)).status).toBe(429);
  });
});

describe('airport identity verification (fails closed)', () => {
  const lhr = getCatalogueAirport('LHR')!;
  const good = (): IdentityGeocodeResult => ({
    formatted_address: 'London Heathrow Airport (LHR), Longford TW6, UK',
    types: ['airport', 'establishment', 'point_of_interest'],
    geometry: { location: { lat: lhr.lat + 0.005, lng: lhr.lng + 0.005 } },
    address_components: [{ short_name: 'GB', types: ['country', 'political'] }],
  });

  it('accepts a single clear airport result that agrees on type, country, place and name', () => {
    const result = evaluateAirportIdentity(lhr, [good()]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.distanceKm).toBeLessThan(MAX_IDENTITY_DISTANCE_KM);
  });

  it('rejects a city centre / neighbourhood / unrelated POI (not typed airport)', () => {
    expect(evaluateAirportIdentity(lhr, [{ ...good(), types: ['locality', 'political'] }])).toEqual({ ok: false, reason: 'NOT_AN_AIRPORT' });
    expect(evaluateAirportIdentity(lhr, [{ ...good(), types: ['establishment', 'point_of_interest'] }])).toEqual({ ok: false, reason: 'NOT_AN_AIRPORT' });
  });

  it('rejects a similarly named airport somewhere else (too far)', () => {
    const elsewhere = { ...good(), geometry: { location: { lat: lhr.lat + 0.5, lng: lhr.lng } } };
    expect(evaluateAirportIdentity(lhr, [elsewhere])).toEqual({ ok: false, reason: 'TOO_FAR' });
  });

  it('rejects the wrong country', () => {
    expect(evaluateAirportIdentity(lhr, [{ ...good(), address_components: [{ short_name: 'US', types: ['country'] }] }])).toEqual({ ok: false, reason: 'WRONG_COUNTRY' });
  });

  it('rejects a nearby airport whose name does not match (e.g. Northolt when Heathrow was asked for)', () => {
    expect(evaluateAirportIdentity(lhr, [{ ...good(), formatted_address: 'RAF Northolt, Ruislip HA4, UK' }])).toEqual({ ok: false, reason: 'NAME_MISMATCH' });
  });

  it('a match on generic words alone ("International Airport") proves nothing', () => {
    const jfk = getCatalogueAirport('JFK')!;
    const wrong = { ...good(), formatted_address: 'Newark Liberty International Airport, NJ, USA', geometry: { location: { lat: jfk.lat, lng: jfk.lng } }, address_components: [{ short_name: 'US', types: ['country'] }] };
    expect(evaluateAirportIdentity(jfk, [wrong]).ok).toBe(false);
  });

  it('accepts a name-poor result when the IATA code is in the address', () => {
    expect(evaluateAirportIdentity(lhr, [{ ...good(), formatted_address: 'Airport (LHR), Hounslow' }]).ok).toBe(true);
  });

  it('with several agreeing results the closest to the catalogue point is the match', () => {
    const nearer = { ...good(), formatted_address: 'London Heathrow Airport (LHR), Terminal 5', geometry: { location: { lat: lhr.lat + 0.001, lng: lhr.lng } } };
    const result = evaluateAirportIdentity(lhr, [good(), nearer]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.matchedAddress).toContain('Terminal 5');
  });

  it('no result fails closed; the closest failing candidate supplies the reason', () => {
    expect(evaluateAirportIdentity(lhr, [])).toEqual({ ok: false, reason: 'NO_RESULT' });
    expect(evaluateAirportIdentity(lhr, [{ formatted_address: 'x' }])).toEqual({ ok: false, reason: 'NO_RESULT' });
  });

  it('verifyAirportIdentity: one country-restricted request, and every failure mode fails closed', async () => {
    const seen: string[] = [];
    global.fetch = vi.fn(async (url: string | URL) => {
      seen.push(String(url));
      return new Response(JSON.stringify({ status: 'OK', results: [good()] }), { status: 200 });
    }) as unknown as typeof fetch;
    expect((await verifyAirportIdentity('k', lhr)).ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/components=country%3AGB/);

    global.fetch = vi.fn(async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
    expect(await verifyAirportIdentity('k', lhr)).toEqual({ ok: false, reason: 'REQUEST_FAILED' });
    global.fetch = vi.fn(async () => { throw new Error('network'); }) as unknown as typeof fetch;
    expect(await verifyAirportIdentity('k', lhr)).toEqual({ ok: false, reason: 'REQUEST_FAILED' });
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ status: 'ZERO_RESULTS', results: [] }), { status: 200 })) as unknown as typeof fetch;
    expect(await verifyAirportIdentity('k', lhr)).toEqual({ ok: false, reason: 'NO_RESULT' });
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ status: 'OVER_QUERY_LIMIT' }), { status: 200 })) as unknown as typeof fetch;
    expect(await verifyAirportIdentity('k', lhr)).toEqual({ ok: false, reason: 'REQUEST_FAILED' });
  });
});

describe('capability evidence must carry the checks behind a positive status', () => {
  it('road_supported requires a passed identity check AND a successful probe route; route_testable requires identity', () => {
    const base = { verifiedDate: '2026-09-30', note: 'n' };
    expect(() => assertValidCapabilityEvidence('LHR', { ...base, status: 'road_supported' })).toThrow(/identity check/);
    expect(() => assertValidCapabilityEvidence('LHR', { ...base, status: 'road_supported', checks: { identityVerified: true, routeProbed: false } })).toThrow(/probe DRIVE route/);
    expect(() => assertValidCapabilityEvidence('LHR', { ...base, status: 'road_supported', checks: passedChecks })).not.toThrow();
    expect(() => assertValidCapabilityEvidence('LHR', { ...base, status: 'route_testable', checks: { identityVerified: true, routeProbed: false } })).not.toThrow();
    expect(() => assertValidCapabilityEvidence('LHR', { ...base, status: 'route_testable' })).toThrow(/identity check/);
    expect(() => assertValidCapabilityEvidence('LHR', { ...base, status: 'temporarily_unsupported' })).not.toThrow();
  });
});

describe('gated generic UI path', () => {
  it('dispatches to the generic road journey only for a server-verified road_supported airport', () => {
    expect(resolveShellDispatch('LHR', getShellAirportLookup('LHR')).kind).toBe('not_yet_supported');
    evidenceTable.LHR = supported();
    const lookup = getShellAirportLookup('LHR');
    expect(lookup?.road).toMatchObject({ code: 'LHR', timeZone: 'Europe/London', estimateLabel: 'Airport-level estimate' });
    const dispatch = resolveShellDispatch('lhr', lookup);
    expect(dispatch.kind).toBe('road_journey');
  });

  it('a blocked or mismatched lookup never reaches the road journey', () => {
    evidenceTable.LHR = supported();
    const lookup = getShellAirportLookup('LHR')!;
    expect(resolveShellDispatch('LHR', { ...lookup, blocked: true }).kind).toBe('not_yet_supported');
    expect(resolveShellDispatch('DEL', lookup).kind).toBe('unsupported');
    expect(resolveShellDispatch('LHR', { ...lookup, road: { ...lookup.road!, code: 'DEL' } }).kind).toBe('not_yet_supported');
  });

  it('special profiles are never rebuilt as generic road airports', () => {
    for (const code of ['ISB', 'MAN']) expect(getRoadAirportInfo(code)).toBeUndefined();
  });

  it('no airport is road_supported in the shipped evidence table (Phase B enables nothing publicly)', () => {
    expect(Object.keys(ROAD_CAPABILITY_EVIDENCE)).toEqual([]);
    expect(getRoadAirportInfo('LHR')).toBeUndefined();
  });

  it('the generic UI never posts anything but the airport code, and tracks only coarse events', () => {
    const src = readFileSync(join(process.cwd(), 'components', 'arrive-by-road-public.tsx'), 'utf8');
    expect(src).toContain('/api/arrive-by/road');
    expect(src).toContain('airportCode: airport.code');
    expect(src).not.toMatch(/latitude|longitude|timeZone:\s*airport|countryCode:/);
    expect(src).toMatch(/track\('arrive_by_journey_checked',\s*{\s*airport: airport\.code, outcome: journeyResult\.outcome\s*}\)/);
    expect(src).toMatch(/track\('arrive_by_recovery_used'/);
    expect(src).not.toMatch(/console\.(log|error|warn|info)\(/);
    expect(src).toMatch(/aria-live="polite"/);
  });

  it('asks the questions the brief names and invents no immigration/baggage/taxi timing', () => {
    const src = readFileSync(join(process.cwd(), 'components', 'arrive-by-road-public.tsx'), 'utf8');
    expect(src).toMatch(/When does your flight land/);
    expect(src).toMatch(/before you're outside the airport/);
    expect(src).toMatch(/until your car, taxi or pickup is ready/);
    expect(src).toMatch(/Where are you going/);
    expect(src).toMatch(/Need to arrive by/);
    expect(src).toMatch(/Arrive By does not assume this for you/);
  });

  it('the road component and the new API never import the catalogue into the client, or log / persist a journey', () => {
    const component = readFileSync(join(process.cwd(), 'components', 'arrive-by-road-public.tsx'), 'utf8');
    const specifiers = [...component.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const specifier of specifiers) expect(specifier).not.toMatch(/airport-catalogue|airports\.generated|catalogue-search|airport-capability/);
    for (const file of ['app/api/arrive-by/road/route.ts', 'lib/arrive-by-shared/road-journey.ts', 'lib/arrive-by-shared/road-routes.ts', 'lib/arrive-by-shared/airport-identity.ts']) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      expect(src, file).not.toMatch(/console\.(log|error|warn|info)\(/);
      expect(src, file).not.toMatch(/brevo|prisma|supabase|\.insert\(|\.save\(|localStorage/i);
    }
  });

  it('the generic road route is noindex-safe: it is an API route, absent from the sitemap', () => {
    const sitemap = readFileSync(join(process.cwd(), 'app', 'sitemap.ts'), 'utf8');
    expect(sitemap).not.toMatch(/arrive-by/);
  });
});
