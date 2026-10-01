import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { planFullJourney } from '@/lib/arrive-by-journey/plan';
import { resolveJourneyAirports } from '@/lib/arrive-by-journey/airports';
import {
  CallCeilingExceeded, GoogleCallLedger, InMemoryCallBudgetStore, JOURNEY_CALL_CEILING, MONTHLY_CALL_LIMIT, MonthlyCallGuard, UpstashRedisCallBudgetStore, getConfiguredCallBudgetStore,
  type CallBudgetStore,
} from '@/lib/arrive-by-journey/call-budget';
import type { JourneyInput, ResolvedLeg } from '@/lib/arrive-by-journey/types';

/**
 * Orchestrator and call-budget tests. Google is always a stubbed fetch: these
 * prove metering, fail-closed budgets, airport rules and reuse of the existing
 * resolver/road engine -- never a live request.
 */

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

const NOW = '2027-01-14T09:00:00.000Z';
const KEY = 'test-key';

function locality(countryCode: string, countryName: string, city: string) {
  return {
    formatted_address: `${city}, ${countryName}`, place_id: `place-${city}`, types: ['locality', 'political'], geometry: { location_type: 'APPROXIMATE' },
    address_components: [{ long_name: city, short_name: city, types: ['locality', 'political'] }, { long_name: countryName, short_name: countryCode, types: ['country', 'political'] }],
  };
}

function venue(countryCode: string, placeId = 'venue-1') {
  return { formatted_address: '1 Test Street, Testtown', place_id: placeId, types: ['establishment', 'point_of_interest'], geometry: { location_type: 'ROOFTOP' }, address_components: [{ long_name: 'Country', short_name: countryCode, types: ['country', 'political'] }] };
}

interface Google { calls: string[]; fetch: typeof fetch }
function google(geocodeResults: unknown[], driveSeconds = 10200): Google {
  const calls: string[] = [];
  const fetchStub = vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push(url.includes('/geocode/') ? 'geocode' : 'routes');
    if (url.includes('/geocode/')) return new Response(JSON.stringify({ status: geocodeResults.length ? 'OK' : 'ZERO_RESULTS', results: geocodeResults }), { status: 200 });
    return new Response(JSON.stringify({ routes: [{ duration: `${driveSeconds}s`, staticDuration: `${driveSeconds - 100}s`, distanceMeters: 90000 }] }), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetch: fetchStub };
}

const guardWith = (store: CallBudgetStore = new InMemoryCallBudgetStore(), extra: ConstructorParameters<typeof MonthlyCallGuard>[0] = {}) =>
  new MonthlyCallGuard({ store, requireDurable: false, now: () => new Date('2027-01-14T09:00:00Z'), ...extra });

const PRESTON_TO_MIRPUR: JourneyInput = {
  start: 'Preston, Lancashire',
  departureAirport: 'MAN',
  originLegMinutes: 55,
  flight: { departsLocal: '2027-01-15T11:00', arrivesLocal: '2027-01-15T23:30', label: 'PK 702' },
  arrivalAirport: 'ISB',
  destination: 'Mirpur, Azad Kashmir',
  preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60, pickupWaitMinutes: 15, pickupMode: 'family' },
};

const MONTH_KEY = 'arrive-by:google-calls:2027-01';

describe('GOLDEN end to end (Google stubbed): Preston → MAN → ISB → Mirpur', () => {
  it('reuses the shared resolver and road engine, meters exactly the calls it makes, and settles the monthly reservation', async () => {
    const g = google([locality('PK', 'Pakistan', 'Mirpur')]);
    const store = new InMemoryCallBudgetStore();
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guardWith(store), originMode: 'ENTERED', nowIso: NOW, baseFetch: g.fetch });

    expect(plan.headline).toEqual({
      leave: 'Leave Preston by around 08:05',
      airport: 'You should reach Manchester Airport with your chosen 2-hour buffer.',
      arrival: 'Expected final arrival: Mirpur around 03:35',
    });
    expect(plan.state).toBe('ESTIMATE_ONLY');
    expect(g.calls).toEqual(['geocode', 'routes']);
    expect(plan.calls).toEqual({ used: 2, ceiling: JOURNEY_CALL_CEILING, breakdown: { geocode: 1, routes: 1, identity: 0, other: 0 } });
    // Reserved 10 up front, settled to the 2 actually used.
    expect(await store.incrementBy(MONTH_KEY, 0, 1)).toBe(2);
    expect(plan.timeline.find((leg) => leg.kind === 'ONWARD')?.evidence).toMatchObject({ kind: 'GOOGLE_ROUTES', checkedAt: NOW });
  });

  it('the Pakistan destination gate is the existing one: an Indian destination is refused before any drive request', async () => {
    const g = google([locality('IN', 'India', 'Amritsar')]);
    const plan = await planFullJourney({ ...PRESTON_TO_MIRPUR, destination: 'Amritsar' }, { apiKey: KEY, guard: guardWith(), originMode: 'ENTERED', nowIso: NOW, baseFetch: g.fetch });
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.notEvidenced?.reason).toBe('ARRIVAL_DESTINATION_UNCONFIRMED');
    expect(plan.arrivalDetail?.clarificationReason).toBe('WRONG_COUNTRY');
    expect(g.calls).toEqual(['geocode']);
    expect(plan.leaveBy?.clock).toBe('08:05'); // the origin side is still evidenced
  });

  it('a venue destination stops at confirmation and hands back the engine\'s own confirmation payload; a forged id does not unlock it', async () => {
    const g = google([venue('PK', 'venue-1')]);
    const first = await planFullJourney({ ...PRESTON_TO_MIRPUR, destination: 'Some Hospital' }, { apiKey: KEY, guard: guardWith(), originMode: 'ENTERED', nowIso: NOW, baseFetch: g.fetch });
    expect(first.arrivalDetail?.pendingConfirmation?.placeId).toBe('venue-1');
    const forged = await planFullJourney({ ...PRESTON_TO_MIRPUR, destination: 'Some Hospital', confirmedPlaceId: 'forged' }, { apiKey: KEY, guard: guardWith(), originMode: 'ENTERED', nowIso: NOW, baseFetch: g.fetch });
    expect(forged.state).toBe('CANNOT_CONFIRM');
    expect(forged.arrivalDetail?.outcome).toBe('DESTINATION_NEEDS_CONFIRMATION');
    const genuine = await planFullJourney({ ...PRESTON_TO_MIRPUR, destination: 'Some Hospital', confirmedPlaceId: 'venue-1' }, { apiKey: KEY, guard: guardWith(), originMode: 'ENTERED', nowIso: NOW, baseFetch: g.fetch });
    expect(genuine.headline?.arrival).toMatch(/around 03:35/);
  });
});

describe('GOLDEN end to end (Google stubbed): UK start → flight → MAN → Sheffield', () => {
  it('uses the GB-only gate and the manually entered flight', async () => {
    const g = google([locality('GB', 'United Kingdom', 'Sheffield')], 4200);
    const plan = await planFullJourney({
      start: 'Edinburgh', departureAirport: 'EDI', originLegMinutes: 40,
      flight: { departsLocal: '2027-02-10T09:00', arrivesLocal: '2027-02-10T10:10' },
      arrivalAirport: 'MAN', destination: 'Sheffield',
      preferences: { departureAirportBufferMinutes: 90, arrivalExitMinutes: 20 },
    }, { apiKey: KEY, guard: guardWith(), originMode: 'ENTERED', nowIso: '2027-02-09T09:00:00.000Z', baseFetch: g.fetch });
    expect(plan.leaveBy?.iso).toBe('2027-02-10T06:50:00.000Z');
    expect(plan.finalArrival?.iso).toBe('2027-02-10T11:40:00.000Z');
    expect(plan.calls?.used).toBe(2);
  });

  it('a non-GB destination is refused under MAN\'s GB-only rule', async () => {
    const g = google([locality('FR', 'France', 'Lille')]);
    const plan = await planFullJourney({
      start: 'Edinburgh', departureAirport: 'EDI', originLegMinutes: 40,
      flight: { departsLocal: '2027-02-10T09:00', arrivesLocal: '2027-02-10T10:10' },
      arrivalAirport: 'MAN', destination: 'Lille', preferences: { departureAirportBufferMinutes: 90, arrivalExitMinutes: 20 },
    }, { apiKey: KEY, guard: guardWith(), originMode: 'ENTERED', nowIso: '2027-02-09T09:00:00.000Z', baseFetch: g.fetch });
    expect(plan.arrivalDetail?.clarificationReason).toBe('WRONG_COUNTRY');
  });
});

describe('validated global road capability remains separate from transit-first', () => {
  it('uses the existing drive model for DXB → Atlantis The Royal only in its unreleased internal capability mode', async () => {
    const atlantis = {
      formatted_address: 'Atlantis The Royal, Dubai, United Arab Emirates', place_id: 'place-atlantis', types: ['establishment', 'point_of_interest'],
      geometry: { location_type: 'ROOFTOP' }, address_components: [{ long_name: 'United Arab Emirates', short_name: 'AE', types: ['country', 'political'] }],
    };
    const g = google([atlantis], 1800);
    const plan = await planFullJourney({
      start: 'London', departureAirport: 'LHR', originLegMinutes: 70,
      flight: { departsLocal: '2027-02-10T09:00', arrivesLocal: '2027-02-10T20:00' },
      arrivalAirport: 'DXB', destination: 'Atlantis The Royal', confirmedPlaceId: 'place-atlantis',
      preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60, pickupWaitMinutes: 10, pickupMode: 'pre-booked' },
    }, { apiKey: KEY, guard: guardWith(), airportMode: 'internal', originMode: 'ENTERED', transitFirst: 'LIVE', nowIso: '2027-02-09T09:00:00.000Z', baseFetch: g.fetch });

    expect(plan.state).toBe('ESTIMATE_ONLY');
    expect(plan.timeline.find((leg) => leg.kind === 'ONWARD')?.evidence.source).toBe('Google traffic-aware driving estimate');
    expect(plan.arrivalDetail?.transit).toBeUndefined();
    expect(g.calls).toEqual(['geocode', 'routes']);
  });
});

describe('the 10-call hard stop', () => {
  it('the ledger allows exactly 10 Google calls, refuses the 11th, and never sends it', async () => {
    const base = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    const ledger = new GoogleCallLedger(JOURNEY_CALL_CEILING, base);
    expect(JOURNEY_CALL_CEILING).toBe(10);
    for (let i = 0; i < 10; i += 1) await ledger.fetch('https://routes.googleapis.com/x');
    expect(ledger.used).toBe(10);
    expect(ledger.exhausted).toBe(false);
    expect(() => ledger.fetch('https://maps.googleapis.com/maps/api/geocode/json')).toThrow(CallCeilingExceeded);
    expect(ledger.exhausted).toBe(true);
    expect(base).toHaveBeenCalledTimes(10);
    expect(ledger.remaining).toBe(0);
  });

  it('the ledger classifies calls so the profile of a journey is measurable', async () => {
    const ledger = new GoogleCallLedger(10, vi.fn(async () => new Response('{}')) as unknown as typeof fetch);
    await ledger.fetch('https://maps.googleapis.com/maps/api/geocode/json?x=1');
    await ledger.fetch('https://routes.googleapis.com/directions/v2:computeRoutes');
    await ledger.fetch('https://routes.googleapis.com/directions/v2:computeRoutes');
    expect(ledger.breakdown()).toEqual({ geocode: 1, routes: 2, identity: 0, other: 0 });
  });

  it('a journey that needs an 11th call is CANNOT CONFIRM, not a guess, and Google is contacted exactly 10 times', async () => {
    const underlying = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    const store = new InMemoryCallBudgetStore();
    const greedy = async (_key: string, _airports: unknown, _input: unknown, ledger: GoogleCallLedger): Promise<{ leg: ResolvedLeg }> => {
      // Mimics the engines: transport errors are swallowed, so the refusal must still be visible on the ledger.
      for (let i = 0; i < 12; i += 1) {
        try { await ledger.fetch('https://maps.googleapis.com/maps/api/geocode/json'); } catch { /* swallowed like the real engines */ }
      }
      return { leg: { status: 'OK', expectedSeconds: 600, evidence: { kind: 'GOOGLE_ROUTES', source: 'greedy test provider' } } };
    };
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guardWith(store), originMode: 'ENTERED', nowIso: NOW, baseFetch: underlying, arrivalLegProvider: greedy as never });
    expect(underlying).toHaveBeenCalledTimes(10);
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.stateLabel).toBe('CANNOT CONFIRM');
    expect(plan.notEvidenced?.reason).toBe('CALL_CEILING_REACHED');
    expect(plan.finalArrival).toBeUndefined(); // an over-budget leg is not trusted even though the provider returned a number
    expect(plan.calls).toMatchObject({ used: 10, ceiling: 10 });
    expect(await store.incrementBy(MONTH_KEY, 0, 1)).toBe(10); // all 10 spent, none refunded
  });

  it('the real engine hitting a smaller ceiling stops the same way (ceiling 1: the geocode is sent, the drive request is not)', async () => {
    const g = google([locality('PK', 'Pakistan', 'Mirpur')]);
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guardWith(), originMode: 'ENTERED', nowIso: NOW, baseFetch: g.fetch, ceiling: 1 });
    expect(g.calls).toEqual(['geocode']);
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.notEvidenced?.reason).toBe('CALL_CEILING_REACHED');
  });

  it('a normal journey uses far fewer than 10 calls (the current profile is 2)', async () => {
    const g = google([locality('PK', 'Pakistan', 'Mirpur')]);
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guardWith(), originMode: 'ENTERED', nowIso: NOW, baseFetch: g.fetch });
    expect(plan.calls?.used).toBeLessThan(10);
  });
});

describe('the monthly guard', () => {
  it('has the founder\'s numbers: 2,000 calls, alerts at 50% and 80%', () => {
    expect(MONTHLY_CALL_LIMIT).toBe(2000);
  });

  it('hard stop at 100%: with 1,995 used a 10-call reservation is refused, refunded, and no Google call is made', async () => {
    const store = new InMemoryCallBudgetStore();
    await store.incrementBy(MONTH_KEY, 1995, 1);
    const g = google([locality('PK', 'Pakistan', 'Mirpur')]);
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guardWith(store), originMode: 'ENTERED', nowIso: NOW, baseFetch: g.fetch });
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.notEvidenced?.reason).toBe('MONTHLY_BUDGET_UNAVAILABLE');
    expect(g.calls).toEqual([]);
    expect(await store.incrementBy(MONTH_KEY, 0, 1)).toBe(1995);
  });

  it('a reservation that lands exactly on the limit is allowed', async () => {
    const store = new InMemoryCallBudgetStore();
    await store.incrementBy(MONTH_KEY, 1990, 1);
    expect((await guardWith(store).reserve(10)).granted).toBe(true);
  });

  it('warns once at 50% (1,000) and once at 80% (1,600), internally', async () => {
    const store = new InMemoryCallBudgetStore();
    const alerts: Array<{ level: number; used: number }> = [];
    const guard = guardWith(store, { onAlert: (alert) => alerts.push({ level: alert.level, used: alert.used }) });
    await store.incrementBy(MONTH_KEY, 985, 1);
    await guard.reserve(10); // 995: no alert
    expect(alerts).toEqual([]);
    await guard.reserve(10); // 1005: crosses 1000
    expect(alerts).toEqual([{ level: 50, used: 1005 }]);
    await guard.reserve(10); // 1015: already alerted
    expect(alerts).toHaveLength(1);
    await store.incrementBy(MONTH_KEY, 580, 1); // 1595
    await guard.reserve(10); // 1605: crosses 1600
    expect(alerts.map((a) => a.level)).toEqual([50, 80]);
  });

  it('counts per calendar month: a new month starts from zero', async () => {
    const store = new InMemoryCallBudgetStore();
    await store.incrementBy('arrive-by:google-calls:2027-01', 1999, 1);
    const february = new MonthlyCallGuard({ store, requireDurable: false, now: () => new Date('2027-02-01T00:00:01Z') });
    expect((await february.reserve(10)).granted).toBe(true);
  });

  it('settling gives back exactly the unused calls and never more', async () => {
    const store = new InMemoryCallBudgetStore();
    const guard = guardWith(store);
    const reservation = await guard.reserve(10);
    await guard.settle(reservation, 3);
    expect(await store.incrementBy(MONTH_KEY, 0, 1)).toBe(3);
    const second = await guard.reserve(10);
    await guard.settle(second, 25); // over-report: nothing is refunded
    expect(await store.incrementBy(MONTH_KEY, 0, 1)).toBe(13);
  });

  it('fails closed: no store, a non-durable store in production, or a throwing store all refuse', async () => {
    expect((await new MonthlyCallGuard({ requireDurable: false }).reserve()).granted).toBe(false);
    expect(await new MonthlyCallGuard({ store: new InMemoryCallBudgetStore(), requireDurable: true }).reserve()).toMatchObject({ granted: false, reason: 'STORE_UNAVAILABLE' });
    const broken: CallBudgetStore = { durable: true, incrementBy: async () => { throw new Error('down'); } };
    expect(await new MonthlyCallGuard({ store: broken, requireDurable: true }).reserve()).toMatchObject({ granted: false, reason: 'STORE_UNAVAILABLE' });
  });

  it('a journey with no guard store never reaches Google', async () => {
    const g = google([locality('PK', 'Pakistan', 'Mirpur')]);
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: new MonthlyCallGuard({ requireDurable: false }), originMode: 'ENTERED', nowIso: NOW, baseFetch: g.fetch });
    expect(plan.notEvidenced?.reason).toBe('MONTHLY_BUDGET_UNAVAILABLE');
    expect(g.calls).toEqual([]);
  });

  it('the visitor rate limit is untouched by the sub-calls a journey makes (submissions, not Google calls)', () => {
    const rateLimit = readFileSync(join(process.cwd(), 'lib', 'arrive-by-shared', 'rate-limit.ts'), 'utf8');
    expect(rateLimit).toMatch(/ARRIVE_BY_RATE_LIMIT_MAX = 5/);
    for (const file of ['call-budget.ts', 'plan.ts', 'providers.ts', 'solver.ts']) {
      const specifiers = [...readFileSync(join(process.cwd(), 'lib', 'arrive-by-journey', file), 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const specifier of specifiers) expect(specifier, file).not.toMatch(/rate-limit|form-security/);
    }
  });
});

describe('the shared-storage adapter (Upstash Redis REST)', () => {
  it('sends one authenticated INCRBY+EXPIRE pipeline and returns the new total', async () => {
    const seen: Array<{ url: string; auth: string | null; body: unknown }> = [];
    const fetchStub = (async (url: string, init: RequestInit) => {
      seen.push({ url, auth: new Headers(init.headers).get('authorization'), body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify([{ result: 12 }, { result: 1 }]), { status: 200 });
    }) as unknown as typeof fetch;
    const store = new UpstashRedisCallBudgetStore('https://example.upstash.io/', 'secret-token', fetchStub);
    expect(await store.incrementBy(MONTH_KEY, 10, 3456000)).toBe(12);
    expect(seen).toEqual([{ url: 'https://example.upstash.io/pipeline', auth: 'Bearer secret-token', body: [['INCRBY', MONTH_KEY, '10'], ['EXPIRE', MONTH_KEY, '3456000']] }]);
    expect(store.durable).toBe(true);
  });

  it('any bad response throws, so the guard turns it into a refusal', async () => {
    for (const bad of [new Response('nope', { status: 500 }), new Response(JSON.stringify([{ error: 'WRONGTYPE' }]), { status: 200 }), new Response(JSON.stringify([{ result: 'x' }]), { status: 200 })]) {
      const store = new UpstashRedisCallBudgetStore('https://x', 't', (async () => bad) as unknown as typeof fetch);
      await expect(store.incrementBy('k', 1, 1)).rejects.toThrow();
    }
  });

  it('is only configured when both env vars exist (Upstash or Vercel KV names); never guessed', () => {
    expect(getConfiguredCallBudgetStore({})).toBeUndefined();
    expect(getConfiguredCallBudgetStore({ UPSTASH_REDIS_REST_URL: 'https://x' })).toBeUndefined();
    expect(getConfiguredCallBudgetStore({ UPSTASH_REDIS_REST_URL: 'https://x', UPSTASH_REDIS_REST_TOKEN: 't' })?.durable).toBe(true);
    expect(getConfiguredCallBudgetStore({ KV_REST_API_URL: 'https://x', KV_REST_API_TOKEN: 't' })?.durable).toBe(true);
  });

  it('the token never appears in any result, error or serialized plan', async () => {
    const store = new UpstashRedisCallBudgetStore('https://x', 'TOP-SECRET-TOKEN', (async () => new Response('bad', { status: 500 })) as unknown as typeof fetch);
    const error = await store.incrementBy('k', 1, 1).catch((e: Error) => e);
    expect(String((error as Error).message)).not.toContain('TOP-SECRET-TOKEN');
  });
});

describe('airport rules (UK departures only; capability-gated arrivals)', () => {
  it('UK departure airports are accepted; a non-UK departure airport is refused', () => {
    for (const code of ['MAN', 'LHR', 'EDI', 'BHX', 'PIK']) expect(resolveJourneyAirports(code, 'ISB').ok, code).toBe(true);
    for (const code of ['DXB', 'ISB', 'JFK', 'ZZZ']) expect(resolveJourneyAirports(code, 'ISB'), code).toMatchObject({ ok: false, reason: 'AIRPORT_NOT_SUPPORTED' });
  });

  it('BEK stays unsupported and LYR stays unresolved: catalogued, never usable', () => {
    for (const code of ['BEK', 'LYR']) expect(resolveJourneyAirports('MAN', code), code).toMatchObject({ ok: false, reason: 'AIRPORT_NOT_SUPPORTED' });
  });

  it('arrivals need capability: explicit profiles and road_supported airports are accepted; unknown codes are not', () => {
    for (const code of ['ISB', 'LHE', 'KHI', 'MAN', 'LHR', 'DXB', 'DEL', 'SYD', 'GRU', 'SIN']) expect(resolveJourneyAirports('EDI', code).ok, code).toBe(true);
    expect(resolveJourneyAirports('EDI', 'ZZZ')).toMatchObject({ ok: false });
  });

  it('public mode additionally requires release, which no generic airport has: only the four explicit profiles pass', () => {
    for (const code of ['ISB', 'LHE', 'KHI', 'MAN']) expect(resolveJourneyAirports('EDI', code, 'public').ok, code).toBe(true);
    for (const code of ['LHR', 'DXB', 'DEL', 'SYD']) expect(resolveJourneyAirports('EDI', code, 'public').ok, code).toBe(false);
  });

  it('a refused airport never reaches Google or the monthly budget', async () => {
    const g = google([locality('PK', 'Pakistan', 'Mirpur')]);
    const store = new InMemoryCallBudgetStore();
    for (const arrivalAirport of ['BEK', 'LYR']) {
      const plan = await planFullJourney({ ...PRESTON_TO_MIRPUR, arrivalAirport }, { apiKey: KEY, guard: guardWith(store), originMode: 'ENTERED', nowIso: NOW, baseFetch: g.fetch });
      expect(plan.notEvidenced?.reason).toBe('AIRPORT_NOT_SUPPORTED');
    }
    const foreign = await planFullJourney({ ...PRESTON_TO_MIRPUR, departureAirport: 'DXB' }, { apiKey: KEY, guard: guardWith(store), originMode: 'ENTERED', nowIso: NOW, baseFetch: g.fetch });
    expect(foreign.notEvidenced?.reason).toBe('AIRPORT_NOT_SUPPORTED');
    expect(g.calls).toEqual([]);
    expect(await store.incrementBy(MONTH_KEY, 0, 1)).toBe(0);
  });
});

describe('cheap failures cost nothing', () => {
  it('invalid times, declared connections and blank places are rejected before any reservation or Google call', async () => {
    const g = google([locality('PK', 'Pakistan', 'Mirpur')]);
    const store = new InMemoryCallBudgetStore();
    const cases: JourneyInput[] = [
      { ...PRESTON_TO_MIRPUR, flight: { departsLocal: '2027-03-28T01:30', arrivesLocal: '2027-03-28T12:00' }, departureAirport: 'LHR' },
      { ...PRESTON_TO_MIRPUR, flight: { ...PRESTON_TO_MIRPUR.flight, declaredConnections: 1 } },
      { ...PRESTON_TO_MIRPUR, destination: '   ' },
      { ...PRESTON_TO_MIRPUR, start: '' },
      { ...PRESTON_TO_MIRPUR, destination: 'x'.repeat(181) },
    ];
    for (const journey of cases) {
      const plan = await planFullJourney(journey, { apiKey: KEY, guard: guardWith(store), originMode: 'ENTERED', nowIso: NOW, baseFetch: g.fetch });
      expect(plan.state).toBe('CANNOT_CONFIRM');
    }
    expect(g.calls).toEqual([]);
    expect(await store.incrementBy(MONTH_KEY, 0, 1)).toBe(0);
  });

  it('a missing start-to-airport estimate still runs the arrival side and asks for the origin leg (F2 will provide it)', async () => {
    const g = google([locality('PK', 'Pakistan', 'Mirpur')]);
    const plan = await planFullJourney({ ...PRESTON_TO_MIRPUR, originLegMinutes: undefined }, { apiKey: KEY, guard: guardWith(), originMode: 'ENTERED', nowIso: NOW, baseFetch: g.fetch });
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.notEvidenced?.reason).toBe('ORIGIN_LEG_MISSING');
    expect(plan.leaveBy).toBeUndefined();
    expect(plan.finalArrival?.clock).toBe('03:35');
  });
});

describe('scope: public full journey and arrival-only compatibility', () => {
  const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
  const walk = (dir: string): string[] => readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));

  it('the public route is explicit, and the arrival-only engines remain separate compatibility paths', () => {
    expect(read('app', 'api', 'arrive-by', 'journey', 'route.ts')).toContain('planFullJourney');
    for (const file of ['components/arrive-by-road-public.tsx', 'components/arrive-by-pakistan-public.tsx', 'components/arrive-by-manchester-public.tsx']) {
      expect(read(...file.split('/')), file).not.toMatch(/planFullJourney/);
    }
  });

  it('the journey module is pure library code: no logging, storage, or analytics', () => {
    for (const file of readdirSync(join(process.cwd(), 'lib', 'arrive-by-journey'))) {
      const src = read('lib', 'arrive-by-journey', file);
      expect(src, file).not.toMatch(/console\.(log|error|warn|info)\(|localStorage|sessionStorage|document\.cookie|track\(/);
    }
  });

  it('it reuses the existing resolver and road engine rather than re-implementing them', () => {
    const providers = read('lib', 'arrive-by-journey', 'providers.ts');
    expect(providers).toContain("from '../arrive-by-shared/road-journey'");
    expect(providers).toContain('computeRoadJourney(');
    expect(read('lib', 'arrive-by-journey', 'airports.ts')).toContain("from '../arrive-by-shared/airport-capability'");
    expect(read('lib', 'arrive-by-journey', 'solver.ts')).toContain("from '../arrive-by-shared/format'");
  });

  it('the release table is untouched: no worldwide release, MAN/ISB/LHE/KHI remain the only public airports', () => {
    expect(read('lib', 'arrive-by-shared', 'airport-release.ts')).toMatch(/ARRIVE_BY_RELEASED_AIRPORTS: Readonly<Record<string, ReleaseEntry>> = \{\};/);
  });
});
