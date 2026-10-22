import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DealCard } from '@/components/ui/deal-card';
import { deals, getDealDirectnessLabel, getDealFareDirectnessLabel } from '@/data/deals';

/**
 * Tier-1 Commercial Readiness QA follow-up (September 2026).
 *
 * The QA found that DealCard's `range` branch (rendered whenever a real,
 * priced fare is shown -- exactly the case that matters most, since it
 * carries an actual number a traveller might act on) never stated the
 * route's own directness in its own text. The top-right badge already
 * correctly names the SPECIFIC FARE's own directness (via
 * getDealFareDirectnessLabel -- see deal-card-fare-directness.test.ts and
 * PR #74's own product-truth review), but nothing reconciled that against
 * the route's own verified service when the two disagree -- most exposed
 * on manchester-lahore and manchester-doha, where Fare Signal is also
 * suppressed, leaving the deal card as the only fare content on the page
 * with zero route-context reconciliation.
 *
 * The fix reuses routeFactLabel/airlineFactLabel -- both already computed
 * unconditionally at the top of the component and already rendered in the
 * sibling no-fare branch -- gated on a genuine mismatch (range.observedDirectness
 * !== presentation.status) so a card where the fare already agrees with the
 * route is completely unchanged.
 */

const NOW_ISO = '2026-10-20';

describe('DealCard reconciles a mismatched fare against the route\'s own directness', () => {
  it('manchester-dubai: the selected connecting travel period is distinguished from direct route service', () => {
    const deal = deals.find((d) => d.id === 'man-dxb-economy')!;
    // The selected November checks are connecting; older trips are outside the range.
    expect(getDealDirectnessLabel(deal, NOW_ISO)).toBe('Direct flight');
    expect(getDealFareDirectnessLabel(deal, NOW_ISO)).toBe('Connecting');

    const html = renderToStaticMarkup(DealCard({ deal, nowIso: NOW_ISO })).replace(/\s+/g, ' ');
    expect(html).toContain('Connecting</span>');
    expect(html).toContain('Connecting fare, not nonstop');
    expect(html).toContain('Nonstop flights are listed for this route, but this fare connects, so its price is not a nonstop price.');
  });

  it('renders reconciliation from the selected period classification', () => {
    const deal = deals.find((d) => d.id === 'man-dxb-economy')!;
    const html = renderToStaticMarkup(DealCard({ deal, nowIso: NOW_ISO })).replace(/\s+/g, ' ');
    expect(html).toContain('Nonstop flights are listed for this route, but this fare connects, so its price is not a nonstop price.');
  });

  it('a card where the fare already agrees with the route\'s own directness renders no reconciliation line at all -- nothing changes for the common case', () => {
    // manchester-islamabad's own Economy deal (if present) or any deal
    // whose fare directness matches its route: scan the full catalogue
    // rather than hardcoding one slug, so this stays correct as data
    // changes.
    let checkedAtLeastOne = false;
    for (const deal of deals) {
      const routeLabel = getDealDirectnessLabel(deal, NOW_ISO);
      const fareLabel = getDealFareDirectnessLabel(deal, NOW_ISO);
      if (!routeLabel || !fareLabel) continue;
      const routeIsDirectLike = routeLabel === 'Direct flight';
      const fareIsDirectLike = fareLabel === 'Direct flight';
      if (routeIsDirectLike !== fareIsDirectLike) continue; // this is the mismatch case, tested above
      checkedAtLeastOne = true;
      const html = renderToStaticMarkup(DealCard({ deal, nowIso: NOW_ISO })).replace(/\s+/g, ' ');
      expect(html, deal.id).not.toMatch(/Connecting fare, not nonstop|This fare is a (connecting|nonstop|direct) journey|Nonstop flights are listed for this route/);
    }
    expect(checkedAtLeastOne).toBe(true);
  });

  it('the no-fare branch\'s existing rendering is completely unchanged', () => {
    // A deal with no matching fare observation still renders exactly the
    // pre-existing Route:/Airline: fact line in the no-range branch --
    // untouched by this fix, which only added a NEW conditional block to
    // the range branch above it.
    const src = readFileSync(join(process.cwd(), 'components/ui/deal-card.tsx'), 'utf8');
    expect(src).toContain("const parts = [airlineFactLabel, routeFactLabel].filter(Boolean) as string[];");
  });
});
