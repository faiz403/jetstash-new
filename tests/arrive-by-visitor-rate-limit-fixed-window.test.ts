import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  InMemoryVisitorWindowStore,
  UpstashVisitorWindowStore,
  VISITOR_WINDOW_SCRIPT,
  createVisitorRateLimiter,
  getConfiguredVisitorWindowStore,
} from '@/lib/arrive-by-shared/visitor-window-store';
import {
  ARRIVE_BY_INTERACTION_RATE_LIMIT_MAX,
  ARRIVE_BY_RATE_LIMIT_MAX,
  ARRIVE_BY_RATE_LIMIT_WINDOW_MS,
  checkPublicJourneyInteractionRateLimit,
  checkPublicJourneyRateLimit,
} from '@/lib/arrive-by-shared/rate-limit';

/**
 * Arrive By visitor limiter: a FIXED window per visitor. Found live on 4 November 2026: the old limiter ran INCRBY then EXPIRE on every
 * request, refused ones included, so a visitor who kept trying was locked out until they stopped for a full minute. These tests pin the
 * repaired behaviour, and pin that the monthly Google call counter (call-budget.ts) is untouched.
 */
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
const MAX = ARRIVE_BY_RATE_LIMIT_MAX;
const WINDOW_S = ARRIVE_BY_RATE_LIMIT_WINDOW_MS / 1000;
const request = (ip: string) => new NextRequest('https://jetstash.test/api/arrive-by/journey', { headers: { 'x-forwarded-for': ip } });

/** A Redis REST fake with real expiry on a controllable clock. It runs only the adapter's own script (matched exactly) plus the old INCRBY/EXPIRE pair, so it can show the old bug too. */
function fakeRedis(clock: { now: number }) {
  const data = new Map<string, { value: number; expiresAt: number | null }>();
  const commands: string[][] = [];
  const live = (key: string) => {
    const e = data.get(key);
    if (e && e.expiresAt !== null && clock.now >= e.expiresAt) data.delete(key);
    return data.get(key);
  };
  const run = (cmd: string[]): { result: unknown } | { error: string } => {
    commands.push(cmd);
    const [name, key, a] = cmd;
    if (name === 'EVAL') {
      // The one atomic script the adapter is allowed to run: INCR, then EXPIRE only if the counter is new or has no expiry.
      if (cmd[1] !== VISITOR_WINDOW_SCRIPT) return { error: 'ERR unexpected script' };
      const counter = cmd[3];
      const e = live(counter) ?? { value: 0, expiresAt: null };
      e.value += 1;
      data.set(counter, e);
      if (e.value === 1 || e.expiresAt === null) e.expiresAt = clock.now + Number(cmd[4]) * 1000;
      return { result: e.value };
    }
    if (name === 'INCRBY') {
      const e = live(key) ?? { value: 0, expiresAt: null };
      e.value += Number(a);
      data.set(key, e);
      return { result: e.value };
    }
    if (name === 'EXPIRE') {
      const e = live(key);
      if (!e) return { result: 0 };
      e.expiresAt = clock.now + Number(a) * 1000;
      return { result: 1 };
    }
    return { error: `ERR unknown command ${name}` };
  };
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as string[][];
    return new Response(JSON.stringify(body.map(run)), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, data, commands };
}

describe('fixed window: refused requests never extend the lockout (the bug found live on 4 November 2026)', () => {
  const clock = { now: 1_000_000 };
  const limiter = () => createVisitorRateLimiter({ store: new InMemoryVisitorWindowStore(() => clock.now), keyPrefix: 'arrive-by:test', max: MAX, windowSeconds: WINDOW_S });
  beforeEach(() => { clock.now = 1_000_000; });

  it(`allows ${MAX} in a window and refuses the next`, async () => {
    const l = limiter();
    for (let i = 0; i < MAX; i += 1) expect(await l.check('visitor-a')).toEqual({ limited: false });
    expect(await l.check('visitor-a')).toEqual({ limited: true });
  });

  it('a visitor who keeps retrying while refused is released exactly one window after the FIRST request', async () => {
    const l = limiter();
    for (let i = 0; i < MAX; i += 1) await l.check('visitor-a');
    for (const offsetS of [5, 15, 25, 35, 45, 55, 59]) {
      clock.now = 1_000_000 + offsetS * 1000;
      expect(await l.check('visitor-a'), `refused retry at +${offsetS}s`).toEqual({ limited: true });
    }
    clock.now = 1_000_000 + WINDOW_S * 1000;
    expect(await l.check('visitor-a')).toEqual({ limited: false });
  });

  it('after recovery the visitor gets a full new allowance, then is refused again', async () => {
    const l = limiter();
    for (let i = 0; i < MAX + 3; i += 1) await l.check('visitor-a');
    clock.now += WINDOW_S * 1000;
    for (let i = 0; i < MAX; i += 1) expect(await l.check('visitor-a')).toEqual({ limited: false });
    expect(await l.check('visitor-a')).toEqual({ limited: true });
  });

  it('visitors are independent', async () => {
    const l = limiter();
    for (let i = 0; i < MAX + 2; i += 1) await l.check('visitor-a');
    expect(await l.check('visitor-a')).toEqual({ limited: true });
    expect(await l.check('visitor-b')).toEqual({ limited: false });
  });

  it('concurrent requests cannot exceed the allowance', async () => {
    const l = limiter();
    const results = await Promise.all(Array.from({ length: 25 }, () => l.check('visitor-a')));
    expect(results.filter((r) => !r.limited)).toHaveLength(MAX);
    expect(results.filter((r) => r.limited)).toHaveLength(25 - MAX);
  });

  it('fails closed (limited and unavailable) when the store throws, with no detail leaked', async () => {
    const broken = { durable: true, hit: async () => { throw new Error('boom TOP-SECRET'); } };
    const l = createVisitorRateLimiter({ store: broken, keyPrefix: 'arrive-by:test', max: MAX, windowSeconds: WINDOW_S });
    expect(await l.check('visitor-a')).toEqual({ limited: true, unavailable: true });
  });
});

describe('the Upstash adapter sets the expiry ONCE per window, never on every request', () => {
  const clock = { now: 5_000_000 };
  beforeEach(() => { clock.now = 5_000_000; });

  it('refused retries against real Redis semantics do not postpone recovery', async () => {
    const redis = fakeRedis(clock);
    const store = new UpstashVisitorWindowStore('https://example.upstash.io/', 'secret', redis.fetchImpl);
    const l = createVisitorRateLimiter({ store, keyPrefix: 'arrive-by:test', max: MAX, windowSeconds: WINDOW_S });
    for (let i = 0; i < MAX; i += 1) expect(await l.check('v')).toEqual({ limited: false });
    for (let s = 5; s < WINDOW_S; s += 5) {
      clock.now = 5_000_000 + s * 1000;
      expect(await l.check('v')).toEqual({ limited: true });
    }
    clock.now = 5_000_000 + WINDOW_S * 1000;
    expect(await l.check('v')).toEqual({ limited: false });
  });

  it('is one atomic script per hit: the expiry is only set for a new or expiry-less counter, never re-armed, and INCRBY is not used', async () => {
    const redis = fakeRedis(clock);
    const store = new UpstashVisitorWindowStore('https://example.upstash.io/', 'secret', redis.fetchImpl);
    for (let i = 0; i < 4; i += 1) await store.hit('k', WINDOW_S);
    expect(redis.commands).toHaveLength(4);
    expect(redis.commands.every((c) => c[0] === 'EVAL' && c[1] === VISITOR_WINDOW_SCRIPT && c[2] === '1' && c[3] === 'k' && c[4] === String(WINDOW_S))).toBe(true);
    expect(redis.commands.flat()).not.toContain('INCRBY');
    expect(VISITOR_WINDOW_SCRIPT).toContain("redis.call('INCR', KEYS[1])");
    expect(VISITOR_WINDOW_SCRIPT).toMatch(/if count == 1 or redis\.call\('TTL', KEYS\[1\]\) == -1 then redis\.call\('EXPIRE', KEYS\[1\], ARGV\[1\]\) end/);
    expect(VISITOR_WINDOW_SCRIPT.split('EXPIRE')).toHaveLength(2); // exactly one EXPIRE, and it is the guarded one
  });

  it('later hits never move an open window (the extension found in independent review cannot happen)', async () => {
    const redis = fakeRedis(clock);
    const store = new UpstashVisitorWindowStore('https://example.upstash.io/', 'secret', redis.fetchImpl);
    await store.hit('k', WINDOW_S);
    const opens = redis.data.get('k')!.expiresAt;
    expect(opens).toBe(clock.now + WINDOW_S * 1000);
    for (const s of [10, 25, 40, 59]) {
      clock.now = 5_000_000 + s * 1000;
      await store.hit('k', WINDOW_S);
      expect(redis.data.get('k')!.expiresAt).toBe(opens);
    }
  });

  it('repairs a counter that somehow has no expiry, so nobody is locked out forever', async () => {
    const redis = fakeRedis(clock);
    redis.data.set('stuck', { value: 99, expiresAt: null });
    const store = new UpstashVisitorWindowStore('https://example.upstash.io/', 'secret', redis.fetchImpl);
    expect(await store.hit('stuck', WINDOW_S)).toBe(100);
    expect(redis.data.get('stuck')?.expiresAt).toBe(clock.now + WINDOW_S * 1000);
    clock.now += WINDOW_S * 1000;
    expect(await store.hit('stuck', WINDOW_S)).toBe(1);
  });

  it('sends one authenticated request and throws on any bad or malformed response without leaking the token', async () => {
    const seen: Array<{ url: string; auth: string | null }> = [];
    const ok = (async (url: string, init: RequestInit) => {
      seen.push({ url, auth: new Headers(init.headers).get('authorization') });
      return new Response(JSON.stringify([{ result: 3 }]), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await new UpstashVisitorWindowStore('https://example.upstash.io/', 'secret', ok).hit('k', WINDOW_S)).toBe(3);
    expect(seen).toEqual([{ url: 'https://example.upstash.io/pipeline', auth: 'Bearer secret' }]);
    for (const bad of [
      new Response('nope', { status: 500 }),
      new Response(JSON.stringify([{ error: 'ERR unknown command EVAL' }]), { status: 200 }),
      new Response(JSON.stringify([{ result: 'x' }]), { status: 200 }),
      new Response(JSON.stringify([{ result: 0 }]), { status: 200 }),
      new Response(JSON.stringify([{ result: 1.5 }]), { status: 200 }),
      new Response(JSON.stringify([{}]), { status: 200 }),
      new Response(JSON.stringify([]), { status: 200 }),
      new Response(JSON.stringify([{ result: 1 }, { result: 1 }]), { status: 200 }),
      new Response(JSON.stringify({ result: 1 }), { status: 200 }),
    ]) {
      const store = new UpstashVisitorWindowStore('https://x', 'TOP-SECRET-TOKEN', (async () => bad.clone()) as unknown as typeof fetch);
      const error = await store.hit('k', WINDOW_S).catch((e: Error) => e);
      expect(error).toBeInstanceOf(Error);
      expect(String((error as Error).message)).not.toContain('TOP-SECRET-TOKEN');
    }
  });

  it('is only configured when both env vars exist (Upstash or Vercel KV names); never guessed', () => {
    expect(getConfiguredVisitorWindowStore({})).toBeUndefined();
    expect(getConfiguredVisitorWindowStore({ UPSTASH_REDIS_REST_URL: 'https://x' })).toBeUndefined();
    expect(getConfiguredVisitorWindowStore({ UPSTASH_REDIS_REST_URL: 'https://x', UPSTASH_REDIS_REST_TOKEN: 't' })?.durable).toBe(true);
    expect(getConfiguredVisitorWindowStore({ KV_REST_API_URL: 'https://x', KV_REST_API_TOKEN: 't' })?.durable).toBe(true);
  });
});

describe('the public limiter functions (what the four journey endpoints and the interaction endpoint call)', () => {
  const clock = { now: 9_000_000 };
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  beforeEach(() => { clock.now = 9_000_000; });
  const productionEnv = { NODE_ENV: 'production', UPSTASH_REDIS_REST_URL: 'https://example.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'secret' };

  it('recovers for a visitor who hammered it, through the real functions against Redis semantics', async () => {
    const redis = fakeRedis(clock);
    vi.stubGlobal('fetch', redis.fetchImpl);
    for (let i = 0; i < MAX; i += 1) expect(await checkPublicJourneyRateLimit(request('203.0.113.7'), productionEnv)).toEqual({ limited: false });
    for (let s = 10; s < WINDOW_S; s += 10) {
      clock.now = 9_000_000 + s * 1000;
      expect(await checkPublicJourneyRateLimit(request('203.0.113.7'), productionEnv)).toEqual({ limited: true });
    }
    clock.now = 9_000_000 + WINDOW_S * 1000;
    expect(await checkPublicJourneyRateLimit(request('203.0.113.7'), productionEnv)).toEqual({ limited: false });
  });

  it('the journey and interaction allowances stay independent and the interaction cap is unchanged', async () => {
    const redis = fakeRedis(clock);
    vi.stubGlobal('fetch', redis.fetchImpl);
    expect(ARRIVE_BY_INTERACTION_RATE_LIMIT_MAX).toBe(30);
    expect(MAX).toBe(5);
    for (let i = 0; i < ARRIVE_BY_INTERACTION_RATE_LIMIT_MAX; i += 1) expect(await checkPublicJourneyInteractionRateLimit(request('203.0.113.8'), productionEnv)).toEqual({ limited: false });
    expect(await checkPublicJourneyInteractionRateLimit(request('203.0.113.8'), productionEnv)).toEqual({ limited: true });
    expect(await checkPublicJourneyRateLimit(request('203.0.113.8'), productionEnv)).toEqual({ limited: false });
  });

  it('stores only a hashed client key, under keys that cannot collide with the monthly budget counter', async () => {
    const redis = fakeRedis(clock);
    vi.stubGlobal('fetch', redis.fetchImpl);
    await checkPublicJourneyRateLimit(request('203.0.113.9'), productionEnv);
    await checkPublicJourneyInteractionRateLimit(request('203.0.113.9'), productionEnv);
    const keys = [...redis.data.keys()];
    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(key).toMatch(/^arrive-by:visitor-window:(journey|interaction):[a-f0-9]{64}$/);
      expect(key).not.toContain('203.0.113.9');
      expect(key).not.toMatch(/monthly|google-calls|budget/i);
    }
  });

  it('fails closed in production without a durable store, and when the store is down', async () => {
    expect(await checkPublicJourneyRateLimit(request('203.0.113.10'), { NODE_ENV: 'production' })).toEqual({ limited: true, unavailable: true });
    expect(await checkPublicJourneyInteractionRateLimit(request('203.0.113.10'), { NODE_ENV: 'production' })).toEqual({ limited: true, unavailable: true });
    vi.stubGlobal('fetch', (async () => new Response('down', { status: 503 })) as unknown as typeof fetch);
    expect(await checkPublicJourneyRateLimit(request('203.0.113.10'), productionEnv)).toEqual({ limited: true, unavailable: true });
  });

  it('local development uses an in-memory fixed window that also recovers', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
    const env = { NODE_ENV: 'development' };
    for (let i = 0; i < MAX; i += 1) expect(await checkPublicJourneyRateLimit(request('203.0.113.11'), env)).toEqual({ limited: false });
    vi.advanceTimersByTime(30_000);
    expect(await checkPublicJourneyRateLimit(request('203.0.113.11'), env)).toEqual({ limited: true });
    vi.advanceTimersByTime(30_000);
    expect(await checkPublicJourneyRateLimit(request('203.0.113.11'), env)).toEqual({ limited: false });
  });
});

describe('scope guard: the monthly Google counter and the other endpoints are untouched', () => {
  it('call-budget.ts still uses INCRBY then EXPIRE for the monthly counter and does not know about the visitor limiter', () => {
    const src = read('lib', 'arrive-by-journey', 'call-budget.ts');
    expect(src).toContain("[['INCRBY', key, String(delta)], ['EXPIRE', key, String(ttlSeconds)]]");
    expect(src).toContain('export const MONTHLY_CALL_LIMIT = 2000;');
    expect(src).toContain('export const JOURNEY_CALL_CEILING = 10;');
    expect(src).not.toMatch(/visitor-window|rate-limit/);
  });

  it('the visitor limiter does not import the monthly budget code', () => {
    for (const file of ['rate-limit.ts', 'visitor-window-store.ts']) {
      const specifiers = [...read('lib', 'arrive-by-shared', file).matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const s of specifiers) expect(s, file).not.toMatch(/call-budget/);
    }
  });

  it('all four billable endpoints still check the visitor limiter, and the interaction endpoint its own', () => {
    for (const route of [
      ['app', 'api', 'arrive-by', 'journey', 'route.ts'],
      ['app', 'api', 'arrive-by', 'road', 'route.ts'],
      ['app', 'api', 'arrive-by-manchester', 'google', 'route.ts'],
      ['app', 'api', 'arrive-by-pakistan', 'google', 'route.ts'],
    ]) expect(read(...route), route.join('/')).toContain('await checkPublicJourneyRateLimit(request)');
    expect(read('app', 'api', 'arrive-by', 'interaction', 'route.ts')).toContain('await checkPublicJourneyInteractionRateLimit(request)');
  });

  it('keeps the published numbers: five calculations per minute, a 60 second window', () => {
    expect(MAX).toBe(5);
    expect(ARRIVE_BY_RATE_LIMIT_WINDOW_MS).toBe(60_000);
  });
});
