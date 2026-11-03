import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { GoogleMapsAttribution } from '@/components/arrive-by-google-attribution';
import { ArriveByMissedServiceDetails, ArriveByReadyBySummary } from '@/components/arrive-by-result-explanations';
import { classifyPlan, metricKey, outcomeField } from '@/lib/arrive-by-journey/beta-metrics';
import { footerNav, mainNav } from '@/lib/site-config';

/**
 * Arrive By public launch (CEO directive, 3 November 2026). Arrive By has been live as a hidden beta since PR #293;
 * launching it means making it findable (indexable, sitemap, navigation and footer), meeting Google's attribution
 * rules for showing Google Maps Platform content without a map, and counting a place-confirmation step as a step,
 * not a failure. No calculation, guard or budget changes.
 */
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8').replace(/\r\n/g, '\n');
const PUBLIC_VIEWS = ['arrive-by-full-journey', 'arrive-by-road-public', 'arrive-by-pakistan-public', 'arrive-by-manchester-public'];

describe('Google Maps attribution', () => {
  it('renders the untranslated, unwrapped text "Google Maps" in an allowed colour and size', () => {
    const html = renderToStaticMarkup(createElement(GoogleMapsAttribution));
    expect(html).toContain('translate="no"');
    expect(html).toContain('whitespace-nowrap');
    expect(html).toContain('>Google Maps<');
    expect(html).toContain('text-google-attribution');
    expect(html).toContain('text-xs');
    expect(read('tailwind.config.js')).toContain("'google-attribution': '#5E5E5E'");
  });

  it.each(PUBLIC_VIEWS)('%s imports and uses it', (view) => {
    const src = read('components', `${view}.tsx`);
    expect(src).toContain("import { GoogleMapsAttribution } from '@/components/arrive-by-google-attribution';");
    expect(src).toMatch(/<GoogleMapsAttribution\b/);
  });

  // Google: "Position attribution near the top or bottom of the content, and within the same visual container."
  // Every bordered panel that shows Google content carries its own attribution, not only the outer result card.
  const block = (src: string, start: string, end: string) => {
    const from = src.indexOf(start);
    expect(from, start).toBeGreaterThan(-1);
    return src.slice(from, src.indexOf(end, from) + end.length);
  };

  it('the planner: result card and place-choice box', () => {
    const src = read('components', 'arrive-by-full-journey.tsx');
    expect(block(src, 'function PendingChoice', '</div>;\n  }')).toMatch(/<GoogleMapsAttribution\b/);
    expect(block(src, '{plan && <div ref={resultRef}', '</section>')).toMatch(/<GoogleMapsAttribution\b/);
  });

  it('the planner: ready-by and missed-service panels, rendered', () => {
    const plan = {
      state: 'POSSIBLE_WITH_MARGIN', stateLabel: 'POSSIBLE WITH MARGIN', reasons: [], timeline: [],
      finalArrival: { iso: '2026-11-14T11:44:00.000Z', zone: 'Europe/London', clock: '11:45', dateLabel: 'Sat 14 Nov', dayOffset: 0 },
      deadline: { iso: '2026-11-14T13:00:00.000Z', latestAcceptableIso: '2026-11-14T13:00:00.000Z', marginMinutes: 76 },
    } as never;
    const transit = { firstService: 'the 10:58 train', expectedArrivalIso: '2026-11-14T11:44:00.000Z', missedServiceArrivalIso: '2026-11-14T12:10:00.000Z', missedServiceMeetsReadyBy: true };
    const readyBy = renderToStaticMarkup(createElement(ArriveByReadyBySummary, { plan }));
    const missed = renderToStaticMarkup(createElement(ArriveByMissedServiceDetails, { transit, timeZone: 'Europe/London' }));
    for (const [name, html] of [['ready-by', readyBy], ['missed-service', missed]]) {
      expect(html, name).toContain('data-testid="google-maps-attribution"');
      expect(html.indexOf('google-maps-attribution'), name).toBeLessThan(html.lastIndexOf('</'));
    }
  });

  it('the Manchester view: answer card, missed-service card, driving cards, itineraries and place check', () => {
    const src = read('components', 'arrive-by-manchester-public.tsx');
    expect(block(src, 'function JourneyChain', '</details>;')).toMatch(/<GoogleMapsAttribution\b/);
    expect(block(src, 'function CarEstimate', '</section>;')).toMatch(/<GoogleMapsAttribution\b/);
    expect(block(src, 'If you miss the first important service', '</section>}')).toMatch(/<GoogleMapsAttribution\b/);
    expect(block(src, '{result && <div ref={resultRef}', '</section>')).toMatch(/<GoogleMapsAttribution\b/);
    expect(block(src, '{pending && <div ref={resultRef}', '</div>}\n\n')).toMatch(/<GoogleMapsAttribution\b/);
  });

  // Each bordered place-check box (Google's found address or candidate list) is its own container.
  const ownDiv = (src: string, at: number) => {
    const open = src.lastIndexOf('<div', at);
    const re = /<div\b|<\/div>/g;
    re.lastIndex = open;
    let depth = 0;
    for (let t = re.exec(src); t; t = re.exec(src)) {
      depth += t[0] === '</div>' ? -1 : 1;
      if (depth === 0) return src.slice(open, t.index);
    }
    throw new Error('unclosed div');
  };
  it.each(PUBLIC_VIEWS)('%s: every place confirmation or selection box carries its own attribution', (view) => {
    const src = read('components', `${view}.tsx`);
    const marker = 'className="mt-4 rounded-md border border-brass bg-white p-4"';
    const boxes: string[] = [];
    for (let at = src.indexOf(marker); at >= 0; at = src.indexOf(marker, at + marker.length)) boxes.push(ownDiv(src, at));
    expect(boxes.length, view).toBeGreaterThanOrEqual(1);
    for (const box of boxes) expect(box, box.slice(0, 120)).toMatch(/<GoogleMapsAttribution\b/);
  });

  it.each(['arrive-by-road-public', 'arrive-by-pakistan-public'])('%s: the result card, which also holds its place check', (view) => {
    const src = read('components', `${view}.tsx`);
    const card = block(src, '{result && <div ref={resultRef}', '</section>');
    expect(card).toMatch(/<GoogleMapsAttribution\b/);
    expect(card).toContain('Google found:');
  });
});

describe('beta outcome counting', () => {
  const choice = { placeId: 'p', formattedAddress: 'somewhere' };

  it('a pause that offers a place to confirm or choose is needs_confirmation, not a failure', () => {
    expect(classifyPlan({ state: 'CANNOT_CONFIRM', notEvidenced: { reason: 'ARRIVAL_DESTINATION_UNCONFIRMED' }, arrivalDetail: { outcome: 'DESTINATION_NEEDS_CONFIRMATION' as never, pendingConfirmation: choice } }))
      .toEqual({ kind: 'needs_confirmation', side: 'ARRIVAL_DESTINATION' });
    expect(classifyPlan({ state: 'CANNOT_CONFIRM', notEvidenced: { reason: 'START_LOCATION_UNCONFIRMED' }, startDetail: { confidence: 'NEEDS_SELECTION', pendingSelection: { candidates: [choice] } } }))
      .toEqual({ kind: 'needs_confirmation', side: 'START_LOCATION' });
  });

  it('the same reason without anything to choose is still cannot_confirm', () => {
    expect(classifyPlan({ state: 'CANNOT_CONFIRM', notEvidenced: { reason: 'ARRIVAL_DESTINATION_UNCONFIRMED' } }))
      .toEqual({ kind: 'cannot_confirm', reason: 'ARRIVAL_DESTINATION_UNCONFIRMED' });
    expect(classifyPlan({ state: 'CANNOT_CONFIRM', notEvidenced: { reason: 'START_LOCATION_UNCONFIRMED' }, arrivalDetail: { outcome: 'DESTINATION_NEEDS_CONFIRMATION' as never, pendingConfirmation: choice } }))
      .toEqual({ kind: 'cannot_confirm', reason: 'START_LOCATION_UNCONFIRMED' });
  });

  it('uses only fixed counter names, so no journey text can reach a key', () => {
    expect(outcomeField({ kind: 'needs_confirmation', side: 'START_LOCATION' })).toBe('needs_confirmation:START_LOCATION');
    expect(outcomeField({ kind: 'needs_confirmation', side: 'ARRIVAL_DESTINATION' })).toBe('needs_confirmation:ARRIVAL_DESTINATION');
    expect(outcomeField({ kind: 'needs_confirmation', side: '12 Acacia Road' as never })).toBe('needs_confirmation:UNSPECIFIED');
    expect(metricKey('2026-11-03', 'needs_confirmation:START_LOCATION')).toBe('arrive-by:metric:2026-11-03:needs_confirmation:START_LOCATION');
  });
});

describe('findability', () => {
  it('is in the main navigation and the footer, and the page is indexable with a public title', () => {
    expect(mainNav.some((item) => item.href === '/arrive-by')).toBe(true);
    expect(footerNav.explore.some((item) => item.href === '/arrive-by')).toBe(true);
    const page = read('app', 'arrive-by', 'page.tsx');
    expect(page).toContain("title: 'Arrive By: when to leave for your flight and onward journey'");
    expect(page).not.toMatch(/robots:/);
  });

  it('keeps the honest Beta label and the no-guarantee wording in the product', () => {
    expect(read('components', 'arrive-by-shell.tsx')).toContain('Arrive By — Beta');
    expect(read('components', 'arrive-by-full-journey.tsx')).toContain('This is an estimate, not a guarantee.');
    expect(read('components', 'arrive-by-full-journey.tsx')).toContain('Arrive By does not track a live flight.');
  });
});
