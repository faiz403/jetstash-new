import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/founder/arrive-by-journey/route';
import { cleanJourneyInput } from '@/lib/arrive-by-journey/clean-journey-input';
import { checkInternalAccess, createJourneyCallGuard, founderEnabled, INTERNAL_TOKEN_HEADER } from '@/lib/arrive-by-journey/internal-access';
import { getArrivalAirportOptions, getDepartureAirportOptions } from '@/lib/arrive-by-journey/airport-options';
import { DEPARTURE_CAPABILITY_EVIDENCE, type DepartureEvidence } from '@/lib/arrive-by-journey/departure-capability';
import { getAirportCapability } from '@/lib/arrive-by-shared/airport-capability';
import type { JourneyPlan } from '@/lib/arrive-by-journey/types';

/**
 * F3: the composed internal full-journey API. Google and the shared call-budget
 * store (Upstash REST) are both stubbed fetches, so the REAL store adapter, guard,
 * ledger, origin search, resolver and road engine all run end to end.
 */

const originalFetch = global.fetch;
const TOKEN = 'internal-test-token-0123456789';
const UPSTASH = 'https://budget.upstash.test';

beforeEach(() => {
  vi.stubEnv('GOOGLE_ROUTES_API_KEY', 'test-key');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2027-01-14T09:00:00.000Z'));
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const at = (countryCode: string, countryName: string, city: string, lat: number, lng: number, types = ['locality', 'political']) => ({
  formatted_address: `${city}, ${countryName}`, place_id: `place-${city}`, types, geometry: { location_type: 'APPROXIMATE', location: { lat, lng } },
  address_components: [{ long_name: city, short_name: city, types: ['locality', 'political'] }, { long_name: countryName, short_name: countryCode, types: ['country', 'political'] }],
});
const venue = (countryCode: string, placeId: string, address: string) => ({
  formatted_address: address, place_id: placeId, types: ['establishment', 'point_of_interest'], geometry: { location_type: 'ROOFTOP', location: { lat: 53.7, lng: -2.7 } },
  address_components: [{ long_name: 'Country', short_name: countryCode, types: ['country', 'political'] }],
});

interface Env { google: string[]; routes: Array<{ origin: Record<string, unknown>; destination: Record<string, unknown>; departureTime: string }>; store: Map<string, number>; storeCalls: Array<unknown> }

/** Stubs Google (geocode + routes) and an Upstash-compatible REST pipeline backed by a real Map. */
function world(places: Record<string, unknown[]>, drive: (departureMs: number, toAirport: boolean) => number | null): Env {
  const env: Env = { google: [], routes: [], store: new Map(), storeCalls: [] };
  global.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith(UPSTASH)) {
      const commands = JSON.parse(String(init?.body)) as string[][];
      env.storeCalls.push(commands);
      const [, key, delta] = commands[0];
      const next = (env.store.get(key) ?? 0) + Number(delta);
      env.store.set(key, next);
      return new Response(JSON.stringify([{ result: next }, { result: 1 }]), { status: 200 });
    }
    if (url.includes('/geocode/')) {
      env.google.push('geocode');
      const address = decodeURIComponent(new URL(url).searchParams.get('address') ?? '').toLowerCase();
      const key = Object.keys(places).find((k) => address.includes(k));
      const results = key ? places[key] : [];
      return new Response(JSON.stringify({ status: results.length ? 'OK' : 'ZERO_RESULTS', results }), { status: 200 });
    }
    env.google.push('routes');
    const body = JSON.parse(String(init?.body));
    env.routes.push(body);
    const minutes = drive(Date.parse(body.departureTime), !('address' in body.destination));
    if (minutes === null) return new Response('{}', { status: 200 });
    return new Response(JSON.stringify({ routes: [{ duration: `${Math.round(minutes * 60)}s`, staticDuration: `${Math.round(minutes * 60) - 60}s` }] }), { status: 200 });
  }) as unknown as typeof fetch;
  return env;
}

let ipCounter = 0;
const ip = () => `198.51.100.${(ipCounter += 1)}.${Math.floor(Math.random() * 1e6)}`;

function post(body: unknown, headers: Record<string, string> = {}, clientIp = ip()) {
  return POST(new NextRequest('http://localhost/api/founder/arrive-by-journey', {
    method: 'POST',
    headers: { 'x-forwarded-for': clientIp, 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}

const PRESTON_TO_MIRPUR = {
  start: 'Preston, Lancashire', departureAirport: 'MAN', arrivalAirport: 'ISB', destination: 'Mirpur, Azad Kashmir',
  flight: { departsLocal: '2027-01-15T11:00', arrivesLocal: '2027-01-15T23:30' },
  preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60, pickupWaitMinutes: 15, pickupMode: 'family' },
};
const PRESTON = at('GB', 'United Kingdom', 'Preston', 53.7632, -2.7031);
const MIRPUR = at('PK', 'Pakistan', 'Mirpur', 33.1478, 73.7517);
const drive = (toAirportMinutes: number | ((t: number) => number), fromAirportMinutes: number) => (t: number, toAirport: boolean) => (toAirport ? (typeof toAirportMinutes === 'function' ? toAirportMinutes(t) : toAirportMinutes) : fromAirportMinutes);

async function json(response: Response) {
  return (await response.json()) as JourneyPlan & { error?: string };
}

describe('the access gates: the endpoint looks like it does not exist unless every gate passes', () => {
  it('production without the founder flag is a 404, before anything else (no rate-limit bucket, no Google)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const env = world({}, () => 55);
    const response = await post(PRESTON_TO_MIRPUR, { [INTERNAL_TOKEN_HEADER]: TOKEN });
    expect(response.status).toBe(404);
    expect(env.google).toEqual([]);
  });

  it('production with the flag but NO configured token, a weak token, or a wrong/missing token is the same 404', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FOUNDER_DASHBOARD_ENABLED', 'true');
    const env = world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    const bodies: unknown[] = [];
    // not configured
    let r = await post(PRESTON_TO_MIRPUR, { [INTERNAL_TOKEN_HEADER]: TOKEN }); bodies.push(await r.json()); expect(r.status).toBe(404);
    // configured but weak
    vi.stubEnv('ARRIVE_BY_INTERNAL_TOKEN', 'short');
    r = await post(PRESTON_TO_MIRPUR, { [INTERNAL_TOKEN_HEADER]: 'short' }); bodies.push(await r.json()); expect(r.status).toBe(404);
    // configured, wrong / missing / different length
    vi.stubEnv('ARRIVE_BY_INTERNAL_TOKEN', TOKEN);
    for (const headers of [{}, { [INTERNAL_TOKEN_HEADER]: 'wrong' }, { [INTERNAL_TOKEN_HEADER]: `${TOKEN}x` }, { [INTERNAL_TOKEN_HEADER]: TOKEN.toUpperCase() }] as Array<Record<string, string>>) {
      r = await post(PRESTON_TO_MIRPUR, headers); bodies.push(await r.json()); expect(r.status).toBe(404);
    }
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1); // every refusal is byte-identical
    expect(env.google).toEqual([]);
  });

  it('the right token in production gets past the gate (then needs durable storage)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FOUNDER_DASHBOARD_ENABLED', 'true');
    vi.stubEnv('ARRIVE_BY_INTERNAL_TOKEN', TOKEN);
    world({}, () => 55);
    expect((await post(PRESTON_TO_MIRPUR, { [INTERNAL_TOKEN_HEADER]: TOKEN })).status).toBe(503);
  });

  it('development needs no token, but a token that IS configured is still enforced', async () => {
    expect(checkInternalAccess(null, { NODE_ENV: 'development' })).toEqual({ allowed: true });
    expect(checkInternalAccess(null, { NODE_ENV: 'development', ARRIVE_BY_INTERNAL_TOKEN: TOKEN })).toMatchObject({ allowed: false, reason: 'TOKEN_MISMATCH' });
    expect(checkInternalAccess(TOKEN, { NODE_ENV: 'development', ARRIVE_BY_INTERNAL_TOKEN: TOKEN })).toEqual({ allowed: true });
    expect(founderEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(founderEnabled({ NODE_ENV: 'production', FOUNDER_DASHBOARD_ENABLED: 'true' })).toBe(true);
    expect(founderEnabled({ NODE_ENV: 'production', FOUNDER_DASHBOARD_ENABLED: 'yes' })).toBe(false);
  });

  it('the token comparison is constant-time and the token is never echoed', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'arrive-by-journey', 'internal-access.ts'), 'utf8');
    expect(src).toContain('timingSafeEqual');
    expect(readFileSync(join(process.cwd(), 'app', 'api', 'founder', 'arrive-by-journey', 'route.ts'), 'utf8')).not.toMatch(/console\.(log|error|info)\(/);
  });
});

describe('durable shared storage is a hard prerequisite for a deployed beta', () => {
  const production = () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FOUNDER_DASHBOARD_ENABLED', 'true');
    vi.stubEnv('ARRIVE_BY_INTERNAL_TOKEN', TOKEN);
  };

  it('production with no Upstash/KV configured: 503, and NOT ONE Google call is made', async () => {
    production();
    const env = world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    const response = await post(PRESTON_TO_MIRPUR, { [INTERNAL_TOKEN_HEADER]: TOKEN });
    expect(response.status).toBe(503);
    expect((await json(response)).error).toMatch(/call-budget storage is not configured/);
    expect(env.google).toEqual([]);
  });

  it('production with the store configured (Upstash env) runs the journey and uses the REAL shared store: reserve 10, settle to actual', async () => {
    production();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', UPSTASH);
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'store-token');
    const env = world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    const response = await post(PRESTON_TO_MIRPUR, { [INTERNAL_TOKEN_HEADER]: TOKEN });
    expect(response.status).toBe(200);
    const plan = await json(response);
    expect(plan.calls?.used).toBe(4);
    expect(env.google).toHaveLength(4);
    expect(env.store.get('arrive-by:google-calls:2027-01')).toBe(4); // reserved 10, refunded 6
    const deltas = env.storeCalls.map((c) => (c as string[][])[0][2]);
    expect(deltas).toEqual(['10', '-6']);
  });

  it('a store outage refuses the journey (CANNOT CONFIRM, no Google call): an unreachable counter never means unlimited', async () => {
    production();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', UPSTASH);
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'store-token');
    const env = world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    const inner = global.fetch;
    global.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => (String(input).startsWith(UPSTASH) ? new Response('down', { status: 500 }) : inner(input, init))) as unknown as typeof fetch;
    const plan = await json(await post(PRESTON_TO_MIRPUR, { [INTERNAL_TOKEN_HEADER]: TOKEN }));
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.notEvidenced?.reason).toBe('MONTHLY_BUDGET_UNAVAILABLE');
    expect(env.google).toEqual([]);
  });

  it('MONTHLY HARD STOP: with 1,995 used, a 10-call reservation is refused, refunded, and no Google call is made', async () => {
    production();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', UPSTASH);
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'store-token');
    const env = world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    env.store.set('arrive-by:google-calls:2027-01', 1995);
    const plan = await json(await post(PRESTON_TO_MIRPUR, { [INTERNAL_TOKEN_HEADER]: TOKEN }));
    expect(plan.notEvidenced?.reason).toBe('MONTHLY_BUDGET_UNAVAILABLE');
    expect(env.google).toEqual([]);
    expect(env.store.get('arrive-by:google-calls:2027-01')).toBe(1995);
  });

  it('crossing 50% and 80% raises one internal warning each, with counts only and no journey detail', async () => {
    production();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', UPSTASH);
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'store-token');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const env = world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    env.store.set('arrive-by:google-calls:2027-01', 995);
    await post(PRESTON_TO_MIRPUR, { [INTERNAL_TOKEN_HEADER]: TOKEN }); // 1005 after reserve: crosses 1000
    env.store.set('arrive-by:google-calls:2027-01', 1595);
    await post(PRESTON_TO_MIRPUR, { [INTERNAL_TOKEN_HEADER]: TOKEN }); // 1605: crosses 1600
    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/50%.*1005\/2000/);
    expect(lines[1]).toMatch(/80%.*1605\/2000/);
    for (const line of lines) expect(line).not.toMatch(/Preston|Mirpur|MAN|ISB/);
  });

  it('in development the in-process store is used (never in production), so local testing needs no infrastructure', () => {
    expect(createJourneyCallGuard({ NODE_ENV: 'development' }).durableConfigured).toBe(false);
    expect(createJourneyCallGuard({ NODE_ENV: 'production' }).durableConfigured).toBe(false);
    expect(createJourneyCallGuard({ NODE_ENV: 'production', KV_REST_API_URL: UPSTASH, KV_REST_API_TOKEN: 't' }).durableConfigured).toBe(true);
  });
});

describe('GOLDEN full chains through the API (start → departure airport → flight → arrival airport → destination)', () => {
  it('Preston → MAN → ISB → Mirpur', async () => {
    const env = world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    const plan = await json(await post(PRESTON_TO_MIRPUR));
    expect(plan.headline).toEqual({
      leave: 'Leave Preston by around 08:00',
      airport: 'You should reach Manchester Airport with your chosen 2-hour buffer.',
      arrival: 'Expected final arrival: Mirpur around 03:35',
    });
    expect(plan.state).toBe('ESTIMATE_ONLY');
    expect(plan.timeline.map((leg) => leg.kind)).toEqual(['ORIGIN_ACCESS', 'DEPARTURE_BUFFER', 'FLIGHT', 'ARRIVAL_EXIT', 'PICKUP_WAIT', 'ONWARD']);
    expect(plan.calls).toEqual({ used: 4, ceiling: 10, breakdown: { geocode: 2, routes: 2, identity: 0, other: 0 } });
    expect(env.google).toHaveLength(4);
  });

  it('Camden/London → LHR → DXB → Sharjah', async () => {
    const CAMDEN = at('GB', 'United Kingdom', 'Camden Town', 51.539, -0.1426, ['sublocality_level_1', 'political', 'sublocality']);
    const SHARJAH = at('AE', 'United Arab Emirates', 'Sharjah', 25.3463, 55.4209);
    world({ camden: [CAMDEN], sharjah: [SHARJAH] }, drive(50, 25));
    const plan = await json(await post({
      start: 'Camden Town, London', departureAirport: 'LHR', arrivalAirport: 'DXB', destination: 'Sharjah, United Arab Emirates',
      flight: { departsLocal: '2027-01-15T09:30', arrivesLocal: '2027-01-15T19:30' },
      preferences: { departureAirportBufferMinutes: 180, arrivalExitMinutes: 45 },
    }));
    // D = 09:30Z - 3 h = 06:30Z. q0 05:30Z (+50 = 06:20Z) -> q1 06:30 - 50 - 2.5 = 05:37:30Z -> floor 05:35.
    expect(plan.headline?.leave).toBe('Leave Camden Town by around 05:35');
    expect(plan.headline?.airport).toBe('You should reach London Heathrow Airport with your chosen 3-hour buffer.');
    // Landing 19:30 GST = 15:30Z; + 45 = 16:15Z; + 25 = 16:40Z = 20:40 GST.
    expect(plan.headline?.arrival).toBe('Expected final arrival: Sharjah around 20:40');
    expect(plan.flight?.elapsedMinutes).toBe(360);
    expect(plan.calls?.used).toBe(5);
  });

  it('Falkirk → EDI → MAN → Sheffield', async () => {
    vi.setSystemTime(new Date('2027-02-09T09:00:00.000Z'));
    world({ falkirk: [at('GB', 'United Kingdom', 'Falkirk', 56.0019, -3.7839)], sheffield: [at('GB', 'United Kingdom', 'Sheffield', 53.3811, -1.4701)] }, drive(26, 70));
    const plan = await json(await post({
      start: 'Falkirk', departureAirport: 'EDI', arrivalAirport: 'MAN', destination: 'Sheffield',
      flight: { departsLocal: '2027-02-10T09:00', arrivesLocal: '2027-02-10T10:10' },
      preferences: { departureAirportBufferMinutes: 90, arrivalExitMinutes: 20 },
    }));
    expect(plan.headline).toEqual({
      leave: 'Leave Falkirk by around 07:00',
      airport: 'You should reach Edinburgh Airport with your chosen 1 hour 30 minute buffer.',
      arrival: 'Expected final arrival: Sheffield around 11:40',
    });
    expect(plan.calls?.used).toBe(5);
  });

  it('a deadline is judged end to end (POSSIBLE WITH MARGIN, then NOT FEASIBLE)', async () => {
    world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    const withMargin = await json(await post({ ...PRESTON_TO_MIRPUR, preferences: { ...PRESTON_TO_MIRPUR.preferences, finalDeadlineLocal: '2027-01-16T06:00', destinationReadinessMinutes: 30 } }));
    expect(withMargin.state).toBe('POSSIBLE_WITH_MARGIN');
    expect(withMargin.deadline?.marginMinutes).toBe(115);
    const missed = await json(await post({ ...PRESTON_TO_MIRPUR, preferences: { ...PRESTON_TO_MIRPUR.preferences, finalDeadlineLocal: '2027-01-16T03:30' } }));
    expect(missed.state).toBe('NOT_FEASIBLE');
  });
});

describe('confirmation and selection: the START and the final DESTINATION, independently', () => {
  it('a venue START stops at confirmation; Yes (re-verified server-side) completes; a forged id does not', async () => {
    const hall = venue('GB', 'start-venue', 'Preston Guild Hall, Preston PR1 3NA, UK');
    const env = world({ 'guild hall': [hall], mirpur: [MIRPUR] }, drive(55, 170));
    const first = await json(await post({ ...PRESTON_TO_MIRPUR, start: 'Guild Hall' }));
    expect(first.startDetail?.pendingConfirmation).toEqual({ placeId: 'start-venue', formattedAddress: 'Preston Guild Hall, Preston PR1 3NA, UK' });
    expect(first.leaveBy).toBeUndefined();
    expect(first.finalArrival).toBeDefined(); // the arrival side is independent and still evidenced
    expect((await json(await post({ ...PRESTON_TO_MIRPUR, start: 'Guild Hall', startConfirmedPlaceId: 'forged' }))).notEvidenced?.reason).toBe('START_LOCATION_UNCONFIRMED');
    const done = await json(await post({ ...PRESTON_TO_MIRPUR, start: 'Guild Hall', startConfirmedPlaceId: 'start-venue' }));
    expect(done.leaveBy).toBeDefined();
    expect(env.routes.some((r) => 'location' in r.origin)).toBe(true);
  });

  it('a multi-place START stops at selection; picking one of the returned candidates completes', async () => {
    const one = { ...venue('GB', 'one', '1 High St, Preston, UK'), partial_match: true };
    const two = { ...venue('GB', 'two', '2 Low Rd, Preston, UK'), partial_match: true };
    world({ 'cafe': [one, two], mirpur: [MIRPUR] }, drive(55, 170));
    const first = await json(await post({ ...PRESTON_TO_MIRPUR, start: 'Cafe Preston' }));
    expect(first.startDetail?.pendingSelection?.candidates.map((c) => c.placeId)).toEqual(['one', 'two']);
    expect((await json(await post({ ...PRESTON_TO_MIRPUR, start: 'Cafe Preston', startSelectedPlaceId: 'stale' }))).startDetail?.pendingSelection).toBeDefined();
    const picked = await json(await post({ ...PRESTON_TO_MIRPUR, start: 'Cafe Preston', startSelectedPlaceId: 'two' }));
    expect(picked.leaveBy).toBeDefined();
  });

  it('a venue DESTINATION stops at confirmation; confirming completes; the start is unaffected', async () => {
    const hospital = venue('PK', 'dest-venue', 'Aga Khan University Hospital, Karachi, Pakistan');
    world({ preston: [PRESTON], hospital: [hospital] }, drive(55, 170));
    const first = await json(await post({ ...PRESTON_TO_MIRPUR, destination: 'Aga Khan Hospital' }));
    expect(first.arrivalDetail?.pendingConfirmation?.placeId).toBe('dest-venue');
    expect(first.leaveBy).toBeDefined();
    expect(first.finalArrival).toBeUndefined();
    const done = await json(await post({ ...PRESTON_TO_MIRPUR, destination: 'Aga Khan Hospital', confirmedPlaceId: 'dest-venue' }));
    expect(done.finalArrival).toBeDefined();
    expect(done.startDetail).toBeUndefined();
  });

  it('a multi-place DESTINATION stops at selection; picking a candidate completes', async () => {
    const a = { ...venue('PK', 'da', '1 Mall Rd, Lahore, Pakistan'), partial_match: true };
    const b = { ...venue('PK', 'db', '9 Canal Rd, Lahore, Pakistan'), partial_match: true };
    world({ preston: [PRESTON], 'nishat': [a, b] }, drive(55, 170));
    const first = await json(await post({ ...PRESTON_TO_MIRPUR, arrivalAirport: 'LHE', destination: 'Nishat Hotel Lahore' }));
    expect(first.arrivalDetail?.pendingSelection?.candidates).toHaveLength(2);
    const picked = await json(await post({ ...PRESTON_TO_MIRPUR, arrivalAirport: 'LHE', destination: 'Nishat Hotel Lahore', selectedPlaceId: 'db' }));
    expect(picked.finalArrival).toBeDefined();
  });

  it('a non-UK start is unsuitable and a wrong-country destination is refused, each on its own side', async () => {
    world({ paris: [at('FR', 'France', 'Paris', 48.8566, 2.3522)], amritsar: [at('IN', 'India', 'Amritsar', 31.63, 74.87)], preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    expect((await json(await post({ ...PRESTON_TO_MIRPUR, start: 'Paris, France' }))).notEvidenced?.reason).toBe('START_LOCATION_UNSUITABLE');
    const wrongDestination = await json(await post({ ...PRESTON_TO_MIRPUR, destination: 'Amritsar' }));
    expect(wrongDestination.arrivalDetail?.clarificationReason).toBe('WRONG_COUNTRY');
    expect(wrongDestination.leaveBy).toBeDefined();
  });
});

describe('overnight and clock-change handling through the API', () => {
  it('overnight: a 06:00 flight with a 7-hour drive to the airport leaves the previous evening', async () => {
    vi.setSystemTime(new Date('2027-01-13T09:00:00.000Z'));
    world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(420, 170));
    const plan = await json(await post({ ...PRESTON_TO_MIRPUR, flight: { departsLocal: '2027-01-15T06:00', arrivesLocal: '2027-01-15T18:30' } }));
    expect(plan.leaveBy).toMatchObject({ iso: '2027-01-14T20:55:00.000Z', clock: '20:55' });
    expect(plan.calls?.used).toBe(5);
  });

  it('UK clock-change day: real minutes across the 01:00Z change, BST clock at the airport', async () => {
    vi.setSystemTime(new Date('2027-03-26T09:00:00.000Z'));
    world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(180, 170));
    const plan = await json(await post({ ...PRESTON_TO_MIRPUR, flight: { departsLocal: '2027-03-28T06:00', arrivesLocal: '2027-03-28T18:30' } }));
    expect(plan.leaveBy?.iso).toBe('2027-03-27T23:55:00.000Z');
    expect(plan.airportArriveBy).toMatchObject({ iso: '2027-03-28T03:00:00.000Z', clock: '04:00' });
  });

  it('a nonexistent local time (spring-forward gap) is rejected before any Google call or reservation', async () => {
    const env = world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    const plan = await json(await post({ ...PRESTON_TO_MIRPUR, flight: { departsLocal: '2027-03-28T01:30', arrivesLocal: '2027-03-28T18:30' } }));
    expect(plan.notEvidenced?.reason).toBe('INVALID_INPUT');
    expect(env.google).toEqual([]);
  });
});

describe('capability gates through the API', () => {
  const table = DEPARTURE_CAPABILITY_EVIDENCE as Record<string, DepartureEvidence>;

  it('a departure airport without directional capability (BRS) is refused with zero Google calls', async () => {
    const env = world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    const plan = await json(await post({ ...PRESTON_TO_MIRPUR, departureAirport: 'BRS' }));
    expect(plan.notEvidenced?.reason).toBe('DEPARTURE_AIRPORT_NOT_EVIDENCED');
    expect(env.google).toEqual([]);
  });

  it('MAN with its departure evidence removed is refused as a departure even though it is a public arrival profile', async () => {
    const saved = table.MAN;
    delete table.MAN;
    try {
      const env = world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
      expect((await json(await post(PRESTON_TO_MIRPUR))).notEvidenced?.reason).toBe('DEPARTURE_AIRPORT_NOT_EVIDENCED');
      expect(env.google).toEqual([]);
    } finally {
      table.MAN = saved;
    }
  });

  it('BEK and LYR are refused as arrival airports; a non-UK airport is refused as a departure', async () => {
    const env = world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    for (const arrivalAirport of ['BEK', 'LYR']) expect((await json(await post({ ...PRESTON_TO_MIRPUR, arrivalAirport }))).notEvidenced?.reason, arrivalAirport).toBe('AIRPORT_NOT_SUPPORTED');
    expect((await json(await post({ ...PRESTON_TO_MIRPUR, departureAirport: 'DXB' }))).notEvidenced?.reason).toBe('AIRPORT_NOT_SUPPORTED');
    expect(env.google).toEqual([]);
  });

  it('a connection declared on the flight is CANNOT CONFIRM with no spend', async () => {
    const env = world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    const plan = await json(await post({ ...PRESTON_TO_MIRPUR, flight: { ...PRESTON_TO_MIRPUR.flight, declaredConnections: 1 } }));
    expect(plan.notEvidenced?.reason).toBe('CONNECTION_NOT_MODELLED');
    expect(env.google).toEqual([]);
  });

  it('the form offers exactly the airports the API accepts: departure = evidence airports, arrival = capability-approved airports', () => {
    const departures = getDepartureAirportOptions().map((o) => o.code);
    expect(departures).toEqual(expect.arrayContaining(['MAN', 'LHR', 'EDI']));
    expect(departures).not.toContain('BRS');
    expect(departures.length).toBe(Object.keys(DEPARTURE_CAPABILITY_EVIDENCE).length);
    const arrivals = getArrivalAirportOptions().map((o) => o.code);
    expect(arrivals).toEqual(expect.arrayContaining(['ISB', 'LHE', 'KHI', 'MAN', 'LHR', 'DXB', 'DEL', 'SYD', 'GRU', 'SIN']));
    for (const code of ['BEK', 'LYR', 'BRS']) expect(arrivals).not.toContain(code);
    for (const code of arrivals) expect(getAirportCapability(code)?.capabilityApproved, code).toBe(true);
  });
});

describe('request handling', () => {
  it('shares the product-wide rate limit (5 submissions / 60 s) and counts a submission once, not its Google calls', async () => {
    world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    const client = ip();
    for (let i = 0; i < 5; i += 1) expect((await post(PRESTON_TO_MIRPUR, {}, client)).status).toBe(200); // each journey makes 4 Google calls
    expect((await post(PRESTON_TO_MIRPUR, {}, client)).status).toBe(429);
  });

  it('is allow-listed: hostile coordinates, timezone, country and an entered origin duration are ignored', async () => {
    const env = world({ preston: [PRESTON], mirpur: [MIRPUR] }, drive(55, 170));
    const plan = await json(await post({ ...PRESTON_TO_MIRPUR, originLegMinutes: 3, originMode: 'ENTERED', lat: 1, lng: 2, timeZone: 'Asia/Tokyo', countryCode: 'JP', routeTarget: { lat: 9, lng: 9 } }));
    expect(plan.timeline[0].minutes).toBe(55); // the live leg, not the "3" a client tried to enter
    expect(JSON.stringify(env.routes)).not.toMatch(/"latitude":(1|9),/);
  });

  it('validation errors are our own messages; nothing raw from Google or the runtime reaches the client', async () => {
    world({}, () => 55);
    const cases: Array<[unknown, RegExp]> = [
      [{ ...PRESTON_TO_MIRPUR, start: '' }, /starting from/],
      [{ ...PRESTON_TO_MIRPUR, departureAirport: 'Manchester' }, /flying from/],
      [{ ...PRESTON_TO_MIRPUR, arrivalAirport: '' }, /landing at/],
      [{ ...PRESTON_TO_MIRPUR, flight: { departsLocal: 'tomorrow', arrivesLocal: '2027-01-15T23:30' } }, /flight leaves/],
      [{ ...PRESTON_TO_MIRPUR, preferences: { ...PRESTON_TO_MIRPUR.preferences, departureAirportBufferMinutes: 9999 } }, /whole minutes/],
      [{ ...PRESTON_TO_MIRPUR, confirmedPlaceId: 'x'.repeat(201) }, /reference is not valid/],
      [{ ...PRESTON_TO_MIRPUR, startSelectedPlaceId: 'x'.repeat(201) }, /reference is not valid/],
      ['{not json', /journey details/],
    ];
    for (const [body, pattern] of cases) {
      const response = await post(body);
      expect(response.status).toBe(422);
      expect((await json(response)).error).toMatch(pattern);
    }
  });

  it('an oversized body is refused (413) and a missing Google key is a 503, both before any lookup', async () => {
    const env = world({}, () => 55);
    const big = await POST(new NextRequest('http://localhost/x', { method: 'POST', headers: { 'x-forwarded-for': ip(), 'content-length': '999999' }, body: '{}' }));
    expect(big.status).toBe(413);
    vi.stubEnv('GOOGLE_ROUTES_API_KEY', '');
    expect((await post(PRESTON_TO_MIRPUR)).status).toBe(503);
    expect(env.google).toEqual([]);
  });

  it('cleanJourneyInput copies only the documented fields and always leaves the origin live', () => {
    const cleaned = cleanJourneyInput({ ...PRESTON_TO_MIRPUR, originLegMinutes: 5, lat: 1, extra: 'x' });
    expect(Object.keys(cleaned).sort()).toEqual(['arrivalAirport', 'confirmedPlaceId', 'departureAirport', 'destination', 'flight', 'preferences', 'selectedPlaceId', 'start', 'startConfirmedPlaceId', 'startSelectedPlaceId']);
    expect(JSON.stringify(cleaned)).not.toMatch(/originLegMinutes|lat|extra/);
  });
});

describe('the internal UI and its non-public status', () => {
  const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
  const walk = (dir: string): string[] => readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
  const page = read('app', 'founder', 'arrive-by-journey', 'page.tsx');
  const component = read('components', 'founder', 'arrive-by-journey.tsx');

  it('the page uses the founder gate, notFound(), force-dynamic and noindex on both paths', () => {
    expect(page).toContain("process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true'");
    expect(page).toContain('notFound()');
    expect(page).toContain("export const dynamic = 'force-dynamic'");
    expect((page.match(/robots:\s*{\s*index:\s*false,\s*follow:\s*false\s*}/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('absent from the sitemap and navigation; /founder stays disallowed; nothing else links to it', () => {
    expect(read('app', 'sitemap.ts')).not.toMatch(/arrive-by-journey/);
    expect(read('app', 'robots.ts')).toMatch(/disallow:\s*['"]\/founder['"]/);
    const own = ['app/founder/arrive-by-journey/page.tsx', 'components/founder/arrive-by-journey.tsx', 'app/api/founder/arrive-by-journey/route.ts'];
    for (const file of [...walk('app'), ...walk('components'), ...walk('lib')].map((f) => f.replace(/\\/g, '/')).filter((f) => /\.(ts|tsx)$/.test(f) && !own.includes(f))) {
      expect(read(file), file).not.toMatch(/founder\/arrive-by-journey/);
    }
  });

  it('the existing arrival-only /arrive-by product is untouched: it imports none of the journey code', () => {
    for (const file of ['app/arrive-by/page.tsx', 'components/arrive-by-shell.tsx', 'components/arrive-by-road-public.tsx', 'components/arrive-by-pakistan-public.tsx', 'components/arrive-by-manchester-public.tsx']) {
      expect(read(...file.split('/')), file).not.toMatch(/arrive-by-journey/);
    }
    for (const file of walk('app/api').map((f) => f.replace(/\\/g, '/')).filter((f) => /arrive-by/.test(f) && !/arrive-by-journey/.test(f))) {
      expect(read(file), file).not.toMatch(/arrive-by-journey/);
    }
  });

  it('the form asks its questions in the founder\'s order and answers "When should I leave?" first', () => {
    const order = ['Where are you starting from?', 'Which airport are you flying from?', 'When does the flight leave?', 'Where are you landing?', 'When does it land?', 'Where are you going after that?'];
    const positions = order.map((q) => component.indexOf(q));
    for (const p of positions) expect(p).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(component.indexOf('plan.headline.leave')).toBeLessThan(component.indexOf('plan.headline.airport'));
    expect(component.indexOf('plan.headline.airport')).toBeLessThan(component.indexOf('plan.headline.arrival'));
    expect(component).toContain('When should I leave?');
  });

  it('confirmation and selection controls exist for BOTH the start and the destination', () => {
    for (const key of ['startConfirmedPlaceId', 'startSelectedPlaceId', 'confirmedPlaceId', 'selectedPlaceId']) expect(component).toContain(key);
    expect(component).toMatch(/Yes — use this place/);
    expect(component).toMatch(/aria-live="polite"/);
    expect(component).toMatch(/resultRef\.current\?\.focus\(\)/);
  });

  it('posts only to the internal route; the token is a password field held in memory; no analytics, storage or logging', () => {
    expect(component).toContain('/api/founder/arrive-by-journey');
    expect(component).toContain('type="password"');
    expect(component).not.toMatch(/localStorage|sessionStorage|document\.cookie|track\(|console\.(log|error|warn|info)\(/);
    expect(component).not.toMatch(/GOOGLE_ROUTES_API_KEY|ARRIVE_BY_INTERNAL_TOKEN/);
  });

  it('the worldwide catalogue never reaches the client: the component and page take airport lists as props', () => {
    const specifiers = [...component.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const specifier of specifiers) expect(specifier).not.toMatch(/airport-catalogue|airports\.generated|catalogue-search|airport-capability|departure-capability$/);
    expect(page).toContain('getDepartureAirportOptions()');
  });

  it('nothing is released: the release table is still empty', () => {
    expect(read('lib', 'arrive-by-shared', 'airport-release.ts')).toMatch(/ARRIVE_BY_RELEASED_AIRPORTS: Readonly<Record<string, ReleaseEntry>> = \{\};/);
  });
});
