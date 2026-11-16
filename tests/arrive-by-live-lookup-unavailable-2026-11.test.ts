import { Children, Suspense, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleCallLedger, InMemoryCallBudgetStore, MonthlyCallGuard } from '@/lib/arrive-by-journey/call-budget';
import { classifyPlan } from '@/lib/arrive-by-journey/beta-metrics';
import { cleanJourneyInput } from '@/lib/arrive-by-journey/clean-journey-input';
import { LIVE_LOOKUP_UNAVAILABLE_DETAIL, planFullJourney } from '@/lib/arrive-by-journey/plan';
import { PublicCallBudgetUnavailable, runPublicGoogleCalculation } from '@/lib/arrive-by-shared/public-call-budget';
import { isLiveLookupPaused, LIVE_LOOKUP_PAUSED_DETAIL } from '@/lib/arrive-by-shared/live-lookup-pause';
import ArriveByPage from '@/app/arrive-by/page';

/**
 * 16 Nov 2026: when Google refuses or cannot be reached (for example the Google Cloud trial ends and billing is disabled), every
 * engine swallows the failure and used to report "Your start location needs confirming" -- blaming the traveller's input for an
 * outage. These tests pin the honest message, and pin that a single usable answer anywhere keeps the old, input-specific behaviour.
 * Every Google request here is a stub; nothing leaves the machine.
 */

const GEOCODE = 'https://maps.googleapis.com/maps/api/geocode/json?address=x';
const ROUTES = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const denied403 = () => json({ error: { code: 403, status: 'PERMISSION_DENIED' } }, 403);

const originalFetch = global.fetch;
/** Fallback for any request a test did not stub. The engines swallow fetch errors, so afterEach also asserts it was never reached. */
const unstubbedFetch = vi.fn(async () => { throw new Error('unexpected real network call'); });
beforeEach(() => {
  unstubbedFetch.mockClear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2027-01-14T09:00:00.000Z'));
  // Safety net: any request that is not given an explicit stub fails the test instead of reaching a real server.
  global.fetch = unstubbedFetch as unknown as typeof fetch;
});
afterEach(() => {
  expect(unstubbedFetch).not.toHaveBeenCalled();
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('GoogleCallLedger.liveLookupUnavailable', () => {
  it('is false before any request and when every answer is usable', async () => {
    const ledger = new GoogleCallLedger(10, (async (input: string | URL | Request) => String(input).includes('/geocode/') ? json({ status: 'OK', results: [] }) : json({ routes: [] })) as typeof fetch);
    expect(ledger.liveLookupUnavailable).toBe(false);
    await ledger.fetch(GEOCODE);
    await ledger.fetch(ROUTES, { method: 'POST' });
    expect(ledger.liveLookupUnavailable).toBe(false);
  });

  it('is true when every answer is a service-level failure (403, 429, 5xx, network error, Geocoding REQUEST_DENIED)', async () => {
    for (const make of [
      () => denied403(),
      () => json({}, 429),
      () => json({}, 503),
      () => { throw new TypeError('fetch failed'); },
      () => json({ status: 'REQUEST_DENIED', error_message: 'You must enable Billing on the Google Cloud Project', results: [] }),
      () => json({ status: 'OVER_QUERY_LIMIT', results: [] }),
    ]) {
      const ledger = new GoogleCallLedger(10, (async () => make()) as unknown as typeof fetch);
      await ledger.fetch(GEOCODE).catch(() => undefined);
      expect(ledger.liveLookupUnavailable).toBe(true);
    }
  });

  it('is false when a place simply is not found (ZERO_RESULTS), when a route is empty, or when the body is unreadable', async () => {
    for (const make of [() => json({ status: 'ZERO_RESULTS', results: [] }), () => json({}), () => new Response('<html>not json</html>', { status: 200 }), () => json({ error: { code: 400 } }, 400)]) {
      const ledger = new GoogleCallLedger(10, (async () => make()) as unknown as typeof fetch);
      await ledger.fetch(GEOCODE);
      expect(ledger.liveLookupUnavailable).toBe(false);
    }
  });

  it('is false as soon as any one request got a usable answer', async () => {
    let call = 0;
    const ledger = new GoogleCallLedger(10, (async () => (call++ === 0 ? denied403() : json({ status: 'OK', results: [] }))) as unknown as typeof fetch);
    await ledger.fetch(GEOCODE);
    await ledger.fetch(GEOCODE);
    expect(ledger.liveLookupUnavailable).toBe(false);
  });

  it("still returns an unconsumed response body to the caller and still throws the original network error", async () => {
    const ledger = new GoogleCallLedger(10, (async () => json({ status: 'OK', results: [{ place_id: 'p' }] })) as unknown as typeof fetch);
    const response = await ledger.fetch(GEOCODE);
    expect(await response.json()).toEqual({ status: 'OK', results: [{ place_id: 'p' }] });

    const boom = new TypeError('fetch failed');
    const failing = new GoogleCallLedger(10, (async () => { throw boom; }) as unknown as typeof fetch);
    await expect(failing.fetch(GEOCODE)).rejects.toBe(boom);
  });

  it('still charges and refuses synchronously at the ceiling', () => {
    const ledger = new GoogleCallLedger(1, (async () => json({})) as unknown as typeof fetch);
    void ledger.fetch(ROUTES);
    expect(() => ledger.fetch(ROUTES)).toThrow();
  });
});

const BODY = {
  start: 'Preston, Lancashire', departureAirport: 'MAN', arrivalAirport: 'ISB', destination: 'Mirpur, Azad Kashmir',
  flight: { departsLocal: '2027-01-15T11:00', arrivesLocal: '2027-01-15T23:30' },
  preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60, pickupWaitMinutes: 15, pickupMode: 'family' },
};

function plan(baseFetch: typeof fetch) {
  const guard = new MonthlyCallGuard({ store: new InMemoryCallBudgetStore(), requireDurable: false });
  return planFullJourney(cleanJourneyInput(BODY), { apiKey: 'test-key', guard, nowIso: new Date().toISOString(), airportMode: 'public', originMode: 'LIVE', transitFirst: 'LIVE', placeNames: 'LIVE', flightConnections: 'FINAL_ARRIVAL_ANCHOR', baseFetch });
}

describe('the public journey when Google is unavailable', () => {
  it.each([
    ['billing disabled (Geocoding 200 REQUEST_DENIED, new APIs 403)', ((input: string | URL | Request) => String(input).includes('/geocode/') ? json({ status: 'REQUEST_DENIED', results: [] }) : denied403())],
    ['403 everywhere', () => denied403()],
    ['quota exhausted (429)', () => json({ error: { status: 'RESOURCE_EXHAUSTED' } }, 429)],
    ['network failure', () => { throw new TypeError('fetch failed'); }],
  ])('%s: says live checks are unavailable and does not blame the places entered', async (_name, make) => {
    const result = await plan((async (input: string | URL | Request) => make(input)) as unknown as typeof fetch);
    expect(result.state).toBe('CANNOT_CONFIRM');
    expect(result.notEvidenced?.reason).toBe('LIVE_LOOKUP_UNAVAILABLE');
    expect(result.reasons).toEqual([LIVE_LOOKUP_UNAVAILABLE_DETAIL]);
    expect(result.reasons.join(' ')).not.toMatch(/start location|too broad|town, postcode|driving route/i);
    expect(result.reasons[0]).toMatch(/can't run live checks right now/);
    // What the traveller entered stays visible: the flight is on the timeline, the drive is explicitly not evidenced.
    expect(result.timeline.some((leg) => leg.kind === 'FLIGHT')).toBe(true);
    expect(result.timeline.some((leg) => leg.kind === 'ORIGIN_ACCESS' || leg.kind === 'ONWARD')).toBe(false);
    expect(result.startDetail).toBeUndefined();
    expect(result.arrivalDetail).toBeUndefined();
    expect(result.headline).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('test-key');
    expect(classifyPlan(result)).toEqual({ kind: 'error' });
  });

  it('keeps the input-specific message when Google works but the place is genuinely not found', async () => {
    const result = await plan((async () => json({ status: 'ZERO_RESULTS', results: [] })) as unknown as typeof fetch);
    expect(result.notEvidenced?.reason).not.toBe('LIVE_LOOKUP_UNAVAILABLE');
    expect(result.reasons.join(' ')).toMatch(/start location|route/i);
  });

  it('does not report an outage when only some requests fail (one usable answer is enough)', async () => {
    const result = await plan((async (input: string | URL | Request) => String(input).includes('/geocode/') ? json({ status: 'ZERO_RESULTS', results: [] }) : denied403()) as unknown as typeof fetch);
    expect(result.notEvidenced?.reason).not.toBe('LIVE_LOOKUP_UNAVAILABLE');
  });

  it('still returns the monthly-budget refusal (not an outage) when the guard refuses before any call', async () => {
    const guard = new MonthlyCallGuard({ store: new InMemoryCallBudgetStore(), requireDurable: false, limit: 0 });
    const result = await planFullJourney(cleanJourneyInput(BODY), { apiKey: 'k', guard, nowIso: new Date().toISOString(), airportMode: 'public', originMode: 'LIVE', baseFetch: (async () => { throw new Error('must not be called'); }) as unknown as typeof fetch });
    expect(result.notEvidenced?.reason).toBe('MONTHLY_BUDGET_UNAVAILABLE');
  });
});

describe('the legacy per-airport calculations', () => {
  it('report LIVE_LOOKUP_UNAVAILABLE with the unchanged customer message when every lookup fails', async () => {
    global.fetch = (async () => denied403()) as unknown as typeof fetch;
    const error = await runPublicGoogleCalculation(async (metered) => {
      await metered(GEOCODE);
      return 'would have said ROUTE_UNAVAILABLE';
    }, { NODE_ENV: 'test' }).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(PublicCallBudgetUnavailable);
    expect((error as PublicCallBudgetUnavailable).reason).toBe('LIVE_LOOKUP_UNAVAILABLE');
    expect((error as PublicCallBudgetUnavailable).message).toBe("Arrive By can't run live checks right now. Please try again later.");
  });

  it('return the calculation unchanged when Google answered (even with ZERO_RESULTS)', async () => {
    global.fetch = (async () => json({ status: 'ZERO_RESULTS', results: [] })) as unknown as typeof fetch;
    await expect(runPublicGoogleCalculation(async (metered) => {
      await metered(GEOCODE);
      return 'engine result';
    }, { NODE_ENV: 'test' })).resolves.toBe('engine result');
  });
});

describe('the controlled pause (ARRIVE_BY_LIVE_LOOKUPS=off)', () => {
  it('is paused only when explicitly set to off (any case, trimmed); unset, on and anything else stay live', () => {
    expect(isLiveLookupPaused({})).toBe(false);
    for (const value of ['off', 'OFF', ' Off ']) expect(isLiveLookupPaused({ ARRIVE_BY_LIVE_LOOKUPS: value })).toBe(true);
    for (const value of ['on', 'ON', '', 'false', '0', 'paused']) expect(isLiveLookupPaused({ ARRIVE_BY_LIVE_LOOKUPS: value })).toBe(false);
  });

  it('answers the public journey without reserving budget or making any Google request, and keeps the entered flight', async () => {
    vi.stubEnv('ARRIVE_BY_LIVE_LOOKUPS', 'off');
    const store = new InMemoryCallBudgetStore();
    const spy = vi.spyOn(store, 'incrementBy');
    const baseFetch = vi.fn(async () => { throw new Error('must not be called'); });
    const guard = new MonthlyCallGuard({ store, requireDurable: false });
    const result = await planFullJourney(cleanJourneyInput(BODY), { apiKey: 'test-key', guard, nowIso: new Date().toISOString(), airportMode: 'public', originMode: 'LIVE', transitFirst: 'LIVE', placeNames: 'LIVE', flightConnections: 'FINAL_ARRIVAL_ANCHOR', baseFetch: baseFetch as unknown as typeof fetch });
    expect(baseFetch).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    expect(result.state).toBe('CANNOT_CONFIRM');
    expect(result.notEvidenced?.reason).toBe('LIVE_LOOKUP_UNAVAILABLE');
    expect(result.reasons).toEqual([LIVE_LOOKUP_PAUSED_DETAIL]);
    expect(result.reasons[0]).not.toMatch(/start location|too broad|town, postcode/i);
    expect(result.timeline.some((leg) => leg.kind === 'FLIGHT')).toBe(true);
    expect(result.headline).toBeUndefined();
    expect(classifyPlan(result)).toEqual({ kind: 'error' });
  });

  it('still reports bad input as bad input while paused (validation runs before the pause)', async () => {
    vi.stubEnv('ARRIVE_BY_LIVE_LOOKUPS', 'off');
    const guard = new MonthlyCallGuard({ store: new InMemoryCallBudgetStore(), requireDurable: false });
    const result = await planFullJourney(cleanJourneyInput({ ...BODY, flight: { departsLocal: '2027-01-15T11:00', arrivesLocal: '2027-01-15T11:00' } }), { apiKey: 'k', guard, nowIso: new Date().toISOString(), airportMode: 'public', originMode: 'LIVE' });
    expect(result.notEvidenced?.reason).not.toBe('LIVE_LOOKUP_UNAVAILABLE');
  });

  it('is live again when the setting is on or removed', async () => {
    vi.stubEnv('ARRIVE_BY_LIVE_LOOKUPS', 'on');
    const result = await plan((async () => json({ status: 'ZERO_RESULTS', results: [] })) as unknown as typeof fetch);
    expect(result.reasons).not.toEqual([LIVE_LOOKUP_PAUSED_DETAIL]);
  });

  it('makes the legacy per-airport calculations refuse with the pause message and no Google request', async () => {
    vi.stubEnv('ARRIVE_BY_LIVE_LOOKUPS', 'off');
    const calculate = vi.fn(async () => 'must not run');
    const error = await runPublicGoogleCalculation(calculate, { NODE_ENV: 'test', ARRIVE_BY_LIVE_LOOKUPS: 'off' }).catch((reason: unknown) => reason);
    expect(calculate).not.toHaveBeenCalled();
    expect(error).toBeInstanceOf(PublicCallBudgetUnavailable);
    expect((error as PublicCallBudgetUnavailable).reason).toBe('LIVE_LOOKUP_PAUSED');
    expect((error as PublicCallBudgetUnavailable).message).toBe(LIVE_LOOKUP_PAUSED_DETAIL);
  });

  it('shows a plain notice above the Arrive By form only while paused', async () => {
    const live = await ArriveByPage({ searchParams: Promise.resolve({}) });
    const liveChildren = Children.toArray((live as unknown as { props: { children: ReactNode } }).props.children) as Array<{ type?: unknown; props?: Record<string, unknown> }>;
    expect(liveChildren).toHaveLength(1);
    expect(liveChildren[0].type).toBe(Suspense);

    vi.stubEnv('ARRIVE_BY_LIVE_LOOKUPS', 'off');
    const paused = await ArriveByPage({ searchParams: Promise.resolve({}) });
    const pausedChildren = Children.toArray((paused as unknown as { props: { children: ReactNode } }).props.children) as Array<{ type?: unknown; props?: Record<string, unknown> }>;
    expect(pausedChildren).toHaveLength(2);
    expect(pausedChildren[0].props?.role).toBe('status');
    expect(JSON.stringify(pausedChildren[0].props)).toContain('Live road-time checks are paused');
    expect(pausedChildren[1].type).toBe(Suspense);
  });
});
