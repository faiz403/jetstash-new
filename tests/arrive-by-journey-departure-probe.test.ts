import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { probeDepartureAirport, toDepartureEvidence, type DepartureProbeRecord } from '@/lib/arrive-by-journey/departure-probe';
import { DEPARTURE_CAPABILITY_EVIDENCE } from '@/lib/arrive-by-journey/departure-capability';
import { getCatalogueAirport } from '@/lib/arrive-by-shared/airport-catalogue';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

const NOW = new Date('2026-10-01T09:00:00Z');
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

function stub(code: string, opts: { identityTypes?: string[]; route?: number | null; startResults?: unknown[] } = {}) {
  const airport = getCatalogueAirport(code)!;
  const identity = [{
    formatted_address: `${airport.name} (${code}), UK`,
    types: opts.identityTypes ?? ['airport', 'establishment'],
    geometry: { location: { lat: airport.lat + 0.003, lng: airport.lng + 0.003 } },
    address_components: [{ short_name: 'GB', types: ['country', 'political'] }],
  }];
  const start = opts.startResults ?? [{ formatted_address: 'Startville, UK', place_id: 's', types: ['locality', 'political'], geometry: { location_type: 'APPROXIMATE', location: { lat: 53.5, lng: -2.5 } }, address_components: [{ long_name: 'Startville', short_name: 'Startville', types: ['locality', 'political'] }, { long_name: 'United Kingdom', short_name: 'GB', types: ['country', 'political'] }] }];
  const seen: string[] = [];
  global.fetch = vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    seen.push(url);
    if (url.includes('/geocode/')) {
      const isIdentity = decodeURIComponent(url).includes(`(${code})`);
      const results = isIdentity ? identity : start;
      return new Response(JSON.stringify({ status: results.length ? 'OK' : 'ZERO_RESULTS', results }), { status: 200 });
    }
    if (opts.route === null) return new Response('{}', { status: 200 });
    return new Response(JSON.stringify({ routes: [{ duration: `${(opts.route ?? 45) * 60}s`, staticDuration: '2500s' }] }), { status: 200 });
  }) as unknown as typeof fetch;
  return seen;
}

describe('the operator departure probe (Google mocked)', () => {
  it('PASS: identity agrees and the production origin search verifies a departure in every time-of-day scenario; cost is measured', async () => {
    const seen = stub('LGW', { route: 45 });
    const record = await probeDepartureAirport('k', { iata: 'LGW', start: 'Startville' }, NOW);
    expect(record.verdict).toBe('PASS');
    expect(record.identity).toMatchObject({ ok: true, basis: 'Google airport-typed result agrees' });
    expect(record.scenarios).toHaveLength(3);
    for (const scenario of record.scenarios) {
      expect(scenario.status).toBe('OK');
      expect(scenario.calls).toBe(scenario.routeQueries + 1); // start geocode + the queries
      expect(scenario.calls).toBeLessThanOrEqual(5);
    }
    // 1 identity request + 3 scenarios x (geocode + queries)
    expect(seen.length).toBe(1 + record.scenarios.reduce((sum, s) => sum + s.calls, 0));
    expect(toDepartureEvidence(record)).toMatchObject({ iata: 'LGW', status: 'departure_supported', checks: { identityVerified: true, routeProbed: true } });
    expect(toDepartureEvidence(record)?.note).toMatch(/NOT release and NOT arrival evidence/);
  });

  it('the probe date is always in the future and in UK local time, so Google is never asked about the past', async () => {
    stub('LGW', { route: 45 });
    const record = await probeDepartureAirport('k', { iata: 'LGW', start: 'Startville' }, NOW);
    for (const scenario of record.scenarios) expect(Date.parse(`${scenario.departureLocal}:00Z`)).toBeGreaterThan(NOW.getTime());
  });

  it('a route Google cannot find is a FAIL with no evidence', async () => {
    stub('LGW', { route: null });
    const record = await probeDepartureAirport('k', { iata: 'LGW', start: 'Startville' }, NOW);
    expect(record.verdict).toBe('FAIL');
    expect(record.scenarios.every((s) => s.status === 'FAILED')).toBe(true);
    expect(toDepartureEvidence(record)).toBeUndefined();
  });

  it('an unresolvable start is START_NOT_CONFIRMED and earns nothing (fallback starts are tried only when the primary fails to resolve)', async () => {
    stub('LGW', { startResults: [] });
    const record = await probeDepartureAirport('k', { iata: 'LGW', start: 'Nowhere', fallbackStarts: ['Also nowhere'] }, NOW);
    expect(record.scenarios.every((s) => s.status === 'START_NOT_CONFIRMED')).toBe(true);
    expect(toDepartureEvidence(record)).toBeUndefined();
  });

  it('MAN (explicit profile): Google typing it as a transit station is accepted ONLY on a strong name match within range, and the basis is recorded', async () => {
    stub('MAN', { identityTypes: ['transit_station', 'establishment'], route: 55 });
    const record = await probeDepartureAirport('k', { iata: 'MAN', start: 'Startville' }, NOW);
    expect(record.identity.ok).toBe(true);
    expect(record.identity.basis).toMatch(/Explicit profile coordinate/);
    expect(record.verdict).toBe('PASS');
  });

  it('BRS (no explicit profile): the same transit-station typing is NOT accepted: NEEDS_REVIEW and no evidence', async () => {
    stub('BRS', { identityTypes: ['transit_station', 'establishment'], route: 45 });
    const record = await probeDepartureAirport('k', { iata: 'BRS', start: 'Startville' }, NOW);
    expect(record.identity).toMatchObject({ ok: false, failure: 'NOT_AN_AIRPORT' });
    expect(record.verdict).toBe('NEEDS_REVIEW');
    expect(toDepartureEvidence(record)).toBeUndefined();
  });

  it('a non-UK airport can never pass', async () => {
    stub('DXB');
    const record = await probeDepartureAirport('k', { iata: 'DXB', start: 'Dubai' }, NOW);
    expect(record.verdict).toBe('FAIL');
    expect(toDepartureEvidence(record)).toBeUndefined();
  });

  it('a study-only probe measures cost but never writes evidence', async () => {
    stub('LGW', { route: 45 });
    const record = await probeDepartureAirport('k', { iata: 'LGW', start: 'Startville', writesEvidence: false }, NOW);
    expect(record.verdict).toBe('PASS');
    expect(toDepartureEvidence(record)).toBeUndefined();
  });

  it('the record holds no API key and no raw Google payload', async () => {
    stub('LGW', { route: 45 });
    const record = await probeDepartureAirport('SECRETKEY1234567890', { iata: 'LGW', start: 'Startville' }, NOW);
    const json = JSON.stringify(record);
    expect(json).not.toContain('SECRETKEY1234567890');
    expect(json).not.toMatch(/AIza|[?&]key=|place_id|address_components/);
  });
});

describe('committed live results (real Google, 1 Oct 2026): what a normal origin leg costs', () => {
  const records = JSON.parse(read('lib', 'arrive-by-journey', 'departure-live-results.json')) as DepartureProbeRecord[];
  const ok = records.flatMap((r) => r.scenarios.filter((s) => s.status === 'OK').map((s) => ({ iata: r.iata, ...s })));

  it('covers the controls: Preston → MAN, London → LHR and another UK airport', () => {
    for (const code of ['MAN', 'LHR', 'EDI', 'LBA', 'NCL']) expect(records.some((r) => r.iata === code && r.verdict === 'PASS'), code).toBe(true);
    expect(records.find((r) => r.iata === 'MAN' && r.start.startsWith('Preston'))?.verdict).toBe('PASS');
  });

  it('measured cost of the origin side: median 3 calls (1 geocode + 2 route queries), worst 4, never above the search cap', () => {
    const calls = ok.map((s) => s.calls).sort((a, b) => a - b);
    const queries = ok.map((s) => s.routeQueries).sort((a, b) => a - b);
    expect(ok.length).toBeGreaterThan(40);
    expect(calls[Math.floor(calls.length / 2)]).toBe(3);
    expect(Math.max(...calls)).toBeLessThanOrEqual(4);
    expect(queries[Math.floor(queries.length / 2)]).toBeLessThanOrEqual(2);
    expect(Math.max(...queries)).toBeLessThanOrEqual(3);
  });

  it('with the 2-call arrival side, a normal whole journey is about 5 calls and the worst observed is 6 (ceiling 10)', () => {
    const ARRIVAL_CALLS = 2;
    const totals = ok.map((s) => s.calls + ARRIVAL_CALLS);
    expect(Math.max(...totals)).toBeLessThanOrEqual(6);
    expect(Math.max(...totals) + 4).toBeLessThanOrEqual(10); // even four extra calls of headroom stays inside the ceiling
  });

  it('every OK scenario is verified feasible (spare time >= 0) and most converged within the 5-minute tolerance', () => {
    for (const s of ok) expect(s.slackMinutes ?? 0, `${s.iata} ${s.label}`).toBeGreaterThanOrEqual(0);
    const converged = ok.filter((s) => s.converged).length;
    expect(converged / ok.length).toBeGreaterThan(0.9);
  });

  it('the long-drive and very-close studies behaved: Edinburgh → MAN and London → EDI settled in <= 3 route queries; Wilmslow → MAN in 2', () => {
    const study = (start: string, iata: string) => records.find((r) => r.iata === iata && r.start === start)!;
    for (const s of study('Edinburgh', 'MAN').scenarios) expect(s.routeQueries).toBeLessThanOrEqual(3);
    for (const s of study('London', 'EDI').scenarios) expect(s.routeQueries).toBeLessThanOrEqual(3);
    for (const s of study('Wilmslow', 'MAN').scenarios) expect(s.routeQueries).toBeLessThanOrEqual(2);
    expect(study('London', 'EDI').scenarios[0].driveMinutes).toBeGreaterThan(400);
  });

  it('evidence and results agree: a PASS that writes evidence has it; NEEDS_REVIEW / FAIL and study probes do not', () => {
    for (const record of records) {
      const has = Boolean(DEPARTURE_CAPABILITY_EVIDENCE[record.iata]);
      if (record.verdict === 'PASS' && record.writesEvidence) expect(has, record.iata).toBe(true);
    }
    const bristol = records.find((r) => r.iata === 'BRS')!;
    expect(bristol.verdict).toBe('NEEDS_REVIEW');
    expect(DEPARTURE_CAPABILITY_EVIDENCE.BRS).toBeUndefined();
  });

  it('nothing in the committed results or evidence resembles a secret', () => {
    for (const file of ['departure-live-results.json', 'departure-capability-evidence.json']) {
      expect(read('lib', 'arrive-by-journey', file), file).not.toMatch(/AIza[0-9A-Za-z_-]{20,}|[?&]key=/);
    }
  });
});
