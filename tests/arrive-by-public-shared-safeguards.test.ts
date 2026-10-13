import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as manchester } from '@/app/api/arrive-by-manchester/google/route';
import { POST as pakistan } from '@/app/api/arrive-by-pakistan/google/route';
import { POST as road } from '@/app/api/arrive-by/road/route';
import { POST as canonical } from '@/app/api/arrive-by/journey/route';
import { POST as interaction } from '@/app/api/arrive-by/interaction/route';
import { computeManchesterJourney } from '@/lib/arrive-by-shared/manchester-journey';
import { computePakistanJourney } from '@/lib/arrive-by-pakistan/journey';
import { computeRoadJourney } from '@/lib/arrive-by-shared/road-journey';
import { cleanInput as cleanManchester } from '@/lib/arrive-by-shared/manchester-clean-input';
import { cleanInput as cleanPakistan } from '@/lib/arrive-by-pakistan/clean-input';
import { cleanRoadInput } from '@/lib/arrive-by-shared/clean-road-input';
import { getEstimateLabel, resolveAirportProfile } from '@/lib/arrive-by-shared/airport-capability';
import { resolveRoutingOrigin } from '@/lib/arrive-by-shared/airport-registry';
import { JOURNEY_CALL_CEILING, MONTHLY_CALL_LIMIT } from '@/lib/arrive-by-journey/call-budget';
import { PublicCallBudgetUnavailable, runPublicGoogleCalculation } from '@/lib/arrive-by-shared/public-call-budget';

// All HTTP is mocked, including the actual Redis REST adapter. No live quota or provider is touched.
const STORE = 'https://shared-budget.example.test';
const MONTH = 'arrive-by:google-calls:2027-01';
const roadBody = {
  airportCode: 'ISB', landingAt: '2027-01-15T12:00', airportExitBufferMinutes: 60,
  pickupMode: 'family', pickupWaitMinutes: 15, destination: 'Rawalpindi',
  deadline: '2027-01-15T15:00', destinationReadinessBufferMinutes: 20,
};
const manchesterBody = {
  originId: 'man-terminal-2', destination: 'Sheffield', availableAt: '2027-01-15T12:00',
  deadline: '2027-01-15T14:30', readinessMinutes: 15,
};
const canonicalBody = {
  start: 'Preston', departureAirport: 'MAN', arrivalAirport: 'ISB', destination: 'Rawalpindi',
  flight: { departsLocal: '2027-01-15T11:00', arrivesLocal: '2027-01-15T20:00' },
  preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60, pickupMode: 'family' },
};
const legacy = [
  { name: 'Manchester', post: manchester, body: manchesterBody },
  { name: 'Pakistan', post: pakistan, body: roadBody },
  { name: 'road', post: road, body: roadBody },
];
const all = [...legacy, { name: 'canonical', post: canonical, body: canonicalBody }];
let client = 0;
function request(body: unknown, ip = `198.51.100.${++client}`) {
  return new NextRequest('https://jetstash.test/api/test', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body),
  });
}
const locality = (city: string, country: string) => ({
  formatted_address: `${city}, ${country}`, place_id: `fixture-${city}`, types: ['locality', 'political'],
  geometry: { location_type: 'APPROXIMATE', location: { lat: country === 'GB' ? 53.7 : 33.6, lng: country === 'GB' ? -2.7 : 73.0 } },
  address_components: [{ long_name: city, short_name: city, types: ['locality', 'political'] }, { long_name: country, short_name: country, types: ['country', 'political'] }],
});

function world(options: { failure?: 'rate' | 'reserve' | 'settle'; providerFailure?: boolean; pending?: boolean; hold?: Promise<void> } = {}) {
  const counts = new Map<string, number>();
  const writes: string[][][] = [];
  const google: Array<{ url: string; body?: Record<string, unknown> }> = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith(STORE)) {
      const commands = JSON.parse(String(init?.body)) as string[][];
      writes.push(commands);
      const [, key, rawDelta] = commands[0];
      const delta = Number(rawDelta);
      if ((options.failure === 'rate' && key.startsWith('arrive-by:journey-rate:'))
        || (options.failure === 'reserve' && key === MONTH && delta > 0)
        || (options.failure === 'settle' && key === MONTH && delta < 0)) return new Response('{}', { status: 503 });
      // No await between read and write: matches the store's atomic INCRBY contract.
      const next = (counts.get(key) ?? 0) + delta;
      counts.set(key, next);
      return new Response(JSON.stringify([{ result: next }, { result: 1 }]));
    }
    if (!/https:\/\/(maps|routes|places)\.googleapis\.com\//.test(url)) throw new Error('Unexpected unmocked HTTP request');
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    google.push({ url, body });
    if (options.hold) await options.hold;
    if (options.providerFailure) throw new Error('Fixture provider transport failure');
    if (url.includes('/geocode/')) {
      const address = new URL(url).searchParams.get('address') ?? '';
      const place = address.includes('Sheffield') ? locality('Sheffield', 'GB')
        : address.includes('Preston') ? locality('Preston', 'GB') : locality('Rawalpindi', 'PK');
      if (options.pending) {
        place.types = ['establishment', 'point_of_interest'];
        place.formatted_address = 'Fixture venue address';
      }
      return new Response(JSON.stringify({ status: 'OK', results: [place] }));
    }
    if (url.includes('places.googleapis.com')) return new Response('{}');
    if (body?.travelMode === 'TRANSIT') return new Response(JSON.stringify({ routes: [] }));
    return new Response(JSON.stringify({ routes: [{ duration: '1200s', staticDuration: '1100s', distanceMeters: 10000 }] }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return { counts, writes, google, fetchMock };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2027-01-14T09:00:00Z'));
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('GOOGLE_ROUTES_API_KEY', 'fixture-key');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', STORE);
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fixture-token');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('all legacy APIs use the durable canonical calculation limiter', () => {
  it.each(legacy)('$name uses a hashed shared key, the same five/60s allowance and no provider spend on the sixth', async ({ post, body }) => {
    const env = world();
    const ip = '203.0.113.50';
    for (let i = 0; i < 5; i += 1) expect((await post(request(body, ip))).status).toBe(200);
    const before = env.google.length;
    expect((await post(request(body, ip))).status).toBe(429);
    expect(env.google).toHaveLength(before);
    const rateWrites = env.writes.filter((w) => w[0][1].startsWith('arrive-by:journey-rate:'));
    expect(new Set(rateWrites.map((w) => w[0][1])).size).toBe(1);
    expect(rateWrites[0][0][1]).toMatch(/^arrive-by:journey-rate:[a-f0-9]{64}$/);
    expect(rateWrites.every((w) => w[0][2] === '1' && w[1][2] === '60')).toBe(true);
  });

  it('switching across all four APIs does not reset the durable client allowance; interaction is independent', async () => {
    const env = world();
    const ip = '203.0.113.51';
    expect((await interaction(request({ event: 'journey_started' }, ip))).status).toBeLessThan(300);
    for (const endpoint of all) expect((await endpoint.post(request(endpoint.body, ip))).status).toBe(200);
    expect((await road(request(roadBody, ip))).status).toBe(200);
    const spent = env.google.length;
    expect((await canonical(request(canonicalBody, ip))).status).toBe(429);
    expect(env.google).toHaveLength(spent);
    expect([...env.counts.keys()].filter((key) => key.startsWith('arrive-by:journey-rate:'))).toHaveLength(1);
    expect([...env.counts.keys()].filter((key) => key.startsWith('arrive-by:interaction-rate:'))).toHaveLength(1);
  });

  it.each(legacy)('$name fails closed on durable rate backend failure', async ({ post, body }) => {
    const env = world({ failure: 'rate' });
    expect((await post(request(body))).status).toBe(503);
    expect(env.google).toEqual([]);
    expect(env.writes.some((w) => w[0][1] === MONTH)).toBe(false);
  });

  it.each(legacy)('$name refuses production without configured durable storage', async ({ post, body }) => {
    const env = world();
    for (const key of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) vi.stubEnv(key, '');
    expect((await post(request(body))).status).toBe(503);
    expect(env.fetchMock).not.toHaveBeenCalled();
  });
});

describe('one monthly ledger across legacy and canonical provider calls', () => {
  it('charges actual calls once, uses one month key across all four APIs and refuses further requests at the boundary', async () => {
    const env = world();
    env.counts.set(MONTH, 1980);
    for (const endpoint of all) {
      const before = env.google.length;
      const counted = env.counts.get(MONTH)!;
      expect((await endpoint.post(request(endpoint.body))).status).toBe(200);
      expect(env.counts.get(MONTH)).toBe(counted + env.google.length - before);
    }
    const spent = env.google.length;
    const counted = env.counts.get(MONTH)!;
    expect(counted).toBe(1980 + spent);
    expect(counted).toBeGreaterThan(1990);
    for (const endpoint of legacy) expect((await endpoint.post(request(endpoint.body))).status).toBe(503);
    const plan = await (await canonical(request(canonicalBody))).json();
    expect(plan.notEvidenced?.reason).toBe('MONTHLY_BUDGET_UNAVAILABLE');
    expect(env.google).toHaveLength(spent);
    expect(env.counts.get(MONTH)).toBe(counted);
    expect(new Set(env.writes.filter((w) => /google-calls:2027-01$/.test(w[0][1])).map((w) => w[0][1]))).toEqual(new Set([MONTH]));
  });

  it.each(legacy)('$name cannot call Google when the monthly allowance is exhausted', async ({ post, body }) => {
    const env = world();
    env.counts.set(MONTH, MONTHLY_CALL_LIMIT);
    expect((await post(request(body))).status).toBe(503);
    expect(env.google).toEqual([]);
    expect(env.counts.get(MONTH)).toBe(MONTHLY_CALL_LIMIT);
  });

  it('concurrent cross-API reservations cannot spend past the available allowance', async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const env = world({ hold });
    env.counts.set(MONTH, MONTHLY_CALL_LIMIT - JOURNEY_CALL_CEILING);
    const pending = all.map((endpoint) => endpoint.post(request(endpoint.body)));
    for (let i = 0; i < 40 && env.google.length === 0; i += 1) await Promise.resolve();
    expect(env.google).toHaveLength(1); // only one reservation can reach any provider
    release();
    const responses = await Promise.all(pending);
    const legacySuccess = responses.slice(0, 3).filter((r) => r.status === 200).length;
    const canonicalPlan = await responses[3].json();
    expect(legacySuccess + Number(canonicalPlan.notEvidenced?.reason !== 'MONTHLY_BUDGET_UNAVAILABLE')).toBe(1);
    expect(env.google.length).toBeLessThanOrEqual(JOURNEY_CALL_CEILING);
    expect(env.counts.get(MONTH)).toBe(MONTHLY_CALL_LIMIT - JOURNEY_CALL_CEILING + env.google.length);
  });

  it.each(legacy)('$name fails closed on a monthly reservation backend failure', async ({ post, body }) => {
    const env = world({ failure: 'reserve' });
    expect((await post(request(body))).status).toBe(503);
    expect(env.google).toEqual([]);
  });

  it.each(legacy)('$name settlement failure retains a safe overcount, never an unmetered next request', async ({ post, body }) => {
    const env = world({ failure: 'settle' });
    env.counts.set(MONTH, 1988);
    expect((await post(request(body))).status).toBe(200);
    expect(env.counts.get(MONTH)).toBe(1998);
    const used = env.google.length;
    expect((await post(request(body))).status).toBe(503);
    expect(env.google).toHaveLength(used);
    expect(env.counts.get(MONTH)).toBeGreaterThanOrEqual(1998);
  });

  it.each(legacy)('$name settles actual attempted calls when the provider fails or destination needs confirmation', async ({ post, body }) => {
    for (const options of [{ providerFailure: true }, { pending: true }]) {
      const env = world(options);
      await post(request(body));
      expect(env.google).toHaveLength(1);
      expect(env.counts.get(MONTH)).toBe(1);
    }
  });

  it('the guarded fetch counts geocoding, Places and Routes before dispatch, and stops even swallowed ceiling refusals', async () => {
    const env = world();
    const urls = ['https://maps.googleapis.com/maps/api/geocode/json', 'https://places.googleapis.com/v1/places/fixture', 'https://routes.googleapis.com/directions/v2:computeRoutes'];
    await runPublicGoogleCalculation(async (meteredFetch) => { for (const url of urls) await meteredFetch(url); });
    expect(env.google).toHaveLength(3);
    expect(env.counts.get(MONTH)).toBe(3);
    await expect(runPublicGoogleCalculation(async (meteredFetch) => {
      for (let i = 0; i < JOURNEY_CALL_CEILING + 1; i += 1) {
        try { await meteredFetch(urls[1]); } catch { /* emulate an engine's unavailable fallback */ }
      }
      return 'must not escape as a trusted partial result';
    })).rejects.toBeInstanceOf(PublicCallBudgetUnavailable);
    expect(env.google).toHaveLength(3 + JOURNEY_CALL_CEILING);
    expect(env.counts.get(MONTH)).toBe(3 + JOURNEY_CALL_CEILING);
  });

  it('persistent counters and alert logs contain only hashed client keys and numeric aggregate counts', async () => {
    const env = world();
    env.counts.set(MONTH, 995); // force count-only monthly alert
    for (const endpoint of all) await endpoint.post(request(endpoint.body, '203.0.113.99'));
    const recorded = JSON.stringify({ writes: env.writes, alerts: vi.mocked(console.warn).mock.calls });
    expect(recorded).not.toMatch(/Rawalpindi|Sheffield|Preston|203\.0\.113\.99|landingAt|destination|deadline|place_id|fixture-key/);
    expect(env.writes.every((w) => w[0][0] === 'INCRBY' && Number.isFinite(Number(w[0][2])) && w[1][0] === 'EXPIRE')).toBe(true);
    expect(vi.mocked(console.warn)).toHaveBeenCalledWith(expect.stringMatching(/^\[arrive-by\] monthly Google call allowance at 50%: \d+\/2000 \(2027-01\)$/));
  });
});

describe('legacy response shapes and calculations remain compatible under the new guard', () => {
  it.each(legacy)('$name returns the unchanged engine result without exposing accounting fields', async ({ name, post, body }) => {
    const env = world();
    let expected;
    if (name === 'Manchester') expected = await computeManchesterJourney('fixture-key', cleanManchester(body), { expectedCountryCodes: ['GB'], regionBias: 'uk' });
    else if (name === 'Pakistan') expected = await computePakistanJourney('fixture-key', cleanPakistan(body));
    else {
      const profile = resolveAirportProfile('ISB')!;
      expected = { ...await computeRoadJourney('fixture-key', { code: profile.code, displayName: profile.displayName, timeZone: profile.timeZone, origin: resolveRoutingOrigin(profile) }, cleanRoadInput(body, () => true), { expectedCountryCodes: ['PK'], regionBias: 'pk' }), estimateLabel: getEstimateLabel(profile) };
    }
    env.google.length = 0;
    const response = await post(request(body));
    expect(response.status).toBe(200);
    const actual = await response.json();
    expect(actual).toEqual(JSON.parse(JSON.stringify(expected)));
    expect(actual).not.toHaveProperty('calls');
    expect(actual).not.toHaveProperty('monthlyUsedAfterReserve');
    expect(env.counts.get(MONTH)).toBe(env.google.length);
    if (name !== 'Manchester') expect(actual).toMatchObject({ expectedArrival: '2027-01-15T08:35:00.000Z', marginMinutes: 65, driveDurationSeconds: 1200 });
  });
});
