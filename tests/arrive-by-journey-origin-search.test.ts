import { describe, expect, it } from 'vitest';
import { searchLatestDeparture, SEARCH_MAX_QUERIES, SEARCH_SEED_MINUTES, SEARCH_TOLERANCE_MINUTES, type DriveQuery } from '@/lib/arrive-by-journey/origin-search';

/**
 * The bounded backward search, tested with synthetic traffic so every number is
 * derivable by hand. A "traffic model" is just duration = f(departure); the search
 * must find the latest departure whose arrival is <= D, verified by the model itself.
 */

const MIN = 60000;
const D = Date.parse('2027-01-15T09:00:00Z'); // the airport deadline (flight 11:00Z minus a 2 h buffer)
const NOW = Date.parse('2027-01-14T09:00:00Z');

/** A model plus a counter, so tests can assert exactly how many Google calls a scenario costs. */
function model(durationMinutesAt: (departureMs: number) => number) {
  const asked: number[] = [];
  const query: DriveQuery = async (departureMs) => {
    asked.push(departureMs);
    return { ok: true, sample: { durationSeconds: Math.round(durationMinutesAt(departureMs) * 60), staticSeconds: 1000 } };
  };
  return { query, asked };
}

const run = (m: ReturnType<typeof model>, extra: Partial<Parameters<typeof searchLatestDeparture>[0]> = {}) =>
  searchLatestDeparture({ deadlineMs: D, nowMs: NOW, query: m.query, ...extra });

describe('constants are the documented, bounded values', () => {
  it('60 min seed, 5 min tolerance, at most 4 queries', () => {
    expect([SEARCH_SEED_MINUTES, SEARCH_TOLERANCE_MINUTES, SEARCH_MAX_QUERIES]).toEqual([60, 5, 4]);
  });
});

describe('convergence on realistic traffic', () => {
  it('a drive exactly the seed length is settled by ONE query (arrives exactly on the deadline)', async () => {
    const m = model(() => 60);
    const result = await run(m);
    expect(result).toMatchObject({ status: 'OK', queries: 1, converged: true, slackMinutes: 0, departureMs: D - 60 * MIN });
    expect(m.asked).toHaveLength(1);
  });

  it('a 55-minute drive: the seed lands 5 min early, which is inside tolerance, so ONE query', async () => {
    const result = await run(model(() => 55));
    expect(result).toMatchObject({ status: 'OK', queries: 1, converged: true, slackMinutes: 5 });
  });

  it('a 50-minute drive needs a second query, aimed at the middle of the window: leave = D - 50 - 2.5 min', async () => {
    const m = model(() => 50);
    const result = await run(m);
    expect(m.asked).toEqual([D - 60 * MIN, D - 52.5 * MIN]);
    expect(result).toMatchObject({ status: 'OK', queries: 2, converged: true, slackMinutes: 2.5, departureMs: D - 52.5 * MIN });
  });

  it('a long 7-hour drive still settles in 2 queries (leave = D - 7 h - 2.5 min)', async () => {
    const result = await run(model(() => 420));
    expect(result).toMatchObject({ status: 'OK', queries: 2, converged: true });
    if (result.status === 'OK') {
      expect(new Date(result.departureMs).toISOString()).toBe('2027-01-15T01:57:30.000Z'); // 09:00Z - 420 - 2.5 min
      expect(D - (result.departureMs + result.durationSeconds * 1000)).toBe(2.5 * MIN);
    }
  });

  it('traffic that worsens with a later departure (rush hour) still converges to a VERIFIED-feasible time within 3 queries', async () => {
    // 45 min if you leave by 06:30Z, then +1 min per 3 min of lateness.
    const rush = (t: number) => 45 + Math.max(0, (t - Date.parse('2027-01-15T06:30:00Z')) / MIN) / 3;
    const m = model(rush);
    const result = await run(m);
    expect(result.status).toBe('OK');
    if (result.status === 'OK') {
      expect(result.departureMs + rush(result.departureMs) * MIN).toBeLessThanOrEqual(D + 1000);
      expect(result.queries).toBeLessThanOrEqual(3);
      expect(result.slackMinutes).toBeGreaterThanOrEqual(0);
      expect(result.slackMinutes).toBeLessThanOrEqual(5);
    }
  });

  it('a one-minute wobble between two nearby departure times (the real-world case) lands feasible on the aimed second query', async () => {
    // 51 min if you leave after 07:00Z, 50 before: the exact fixed point would be missed by a minute.
    const wobble = (t: number) => (t >= Date.parse('2027-01-15T07:00:00Z') ? 51 : 50);
    const result = await run(model(wobble));
    expect(result).toMatchObject({ status: 'OK', converged: true });
    if (result.status === 'OK') expect(result.queries).toBeLessThanOrEqual(2);
  });

  it('exact arithmetic: nothing is rounded inside the search (fractional minutes and seconds survive)', async () => {
    const m: DriveQuery = async () => ({ ok: true, sample: { durationSeconds: 3417 } });
    const result = await searchLatestDeparture({ deadlineMs: D, nowMs: NOW, query: m });
    if (result.status === 'OK') expect((D - (result.departureMs + 3417 * 1000)) % 1000).toBe(0);
    expect(result.status).toBe('OK');
  });
});

describe('the search is bounded and never reports an unverified time as safe', () => {
  it('a model where traffic grows exactly as fast as you delay never becomes feasible: FAILED after exactly 4 queries, not more', async () => {
    // drive = (D - T) + 10 min, so slack is always -10 min however early you go.
    const never = (t: number) => (D - t) / MIN + 10;
    const m = model(never);
    const result = await run(m);
    expect(result).toEqual(expect.objectContaining({ status: 'FAILED', reason: 'NO_FEASIBLE_WITHIN_BUDGET', queries: 4 }));
    expect(m.asked).toHaveLength(4);
  });

  it('maxQueries is a hard cap (here 2), whatever the model does', async () => {
    const never = (t: number) => (D - t) / MIN + 10;
    const m = model(never);
    await run(m, { maxQueries: 2 });
    expect(m.asked).toHaveLength(2);
  });

  it('if the budget ends while the best verified point is early (large slack), that safe time is returned with converged=false', async () => {
    // Every query says 50 min but the second point is never reached because maxQueries is 1.
    const result = await run(model(() => 50), { maxQueries: 1 });
    expect(result).toMatchObject({ status: 'OK', converged: false, slackMinutes: 10, queries: 1 });
  });

  it('a revisited point stops the search (no query is wasted repeating itself)', async () => {
    // Constant 60 with tolerance 0: slack is exactly 0 on the first point; fixed-point aims 0 min away -> same point.
    const m = model(() => 60);
    const result = await run(m, { toleranceMinutes: 0 });
    expect(m.asked).toHaveLength(1);
    expect(result.status).toBe('OK');
  });

  it('a failed FIRST query fails the search; a failure after a verified point keeps that verified answer', async () => {
    const dead: DriveQuery = async () => ({ ok: false });
    expect(await searchLatestDeparture({ deadlineMs: D, nowMs: NOW, query: dead })).toMatchObject({ status: 'FAILED', reason: 'QUERY_FAILED', queries: 1 });
    let calls = 0;
    const flaky: DriveQuery = async () => (calls++ === 0 ? { ok: true, sample: { durationSeconds: 50 * 60 } } : { ok: false });
    const kept = await searchLatestDeparture({ deadlineMs: D, nowMs: NOW, query: flaky });
    expect(kept).toMatchObject({ status: 'OK', converged: false, slackMinutes: 10, queries: 2 });
  });

  it('a ledger refusal is reported as BUDGET_EXHAUSTED, distinct from a routing failure', async () => {
    const refused: DriveQuery = async () => ({ ok: false, exhausted: true });
    expect(await searchLatestDeparture({ deadlineMs: D, nowMs: NOW, query: refused })).toMatchObject({ status: 'FAILED', reason: 'BUDGET_EXHAUSTED' });
  });

  it('property: over 300 seeded random smooth traffic models the result is always verified-feasible, deterministic and within 4 queries', async () => {
    let seed = 20261001;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    for (let i = 0; i < 300; i += 1) {
      const base = 5 + rand() * 500;              // 5 min .. ~8.5 h
      const slope = (rand() - 0.5) * 0.4;         // traffic changes up to +/-0.2 min per min
      const wobble = rand() * 6;                  // up to 6 min of noise
      const f = (t: number) => Math.max(1, base + slope * ((t - (D - base * MIN)) / MIN) + wobble * Math.sin(t / 1e6));
      const a = await run(model(f));
      const b = await run(model(f));
      expect(a).toEqual(b);
      if (a.status === 'OK') {
        expect(a.departureMs + f(a.departureMs) * MIN, `case ${i}`).toBeLessThanOrEqual(D + 1000);
        expect(a.queries).toBeLessThanOrEqual(4);
        expect(a.slackMinutes).toBeGreaterThanOrEqual(0);
      } else {
        expect(a.status === 'FAILED' || a.status === 'ALREADY_TOO_LATE').toBe(true);
        expect(a.queries).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe('the clock: Google will not route a departure in the past', () => {
  it('a departure time before now is clamped to now + 1 minute, never sent in the past', async () => {
    const m = model(() => 30);
    const tightNow = D - 40 * MIN; // seed point D-60 is already in the past
    await searchLatestDeparture({ deadlineMs: D, nowMs: tightNow, query: m.query });
    expect(m.asked[0]).toBe(tightNow + MIN);
    for (const at of m.asked) expect(at).toBeGreaterThanOrEqual(tightNow + MIN);
  });

  it('if even leaving right now misses the deadline the result is ALREADY_TOO_LATE, and the departure it reports (D - drive) is before now', async () => {
    const tightNow = D - 30 * MIN;
    const result = await searchLatestDeparture({ deadlineMs: D, nowMs: tightNow, query: model(() => 45).query });
    expect(result.status).toBe('ALREADY_TOO_LATE');
    if (result.status === 'ALREADY_TOO_LATE') {
      expect(result.departureMs).toBe(D - 45 * MIN);
      expect(result.departureMs).toBeLessThan(tightNow);
      expect(result.queries).toBe(1);
    }
  });

  it('leaving now IS enough when the drive is short: the search verifies a real departure after now', async () => {
    const tightNow = D - 30 * MIN;
    const result = await searchLatestDeparture({ deadlineMs: D, nowMs: tightNow, query: model(() => 10).query });
    expect(result.status).toBe('OK');
    if (result.status === 'OK') expect(result.departureMs).toBeGreaterThanOrEqual(tightNow + MIN);
  });
});

describe('measured cost of the search (synthetic traffic profiles; live numbers are in the departure probe results)', () => {
  const profiles: Record<string, (t: number) => number> = {
    'constant 15 min': () => 15,
    'constant 58 min': () => 58,
    'constant 3 h': () => 180,
    'rush-hour ramp': (t) => 45 + Math.max(0, (t - Date.parse('2027-01-15T06:30:00Z')) / MIN) / 3,
    'one-minute wobble': (t) => (t >= Date.parse('2027-01-15T07:00:00Z') ? 51 : 50),
    'evening peak, 25% slower': (t) => (t >= Date.parse('2027-01-15T07:30:00Z') ? 70 : 56),
  };

  it('every profile settles within 3 route queries, the median is 2, and the hard cap is 4', async () => {
    const counts: number[] = [];
    for (const [name, f] of Object.entries(profiles)) {
      const result = await run(model(f));
      expect(result.status, name).toBe('OK');
      expect(result.queries, name).toBeLessThanOrEqual(3);
      counts.push(result.queries);
    }
    const sorted = [...counts].sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThanOrEqual(2);
    expect(Math.max(...counts)).toBeLessThanOrEqual(SEARCH_MAX_QUERIES);
  });
});
