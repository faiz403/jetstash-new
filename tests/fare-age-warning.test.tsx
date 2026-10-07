import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FareAgeWarning } from '@/components/route/fare-age-warning';
import { FareSignal } from '@/components/route/fare-signal';
import { RouteCardFare } from '@/components/route/route-card-fare';
import { TrackedFaresExplorer } from '@/components/sections/tracked-fares-explorer';
import { buildTrackedFareAirportGroups } from '@/lib/tracked-fare-groups';
import { getFareAgeWarningText } from '@/lib/fare-age-warning';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import type { FareSignalObservation } from '@/lib/fare-signal';

const NOW = '2026-10-08';
const observation = (observedDate: string): FareSignalObservation => ({
  id: `fare-${observedDate}`,
  cabin: 'Economy',
  airline: 'Example Air',
  price: 123,
  currency: 'GBP',
  observedDate,
  departureDate: '2026-11-17',
  returnDate: '2026-12-01',
  directness: 'direct',
  outboundStops: 0,
  returnStops: 0,
  connectionAirports: [],
  isSelfTransfer: false,
  journeyConsequences: [],
});

const norm = (html: string) => html.replace(/\s+/g, ' ');

describe('representative fare age warning', () => {
  it('starts strictly after day 30 and uses the actual age', () => {
    expect(getFareAgeWarningText('2026-09-08', NOW)).toBeNull();
    expect(getFareAgeWarningText('2026-09-07', NOW)).toBe(
      'Checked 31 days ago. Price or availability may have changed.',
    );
    expect(getFareAgeWarningText('2026-08-13', NOW)).toBe(
      'Checked 56 days ago. Price or availability may have changed.',
    );
  });

  it('keeps 56-day and 60-day fares visible; the cue never hides their price', () => {
    for (const [observedDate, age] of [['2026-08-13', 56], ['2026-08-09', 60]] as const) {
      const html = norm(renderToStaticMarkup(createElement(RouteCardFare, {
        observation: observation(observedDate),
        state: 'current',
        nowIso: NOW,
      })));
      expect(html).toContain('£123');
      expect(html).toContain(`Checked ${age} days ago. Price or availability may have changed.`);
    }
  });

  it('keeps a 30-day fare warning-free and emits one warning on a 31-day route Fare Signal', () => {
    const warningFree = norm(renderToStaticMarkup(createElement(FareAgeWarning, {
      observedDate: '2026-09-08', nowIso: NOW,
    })));
    expect(warningFree).toBe('');

    const signal = getFareSignalForRoute('manchester-islamabad', '2026-10-08');
    const html = norm(renderToStaticMarkup(FareSignal({
      signal: { ...signal, state: 'current', observation: observation('2026-09-07') },
      nowIso: NOW,
      tripComUrl: null,
      routeSlug: 'manchester-islamabad',
    })));
    const warning = 'Checked 31 days ago. Price or availability may have changed.';
    expect(html.match(new RegExp(warning, 'g'))).toHaveLength(1);
  });

  it('preserves the existing recent-state caveat and upgrades it to one age-specific cue only after day 30', () => {
    const recent = getFareSignalForRoute('manchester-islamabad', '2026-10-08');
    const recentMarkup = (observedDate: string) => norm(renderToStaticMarkup(FareSignal({
      signal: { ...recent, state: 'recent', observation: observation(observedDate) },
      nowIso: NOW,
      tripComUrl: null,
      routeSlug: 'manchester-islamabad',
    })));

    expect(recentMarkup('2026-09-23')).toContain('Price may have changed.');
    const older = recentMarkup('2026-09-07');
    expect(older).toContain('Checked 31 days ago. Price or availability may have changed.');
    expect(older).not.toContain('Price may have changed.');
  });

  it('shows the same single cue on tracked-fare cards without changing group membership', () => {
    const groups = buildTrackedFareAirportGroups(undefined, undefined, NOW);
    const routeCount = groups.reduce((count, group) => count + group.entries.length, 0);
    const html = norm(renderToStaticMarkup(createElement(TrackedFaresExplorer, {
      airportGroups: groups.filter((group) => group.entries.some((entry) => entry.routeSlug === 'manchester-islamabad')),
      nowIso: NOW,
    })));

    expect(routeCount).toBe(75);
    expect(html).toContain('£480');
    expect(html).toContain('Checked 44 days ago. Price or availability may have changed.');
    expect(html.match(/Price or availability may have changed\./g)).toHaveLength(1);
  });

  it('does not add the representative-fare cue to historical range or deal-card copy', () => {
    const source = [
      'components/sections/deal-card.tsx',
      'components/sections/fare-history-panel.tsx',
    ];
    for (const path of source) {
      // Keep the shared cue isolated to selected representative fare surfaces.
      expect(readFileSync(join(process.cwd(), path), 'utf8')).not.toContain('FareAgeWarning');
    }
  });
});
