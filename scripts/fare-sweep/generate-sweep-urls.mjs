#!/usr/bin/env node
/**
 * Generates the dated search URLs for one weekly fare sweep.
 *
 *   node scripts/fare-sweep/generate-sweep-urls.mjs 2026-10-20 [--out <file>] [--allow-non-tuesday]
 *
 * Reads scripts/fare-sweep/sweep-routes.json, applies the FARE-METHOD-001
 * window from lib/fare-sweep-dates.ts (departure = sweep date + 56 days,
 * return + 14 nights), and prints JSON (or writes it to --out). Each URL is
 * re-read after rewriting to confirm its airports and dates. Collection
 * tooling only: it fetches nothing and changes no repository data.
 *
 * Loads the TypeScript helper with Node's built-in type stripping (Node 23.6+).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const sweep = await import(join(root, 'lib', 'fare-sweep-dates.ts').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
const { peakPeriodOccurrences } = await import(join(root, 'data', 'peak-period-dates.ts').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));

const args = process.argv.slice(2);
const sweepDate = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const outIndex = args.indexOf('--out');
const outFile = outIndex >= 0 ? args[outIndex + 1] : null;

if (!sweepDate) {
  console.error('Usage: node scripts/fare-sweep/generate-sweep-urls.mjs <YYYY-MM-DD> [--out <file>] [--allow-non-tuesday]');
  process.exit(1);
}
if (!sweep.isTuesdayIso(sweepDate) && !args.includes('--allow-non-tuesday')) {
  console.error(`${sweepDate} is not a Tuesday. Weekly sweeps run on Tuesdays; pass --allow-non-tuesday to override.`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(join(here, 'sweep-routes.json'), 'utf8'));
const window = sweep.getRollingSweepWindow(sweepDate);
const peak = sweep.getChristmasNewYearPeak(window, peakPeriodOccurrences);

const routes = config.routes.map((r) => {
  const googleFlightsUrl = sweep.withGoogleFlightsDates(r.templateUrl, { origin: r.origin, destination: r.destination }, window.departureDate, window.returnDate);
  const check = sweep.readGoogleFlightsRoundTrip(googleFlightsUrl);
  if (check.origin !== r.origin || check.destination !== r.destination || check.departureDate !== window.departureDate || check.returnDate !== window.returnDate) {
    throw new Error(`Post-rewrite check failed for ${r.slug}`);
  }
  return {
    slug: r.slug,
    origin: r.origin,
    destination: r.destination,
    googleFlightsUrl,
    ...(r.kayakFallback ? { kayakUrl: sweep.buildKayakRoundTripUrl(r.origin, r.destination, window.departureDate, window.returnDate) } : {}),
  };
});

const output = {
  ...window,
  stayNights: sweep.SWEEP_STAY_NIGHTS,
  peakSeason: peak.isPeakSeason,
  peakOccurrenceId: peak.occurrenceId,
  peakNote: peak.isPeakSeason
    ? 'Christmas/New Year peak-season window: label these observations as peak-season and do not compare them directly with fares from other travel windows.'
    : null,
  routeCount: routes.length,
  routes,
};

const json = JSON.stringify(output, null, 2) + '\n';
if (outFile) {
  writeFileSync(outFile, json);
  console.error(`Wrote ${routes.length} routes for ${window.departureDate} to ${window.returnDate}${peak.isPeakSeason ? ' (PEAK SEASON)' : ''} to ${outFile}`);
} else {
  process.stdout.write(json);
}
