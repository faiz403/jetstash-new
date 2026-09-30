import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { planFullJourney } from '@/lib/arrive-by-journey/plan';
import { googleOriginLeg } from '@/lib/arrive-by-journey/origin-leg';
import { resolveJourneyAirports } from '@/lib/arrive-by-journey/airports';
import { DEPARTURE_CAPABILITY_EVIDENCE, assertValidDepartureEvidence, hasDepartureCapability, type DepartureEvidence } from '@/lib/arrive-by-journey/departure-capability';
import { GoogleCallLedger, InMemoryCallBudgetStore, MonthlyCallGuard } from '@/lib/arrive-by-journey/call-budget';
import { getCatalogueAirport } from '@/lib/arrive-by-shared/airport-catalogue';
import { getAirportProfile, resolveRoutingOrigin } from '@/lib/arrive-by-shared/airport-registry';
import { resolveAirportProfile } from '@/lib/arrive-by-shared/airport-capability';
import { clockOf } from '@/lib/arrive-by-journey/local-time';
import type { JourneyInput } from '@/lib/arrive-by-journey/types';

/**
 * F2: the live start -> departure-airport leg. Google is a stubbed fetch whose
 * drive duration is a function of the requested departure time, so the real
 * production search runs end to end and every number is derivable by hand.
 */

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

const MIN = 60000;
const KEY = 'test-key';

interface RouteCall { origin: Record<string, unknown>; destination: Record<string, unknown>; departureTime: string }
interface Stub { geocodes: string[]; routes: RouteCall[]; fetch: typeof fetch; total: () => number }

/**
 * @param places   geocode responses by (case-insensitive) address substring
 * @param drive    minutes for a route request; null = Google returns no route; a number is a constant
 */
function google(places: Record<string, unknown[]>, drive: number | ((departureMs: number, body: RouteCall) => number | null)): Stub {
  const geocodes: string[] = [];
  const routes: RouteCall[] = [];
  const fetchStub = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/geocode/')) {
      const address = decodeURIComponent(new URL(url).searchParams.get('address') ?? '');
      geocodes.push(url);
      const key = Object.keys(places).find((k) => address.toLowerCase().includes(k.toLowerCase()));
      const results = key ? places[key] : [];
      return new Response(JSON.stringify({ status: results.length ? 'OK' : 'ZERO_RESULTS', results }), { status: 200 });
    }
    const body = JSON.parse(String(init?.body)) as RouteCall;
    routes.push(body);
    const minutes = typeof drive === 'function' ? drive(Date.parse(body.departureTime), body) : drive;
    if (minutes === null) return new Response('{}', { status: 200 });
    return new Response(JSON.stringify({ routes: [{ duration: `${Math.round(minutes * 60)}s`, staticDuration: `${Math.round(minutes * 60) - 60}s`, distanceMeters: 40000 }] }), { status: 200 });
  }) as unknown as typeof fetch;
  return { geocodes, routes, fetch: fetchStub, total: () => geocodes.length + routes.length };
}

const at = (countryCode: string, countryName: string, city: string, lat: number, lng: number, types = ['locality', 'political']) => ({
  formatted_address: `${city}, ${countryName}`, place_id: `place-${city}`, types, geometry: { location_type: 'APPROXIMATE', location: { lat, lng } },
  address_components: [{ long_name: city, short_name: city, types: ['locality', 'political'] }, { long_name: countryName, short_name: countryCode, types: ['country', 'political'] }],
});
const PRESTON = at('GB', 'United Kingdom', 'Preston', 53.7632, -2.7031);
const MIRPUR = at('PK', 'Pakistan', 'Mirpur', 33.1478, 73.7517);

const NOW = '2027-01-14T09:00:00.000Z';
const guard = () => new MonthlyCallGuard({ store: new InMemoryCallBudgetStore(), requireDurable: false, now: () => new Date(NOW) });

const PRESTON_TO_MIRPUR: JourneyInput = {
  start: 'Preston, Lancashire',
  departureAirport: 'MAN',
  flight: { departsLocal: '2027-01-15T11:00', arrivesLocal: '2027-01-15T23:30', label: 'PK 702' },
  arrivalAirport: 'ISB',
  destination: 'Mirpur, Azad Kashmir',
  preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60, pickupWaitMinutes: 15, pickupMode: 'family' },
};

/** Drive minutes by the direction of the request: into a UK airport (start side) vs out of one (arrival side). */
const journeyDrive = (originMinutes: number | ((t: number) => number), arrivalMinutes: number) => (t: number, body: RouteCall) =>
  'placeId' in body.destination || 'address' in body.destination ? arrivalMinutes : typeof originMinutes === 'function' ? originMinutes(t) : originMinutes;

describe('GOLDEN: Preston → MAN → manual flight → ISB → Mirpur (live origin leg composed with the F1 chain)', () => {
  it('the first leg is searched, verified and composed: leave-by, arrival side and call counts', async () => {
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive(55, 170));
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });

    // D = 11:00Z - 120 = 09:00Z. Seed point 08:00Z + 55 min = 08:55Z (5 min to spare = tolerance): converged in ONE query.
    expect(plan.leaveBy).toMatchObject({ iso: '2027-01-15T08:00:00.000Z', clock: '08:00' });
    expect(plan.originSearch).toEqual({ queries: 1, converged: true, slackMinutes: 5, departureAirport: 'MAN' });
    // The arrival side is exactly F1's: 18:30Z + 75 min + 170 min = 22:35Z = 03:35 Karachi.
    expect(plan.finalArrival).toMatchObject({ iso: '2027-01-15T22:35:00.000Z', clock: '03:35' });
    expect(plan.headline?.leave).toBe('Leave Preston by around 08:00');
    expect(plan.timeline[0]).toMatchObject({ kind: 'ORIGIN_ACCESS', minutes: 55, evidence: { kind: 'GOOGLE_ROUTES', checkedAt: NOW } });
    // Whole-journey call profile: start geocode + 1 route query + destination geocode + arrival route = 4.
    expect(plan.calls).toEqual({ used: 4, ceiling: 10, breakdown: { geocode: 2, routes: 2, identity: 0, other: 0 } });
    expect(g.total()).toBe(4);
  });

  it('a route where the seed misses needs one more query, and the whole journey is 5 calls', async () => {
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive(50, 170));
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
    // q0 08:00Z (+50 = 08:50, slack 10) -> q1 at 09:00 - 50 - 2.5 = 08:07:30Z (+50 = 08:57:30, slack 2.5) -> floor to 08:05.
    expect(plan.originSearch).toMatchObject({ queries: 2, converged: true, slackMinutes: 2.5 });
    expect(plan.leaveBy).toMatchObject({ iso: '2027-01-15T08:05:00.000Z', clock: '08:05' });
    expect(plan.calls?.used).toBe(5);
  });

  it('the origin route request goes FROM Google\'s own coordinate for Preston INTO the trusted MAN route target, in UTC, through the ledger', async () => {
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive(55, 170));
    await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
    const first = g.routes[0];
    expect(first.origin).toEqual({ location: { latLng: { latitude: 53.7632, longitude: -2.7031 } } });
    const manTarget = resolveRoutingOrigin(getAirportProfile('MAN')!);
    expect(first.destination).toEqual({ location: { latLng: { latitude: (manTarget as { lat: number }).lat, longitude: (manTarget as { lng: number }).lng } } });
    expect(first.departureTime).toBe('2027-01-15T08:00:00.000Z');
    expect(new URL(g.geocodes[0]).searchParams.get('region')).toBe('uk');
  });

  it('client-supplied coordinates, airport facts and country are never read: the airport target is server-resolved', async () => {
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive(55, 170));
    const hostile = { ...PRESTON_TO_MIRPUR, lat: 1, lng: 2, originLat: 40, airportLat: 0.5, timeZone: 'Asia/Tokyo', countryCode: 'JP' } as unknown as JourneyInput;
    const plan = await planFullJourney(hostile, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
    expect(JSON.stringify(g.routes)).not.toMatch(/"latitude":(1|40|0\.5),/);
    expect(plan.leaveBy?.iso).toBe('2027-01-15T08:00:00.000Z');
  });

  it('an entered originLegMinutes is IGNORED in LIVE mode: it is never a silent substitute', async () => {
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive(55, 170));
    const plan = await planFullJourney({ ...PRESTON_TO_MIRPUR, originLegMinutes: 5 }, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
    expect(plan.timeline[0].minutes).toBe(55);
    expect(plan.timeline[0].evidence.kind).toBe('GOOGLE_ROUTES');
  });

  it('the entered leg exists only as an explicit internal fallback (originMode ENTERED), labelled as entered', async () => {
    const g = google({ mirpur: [MIRPUR] }, 170);
    const plan = await planFullJourney({ ...PRESTON_TO_MIRPUR, originLegMinutes: 55 }, { apiKey: KEY, guard: guard(), originMode: 'ENTERED', nowIso: NOW, baseFetch: g.fetch });
    expect(plan.leaveBy?.clock).toBe('08:05');
    expect(plan.timeline[0].evidence.kind).toBe('ENTERED');
    expect(g.geocodes).toHaveLength(1); // only the destination was looked up
  });
});

describe('other UK departure airports', () => {
  it('London start → LHR routes INTO the trusted LHR coordinate (catalogue, no explicit profile)', async () => {
    const CAMDEN = at('GB', 'United Kingdom', 'Camden Town', 51.539, -0.1426, ['sublocality_level_1', 'political', 'sublocality']);
    const g = google({ camden: [CAMDEN] }, 50);
    const ledger = new GoogleCallLedger(10, g.fetch);
    const lhr = getCatalogueAirport('LHR')!;
    const outcome = await googleOriginLeg(KEY, { departure: { code: 'LHR', name: lhr.name, timeZone: lhr.timeZone, routeTarget: resolveRoutingOrigin(resolveAirportProfile('LHR')!) } }, { ...PRESTON_TO_MIRPUR, start: 'Camden Town, London', departureAirport: 'LHR', flight: { departsLocal: '2027-01-15T09:30', arrivesLocal: '2027-01-15T19:30' }, preferences: { departureAirportBufferMinutes: 180, arrivalExitMinutes: 30 } }, ledger, NOW);
    expect(outcome.search).toMatchObject({ status: 'OK' });
    expect(g.routes[0].destination).toEqual({ location: { latLng: { latitude: lhr.lat, longitude: lhr.lng } } });
    expect(ledger.used).toBe(3); // geocode + 2 route queries
  });

  it('a UK start → another validated UK departure airport (Edinburgh) composes through the whole plan', async () => {
    const FALKIRK = at('GB', 'United Kingdom', 'Falkirk', 56.0019, -3.7839);
    const SHEFFIELD = at('GB', 'United Kingdom', 'Sheffield', 53.3811, -1.4701);
    const g = google({ falkirk: [FALKIRK], sheffield: [SHEFFIELD] }, journeyDrive(26, 70));
    const plan = await planFullJourney({
      start: 'Falkirk', departureAirport: 'EDI', arrivalAirport: 'MAN', destination: 'Sheffield',
      flight: { departsLocal: '2027-02-10T09:00', arrivesLocal: '2027-02-10T10:10' },
      preferences: { departureAirportBufferMinutes: 90, arrivalExitMinutes: 20 },
    }, { apiKey: KEY, guard: guard(), nowIso: '2027-02-09T09:00:00.000Z', baseFetch: g.fetch });
    // D = 07:30Z. q0 06:30Z + 26 = 06:56Z (34 min spare) -> q1 07:30-26-2.5 = 07:01:30Z (+26 = 07:27:30Z) -> floor 07:00.
    expect(plan.leaveBy?.iso).toBe('2027-02-10T07:00:00.000Z');
    expect(plan.finalArrival?.iso).toBe('2027-02-10T11:40:00.000Z');
    expect(plan.calls?.used).toBe(5);
  });
});

describe('start location safety (shared resolver, UK gate)', () => {
  const venue = { formatted_address: '1 Test Street, Preston', place_id: 'venue-1', types: ['establishment', 'point_of_interest'], geometry: { location_type: 'ROOFTOP', location: { lat: 53.76, lng: -2.7 } }, address_components: [{ long_name: 'United Kingdom', short_name: 'GB', types: ['country', 'political'] }] };

  it('an impossible start (no result) is refused and never routed', async () => {
    const g = google({ mirpur: [MIRPUR] }, 55);
    const plan = await planFullJourney({ ...PRESTON_TO_MIRPUR, start: 'Nowhereville Xyzzy' }, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.notEvidenced?.reason).toBe('START_LOCATION_UNCONFIRMED');
    // Only the arrival-side route (destination is an address) was requested: nothing was routed INTO the airport.
    expect(g.routes.every((r) => 'address' in r.destination)).toBe(true);
    expect(plan.leaveBy).toBeUndefined();
    expect(plan.finalArrival?.clock).toBe('01:40'); // the arrival side is still evidenced (55-minute stub drive)
  });

  it('an ambiguous start (a venue) stops at confirmation and offers the resolver\'s own payload; a forged id does not unlock it', async () => {
    const g = google({ 'test street': [venue], mirpur: [MIRPUR] }, 55);
    const first = await planFullJourney({ ...PRESTON_TO_MIRPUR, start: '1 Test Street' }, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
    expect(first.startDetail?.pendingConfirmation).toEqual({ placeId: 'venue-1', formattedAddress: '1 Test Street, Preston' });
    const forged = await planFullJourney({ ...PRESTON_TO_MIRPUR, start: '1 Test Street', startConfirmedPlaceId: 'forged' }, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
    expect(forged.notEvidenced?.reason).toBe('START_LOCATION_UNCONFIRMED');
    const genuine = await planFullJourney({ ...PRESTON_TO_MIRPUR, start: '1 Test Street', startConfirmedPlaceId: 'venue-1' }, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
    expect(genuine.leaveBy).toBeDefined();
  });

  it('a start outside the UK is unsuitable and is never routed', async () => {
    const PARIS = at('FR', 'France', 'Paris', 48.8566, 2.3522);
    const g = google({ paris: [PARIS], mirpur: [MIRPUR] }, 55);
    const plan = await planFullJourney({ ...PRESTON_TO_MIRPUR, start: 'Paris, France' }, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
    expect(plan.notEvidenced?.reason).toBe('START_LOCATION_UNSUITABLE');
    expect(plan.startDetail?.clarificationReason).toBe('WRONG_COUNTRY');
    expect(g.routes).toHaveLength(1); // only the arrival-side route
  });

  it('a region-sized start ("Lancashire") is too broad to route from', async () => {
    const REGION = { ...at('GB', 'United Kingdom', 'Lancashire', 53.8, -2.6, ['administrative_area_level_2', 'political']) };
    const g = google({ lancashire: [REGION], mirpur: [MIRPUR] }, 55);
    const plan = await planFullJourney({ ...PRESTON_TO_MIRPUR, start: 'Lancashire' }, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
    expect(plan.notEvidenced?.reason).toBe('START_LOCATION_UNCONFIRMED');
    expect(plan.leaveBy).toBeUndefined();
  });
});

describe('start very close, very long, midnight and DST', () => {
  it('a start 4 minutes from the airport: the search still lands within the window and rounds down', async () => {
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive(4, 170));
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
    // q0 08:00Z (+4, 56 spare) -> q1 09:00 - 4 - 2.5 = 08:53:30Z -> floor 08:50.
    expect(plan.leaveBy?.iso).toBe('2027-01-15T08:50:00.000Z');
    expect(plan.originSearch).toMatchObject({ queries: 2, converged: true });
  });

  it('a 7-hour drive settles in 2 queries and the leave time is in the small hours, before the flight morning', async () => {
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive(420, 170));
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
    expect(plan.leaveBy?.iso).toBe('2027-01-15T01:55:00.000Z'); // 09:00 - 7h - 2.5min = 01:57:30 -> 01:55
    expect(plan.originSearch?.queries).toBe(2);
    expect(plan.calls?.used).toBe(5);
  });

  it('a journey that crosses midnight: a 06:00 flight with a 7-hour drive leaves the previous day', async () => {
    // 06:00 GMT departure, 2 h buffer -> D = 04:00Z on the 15th; 420-minute drive -> leave 20:57:30Z on the 14th -> 20:55.
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive(420, 170));
    const plan = await planFullJourney({ ...PRESTON_TO_MIRPUR, flight: { departsLocal: '2027-01-15T06:00', arrivesLocal: '2027-01-15T18:30' } }, { apiKey: KEY, guard: guard(), nowIso: '2027-01-13T09:00:00.000Z', baseFetch: g.fetch });
    expect(plan.leaveBy?.iso).toBe('2027-01-14T20:55:00.000Z');
    expect(plan.leaveBy?.clock).toBe('20:55');
    expect(plan.airportArriveBy?.iso).toBe('2027-01-15T04:00:00.000Z');
    expect(plan.timeline[0].startIso.slice(0, 10)).toBe('2027-01-14');
  });

  it('a UK clock-change day: the drive spans the 01:00Z change, real minutes are used, and Google is asked in UTC', async () => {
    // 2027-03-28: clocks go forward at 01:00Z. Flight 06:00 BST = 05:00Z; 2 h buffer -> D = 03:00Z (04:00 BST); 180-min drive.
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive(180, 170));
    const plan = await planFullJourney({ ...PRESTON_TO_MIRPUR, flight: { departsLocal: '2027-03-28T06:00', arrivesLocal: '2027-03-28T18:30' } }, { apiKey: KEY, guard: guard(), nowIso: '2027-03-26T09:00:00.000Z', baseFetch: g.fetch });
    // q0 02:00Z (+180 = 05:00Z, -120 slack) -> q1 03:00 - 180 - 2.5 = 23:57:30Z (27th) -> leave 23:55Z = 23:55 GMT.
    expect(plan.leaveBy?.iso).toBe('2027-03-27T23:55:00.000Z');
    expect(plan.airportArriveBy).toMatchObject({ iso: '2027-03-28T03:00:00.000Z', clock: '04:00' }); // BST clock at the airport
    expect(clockOf(Date.parse(plan.leaveBy!.iso), 'Europe/London')).toBe('23:55');
    for (const call of g.routes.slice(0, 2)) expect(call.departureTime).toMatch(/Z$/);
  });
});

describe('failure, budget and the directional capability gate', () => {
  it('Google failing (no route) is CANNOT CONFIRM for the origin leg; an entered duration is NOT silently substituted', async () => {
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, (t, body) => (('address' in body.destination) ? 170 : null));
    const plan = await planFullJourney({ ...PRESTON_TO_MIRPUR, originLegMinutes: 55 }, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.notEvidenced?.reason).toBe('ORIGIN_ROUTE_UNAVAILABLE');
    expect(plan.leaveBy).toBeUndefined();
    expect(plan.finalArrival?.clock).toBe('03:35');
  });

  it('a server error on every route request is the same: CANNOT CONFIRM, never a guess', async () => {
    global.fetch = originalFetch;
    const geocodeOnly = vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes('/geocode/')) return new Response(JSON.stringify({ status: 'OK', results: [PRESTON] }), { status: 200 });
      return new Response('boom', { status: 500 });
    }) as unknown as typeof fetch;
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: geocodeOnly });
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.leaveBy).toBeUndefined();
  });

  it('a search that can never find a feasible time stops at 4 queries: 1 + 4 + 2 = 7 calls, the arrival side is untouched', async () => {
    // Traffic grows exactly as fast as you delay: slack is always -10 minutes.
    const D = Date.parse('2027-01-15T09:00:00Z');
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive((t) => (D - t) / MIN + 10, 170));
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
    expect(plan.notEvidenced?.reason).toBe('ORIGIN_SEARCH_NO_FEASIBLE');
    expect(plan.originSearch?.queries).toBe(4);
    expect(plan.calls?.used).toBe(7);
    expect(plan.finalArrival?.clock).toBe('03:35');
  });

  it('the 10-call ceiling covers the WHOLE journey: an origin provider that spends 12 calls is stopped at exactly 10 sent', async () => {
    const underlying = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    const greedy: typeof googleOriginLeg = async (_key, _airports, _input, ledger) => {
      for (let i = 0; i < 12; i += 1) {
        try { await ledger.fetch('https://routes.googleapis.com/directions/v2:computeRoutes'); } catch { /* swallowed like the real engines */ }
      }
      return { leg: { status: 'OK', expectedSeconds: 3600, evidence: { kind: 'GOOGLE_ROUTES', source: 'greedy' } } };
    };
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: underlying, originLegProvider: greedy });
    expect(underlying).toHaveBeenCalledTimes(10);
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.notEvidenced?.reason).toBe('CALL_CEILING_REACHED');
    expect(plan.leaveBy).toBeUndefined(); // an over-budget origin leg is not trusted
    expect(plan.calls).toMatchObject({ used: 10, ceiling: 10 });
  });

  it('the real search cannot starve the arrival side: with a ceiling of 5 the origin gets 2 queries and the arrival keeps its 2 calls', async () => {
    const D = Date.parse('2027-01-15T09:00:00Z');
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive((t) => (D - t) / MIN + 10, 170));
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch, ceiling: 5 });
    expect(plan.calls?.used).toBeLessThanOrEqual(5);
    expect(plan.finalArrival?.clock).toBe('03:35'); // arrival side completed inside the same 5 calls
    expect(plan.originSearch?.queries).toBe(2);
  });

  it('a ceiling too small to fit the origin search refuses it without spending the arrival reserve', async () => {
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive(55, 170));
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch, ceiling: 3 });
    expect(plan.notEvidenced?.reason).toBe('ORIGIN_ROUTE_UNAVAILABLE');
    expect(plan.calls?.used).toBeLessThanOrEqual(3);
  });

  it('leaving now already misses the flight: NOT FEASIBLE, not a leave time to act on', async () => {
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive(55, 170));
    const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guard(), nowIso: '2027-01-15T08:30:00.000Z', baseFetch: g.fetch });
    expect(plan.state).toBe('NOT_FEASIBLE');
    expect(plan.reasons[0]).toMatch(/already passed/);
    expect(Math.min(...g.routes.map((r) => Date.parse(r.departureTime)))).toBeGreaterThanOrEqual(Date.parse('2027-01-15T08:31:00.000Z'));
  });
});

describe('departure capability is directional and separate from arrival capability', () => {
  const table = DEPARTURE_CAPABILITY_EVIDENCE as Record<string, DepartureEvidence>;

  it('a UK airport with NO departure evidence is refused for a live origin, before any Google call or monthly reservation', async () => {
    const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive(55, 170));
    const store = new InMemoryCallBudgetStore();
    const plan = await planFullJourney({ ...PRESTON_TO_MIRPUR, departureAirport: 'BRS' }, { apiKey: KEY, guard: new MonthlyCallGuard({ store, requireDurable: false, now: () => new Date(NOW) }), nowIso: NOW, baseFetch: g.fetch });
    expect(plan.notEvidenced?.reason).toBe('DEPARTURE_AIRPORT_NOT_EVIDENCED');
    expect(g.total()).toBe(0);
    expect(await store.incrementBy('arrive-by:google-calls:2027-01', 0, 1)).toBe(0);
  });

  it('MAN is a public explicit profile with arrival capability, yet WITHOUT departure evidence it cannot be a live departure', async () => {
    const saved = table.MAN;
    delete table.MAN;
    try {
      expect(hasDepartureCapability('MAN')).toBe(false);
      expect(resolveJourneyAirports('MAN', 'ISB', 'internal', 'LIVE')).toMatchObject({ ok: false, reason: 'DEPARTURE_AIRPORT_NOT_EVIDENCED' });
      // ...while its ARRIVAL role is unaffected.
      expect(resolveJourneyAirports('EDI', 'MAN', 'internal', 'ENTERED').ok).toBe(true);
      const g = google({ preston: [PRESTON], mirpur: [MIRPUR] }, journeyDrive(55, 170));
      const plan = await planFullJourney(PRESTON_TO_MIRPUR, { apiKey: KEY, guard: guard(), nowIso: NOW, baseFetch: g.fetch });
      expect(plan.notEvidenced?.reason).toBe('DEPARTURE_AIRPORT_NOT_EVIDENCED');
      expect(g.total()).toBe(0);
    } finally {
      table.MAN = saved;
    }
  });

  it('an airport with ARRIVAL capability (LHR: road_supported) but no departure evidence is still not a live departure', () => {
    expect(hasDepartureCapability('LHR', {})).toBe(false);
    expect(hasDepartureCapability('LHR')).toBe(true); // only because the F2 probe proved the other direction separately
  });

  it('a non-UK airport is never a departure, even with a (forged) evidence entry', () => {
    expect(resolveJourneyAirports('DXB', 'ISB', 'internal', 'ENTERED')).toMatchObject({ ok: false, reason: 'AIRPORT_NOT_SUPPORTED' });
    expect(() => assertValidDepartureEvidence({ iata: 'DXB', status: 'departure_supported', verifiedDate: '2026-10-01', note: 'x', checks: { identityVerified: true, routeProbed: true } })).toThrow(/UK airports only/);
  });

  it('departure evidence needs identity AND a DRIVE route, a date and a note', () => {
    const good: DepartureEvidence = { iata: 'MAN', status: 'departure_supported', verifiedDate: '2026-10-01', note: 'n', checks: { identityVerified: true, routeProbed: true } };
    expect(() => assertValidDepartureEvidence(good)).not.toThrow();
    expect(() => assertValidDepartureEvidence({ ...good, checks: { identityVerified: true, routeProbed: false } as never })).toThrow(/DRIVE route/);
    expect(() => assertValidDepartureEvidence({ ...good, checks: { identityVerified: false, routeProbed: true } as never })).toThrow(/identity/);
    expect(() => assertValidDepartureEvidence({ ...good, verifiedDate: 'soon' })).toThrow(/YYYY-MM-DD/);
    expect(() => assertValidDepartureEvidence({ ...good, note: ' ' })).toThrow(/note/);
    expect(() => assertValidDepartureEvidence({ ...good, iata: 'ZZZ' })).toThrow(/catalogue/);
  });

  it('the committed departure evidence covers the controls (MAN, LHR, EDI) and not the airports that failed review', () => {
    for (const code of ['MAN', 'LHR', 'EDI', 'NCL', 'LBA', 'BHX']) expect(hasDepartureCapability(code), code).toBe(true);
    expect(hasDepartureCapability('BRS')).toBe(false); // Google types Bristol Airport as a transit station; no explicit profile to vouch for it
    for (const [code, entry] of Object.entries(DEPARTURE_CAPABILITY_EVIDENCE)) {
      expect(getCatalogueAirport(code)?.countryCode, code).toBe('GB');
      expect(entry.note, code).toMatch(/NOT release/);
    }
  });

  it('departure evidence never carries a release, and the release table is untouched', () => {
    expect(readFileSync(join(process.cwd(), 'lib', 'arrive-by-shared', 'airport-release.ts'), 'utf8')).toMatch(/ARRIVE_BY_RELEASED_AIRPORTS: Readonly<Record<string, ReleaseEntry>> = \{\};/);
  });
});

describe('scope', () => {
  const walk = (dir: string): string[] => readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));

  it('still no public UI or route: nothing under app/ or components/ imports the journey or probe code', () => {
    for (const file of [...walk('app'), ...walk('components')].filter((f) => /\.(ts|tsx)$/.test(f))) {
      expect(readFileSync(join(process.cwd(), file), 'utf8'), file).not.toMatch(/arrive-by-journey|departure-probe/);
    }
  });

  it('origin-side code never touches the rate limiter, storage, logging or analytics', () => {
    for (const file of ['origin-leg.ts', 'origin-search.ts', 'departure-capability.ts', 'departure-probe.ts']) {
      const src = readFileSync(join(process.cwd(), 'lib', 'arrive-by-journey', file), 'utf8');
      expect(src, file).not.toMatch(/console\.(log|error|warn|info)\(|localStorage|sessionStorage|track\(|rate-limit|form-security/);
    }
  });
});
