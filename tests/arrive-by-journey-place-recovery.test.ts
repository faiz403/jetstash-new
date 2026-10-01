import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/founder/arrive-by-journey/route';
import {
  EMPTY_RECOVERY, chooseConfirmed, chooseSelected, invalidateForArrivalAirportChange, invalidateSide, pendingSides, reconcileWithPlan, toRequestFields,
  type PlaceSide, type RecoveryState,
} from '@/lib/arrive-by-journey/place-recovery';
import type { JourneyPlan } from '@/lib/arrive-by-journey/types';

/**
 * F3.1: start and destination recovery are independent pieces of state.
 *
 * ROOT CAUSE (proved below by the "old client" tests): the API is stateless and re-resolves both
 * places on every request, honouring only the place IDs sent WITH that request. The first UI sent
 * only the choice just made, so resolving one side dropped the other side's choice and its prompt
 * came back: an endless oscillation. The server was correct; the client must hold one choice per
 * side and resend both every time.
 */

const originalFetch = global.fetch;
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

// ---------- a stubbed Google whose place results mimic each recovery state ----------
const loc = (lat: number, lng: number) => ({ location_type: 'ROOFTOP', location: { lat, lng } });
const locality = (cc: string, country: string, city: string, lat: number, lng: number) => ({
  formatted_address: `${city}, ${country}`, place_id: `loc-${city}`, types: ['locality', 'political'], geometry: { location_type: 'APPROXIMATE', location: { lat, lng } },
  address_components: [{ long_name: city, short_name: city, types: ['locality', 'political'] }, { long_name: country, short_name: cc, types: ['country', 'political'] }],
});
const venue = (cc: string, id: string, address: string, partial = false) => ({
  formatted_address: address, place_id: id, types: ['establishment', 'point_of_interest'], partial_match: partial, geometry: loc(53.7, -2.7),
  address_components: [{ long_name: 'Country', short_name: cc, types: ['country', 'political'] }],
});

const PLACES: Record<string, unknown[]> = {
  // START (UK)
  preston: [locality('GB', 'United Kingdom', 'Preston', 53.7632, -2.7031)],                                    // RESOLVED
  'guild hall': [venue('GB', 'st-conf', 'Preston Guild Hall, Preston PR1 3NA, UK')],                          // NEEDS_CONFIRMATION
  'preston station': [venue('GB', 'st-a', 'Preston Railway Station, Preston, UK', true), venue('GB', 'st-b', 'Preston, Fishergate, Preston PR1 8AP, UK', true)], // NEEDS_SELECTION
  'paris': [locality('FR', 'France', 'Paris', 48.8566, 2.3522)],
  // DESTINATION (Pakistan)
  mirpur: [locality('PK', 'Pakistan', 'Mirpur', 33.1478, 73.7517)],                                            // RESOLVED
  'aga khan': [venue('PK', 'de-conf', 'Aga Khan University Hospital, Karachi, Pakistan')],                     // NEEDS_CONFIRMATION
  nishat: [venue('PK', 'de-a', '1 Mall Rd, Lahore, Pakistan', true), venue('PK', 'de-b', '9 Canal Rd, Lahore, Pakistan', true)], // NEEDS_SELECTION
  amritsar: [venue('IN', 'in-1', 'Golden Temple, Amritsar, India')],
};

const START_TEXT = { RESOLVED: 'Preston', CONFIRM: 'Guild Hall', SELECT: 'Preston station' } as const;
const DEST_TEXT = { RESOLVED: 'Mirpur', CONFIRM: 'Aga Khan Hospital', SELECT: 'Nishat Hotel Lahore' } as const;
type Kind = keyof typeof START_TEXT;

let googleCalls = 0;
function stubGoogle() {
  googleCalls = 0;
  global.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    googleCalls += 1;
    if (url.includes('/geocode/')) {
      const address = decodeURIComponent(new URL(url).searchParams.get('address') ?? '').toLowerCase();
      const key = Object.keys(PLACES).sort((a, b) => b.length - a.length).find((k) => address.includes(k));
      const results = key ? PLACES[key] : [];
      return new Response(JSON.stringify({ status: results.length ? 'OK' : 'ZERO_RESULTS', results }), { status: 200 });
    }
    const body = JSON.parse(String(init?.body));
    const toAirport = !('address' in body.destination);
    return new Response(JSON.stringify({ routes: [{ duration: toAirport ? '3300s' : '10200s', staticDuration: '3200s' }] }), { status: 200 });
  }) as unknown as typeof fetch;
}

let ipCounter = 0;
async function post(body: unknown, ip: string): Promise<JourneyPlan & { error?: string }> {
  const response = await POST(new NextRequest('http://localhost/api/founder/arrive-by-journey', {
    method: 'POST', headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
  return (await response.json()) as JourneyPlan & { error?: string };
}

const journey = (start: string, destination: string) => ({
  start, destination, departureAirport: 'MAN', arrivalAirport: 'ISB',
  flight: { departsLocal: '2027-01-15T11:00', arrivesLocal: '2027-01-15T23:30' },
  preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60, pickupWaitMinutes: 15, pickupMode: 'family' },
});

// ---------- the client model: what the founder UI does, driven against the real route ----------
type Order = 'start-first' | 'destination-first';

interface Session { plan: JourneyPlan; requests: number; sentBodies: Array<Record<string, unknown>>; recovery: RecoveryState; googleCallsPerRequest: number[] }

/**
 * The FIXED client: holds one choice per side, resends both every time, reconciles after each response.
 * Resolves exactly one prompt per request (a user clicking one button), in the requested order.
 */
async function fixedClient(start: string, destination: string, order: Order, maxRequests = 6): Promise<Session> {
  const ip = `198.51.100.${(ipCounter += 1)}`; // ONE client for the whole session: recovery must fit the 5/60 s limit
  let recovery = EMPTY_RECOVERY;
  const sentBodies: Array<Record<string, unknown>> = [];
  const googleCallsPerRequest: number[] = [];
  let plan: (JourneyPlan & { error?: string }) | undefined;
  for (let requests = 1; requests <= maxRequests; requests += 1) {
    const before = googleCalls;
    const body = { ...journey(start, destination), ...toRequestFields(recovery) };
    sentBodies.push(body);
    plan = await post(body, ip);
    googleCallsPerRequest.push(googleCalls - before);
    if (plan.error) throw new Error(plan.error);
    recovery = reconcileWithPlan(recovery, plan);
    if (plan.headline) return { plan, requests, sentBodies, recovery, googleCallsPerRequest };
    const pending = pendingSides(plan);
    const sides: PlaceSide[] = order === 'start-first' ? ['start', 'destination'] : ['destination', 'start'];
    const side = sides.find((s) => pending[s] === 'CONFIRM' || pending[s] === 'SELECT');
    if (!side) break; // nothing the user can act on
    const detail = side === 'start' ? plan.startDetail : plan.arrivalDetail;
    recovery = detail?.pendingSelection
      ? chooseSelected(recovery, side, detail.pendingSelection.candidates[0].placeId)
      : chooseConfirmed(recovery, side, detail?.pendingConfirmation?.placeId ?? '');
  }
  return { plan: plan as JourneyPlan, requests: maxRequests, sentBodies, recovery, googleCallsPerRequest };
}

/** The OLD client: sends only the choice just made (the reproduced bug). Fresh IP each request so the rate limit does not mask it. */
async function oldClient(start: string, destination: string, order: Order, maxRequests = 8) {
  const trail: Array<{ start: string; dest: string; done: boolean }> = [];
  let choice: Record<string, string> = {};
  for (let i = 0; i < maxRequests; i += 1) {
    const plan = await post({ ...journey(start, destination), ...choice }, `192.0.2.${(ipCounter += 1)}`);
    const p = pendingSides(plan);
    trail.push({ start: p.start, dest: p.destination, done: Boolean(plan.headline) });
    if (plan.headline) return { done: true, trail };
    const sides: PlaceSide[] = order === 'start-first' ? ['start', 'destination'] : ['destination', 'start'];
    const side = sides.find((s) => p[s] === 'CONFIRM' || p[s] === 'SELECT');
    if (!side) break;
    const detail = side === 'start' ? plan.startDetail : plan.arrivalDetail;
    const id = detail?.pendingSelection ? detail.pendingSelection.candidates[0].placeId : detail?.pendingConfirmation?.placeId ?? '';
    const selected = Boolean(detail?.pendingSelection);
    choice = side === 'start' ? (selected ? { startSelectedPlaceId: id } : { startConfirmedPlaceId: id }) : (selected ? { selectedPlaceId: id } : { confirmedPlaceId: id });
  }
  return { done: false, trail };
}

describe('ROOT CAUSE: a client that sends only the latest choice oscillates; the server is not at fault', () => {
  it.each([['SELECT', 'CONFIRM'], ['CONFIRM', 'SELECT'], ['CONFIRM', 'CONFIRM'], ['SELECT', 'SELECT']] as Array<[Kind, Kind]>)('start %s + destination %s: the old client never completes', async (s, d) => {
    stubGoogle();
    for (const order of ['start-first', 'destination-first'] as Order[]) {
      const result = await oldClient(START_TEXT[s], DEST_TEXT[d], order);
      expect(result.done, `${s}/${d} ${order}`).toBe(false);
      // Each resolved side comes straight back for recovery on the next request: the prompts alternate.
      const afterFirst = result.trail.slice(1, 5);
      expect(afterFirst.some((step) => step.start !== 'NONE') && afterFirst.some((step) => step.dest !== 'NONE'), `${s}/${d} ${order}`).toBe(true);
    }
  });

  it('the very same choices sent TOGETHER complete in one request: the server was correct all along', async () => {
    stubGoogle();
    const first = await post(journey(START_TEXT.SELECT, DEST_TEXT.CONFIRM), '203.0.113.201');
    const together = await post({
      ...journey(START_TEXT.SELECT, DEST_TEXT.CONFIRM),
      startSelectedPlaceId: first.startDetail?.pendingSelection?.candidates[0].placeId,
      confirmedPlaceId: first.arrivalDetail?.pendingConfirmation?.placeId,
    }, '203.0.113.202');
    expect(together.headline).toBeDefined();
    expect(together.state).toBe('ESTIMATE_ONLY');
  });
});

describe('the recovery reducer (pure)', () => {
  it('each side holds its own choice; choosing one never touches the other', () => {
    let state = chooseSelected(EMPTY_RECOVERY, 'start', 's1');
    state = chooseConfirmed(state, 'destination', 'd1');
    expect(state).toEqual({ start: { selectedPlaceId: 's1' }, destination: { confirmedPlaceId: 'd1' } });
    expect(toRequestFields(state)).toEqual({ startSelectedPlaceId: 's1', confirmedPlaceId: 'd1' });
    state = chooseConfirmed(state, 'start', 's2'); // a new choice for one side replaces only that side
    expect(state).toEqual({ start: { confirmedPlaceId: 's2' }, destination: { confirmedPlaceId: 'd1' } });
  });

  it('there is no shared recovery field: the four request fields map to exactly two independent sides', () => {
    expect(toRequestFields({ start: { confirmedPlaceId: 'a' }, destination: { selectedPlaceId: 'b' } })).toEqual({ startConfirmedPlaceId: 'a', selectedPlaceId: 'b' });
    expect(toRequestFields(EMPTY_RECOVERY)).toEqual({});
  });

  it('editing START text invalidates only the start; editing DESTINATION text only the destination', () => {
    const both: RecoveryState = { start: { selectedPlaceId: 's' }, destination: { confirmedPlaceId: 'd' } };
    expect(invalidateSide(both, 'start')).toEqual({ start: {}, destination: { confirmedPlaceId: 'd' } });
    expect(invalidateSide(both, 'destination')).toEqual({ start: { selectedPlaceId: 's' }, destination: {} });
    expect(invalidateSide(EMPTY_RECOVERY, 'start')).toBe(EMPTY_RECOVERY); // no needless state churn
  });

  it('changing the arrival airport to another country invalidates only the destination; the same country or a departure change resets nothing', () => {
    const both: RecoveryState = { start: { selectedPlaceId: 's' }, destination: { confirmedPlaceId: 'd' } };
    expect(invalidateForArrivalAirportChange(both, 'Pakistan', 'United Arab Emirates')).toEqual({ start: { selectedPlaceId: 's' }, destination: {} });
    expect(invalidateForArrivalAirportChange(both, 'Pakistan', 'Pakistan')).toBe(both);
  });

  it('reconcile forgets a side ONLY when the server sent it back for recovery despite our choice (stale/forged)', () => {
    const sent: RecoveryState = { start: { confirmedPlaceId: 'forged' }, destination: { confirmedPlaceId: 'good' } };
    const plan = { startDetail: { confidence: 'NEEDS_CONFIRMATION', pendingConfirmation: { placeId: 'x', formattedAddress: 'X' } } } as unknown as JourneyPlan;
    expect(reconcileWithPlan(sent, plan)).toEqual({ start: {}, destination: { confirmedPlaceId: 'good' } });
    expect(reconcileWithPlan(sent, {} as JourneyPlan)).toBe(sent);
  });
});

describe('RECOVERY COMBINATIONS (fixed client, real route, stubbed Google): every order completes', () => {
  const combos: Array<[string, Kind, Kind]> = [
    ['A', 'SELECT', 'CONFIRM'],
    ['C', 'CONFIRM', 'SELECT'],
    ['D', 'CONFIRM', 'CONFIRM'],
    ['E', 'SELECT', 'SELECT'],
  ];

  it.each(combos.flatMap(([id, s, d]) => (['start-first', 'destination-first'] as Order[]).map((order) => [id, s, d, order] as [string, Kind, Kind, Order])))(
    '%s: start %s + destination %s, resolved %s → completes in 3 requests, never re-asks a resolved side',
    async (_id, s, d, order) => {
      stubGoogle();
      const session = await fixedClient(START_TEXT[s], DEST_TEXT[d], order);
      expect(session.plan.headline, 'completes').toBeDefined();
      expect(session.requests).toBe(3); // initial + one per prompt: 3 submissions fits the 5 / 60 s limit
      // The final request carries BOTH resolved choices.
      const last = session.sentBodies[2];
      expect(Object.keys(last).filter((k) => /PlaceId$/.test(k)).length).toBe(2);
      // Once a side was resolved, no later response asked about it again.
      const firstResolved: PlaceSide = order === 'start-first' ? 'start' : 'destination';
      const second = session.sentBodies[1];
      expect(Object.keys(second).some((k) => (firstResolved === 'start' ? /^start/.test(k) : /^(confirmed|selected)PlaceId$/.test(k)))).toBe(true);
      // A recovery request never blows the 10-call journey ceiling (2 geocodes + up to 3 route queries + one Places name lookup per unnamed candidate shown).
      for (const calls of session.googleCallsPerRequest) expect(calls).toBeLessThanOrEqual(10);
    },
  );

  it.each([['CONFIRM'], ['SELECT']] as Array<[Kind]>)('F: start already RESOLVED, destination %s → the start stays resolved (never prompted, never sent an id)', async (d) => {
    stubGoogle();
    const session = await fixedClient(START_TEXT.RESOLVED, DEST_TEXT[d], 'destination-first');
    expect(session.plan.headline).toBeDefined();
    expect(session.requests).toBe(2);
    for (const body of session.sentBodies) expect(Object.keys(body).some((k) => /^start(Confirmed|Selected)PlaceId$/.test(k))).toBe(false);
    expect(session.plan.startDetail).toBeUndefined();
    expect(session.recovery.start).toEqual({});
  });

  it.each([['CONFIRM'], ['SELECT']] as Array<[Kind]>)('G: destination already RESOLVED, start %s → the destination stays resolved (never prompted, never sent an id)', async (s) => {
    stubGoogle();
    const session = await fixedClient(START_TEXT[s], DEST_TEXT.RESOLVED, 'start-first');
    expect(session.plan.headline).toBeDefined();
    expect(session.requests).toBe(2);
    for (const body of session.sentBodies) expect(Object.keys(body).some((k) => /^(confirmed|selected)PlaceId$/.test(k))).toBe(false);
    expect(session.plan.arrivalDetail).toBeUndefined();
    expect(session.recovery.destination).toEqual({});
  });

  it('both sides already resolved: one request, no prompts', async () => {
    stubGoogle();
    const session = await fixedClient(START_TEXT.RESOLVED, DEST_TEXT.RESOLVED, 'start-first');
    expect(session.requests).toBe(1);
    expect(session.plan.startDetail).toBeUndefined();
    expect(session.plan.arrivalDetail).toBeUndefined();
  });
});

describe('INVALIDATION on the client model: edits reset only what they affect', () => {
  it('after both are resolved, EDITING THE START re-prompts only the start; the destination stays resolved and is not re-asked', async () => {
    stubGoogle();
    const ip = '198.51.100.240';
    let recovery = EMPTY_RECOVERY;
    // Resolve both first.
    const first = await post(journey(START_TEXT.SELECT, DEST_TEXT.CONFIRM), ip);
    recovery = chooseSelected(recovery, 'start', first.startDetail?.pendingSelection?.candidates[0].placeId ?? '');
    recovery = chooseConfirmed(recovery, 'destination', first.arrivalDetail?.pendingConfirmation?.placeId ?? '');
    const done = await post({ ...journey(START_TEXT.SELECT, DEST_TEXT.CONFIRM), ...toRequestFields(recovery) }, ip);
    expect(done.headline).toBeDefined();
    // The user now edits the START to a different ambiguous place.
    recovery = invalidateSide(recovery, 'start');
    const edited = await post({ ...journey(START_TEXT.CONFIRM, DEST_TEXT.CONFIRM), ...toRequestFields(recovery) }, ip);
    expect(pendingSides(edited)).toEqual({ start: 'CONFIRM', destination: 'NONE' });
    expect(edited.arrivalDetail).toBeUndefined();
    expect(recovery.destination.confirmedPlaceId).toBe('de-conf');
  });

  it('EDITING THE DESTINATION re-prompts only the destination; the start stays resolved', async () => {
    stubGoogle();
    const ip = '198.51.100.241';
    let recovery = chooseConfirmed(EMPTY_RECOVERY, 'start', 'st-conf');
    recovery = chooseConfirmed(recovery, 'destination', 'de-conf');
    const done = await post({ ...journey(START_TEXT.CONFIRM, DEST_TEXT.CONFIRM), ...toRequestFields(recovery) }, ip);
    expect(done.headline).toBeDefined();
    recovery = invalidateSide(recovery, 'destination');
    const edited = await post({ ...journey(START_TEXT.CONFIRM, DEST_TEXT.SELECT), ...toRequestFields(recovery) }, ip);
    expect(pendingSides(edited)).toEqual({ start: 'NONE', destination: 'SELECT' });
    expect(edited.startDetail).toBeUndefined();
    expect(recovery.start.confirmedPlaceId).toBe('st-conf');
  });

  it('changing only the DEPARTURE airport or the flight times leaves both resolutions intact and completes in one request', async () => {
    stubGoogle();
    const both: RecoveryState = { start: { confirmedPlaceId: 'st-conf' }, destination: { confirmedPlaceId: 'de-conf' } };
    const plan = await post({ ...journey(START_TEXT.CONFIRM, DEST_TEXT.CONFIRM), departureAirport: 'LHR', flight: { departsLocal: '2027-01-15T14:00', arrivesLocal: '2027-01-16T02:00' }, ...toRequestFields(both) }, '198.51.100.242');
    expect(plan.headline).toBeDefined();
    expect(plan.startDetail).toBeUndefined();
    expect(plan.arrivalDetail).toBeUndefined();
  });

  it('a destination ID confirmed for one country does not survive a move to an airport in another country (only the destination is reset)', async () => {
    // The destination place is Pakistani; the arrival airport becomes DXB (UAE): the gate is different, so the old ID must not be reused.
    const both: RecoveryState = { start: { confirmedPlaceId: 'st-conf' }, destination: { confirmedPlaceId: 'de-conf' } };
    const reset = invalidateForArrivalAirportChange(both, 'Pakistan', 'United Arab Emirates');
    expect(reset).toEqual({ start: { confirmedPlaceId: 'st-conf' }, destination: {} });
    stubGoogle();
    const plan = await post({ ...journey(START_TEXT.CONFIRM, DEST_TEXT.CONFIRM), arrivalAirport: 'DXB', ...toRequestFields(both) }, '198.51.100.243');
    expect(plan.arrivalDetail?.clarificationReason).toBe('WRONG_COUNTRY'); // the server gate holds even if a stale ID were sent
    expect(plan.startDetail).toBeUndefined();
  });
});

describe('SECURITY: server-side verification is unchanged and each side is judged independently', () => {
  const sameRequest = (extra: Record<string, unknown>) => ({ ...journey(START_TEXT.CONFIRM, DEST_TEXT.CONFIRM), ...extra });

  it('a forged START confirmation id is rejected without destroying a valid DESTINATION resolution', async () => {
    stubGoogle();
    const plan = await post(sameRequest({ startConfirmedPlaceId: 'forged', confirmedPlaceId: 'de-conf' }), '203.0.113.211');
    expect(pendingSides(plan)).toEqual({ start: 'CONFIRM', destination: 'NONE' });
    expect(plan.finalArrival).toBeDefined(); // the destination side was honoured and evidenced
    expect(plan.leaveBy).toBeUndefined();
    expect(reconcileWithPlan({ start: { confirmedPlaceId: 'forged' }, destination: { confirmedPlaceId: 'de-conf' } }, plan)).toEqual({ start: {}, destination: { confirmedPlaceId: 'de-conf' } });
  });

  it('a forged DESTINATION confirmation id is rejected without destroying a valid START resolution', async () => {
    stubGoogle();
    const plan = await post(sameRequest({ startConfirmedPlaceId: 'st-conf', confirmedPlaceId: 'forged' }), '203.0.113.212');
    expect(pendingSides(plan)).toEqual({ start: 'NONE', destination: 'CONFIRM' });
    expect(plan.leaveBy).toBeDefined();
    expect(plan.finalArrival).toBeUndefined();
  });

  it('forged SELECTION ids (start, destination) are rejected safely and re-offer the real candidates', async () => {
    stubGoogle();
    const forgedStart = await post({ ...journey(START_TEXT.SELECT, DEST_TEXT.CONFIRM), startSelectedPlaceId: 'forged', confirmedPlaceId: 'de-conf' }, '203.0.113.213');
    expect(forgedStart.startDetail?.pendingSelection?.candidates.map((c) => c.placeId)).toEqual(['st-a', 'st-b']);
    expect(forgedStart.arrivalDetail).toBeUndefined();
    const forgedDest = await post({ ...journey(START_TEXT.CONFIRM, DEST_TEXT.SELECT), startConfirmedPlaceId: 'st-conf', selectedPlaceId: 'forged' }, '203.0.113.214');
    expect(forgedDest.arrivalDetail?.pendingSelection?.candidates.map((c) => c.placeId)).toEqual(['de-a', 'de-b']);
    expect(forgedDest.startDetail).toBeUndefined();
  });

  it('stale ids (a valid id for a DIFFERENT query, or an id after the text changed) are not honoured', async () => {
    stubGoogle();
    // 'de-conf' is a real id, but not one this destination text resolves to.
    const stale = await post({ ...journey(START_TEXT.RESOLVED, DEST_TEXT.SELECT), confirmedPlaceId: 'de-conf', selectedPlaceId: 'de-conf' }, '203.0.113.215');
    expect(stale.arrivalDetail?.pendingSelection).toBeDefined();
    const swapped = await post({ ...journey(START_TEXT.CONFIRM, DEST_TEXT.RESOLVED), startConfirmedPlaceId: 'st-a' }, '203.0.113.216');
    expect(swapped.startDetail?.pendingConfirmation?.placeId).toBe('st-conf');
  });

  it('a confirmation id cannot cross sides: a start id sent as the destination id (and vice versa) is not honoured', async () => {
    stubGoogle();
    const crossed = await post(sameRequest({ startConfirmedPlaceId: 'de-conf', confirmedPlaceId: 'st-conf' }), '203.0.113.217');
    expect(pendingSides(crossed)).toEqual({ start: 'CONFIRM', destination: 'CONFIRM' });
  });

  it('wrong country is still blocked on both sides, whatever ids are sent', async () => {
    stubGoogle();
    const startAbroad = await post({ ...journey('Paris, France', DEST_TEXT.RESOLVED), startConfirmedPlaceId: 'loc-Paris' }, '203.0.113.218');
    expect(startAbroad.notEvidenced?.reason).toBe('START_LOCATION_UNSUITABLE');
    const destAbroad = await post({ ...journey(START_TEXT.RESOLVED, 'Golden Temple Amritsar'), confirmedPlaceId: 'in-1' }, '203.0.113.219');
    expect(destAbroad.arrivalDetail?.clarificationReason).toBe('WRONG_COUNTRY');
    expect(destAbroad.leaveBy).toBeDefined();
  });

  it('oversized ids are still rejected at validation', async () => {
    stubGoogle();
    const big = 'x'.repeat(201);
    for (const field of ['startConfirmedPlaceId', 'startSelectedPlaceId', 'confirmedPlaceId', 'selectedPlaceId']) {
      const plan = await post({ ...sameRequest({ [field]: big }) }, `203.0.113.${220 + Math.floor(Math.random() * 30)}`);
      expect(plan.error, field).toMatch(/reference is not valid/);
    }
  });
});

describe('the founder UI is wired to the independent state model', () => {
  const component = readFileSync(join(process.cwd(), 'components', 'founder', 'arrive-by-journey.tsx'), 'utf8');

  it('uses the recovery reducer and resubmits BOTH sides every time', () => {
    expect(component).toContain("from '@/lib/arrive-by-journey/place-recovery'");
    expect(component).toContain('...toRequestFields(next)');
    expect(component).toContain('reconcileWithPlan(next, body as JourneyPlan)');
    expect(component).toMatch(/chooseConfirmed\(recovery, side,/);
    expect(component).toMatch(/chooseSelected\(recovery, side,/);
  });

  it('no request is ever built from a single ad hoc choice (the old bug shape is gone)', () => {
    expect(component).not.toMatch(/run\(\{/);
    expect(component).not.toMatch(/\[confirmKey\]|\[selectKey\]/);
  });

  it('editing each text field invalidates only that side; a country change on the arrival airport invalidates only the destination', () => {
    expect(component).toMatch(/setStart\(e\.target\.value\); setRecovery\(\(r\) => invalidateSide\(r, 'start'\)\)/);
    expect(component).toMatch(/setDestination\(e\.target\.value\); setRecovery\(\(r\) => invalidateSide\(r, 'destination'\)\)/);
    expect(component).toContain('invalidateForArrivalAirportChange(');
    expect(component).not.toMatch(/setRecovery\(EMPTY_RECOVERY\)/); // the whole form/state is never reset
  });

  it('shows each side\'s state separately', () => {
    expect(component).toContain('data-testid="place-status"');
  });

  it('place-recovery is client-safe: pure, no catalogue, no network, no storage', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'arrive-by-journey', 'place-recovery.ts'), 'utf8');
    const specifiers = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(specifiers).toEqual(['./types']);
    expect(src).not.toMatch(/fetch\(|localStorage|sessionStorage|console\./);
  });
});
