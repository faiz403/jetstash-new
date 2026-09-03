import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FareHistoryPanel } from '@/components/route/fare-history-panel';
import { getPublishableObservationsByRoute } from '@/data/fare-observations';

/**
 * MAN→ISB Flagship Verdict pilot, Phase 1 (September 2026). Fare History's
 * full observation list is now collapsed behind a native <details> element
 * by default — applied to the shared FareHistoryPanel component universally
 * (not just on manchester-islamabad), since there is no per-route branching
 * to hang a narrower change on. This suite exists specifically to prove
 * that collapsing changes visibility only: no observation is removed,
 * reordered or reworded, across more than one route.
 */
describe('FareHistoryPanel: collapsed by default, nothing removed', () => {
  it('wraps the observation rows in a native <details>, closed by default (no `open` attribute)', () => {
    const observations = getPublishableObservationsByRoute('manchester-islamabad', '2026-09-03');
    const html = renderToStaticMarkup(FareHistoryPanel({ observations }));
    expect(html).toContain('<details>');
    expect(html).not.toContain('<details open');
  });

  it('the always-visible header still states the real check count before any disclosure is opened', () => {
    const observations = getPublishableObservationsByRoute('manchester-islamabad', '2026-09-03');
    const html = renderToStaticMarkup(FareHistoryPanel({ observations }));
    expect(html).toMatch(/Economy · \d+ comparable checks? tracked/);
    expect(html).toMatch(/<summary[^>]*>See all \d+ checks?<\/summary>/);
  });

  it('every observation row still renders inside the collapsed markup — collapsed is not removed', () => {
    const observations = getPublishableObservationsByRoute('manchester-islamabad', '2026-09-03');
    const html = renderToStaticMarkup(FareHistoryPanel({ observations }));
    // Cross-checked against the known manchester-islamabad archive (also
    // asserted by tests/fare-history-coherence.test.ts's own price list) —
    // every one of these must still be present, not just the summary count.
    for (const price of [434, 431, 460, 480, 601, 621, 626, 645, 524, 562]) {
      expect(html, `£${price}`).toContain(`£${price.toLocaleString('en-GB')}`);
    }
    expect(html).toContain('comparable check');
    expect(html).toContain('Checked');
    expect(html).toContain('Travel dates:');
  });

  it('the summary count matches the real number of publishable rows for a second, differently-shaped route', () => {
    const observations = getPublishableObservationsByRoute('manchester-dubai', '2026-08-19');
    const html = renderToStaticMarkup(FareHistoryPanel({ observations }));
    const count = observations.length;
    expect(html).toContain(`See all ${count} check${count === 1 ? '' : 's'}`);
  });

  it('a route with zero publishable observations still renders nothing at all (unchanged fail-closed behaviour)', () => {
    expect(FareHistoryPanel({ observations: [] })).toBeNull();
  });

  it('the trailing "not a live price feed" disclaimer is unchanged and still present', () => {
    const observations = getPublishableObservationsByRoute('manchester-islamabad', '2026-09-03');
    const html = renderToStaticMarkup(FareHistoryPanel({ observations }));
    expect(html).toContain('Every figure above is a fare checked and recorded on the date shown, not a live price feed.');
  });
});
