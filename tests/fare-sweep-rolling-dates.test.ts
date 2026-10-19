import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { routes, getRouteAirport, getRouteDestination } from '@/data/routes';
import { peakPeriodOccurrences } from '@/data/peak-period-dates';
import {
  addDaysIso,
  buildKayakRoundTripUrl,
  getChristmasNewYearPeak,
  getRollingSweepWindow,
  isTuesdayIso,
  readGoogleFlightsRoundTrip,
  withGoogleFlightsDates,
} from '@/lib/fare-sweep-dates';

/**
 * Rolling weekly fare-sweep window (19 Oct 2026, founder-approved). The 6
 * and 13 Oct sweeps reused searches frozen at 17 Nov–1 Dec 2026; these
 * tests pin the FARE-METHOD-001 rule (sweep + 56 days, 14 nights) and the
 * byte-level integrity of every rewritten URL.
 */

interface SweepRoute {
  slug: string;
  origin: string;
  destination: string;
  templateUrl: string;
  kayakFallback?: boolean;
}

const config = JSON.parse(readFileSync(join(process.cwd(), 'scripts/fare-sweep/sweep-routes.json'), 'utf8')) as { routes: SweepRoute[] };
const WINDOW_20_OCT = getRollingSweepWindow('2026-10-20');

describe('rolling window dates', () => {
  it('20 Oct 2026 sweeps 15–29 Dec 2026', () => {
    expect(WINDOW_20_OCT).toEqual({ sweepDate: '2026-10-20', departureDate: '2026-12-15', returnDate: '2026-12-29' });
  });

  it('advances exactly 7 days per weekly Tuesday sweep', () => {
    let sweepDate = '2026-10-20';
    let previous = getRollingSweepWindow(sweepDate);
    for (let week = 0; week < 60; week++) {
      sweepDate = addDaysIso(sweepDate, 7);
      expect(isTuesdayIso(sweepDate)).toBe(true);
      const next = getRollingSweepWindow(sweepDate);
      expect(next.departureDate).toBe(addDaysIso(previous.departureDate, 7));
      expect(next.returnDate).toBe(addDaysIso(next.departureDate, 14));
      previous = next;
    }
  });

  it('handles month, year and leap-day rollover in UTC', () => {
    expect(getRollingSweepWindow('2026-11-10')).toMatchObject({ departureDate: '2027-01-05', returnDate: '2027-01-19' });
    expect(getRollingSweepWindow('2028-01-04')).toMatchObject({ departureDate: '2028-02-29', returnDate: '2028-03-14' });
    // Across the UK clock change (25 Oct 2026) nothing shifts.
    expect(getRollingSweepWindow('2026-10-27')).toMatchObject({ departureDate: '2026-12-22', returnDate: '2027-01-05' });
  });

  it('rejects invalid dates and recognises Tuesdays', () => {
    expect(() => getRollingSweepWindow('2026-02-30')).toThrow();
    expect(() => getRollingSweepWindow('20/10/2026')).toThrow();
    expect(isTuesdayIso('2026-10-20')).toBe(true);
    expect(isTuesdayIso('2026-10-19')).toBe(false);
  });
});

describe('Christmas/New Year peak flag', () => {
  it('flags windows overlapping the existing christmas-new-year occurrence', () => {
    expect(getChristmasNewYearPeak(WINDOW_20_OCT, peakPeriodOccurrences)).toEqual({ isPeakSeason: true, occurrenceId: 'christmas-2026' });
    expect(getChristmasNewYearPeak(getRollingSweepWindow('2026-11-10'), peakPeriodOccurrences).isPeakSeason).toBe(false); // 5–19 Jan
    expect(getChristmasNewYearPeak(getRollingSweepWindow('2026-11-03'), peakPeriodOccurrences).isPeakSeason).toBe(true); // 29 Dec–12 Jan
  });

  it('does not flag an ordinary window', () => {
    expect(getChristmasNewYearPeak(getRollingSweepWindow('2026-10-06'), peakPeriodOccurrences)).toEqual({ isPeakSeason: false, occurrenceId: null });
  });

  it('fails loudly when the calendar has no occurrence for that season', () => {
    expect(() => getChristmasNewYearPeak(getRollingSweepWindow('2028-10-24'), peakPeriodOccurrences)).toThrow(/christmas-new-year/);
  });
});

describe('in-repo sweep configuration', () => {
  it('covers exactly the 89 current routes, once each', () => {
    const slugs = config.routes.map((r) => r.slug);
    expect(slugs).toHaveLength(89);
    expect(new Set(slugs).size).toBe(89);
    expect([...slugs].sort()).toEqual(routes.map((r) => r.slug).sort());
  });

  it('every origin and destination matches the route’s own airport records', () => {
    for (const r of config.routes) {
      const route = routes.find((x) => x.slug === r.slug)!;
      expect(r.origin, r.slug).toBe(getRouteAirport(route)!.code);
      expect(r.destination, r.slug).toBe(getRouteDestination(route)!.iataCode);
    }
  });

  it('marks exactly the seven KAYAK fallbacks', () => {
    expect(config.routes.filter((r) => r.kayakFallback).map((r) => r.slug).sort()).toEqual([
      'bristol-antalya',
      'bristol-dalaman',
      'glasgow-dalaman',
      'leeds-bradford-antalya',
      'leeds-bradford-bodrum',
      'leeds-bradford-dalaman',
      'newcastle-dalaman',
    ]);
  });
});

describe('all 89 Google Flights URLs', () => {
  it.each(config.routes.map((r) => [r.slug, r] as const))('%s: only the two dates change', (_slug, r) => {
    const template = readGoogleFlightsRoundTrip(r.templateUrl);
    expect(template).toMatchObject({ origin: r.origin, destination: r.destination });

    const dated = withGoogleFlightsDates(r.templateUrl, r, WINDOW_20_OCT.departureDate, WINDOW_20_OCT.returnDate);
    // Round trip: outbound origin→destination, return reversed, new dates.
    expect(readGoogleFlightsRoundTrip(dated)).toEqual({ origin: r.origin, destination: r.destination, departureDate: '2026-12-15', returnDate: '2026-12-29' });

    const before = new URL(r.templateUrl);
    const after = new URL(dated);
    expect(after.origin + after.pathname).toBe(before.origin + before.pathname);
    expect([...after.searchParams.keys()]).toEqual([...before.searchParams.keys()]);
    for (const key of before.searchParams.keys()) {
      if (key !== 'tfs') expect(after.searchParams.get(key)).toBe(before.searchParams.get(key));
    }
    // Byte-level: same length, and only the 20 date bytes differ.
    const a = Buffer.from(before.searchParams.get('tfs')!, 'base64url');
    const b = Buffer.from(after.searchParams.get('tfs')!, 'base64url');
    expect(b.length).toBe(a.length);
    let changed = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) changed++;
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThanOrEqual(20);
    expect(b.toString('latin1').replace(/2026-12-(15|29)/g, '')).toBe(a.toString('latin1').replace(/\d{4}-\d{2}-\d{2}/g, ''));
  });
});

describe('fail-closed URL handling', () => {
  const sample = config.routes.find((r) => r.slug === 'london-heathrow-dubai')!;

  it('LHR-DXB sample encodes Heathrow and Dubai exactly', () => {
    expect(readGoogleFlightsRoundTrip(sample.templateUrl)).toMatchObject({ origin: 'LHR', destination: 'DXB' });
  });

  it('refuses a mismatched airport pair, a bad date range or a malformed tfs', () => {
    expect(() => withGoogleFlightsDates(sample.templateUrl, { origin: 'LGW', destination: 'DXB' }, '2026-12-15', '2026-12-29')).toThrow();
    expect(() => withGoogleFlightsDates(sample.templateUrl, sample, '2026-12-29', '2026-12-15')).toThrow();
    expect(() => withGoogleFlightsDates(sample.templateUrl, sample, '2026-12-15', '2026-12-15')).toThrow();
    expect(() => readGoogleFlightsRoundTrip(sample.templateUrl.replace(/tfs=[^&]+/, 'tfs=CBwQAQ'))).toThrow();
    expect(() => readGoogleFlightsRoundTrip('https://www.kayak.co.uk/flights/LHR-DXB/2026-12-15/2026-12-29')).toThrow();
  });

  it('refuses an inserted third leg, a truncated payload or changed options (Codex review)', () => {
    const tfs = new URL(sample.templateUrl).searchParams.get('tfs')!;
    const bytes = Buffer.from(tfs, 'base64url');
    const withTfs = (b: Buffer) => sample.templateUrl.replace(`tfs=${tfs}`, `tfs=${b.toString('base64url')}`);
    const thirdLeg = Buffer.concat([bytes.subarray(0, 68), bytes.subarray(4, 36), bytes.subarray(68)]);
    expect(() => readGoogleFlightsRoundTrip(withTfs(thirdLeg))).toThrow(/legs or options/);
    expect(() => withGoogleFlightsDates(withTfs(thirdLeg), sample, '2026-12-15', '2026-12-29')).toThrow();
    expect(() => readGoogleFlightsRoundTrip(withTfs(bytes.subarray(0, bytes.length - 3)))).toThrow(/legs or options/);
    const twoAdults = Buffer.from(bytes);
    twoAdults[69] = 0x02; // the 0x40 passengers field
    expect(() => readGoogleFlightsRoundTrip(withTfs(twoAdults))).toThrow(/legs or options/);
  });

  it('builds KAYAK fallback URLs with exact airports and dates', () => {
    expect(buildKayakRoundTripUrl('LBA', 'AYT', '2026-12-15', '2026-12-29')).toBe('https://www.kayak.co.uk/flights/LBA-AYT/2026-12-15/2026-12-29');
    expect(() => buildKayakRoundTripUrl('Leeds', 'AYT', '2026-12-15', '2026-12-29')).toThrow();
  });
});

describe('generator script', () => {
  const run = (...args: string[]) => spawnSync(process.execPath, ['--no-warnings', 'scripts/fare-sweep/generate-sweep-urls.mjs', ...args], { cwd: process.cwd(), encoding: 'utf8' });

  it('emits 89 dated routes plus the peak-season label for 20 Oct 2026', () => {
    const result = run('2026-10-20');
    expect(result.status, result.stderr).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out).toMatchObject({ departureDate: '2026-12-15', returnDate: '2026-12-29', peakSeason: true, peakOccurrenceId: 'christmas-2026', routeCount: 89 });
    expect(out.routes.filter((r: { kayakUrl?: string }) => r.kayakUrl)).toHaveLength(7);
    for (const r of out.routes) expect(readGoogleFlightsRoundTrip(r.googleFlightsUrl)).toMatchObject({ departureDate: '2026-12-15', returnDate: '2026-12-29' });
  });

  it('refuses a non-Tuesday unless overridden', () => {
    expect(run('2026-10-19').status).toBe(1);
    expect(run('2026-10-19', '--allow-non-tuesday').status).toBe(0);
  });
});

describe('scope', () => {
  it('nothing the public site renders imports the sweep helper', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && readFileSync(path, 'utf8').includes('fare-sweep-dates')) offenders.push(path);
      }
    };
    ['app', 'components', 'data'].forEach((d) => walk(join(process.cwd(), d)));
    expect(offenders).toEqual([]);
  });
});
