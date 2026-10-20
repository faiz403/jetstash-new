/** Local, offline comparison with the founder-approved Production source baseline. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as current from '../data/fare-observations';
import { routes } from '../data/routes';
import { deals, isBundledProductDeal } from '../data/deals';
import { deriveFareSignal, getFareSignalForRoute } from '../lib/fare-signal';
import { meetsPromotedDepartureLeadTime } from '../lib/freshness-thresholds';

const BASE = 'e744cffe53371127bdc2f04d1bb00fb4ce632849';
const NOW = '2026-10-20';
const cabins = ['Economy', 'Premium Economy', 'Business'] as const;

async function main() {
  // Read the original module from Git without switching, editing or creating a worktree.
  // Its sibling imports resolve to unchanged data modules through the existing alias.
  const source = execFileSync('git', ['show', `${BASE}:data/fare-observations.ts`], { encoding: 'utf8', maxBuffer: 4_000_000 });
  const cache = resolve('.next/cache/fare-range-review');
  mkdirSync(cache, { recursive: true });
  const file = resolve(cache, 'baseline.ts');
  writeFileSync(file, source.replaceAll("from './", "from '@/data/"));
  try {
    const baseline: typeof current = await import(pathToFileURL(file).href);
    assert.deepEqual(current.fareObservations, baseline.fareObservations, 'Observation history changed');
    execFileSync('git', ['diff', '--exit-code', BASE, '--',
      'data/routes.ts', 'data/route-status-events.ts', 'data/deals.ts',
      'lib/route-status-copy.ts', 'lib/booking-providers.ts', 'lib/fare-airport-pair.ts',
      'lib/freshness-thresholds.ts', 'lib/fare-signal.ts', 'data/fare-reverifications.ts',
    ], { stdio: 'pipe' });

    let hidden = 0;
    const cells = [];
    const changed = [];
    for (const route of routes) {
      const originalPool = baseline.getPublishableObservationsByRoute(route.slug, NOW);
      assert.deepEqual(getFareSignalForRoute(route.slug, NOW), deriveFareSignal(originalPool, NOW), `${route.slug}: Fare Signal`);
      for (const cabin of cabins) {
        const original = baseline.getPublishableObservationsByRouteAndCabin(route.slug, cabin, NOW);
        const eligible = current.getPublishableObservationsByRouteAndCabin(route.slug, cabin, NOW);
        assert.deepEqual(eligible, original, `${route.slug}/${cabin}: publication eligibility`);
        const before = baseline.getFareRangeSummary(route.slug, cabin, NOW);
        const after = current.getFareRangeSummary(route.slug, cabin, NOW);
        if (!before) { hidden++; assert.equal(after, null, `${route.slug}/${cabin}: newly visible fare`); }
        const selected = current.selectFareRangeTravelPeriod(eligible.filter(o => meetsPromotedDepartureLeadTime(o.departureDate, NOW)));
        assert(selected.every(o => original.some(old => old.id === o.id)));
        if (after) {
          assert.equal(new Set(selected.map(o => `${o.departureDate}/${o.returnDate}`)).size, 1);
          assert.equal(after.count, selected.length);
        }
        const oldFields = after ? Object.fromEntries(Object.entries(after).filter(([key]) => !['departureDate', 'returnDate'].includes(key))) : null;
        const differs = JSON.stringify(before) !== JSON.stringify(oldFields);
        cells.push({ route: route.slug, cabin, publishableIdsUnchanged: true, hiddenBefore: !before, hiddenAfter: !after, summaryChanged: differs });
        if (differs) changed.push({ route: route.slug, cabin, before, after });
      }
    }
    const pricedCards = deals.filter(d => !isBundledProductDeal(d)).flatMap(deal => {
      const route = routes.find(r => r.airportSlug === deal.fromAirportSlug && r.destinationSlug === deal.toDestinationSlug);
      const summary = route ? current.getFareRangeSummary(route.slug, deal.cabin, NOW) : null;
      return summary && route ? [{ id: deal.id, route: route.slug, cabin: deal.cabin, summary }] : [];
    });
    const output = resolve('node_modules/.cache/fare-range-review');
    mkdirSync(output, { recursive: true });
    const report = { baseline: BASE, date: NOW, routes: routes.length, pairs: cells.length, hiddenStillHidden: hidden, cells, changed, pricedCards };
    writeFileSync(resolve(output, 'final-comparison.json'), JSON.stringify(report, null, 2));
    assert.equal(routes.length, 89);
    assert.equal(cells.length, 267);
    console.log(JSON.stringify({ baseline: BASE, date: NOW, routes: routes.length, pairs: cells.length,
      hiddenStillHidden: hidden, changed: changed.length, pricedCards: pricedCards.length,
      publication: 'identical', fareSignals: 'identical', history: 'identical', protectedSources: 'identical' }, null, 2));
  } finally {
    unlinkSync(file);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
