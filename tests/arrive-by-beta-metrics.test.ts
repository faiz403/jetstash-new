import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { InMemoryCallBudgetStore } from '@/lib/arrive-by-journey/call-budget';
import {
  CANNOT_CONFIRM_REASONS, classifyPlan, isGenuineSubmission, metricKey, outcomeField, recordBetaOutcome, toAllowedReason,
} from '@/lib/arrive-by-journey/beta-metrics';

const hoisted = vi.hoisted(() => ({ rate: vi.fn(), plan: vi.fn() }));
vi.mock('@/lib/arrive-by-shared/rate-limit', () => ({ checkPublicJourneyRateLimit: hoisted.rate }));
vi.mock('@/lib/arrive-by-journey/plan', async (original) => ({ ...(await original<typeof import('@/lib/arrive-by-journey/plan')>()), planFullJourney: hoisted.plan }));

import { POST } from '@/app/api/arrive-by/journey/route';

const KEY_PATTERN = /^arrive-by:metric:\d{4}-\d{2}-\d{2}:(submissions|result_usable|error|refused:rate_limit|refused:budget|cannot_confirm:[A-Z_]+)$/;

const goodBody = {
  start: 'Preston', departureAirport: 'MAN', arrivalAirport: 'ISB', destination: 'Mirpur',
  flight: { departsLocal: '2027-01-15T11:00', arrivesLocal: '2027-01-15T23:30' },
  preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60 },
};

function req(body: unknown, opts: { contentLength?: boolean | number; raw?: string } = {}) {
  const text = opts.raw ?? JSON.stringify(body);
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.9' };
  if (opts.contentLength !== false) headers['content-length'] = String(typeof opts.contentLength === 'number' ? opts.contentLength : Buffer.byteLength(text));
  return new NextRequest('http://localhost/api/arrive-by/journey', { method: 'POST', headers, body: text });
}

let counts: Map<string, number>;
let upstashBodies: string[];
let failMetricWrites = false;
const flush = () => new Promise((resolve) => setTimeout(resolve, 5));
const terminals = () => [...counts.entries()].filter(([key]) => !key.endsWith(':submissions'));
const total = (entries: Array<[string, number]>) => entries.reduce((sum, [, value]) => sum + value, 0);
const submissions = () => [...counts.entries()].filter(([key]) => key.endsWith(':submissions')).reduce((sum, [, value]) => sum + value, 0);

beforeEach(() => {
  counts = new Map();
  upstashBodies = [];
  failMetricWrites = false;
  hoisted.rate.mockReset().mockResolvedValue({ limited: false });
  hoisted.plan.mockReset();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('GOOGLE_ROUTES_API_KEY', 'test-key');
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example.test');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    const text = String(init?.body ?? '');
    upstashBodies.push(text);
    const commands = JSON.parse(text) as string[][];
    const key = commands[0][1];
    if (key.startsWith('arrive-by:metric:') && failMetricWrites) throw new Error('store down');
    const next = (counts.get(key) ?? 0) + Number(commands[0][2]);
    counts.set(key, next);
    return new Response(JSON.stringify([{ result: next }, { result: 1 }]), { status: 200 });
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Arrive By beta counters: one submission, exactly one terminal outcome', () => {
  it('counts a usable result as submissions + result_usable only', async () => {
    hoisted.plan.mockResolvedValue({ state: 'POSSIBLE_WITH_MARGIN', timeline: [] });
    const response = await POST(req(goodBody));
    await flush();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: 'POSSIBLE_WITH_MARGIN', timeline: [] });
    expect(submissions()).toBe(1);
    expect(terminals().map(([key, value]) => [key.split(':').slice(3).join(':'), value])).toEqual([['result_usable', 1]]);
  });

  it.each(['POSSIBLE_BUT_TIGHT', 'NOT_FEASIBLE', 'ESTIMATE_ONLY'])('treats %s as a usable planning result', async (state) => {
    hoisted.plan.mockResolvedValue({ state, timeline: [] });
    await POST(req(goodBody));
    await flush();
    expect(terminals().map(([key]) => key.split(':').slice(3).join(':'))).toEqual(['result_usable']);
  });

  it('counts CANNOT CONFIRM only under its allowlisted reason, never as result_usable', async () => {
    hoisted.plan.mockResolvedValue({ state: 'CANNOT_CONFIRM', timeline: [], notEvidenced: { reason: 'START_LOCATION_UNCONFIRMED' } });
    await POST(req(goodBody));
    await flush();
    expect(submissions()).toBe(1);
    expect(terminals().map(([key]) => key.split(':').slice(3).join(':'))).toEqual(['cannot_confirm:START_LOCATION_UNCONFIRMED']);
  });

  it('classifies the monthly-budget refusal as refused:budget', async () => {
    hoisted.plan.mockResolvedValue({ state: 'CANNOT_CONFIRM', timeline: [], notEvidenced: { reason: 'MONTHLY_BUDGET_UNAVAILABLE' } });
    await POST(req(goodBody));
    await flush();
    expect(terminals().map(([key]) => key.split(':').slice(3).join(':'))).toEqual(['refused:budget']);
  });

  it('classifies a rate-limit refusal of a genuine submission as submissions + refused:rate_limit', async () => {
    hoisted.rate.mockResolvedValue({ limited: true });
    const response = await POST(req(goodBody));
    await flush();
    expect(response.status).toBe(429);
    expect(hoisted.plan).not.toHaveBeenCalled();
    expect(submissions()).toBe(1);
    expect(terminals().map(([key]) => key.split(':').slice(3).join(':'))).toEqual(['refused:rate_limit']);
  });

  it('classifies an unexpected engine failure as error and keeps the 500 response', async () => {
    hoisted.plan.mockRejectedValue(new Error('boom: Preston, 12 Acacia Road'));
    const response = await POST(req(goodBody));
    await flush();
    expect(response.status).toBe(500);
    expect(submissions()).toBe(1);
    expect(terminals().map(([key]) => key.split(':').slice(3).join(':'))).toEqual(['error']);
  });

  it('does not count a missing server key as a normal user outcome beyond one error', async () => {
    vi.stubEnv('GOOGLE_ROUTES_API_KEY', '');
    const response = await POST(req(goodBody));
    await flush();
    expect(response.status).toBe(503);
    expect(submissions()).toBe(1);
    expect(terminals().map(([key]) => key.split(':').slice(3).join(':'))).toEqual(['error']);
  });

  it('never gives one submission two terminal outcomes, across a mixed run', async () => {
    hoisted.plan.mockResolvedValueOnce({ state: 'POSSIBLE_WITH_MARGIN', timeline: [] })
      .mockResolvedValueOnce({ state: 'CANNOT_CONFIRM', timeline: [], notEvidenced: { reason: 'AIRPORT_NOT_SUPPORTED' } })
      .mockResolvedValueOnce({ state: 'CANNOT_CONFIRM', timeline: [], notEvidenced: { reason: 'MONTHLY_BUDGET_UNAVAILABLE' } })
      .mockRejectedValueOnce(new Error('x'));
    for (let i = 0; i < 4; i += 1) await POST(req(goodBody));
    hoisted.rate.mockResolvedValue({ limited: true });
    await POST(req(goodBody));
    await flush();
    expect(submissions()).toBe(5);
    expect(total(terminals())).toBe(5);
  });
});

describe('Arrive By beta counters: noise is not a submission', () => {
  it('does not count a malformed body that passes the limiter (422)', async () => {
    const response = await POST(req(null, { raw: '{not json' }));
    await flush();
    expect(response.status).toBe(422);
    expect(counts.size).toBe(0);
  });

  it('does not count an invalid submission that fails validation', async () => {
    const response = await POST(req({ ...goodBody, start: '' }));
    await flush();
    expect(response.status).toBe(422);
    expect(counts.size).toBe(0);
  });

  it('does not count a rate-limited request whose body is malformed, undeclared or oversized', async () => {
    hoisted.rate.mockResolvedValue({ limited: true });
    expect((await POST(req(null, { raw: '{not json' }))).status).toBe(429);
    expect((await POST(req(goodBody, { contentLength: false }))).status).toBe(429);
    expect((await POST(req(goodBody, { contentLength: 9 * 1024 }))).status).toBe(429);
    await flush();
    expect(counts.size).toBe(0);
  });

  it('does not parse an oversized refused body', async () => {
    const big = new Request('http://localhost/x', { method: 'POST', headers: { 'content-length': String(9 * 1024) }, body: JSON.stringify(goodBody) });
    const json = vi.spyOn(big, 'clone');
    expect(await isGenuineSubmission(big, 8 * 1024)).toBe(false);
    expect(json).not.toHaveBeenCalled();
  });
});

describe('Arrive By beta counters: measurement can never affect a journey', () => {
  it('returns the identical response when the metric store is down', async () => {
    hoisted.plan.mockResolvedValue({ state: 'POSSIBLE_WITH_MARGIN', timeline: [] });
    failMetricWrites = true;
    const response = await POST(req(goodBody));
    await flush();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: 'POSSIBLE_WITH_MARGIN', timeline: [] });
    expect(counts.size).toBe(0);
  });

  it('records nothing from a Preview deployment (shared database)', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    hoisted.plan.mockResolvedValue({ state: 'POSSIBLE_WITH_MARGIN', timeline: [] });
    await POST(req(goodBody));
    await flush();
    expect(upstashBodies.filter((body) => body.includes('arrive-by:metric:'))).toEqual([]);
  });

  it('records nothing and does not throw when no durable store is configured', async () => {
    vi.stubEnv('KV_REST_API_URL', '');
    vi.stubEnv('KV_REST_API_TOKEN', '');
    const response = await POST(req(goodBody));
    await flush();
    expect(response.status).toBe(503);
    expect(upstashBodies).toEqual([]);
  });

  it('leaves the rate limiter, budget guard and engine call exactly as they were', () => {
    const route = readFileSync(join(process.cwd(), 'app', 'api', 'arrive-by', 'journey', 'route.ts'), 'utf8');
    expect(route.indexOf('checkPublicJourneyRateLimit(request)')).toBeLessThan(route.indexOf('request.json()'));
    expect(route).toContain('createJourneyCallGuard(process.env');
    expect(route).toContain("planFullJourney(input, { apiKey, guard, nowIso: new Date().toISOString(), airportMode: 'public', originMode: 'LIVE', transitFirst: 'LIVE', placeNames: 'LIVE' })");
    expect(route).toContain('status: 429');
    expect(route).toContain('status: 413');
    expect(route).toContain('status: 422');
  });
});

describe('Arrive By beta counters: privacy', () => {
  it('lets no request or user field reach a key or a value', async () => {
    hoisted.plan.mockResolvedValue({ state: 'CANNOT_CONFIRM', timeline: [], notEvidenced: { reason: 'ARRIVAL_DESTINATION_UNCONFIRMED', detail: 'Atlantis The Royal' }, startDetail: { resolvedAddress: '12 Acacia Road, Preston' } });
    await POST(req({ ...goodBody, start: 'Preston 12 Acacia Road', destination: 'Secret Hotel Karachi' }));
    hoisted.rate.mockResolvedValue({ limited: true });
    await POST(req({ ...goodBody, start: 'Preston 12 Acacia Road', destination: 'Secret Hotel Karachi' }));
    hoisted.plan.mockRejectedValue(new Error('geocode failed for 12 Acacia Road'));
    hoisted.rate.mockResolvedValue({ limited: false });
    await POST(req({ ...goodBody, start: 'Preston 12 Acacia Road' }));
    await flush();
    const metricBodies = upstashBodies.filter((body) => body.includes('arrive-by:metric:'));
    expect(metricBodies.length).toBeGreaterThan(0);
    for (const body of metricBodies) {
      const [increment, expire] = JSON.parse(body) as string[][];
      expect(increment[0]).toBe('INCRBY');
      expect(increment[1]).toMatch(KEY_PATTERN);
      expect(increment[2]).toBe('1');
      expect(expire[0]).toBe('EXPIRE');
      expect(expire[2]).toBe(String(90 * 24 * 60 * 60));
      expect(body).not.toMatch(/Acacia|Secret|Preston|Karachi|MAN|ISB|Atlantis|198\.51|geocode|2027/i);
    }
  });

  it('turns any non-allowlisted reason into UNSPECIFIED, so free text cannot become a key', () => {
    expect(toAllowedReason('12 Acacia Road, Preston')).toBe('UNSPECIFIED');
    expect(toAllowedReason(undefined)).toBe('UNSPECIFIED');
    expect(toAllowedReason({ detail: 'x' })).toBe('UNSPECIFIED');
    expect(outcomeField({ kind: 'cannot_confirm', reason: '12 Acacia Road' as never })).toBe('cannot_confirm:UNSPECIFIED');
    expect(classifyPlan({ state: 'CANNOT_CONFIRM', notEvidenced: { reason: '12 Acacia Road' as never } })).toEqual({ kind: 'cannot_confirm', reason: 'UNSPECIFIED' });
    for (const reason of CANNOT_CONFIRM_REASONS) expect(metricKey('2026-10-03', outcomeField({ kind: 'cannot_confirm', reason }))).toMatch(KEY_PATTERN);
  });

  it('records into an injected store with only date + fixed field names', async () => {
    const store = new InMemoryCallBudgetStore();
    const spy = vi.spyOn(store, 'incrementBy');
    await recordBetaOutcome({ kind: 'refused_rate_limit' }, { store, now: new Date('2026-10-03T23:59:00Z') });
    expect(spy.mock.calls.map((call) => call[0])).toEqual(['arrive-by:metric:2026-10-03:submissions', 'arrive-by:metric:2026-10-03:refused:rate_limit']);
    expect(spy.mock.calls.every((call) => call[1] === 1 && call[2] === 90 * 24 * 60 * 60)).toBe(true);
  });

  it('keeps the metrics module free of request and identity data', () => {
    const source = readFileSync(join(process.cwd(), 'lib', 'arrive-by-journey', 'beta-metrics.ts'), 'utf8');
    expect(source).not.toMatch(/x-forwarded-for|user-agent|\.cookies|\.ip\b|input\.(start|destination|flight)|body\.(start|destination)/i);
    expect(source).not.toMatch(/console\./);
  });

  it('counts every NotEvidencedReason except the budget one, and nothing else', () => {
    expect(new Set(CANNOT_CONFIRM_REASONS).size).toBe(CANNOT_CONFIRM_REASONS.length);
    expect(CANNOT_CONFIRM_REASONS).not.toContain('MONTHLY_BUDGET_UNAVAILABLE');
    expect(CANNOT_CONFIRM_REASONS).toHaveLength(12);
  });
});
