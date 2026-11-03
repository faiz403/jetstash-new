import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { GoogleMapsAttribution } from '@/components/arrive-by-google-attribution';
import { classifyPlan, metricKey, outcomeField } from '@/lib/arrive-by-journey/beta-metrics';
import { footerNav, mainNav } from '@/lib/site-config';

/**
 * Arrive By public launch (CEO directive, 3 November 2026). Arrive By has been live as a hidden beta since PR #293;
 * launching it means making it findable (indexable, sitemap, navigation and footer), meeting Google's attribution
 * rules for showing Google Maps Platform content without a map, and counting a place-confirmation step as a step,
 * not a failure. No calculation, guard or budget changes.
 */
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
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

  it.each(PUBLIC_VIEWS)('%s shows it inside every result container that carries Google content', (view) => {
    const src = read('components', `${view}.tsx`);
    expect(src).toContain("import { GoogleMapsAttribution } from '@/components/arrive-by-google-attribution';");
    expect((src.match(/<GoogleMapsAttribution\b/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('the full-journey planner also shows it in the place-choice box, where Google place names are listed', () => {
    const src = read('components', 'arrive-by-full-journey.tsx');
    expect(src).toContain('{(detail.pendingConfirmation || detail.pendingSelection) && <GoogleMapsAttribution');
    expect((src.match(/<GoogleMapsAttribution\b/g) ?? []).length).toBe(2);
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
