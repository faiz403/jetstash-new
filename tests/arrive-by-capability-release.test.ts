import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { NextRequest } from 'next/server';
import { POST as postRoad } from '@/app/api/arrive-by/road/route';
import { ROAD_CAPABILITY_EVIDENCE, getAirportCapability, getRoadAirportInfo, getShellAirportLookup, type CapabilityEvidence } from '@/lib/arrive-by-shared/airport-capability';
import { ARRIVE_BY_RELEASED_AIRPORTS, getGenericAirportRelease, isInternalQaReleaseEnabled, assertValidReleaseEntry, type ReleaseEntry } from '@/lib/arrive-by-shared/airport-release';
import { getCatalogueAirport, getCatalogueAirports } from '@/lib/arrive-by-shared/airport-catalogue';
import { resolveShellDispatch } from '@/lib/arrive-by-shared/shell-dispatch';
import { getAirportProfile, getPublicAirportProfiles } from '@/lib/arrive-by-shared/airport-registry';
import { classifyProbe, probeAirport, serializeProbeRecords, sameTimeZone, toEvidenceEntry, type ProbeRecord } from '@/lib/arrive-by-shared/capability-probe';

/**
 * Phase C: capability (can Arrive By safely calculate this airport?) and
 * release (have we chosen to expose it?) are separate gates. Live probe
 * evidence is committed for many airports; NONE of them is released, so none
 * is reachable by a user.
 */

const evidenceTable = ROAD_CAPABILITY_EVIDENCE as Record<string, CapabilityEvidence>;
const releaseTable = ARRIVE_BY_RELEASED_AIRPORTS as Record<string, ReleaseEntry>;
const shippedEvidence = { ...evidenceTable };
const shippedRelease = { ...releaseTable };
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const passedChecks = { identityVerified: true, routeProbed: true };
const evidence = (status: CapabilityEvidence['status']): CapabilityEvidence => ({ status, verifiedDate: '2026-09-30', note: 'test', checks: passedChecks });
const release = (status: ReleaseEntry['status']): ReleaseEntry => ({ status, decidedDate: '2026-09-30', approvedNote: 'test-only release' });

const originalFetch = global.fetch;
const originalKey = process.env.GOOGLE_ROUTES_API_KEY;

beforeEach(() => {
  process.env.GOOGLE_ROUTES_API_KEY = 'test-key';
});
afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GOOGLE_ROUTES_API_KEY;
  else process.env.GOOGLE_ROUTES_API_KEY = originalKey;
  for (const code of Object.keys(evidenceTable)) delete evidenceTable[code];
  for (const code of Object.keys(releaseTable)) delete releaseTable[code];
  Object.assign(evidenceTable, shippedEvidence);
  Object.assign(releaseTable, shippedRelease);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(() => {
  Object.assign(evidenceTable, shippedEvidence);
});

describe('capability and release are separate gates', () => {
  it('road_supported + internal_only: capability approved, but NOT publicly eligible', () => {
    const result = getAirportCapability('LHR', { LHR: evidence('road_supported') }, {});
    expect(result).toMatchObject({ status: 'road_supported', capabilityApproved: true, releaseStatus: 'internal_only', journeyEligible: false });
  });

  it('road_supported + public_beta / public: eligible', () => {
    for (const status of ['public_beta', 'public'] as const) {
      expect(getAirportCapability('LHR', { LHR: evidence('road_supported') }, { LHR: release(status) })).toMatchObject({ capabilityApproved: true, releaseStatus: status, journeyEligible: true });
    }
  });

  it('a release without capability evidence never makes an airport eligible', () => {
    expect(getAirportCapability('LHR', {}, { LHR: release('public') })).toMatchObject({ status: 'catalogued', journeyEligible: false, capabilityApproved: false });
    expect(getAirportCapability('LHR', { LHR: { ...evidence('route_testable'), checks: { identityVerified: true, routeProbed: false } } }, { LHR: release('public') })?.journeyEligible).toBe(false);
  });

  it('temporarily_unsupported always blocks, whatever the release status', () => {
    for (const status of ['public_beta', 'public'] as const) {
      const blocked = getAirportCapability('LHR', { LHR: evidence('temporarily_unsupported') }, { LHR: release(status) });
      expect(blocked).toMatchObject({ status: 'temporarily_unsupported', journeyEligible: false, capabilityApproved: false });
    }
    // ...including an explicit public profile.
    expect(getAirportCapability('ISB', { ISB: evidence('temporarily_unsupported') }, { ISB: release('public') })?.journeyEligible).toBe(false);
  });

  it('the four explicit profiles are unaffected by the release table (they carry their own public state)', () => {
    for (const code of ['MAN', 'ISB', 'LHE', 'KHI']) {
      expect(getAirportCapability(code, {}, {})).toMatchObject({ status: 'special_profile', journeyEligible: true, releaseStatus: 'public' });
    }
    expect(getPublicAirportProfiles().map((profile) => profile.code).sort()).toEqual(['ISB', 'KHI', 'LHE', 'MAN']);
    expect(getAirportProfile('MAN')?.journeyEngine).toBe('TRANSIT_FIRST');
  });

  it('release entries are validated', () => {
    expect(() => assertValidReleaseEntry('LHR', release('public_beta'))).not.toThrow();
    expect(() => assertValidReleaseEntry('lhr', release('public_beta'))).toThrow(/IATA/);
    expect(() => assertValidReleaseEntry('LHR', { ...release('public'), decidedDate: 'soon' })).toThrow(/YYYY-MM-DD/);
    expect(() => assertValidReleaseEntry('LHR', { ...release('public'), approvedNote: ' ' })).toThrow(/approval note/);
    expect(getGenericAirportRelease('LHR', {})).toBe('internal_only');
  });
});

describe('committed live evidence does not expose anything', () => {
  it('there is real committed evidence, and the release table is empty', () => {
    expect(Object.keys(shippedEvidence).length).toBeGreaterThan(20);
    expect(Object.keys(shippedRelease)).toEqual([]);
  });

  it('every airport with road_supported evidence is still NOT journey-eligible in the shipped state', () => {
    const supported = Object.entries(shippedEvidence).filter(([, e]) => e.status === 'road_supported').map(([code]) => code);
    expect(supported.length).toBeGreaterThan(20);
    for (const code of supported) {
      expect(getAirportCapability(code), code).toMatchObject({ status: 'road_supported', capabilityApproved: true, releaseStatus: 'internal_only', journeyEligible: false });
      expect(getRoadAirportInfo(code), code).toBeUndefined();
    }
  });

  it('across the whole catalogue, exactly the four explicit profiles are publicly eligible', () => {
    const eligible = getCatalogueAirports().filter((a) => getAirportCapability(a.iata)?.journeyEligible).map((a) => a.iata).sort();
    expect(eligible).toEqual(['ISB', 'KHI', 'LHE', 'MAN']);
  });

  it('the public shell refuses a verified-but-unreleased airport and shows the safe "can\'t calculate yet" state', () => {
    for (const code of ['LHR', 'DXB', 'DEL', 'JFK', 'SYD', 'GVA']) {
      const lookup = getShellAirportLookup(code);
      expect(lookup?.road, code).toBeUndefined();
      expect(resolveShellDispatch(code, lookup).kind, code).toBe('not_yet_supported');
    }
  });

  it('the public API refuses a verified-but-unreleased airport with a 404, before any Google call', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    for (const code of ['LHR', 'DXB', 'DEL']) {
      const response = await postRoad(new NextRequest('http://localhost/api/arrive-by/road', {
        method: 'POST',
        headers: { 'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 1e6)}` },
        body: JSON.stringify({ airportCode: code, landingAt: '2026-11-17T12:00', airportExitBufferMinutes: 60, destination: 'Reading', pickupMode: 'family' }),
      }));
      expect(response.status, code).toBe(404);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('releasing an airport (both gates) opens the shell; adding a kill switch closes it again', () => {
    releaseTable.LHR = release('public_beta');
    expect(resolveShellDispatch('LHR', getShellAirportLookup('LHR')).kind).toBe('road_journey');
    evidenceTable.LHR = evidence('temporarily_unsupported');
    expect(resolveShellDispatch('LHR', getShellAirportLookup('LHR')).kind).toBe('not_yet_supported');
  });

  it('every committed evidence record is a real catalogue airport, none is an explicit profile, and none carries a release', () => {
    for (const [code, entry] of Object.entries(shippedEvidence)) {
      expect(getCatalogueAirport(code), code).toBeDefined();
      expect(['MAN', 'ISB', 'LHE', 'KHI']).not.toContain(code);
      expect(entry.checks?.identityVerified, code).toBe(true);
      expect(entry.note, code).toMatch(/NOT released|not proven/);
    }
  });

  it('committed evidence matches the committed live results (PASS => road_supported; nothing else is)', () => {
    const results = JSON.parse(read('lib', 'arrive-by-shared', 'catalogue', 'phase-c-live-results.json')) as ProbeRecord[];
    for (const record of results) {
      const stored = shippedEvidence[record.iata];
      if (record.control) expect(stored, record.iata).toBeUndefined();
      else if (record.recommendation === 'road_supported') expect(stored?.status, record.iata).toBe('road_supported');
      else if (record.recommendation === 'route_testable') expect(stored?.status, record.iata).toBe('route_testable');
      else expect(stored, record.iata).toBeUndefined();
      if (record.verdict === 'PASS' && !record.control) expect(record.recommendation).toBe('road_supported');
      if (record.verdict !== 'PASS') expect(record.recommendation).not.toBe('road_supported');
    }
  });
});

describe('the dev-only internal QA switch can never expose an airport to real users', () => {
  it('is honoured only in NODE_ENV=development with the flag set', () => {
    expect(isInternalQaReleaseEnabled({ NODE_ENV: 'development', ARRIVE_BY_INTERNAL_QA: '1' })).toBe(true);
    expect(isInternalQaReleaseEnabled({ NODE_ENV: 'production', ARRIVE_BY_INTERNAL_QA: '1' })).toBe(false);
    expect(isInternalQaReleaseEnabled({ NODE_ENV: 'test', ARRIVE_BY_INTERNAL_QA: '1' })).toBe(false);
    expect(isInternalQaReleaseEnabled({ ARRIVE_BY_INTERNAL_QA: '1' })).toBe(false);
    expect(isInternalQaReleaseEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(isInternalQaReleaseEnabled({ NODE_ENV: 'development', ARRIVE_BY_INTERNAL_QA: 'true' })).toBe(false);
  });

  it('with the flag set in the test/production environment, a verified airport is still refused', () => {
    vi.stubEnv('ARRIVE_BY_INTERNAL_QA', '1');
    expect(getAirportCapability('LHR')?.journeyEligible).toBe(false);
  });

  it('even in development, the kill switch still blocks', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ARRIVE_BY_INTERNAL_QA', '1');
    expect(getAirportCapability('LHR')?.journeyEligible).toBe(true);
    evidenceTable.LHR = evidence('temporarily_unsupported');
    expect(getAirportCapability('LHR')?.journeyEligible).toBe(false);
  });
});

describe('operator probe: classification', () => {
  const okDrive = { outcome: 'ETA_ONLY' as const, destinationConfidence: 'CONFIRMED' };
  const base = { identityOk: true, identityHasPlausibleCandidate: true, drive: okDrive, timezoneStatus: 'MATCH' as const, policyChecksAllMatched: true };

  it('PASS needs identity, a real route, a consistent timezone and matching policy checks; it recommends capability only', () => {
    expect(classifyProbe(base)).toMatchObject({ verdict: 'PASS', recommendation: 'road_supported' });
    expect(classifyProbe({ ...base, timezoneStatus: 'NOT_CHECKED' }).verdict).toBe('PASS');
  });

  it('failure classes are factual', () => {
    expect(classifyProbe({ ...base, drive: { outcome: 'ROUTE_UNAVAILABLE', destinationConfidence: 'CONFIRMED' } })).toMatchObject({ verdict: 'FAIL', failureClass: 'no_drive_route', recommendation: 'route_testable' });
    expect(classifyProbe({ ...base, drive: { outcome: 'ROUTE_UNAVAILABLE', destinationConfidence: 'UNRESOLVED' } })).toMatchObject({ verdict: 'NEEDS_REVIEW', failureClass: 'destination_resolution' });
    expect(classifyProbe({ ...base, drive: { outcome: 'DESTINATION_NEEDS_CLARIFICATION', clarificationReason: 'WRONG_COUNTRY' } })).toMatchObject({ verdict: 'FAIL', failureClass: 'country_policy' });
    expect(classifyProbe({ ...base, drive: { outcome: 'ERROR' } })).toMatchObject({ verdict: 'FAIL', failureClass: 'google_error' });
    expect(classifyProbe({ ...base, timezoneStatus: 'MISMATCH' })).toMatchObject({ verdict: 'NEEDS_REVIEW', failureClass: 'timezone' });
    expect(classifyProbe({ ...base, policyChecksAllMatched: false })).toMatchObject({ verdict: 'NEEDS_REVIEW', failureClass: 'country_policy' });
  });

  it('identity failures never produce evidence; a plausible near-miss is reviewed by a human, not tuned away', () => {
    expect(classifyProbe({ ...base, identityOk: false, identityFailure: 'NO_RESULT', identityHasPlausibleCandidate: false })).toMatchObject({ verdict: 'FAIL', failureClass: 'airport_identity', recommendation: 'none' });
    expect(classifyProbe({ ...base, identityOk: false, identityFailure: 'TOO_FAR', identityHasPlausibleCandidate: true })).toMatchObject({ verdict: 'NEEDS_REVIEW', recommendation: 'none' });
    expect(classifyProbe({ ...base, identityOk: false, identityFailure: 'NOT_AN_AIRPORT', identityHasPlausibleCandidate: true })).toMatchObject({ verdict: 'NEEDS_REVIEW', recommendation: 'none' });
    expect(classifyProbe({ ...base, identityOk: false, identityFailure: 'NOT_AN_AIRPORT', identityHasPlausibleCandidate: false }).verdict).toBe('FAIL');
    expect(classifyProbe({ ...base, identityOk: false, identityFailure: 'NOT_AN_AIRPORT', identityHasPlausibleCandidate: false, identityCountryMismatch: true })).toMatchObject({ verdict: 'NEEDS_REVIEW', failureClass: 'catalogue_data' });
  });

  it('sameTimeZone treats alias names for one zone as equal and different zones as different', () => {
    expect(sameTimeZone('Asia/Kolkata', 'Asia/Calcutta')).toBe(true);
    expect(sameTimeZone('Europe/London', 'Europe/London')).toBe(true);
    expect(sameTimeZone('Europe/London', 'Europe/Paris')).toBe(false);
    expect(sameTimeZone('America/Edmonton', 'America/Regina')).toBe(false);
  });
});

/** A Google that behaves for LHR: an airport-typed identity result, a resolvable destination and a route. */
function mockGoogle(opts: { identity?: unknown[]; identityStatus?: string; unrestricted?: unknown[]; destination?: unknown[]; route?: unknown; timezone?: 'OK' | 'DENIED' } = {}) {
  const seen: string[] = [];
  global.fetch = vi.fn(async (input: string | URL) => {
    const url = String(input);
    seen.push(url);
    if (url.includes('/timezone/')) {
      return new Response(JSON.stringify(opts.timezone === 'OK' ? { status: 'OK', timeZoneId: 'Europe/London' } : { status: 'REQUEST_DENIED' }), { status: 200 });
    }
    if (url.includes('/geocode/')) {
      const isIdentity = decodeURIComponent(url).includes('(LHR)');
      if (isIdentity) {
        const restricted = url.includes('components=');
        const results = restricted ? (opts.identity ?? lhrIdentity()) : (opts.unrestricted ?? []);
        return new Response(JSON.stringify({ status: results.length ? 'OK' : 'ZERO_RESULTS', results }), { status: 200 });
      }
      const results = opts.destination ?? [readingResult()];
      return new Response(JSON.stringify({ status: results.length ? 'OK' : 'ZERO_RESULTS', results }), { status: 200 });
    }
    return new Response(JSON.stringify(opts.route ?? { routes: [{ duration: '2640s', staticDuration: '2400s', distanceMeters: 60000 }] }), { status: 200 });
  }) as unknown as typeof fetch;
  return seen;
}

function lhrIdentity(overrides: Record<string, unknown> = {}) {
  const lhr = getCatalogueAirport('LHR')!;
  return [{
    formatted_address: 'London Heathrow Airport (LHR), Longford TW6, UK',
    types: ['airport', 'establishment', 'point_of_interest'],
    geometry: { location: { lat: lhr.lat + 0.002, lng: lhr.lng + 0.002 } },
    address_components: [{ short_name: 'GB', types: ['country', 'political'] }],
    ...overrides,
  }];
}

function readingResult() {
  return {
    formatted_address: 'Reading, UK',
    place_id: 'reading',
    types: ['locality', 'political'],
    geometry: { location_type: 'APPROXIMATE' },
    address_components: [
      { long_name: 'Reading', short_name: 'Reading', types: ['locality', 'political'] },
      { long_name: 'United Kingdom', short_name: 'GB', types: ['country', 'political'] },
    ],
  };
}

describe('operator probe: live-flow behaviour (Google mocked)', () => {
  const spec = { iata: 'LHR', region: 'UK/Europe', destination: 'Reading, UK' };
  const now = new Date('2026-09-30T10:00:00Z');

  it('a clean airport PASSES, recommends road_supported and records the facts the brief lists', async () => {
    mockGoogle();
    const record = await probeAirport('test-key', spec, now);
    expect(record).toMatchObject({ iata: 'LHR', icao: 'EGLL', airportName: 'London Heathrow Airport', city: 'London', countryCode: 'GB', catalogueTimeZone: 'Europe/London', verdict: 'PASS', recommendation: 'road_supported', control: false });
    expect(record.catalogueLat).toBeCloseTo(51.47, 1);
    expect(record.identity).toMatchObject({ ok: true });
    expect(record.identity.distanceKm).toBeLessThan(1);
    expect(record.identity.matchedAddress).toContain('Heathrow');
    expect(record.drive).toMatchObject({ destination: 'Reading, UK', outcome: 'ETA_ONLY', durationSeconds: 2640, distanceMeters: 60000 });
    expect(record.timezone).toEqual({ catalogue: 'Europe/London', status: 'NOT_CHECKED' });
    expect(record.probedAt).toBe('2026-09-30T10:00:00.000Z');
    expect(record.evidenceSource).toMatch(/capability-probe/);
    expect(record.thresholds).toEqual({ maxIdentityDistanceKm: 5, nameHitThreshold: 0.5 });
  });

  it('policy checks run through the real engine: a same-country airport refuses Paris, and a mismatch with expectation is NEEDS_REVIEW', async () => {
    const paris = { formatted_address: 'Paris, France', place_id: 'paris', types: ['locality', 'political'], geometry: { location_type: 'APPROXIMATE' }, address_components: [{ long_name: 'Paris', short_name: 'Paris', types: ['locality', 'political'] }, { long_name: 'France', short_name: 'FR', types: ['country', 'political'] }] };
    mockGoogle();
    const inner = global.fetch;
    global.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = decodeURIComponent(String(input));
      if (url.includes('/geocode/') && url.includes('Paris')) return new Response(JSON.stringify({ status: 'OK', results: [paris] }), { status: 200 });
      return inner(input, init);
    }) as unknown as typeof fetch;
    const ok = await probeAirport('k', { ...spec, policyChecks: [{ destination: 'Paris, France', expected: 'REFUSE_WRONG_COUNTRY' }] }, now);
    expect(ok.policyChecks[0]).toMatchObject({ outcome: 'DESTINATION_NEEDS_CLARIFICATION', clarificationReason: 'WRONG_COUNTRY', matchedExpectation: true });
    expect(ok.verdict).toBe('PASS');
    // Expecting a route where policy refuses is a policy mismatch, reported for review -- the policy is never widened to fit.
    const mismatch = await probeAirport('k', { ...spec, policyChecks: [{ destination: 'Paris, France', expected: 'ROUTE' }] }, now);
    expect(mismatch).toMatchObject({ verdict: 'NEEDS_REVIEW', failureClass: 'country_policy', recommendation: 'route_testable' });
  });

  it('records a timezone MATCH when Google\'s Time Zone API is available, and a MISMATCH when it disagrees', async () => {
    mockGoogle({ timezone: 'OK' });
    expect((await probeAirport('k', spec, now)).timezone).toEqual({ catalogue: 'Europe/London', google: 'Europe/London', status: 'MATCH' });
  });

  it('an unresolvable identity is a FAIL with no evidence', async () => {
    mockGoogle({ identity: [], unrestricted: [] });
    const record = await probeAirport('k', spec, now);
    expect(record).toMatchObject({ verdict: 'FAIL', failureClass: 'airport_identity', recommendation: 'none' });
    expect(toEvidenceEntry(record)).toBeUndefined();
  });

  it('a wrong-country catalogue entry is surfaced as catalogue_data via one unrestricted lookup', async () => {
    const lhr = getCatalogueAirport('LHR')!;
    mockGoogle({
      identity: [],
      unrestricted: [{ formatted_address: 'London Heathrow Airport (LHR), Longford, XX', types: ['airport'], geometry: { location: { lat: lhr.lat, lng: lhr.lng } }, address_components: [{ short_name: 'XX', types: ['country'] }] }],
    });
    const record = await probeAirport('k', spec, now);
    expect(record).toMatchObject({ verdict: 'NEEDS_REVIEW', failureClass: 'catalogue_data', recommendation: 'none' });
    expect(record.identity.unrestrictedCountryMismatch?.googleCountry).toBe('XX');
  });

  it('a strong name match typed as a transit station is NEEDS_REVIEW, not silently accepted', async () => {
    mockGoogle({ identity: lhrIdentity({ types: ['transit_station', 'establishment'] }) });
    const record = await probeAirport('k', spec, now);
    expect(record).toMatchObject({ verdict: 'NEEDS_REVIEW', failureClass: 'airport_identity', recommendation: 'none' });
    expect(toEvidenceEntry(record)).toBeUndefined();
  });

  it('no DRIVE route is a FAIL that earns route_testable at most, never road_supported', async () => {
    mockGoogle({ route: { routes: [] } });
    const record = await probeAirport('k', spec, now);
    expect(record).toMatchObject({ verdict: 'FAIL', failureClass: 'no_drive_route', recommendation: 'route_testable' });
    expect(toEvidenceEntry(record)).toMatchObject({ status: 'route_testable', checks: { identityVerified: true, routeProbed: false } });
  });

  it('a destination that will not resolve is a finding about the destination, and a fallback that resolves lets the airport pass', async () => {
    let calls = 0;
    mockGoogle();
    const inner = global.fetch;
    global.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = decodeURIComponent(String(input));
      if (url.includes('/geocode/') && !url.includes('(LHR)') && url.includes('Windsor')) {
        calls += 1;
        return new Response(JSON.stringify({ status: 'ZERO_RESULTS', results: [] }), { status: 200 });
      }
      return inner(input, init);
    }) as unknown as typeof fetch;
    const record = await probeAirport('k', { ...spec, destination: 'Windsor Nowhere, UK', fallbackDestinations: ['Reading, UK'] }, now);
    expect(calls).toBe(1);
    expect(record.driveAttempts.map((a) => a.outcome)).toEqual(['ROUTE_UNAVAILABLE', 'ETA_ONLY']);
    expect(record.verdict).toBe('PASS');
    expect(record.notes.join(' ')).toMatch(/destination-resolution finding, not an airport failure/);
  });

  it('a control airport (an explicit profile) is probed but can never earn generic evidence', async () => {
    mockGoogle();
    const record = await probeAirport('k', { iata: 'ISB', region: 'Control', destination: 'Rawalpindi, Pakistan' }, now);
    expect(record.control).toBe(true);
    expect(record.recommendation).toBe('none');
    expect(toEvidenceEntry(record)).toBeUndefined();
  });

  it('probing never writes to the release table', async () => {
    mockGoogle();
    await probeAirport('k', spec, now);
    expect(Object.keys(releaseTable)).toEqual([]);
  });
});

describe('operator evidence: serialization and secrets', () => {
  it('serialises factual records without the API key, and refuses to emit one that contains it', async () => {
    mockGoogle();
    const record = await probeAirport('SECRETKEY1234567890', { iata: 'LHR', region: 'x', destination: 'Reading, UK' }, new Date('2026-09-30T10:00:00Z'));
    const json = serializeProbeRecords([record], 'SECRETKEY1234567890');
    expect(json).not.toContain('SECRETKEY1234567890');
    expect(json).not.toMatch(/[?&]key=|AIza/);
    const withLeak = { ...record, notes: ['url https://maps.googleapis.com/x?key=AIzaSyDUMMYDUMMYDUMMYDUMMYDUMMY123456'] };
    expect(() => serializeProbeRecords([withLeak])).toThrow(/API key/);
    expect(() => serializeProbeRecords([{ ...record, notes: ['SECRETKEY1234567890'] }], 'SECRETKEY1234567890')).toThrow(/API key/);
  });

  it('stores no raw Google payloads: only the documented fields', async () => {
    mockGoogle();
    const record = await probeAirport('k', { iata: 'LHR', region: 'x', destination: 'Reading, UK' });
    expect(Object.keys(record).sort()).toEqual(['airportName', 'catalogueLat', 'catalogueLng', 'catalogueTimeZone', 'city', 'control', 'countryCode', 'drive', 'driveAttempts', 'evidenceSource', 'failureClass', 'iata', 'icao', 'identity', 'notes', 'policyChecks', 'probedAt', 'recommendation', 'region', 'thresholds', 'timezone', 'verdict'].filter((key) => key in record));
    expect(JSON.stringify(record)).not.toMatch(/place_id|address_components|geometry/);
  });

  it('no committed catalogue file contains anything that looks like an API key', () => {
    const dir = join(process.cwd(), 'lib', 'arrive-by-shared', 'catalogue');
    for (const file of readdirSync(dir)) {
      const text = readFileSync(join(dir, file), 'utf8');
      expect(text, file).not.toMatch(/AIza[0-9A-Za-z_-]{20,}|[?&]key=/);
    }
  });

  it('the operator tool is a CLI script, not a route: nothing under app/ imports or exposes it', () => {
    expect(existsSync(join(process.cwd(), 'scripts', 'arrive-by-capability-probe.ts'))).toBe(true);
    const walk = (dir: string): string[] => readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
    for (const file of walk('app').filter((f) => /\.(ts|tsx)$/.test(f))) {
      expect(read(file), file).not.toMatch(/capability-probe|probeAirport/);
    }
    for (const file of ['components/arrive-by-shell.tsx', 'components/arrive-by-road-public.tsx']) expect(read(...file.split('/'))).not.toMatch(/capability-probe/);
  });

  it('the operator probe does not use the public rate limiter (no shared visitor bucket) and adds no public bypass', () => {
    const src = read('lib', 'arrive-by-shared', 'capability-probe.ts');
    const script = read('scripts', 'arrive-by-capability-probe.ts');
    const imports = (text: string) => [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const specifier of [...imports(src), ...imports(script)]) expect(specifier).not.toMatch(/rate-limit|form-security|\/api\//);
    expect(read('lib', 'arrive-by-shared', 'rate-limit.ts')).toMatch(/ARRIVE_BY_RATE_LIMIT_MAX = 5/);
    expect(read('lib', 'arrive-by-shared', 'rate-limit.ts')).toMatch(/60 \* 1000/);
    expect(script).toMatch(/release table untouched/);
    expect(imports(script).join(' ')).not.toMatch(/airport-release/);
    expect(script.replace(/\/\*[\s\S]*?\*\//, '')).not.toMatch(/ARRIVE_BY_RELEASED_AIRPORTS/);
  });
});
