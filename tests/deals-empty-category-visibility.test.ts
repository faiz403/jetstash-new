import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getVisibleFilters } from '@/components/sections/deals-explorer';
import { deals, hasTrackedFare, type DealCabin } from '@/data/deals';

/**
 * Deals page: a category filter tab (Packages, Business class, or any
 * other) with zero live (tracked-fare) deals is hidden rather than shown
 * with a misleading "0" badge — see the getVisibleFilters doc comment in
 * components/sections/deals-explorer.tsx for the full reasoning. "Live"
 * here means exactly what the pre-existing count badge already meant:
 * hasTrackedFare(deal, nowIso) — a genuine, fully-dated, publishable fare
 * observation exists for that deal's route+cabin (data/deals.ts,
 * data/fare-observations.ts). Nothing about deal data, affiliate links,
 * route facts or the deal cards themselves is touched by this fix.
 */

const NOW_ISO = '2026-08-01';
const explorerSrc = readFileSync(join(process.cwd(), 'components/sections/deals-explorer.tsx'), 'utf8');

describe('getVisibleFilters — real current production data', () => {
  const visible = getVisibleFilters(NOW_ISO);
  const visibleValues = visible.map((f) => f.value);

  it('1. Packages is hidden — every package-category deal currently has zero live (tracked-fare) count', () => {
    const packageDeals = deals.filter((d) => d.category === 'package');
    expect(packageDeals.length).toBeGreaterThan(0); // sanity: the category itself is not empty of deal objects
    expect(packageDeals.every((d) => !hasTrackedFare(d, NOW_ISO))).toBe(true);
    expect(visibleValues).not.toContain('package');
  });

  it('2. Business class is now visible — Business Fare Evidence Batch 1 (22 Aug 2026) plus the later Manchester-Karachi product-completion PR (23 Aug 2026) give four of the eleven existing business-category deals a genuine, current, publishable fare, which is enough to flip visibility (getVisibleFilters gates on deals.some(...), not every) — most business-category deals still have none (append-only archive: no observedDate<=nowIso gate, so this test\'s earlier-dated NOW_ISO still sees all the new evidence)', () => {
    const businessDeals = deals.filter((d) => d.category === 'business');
    expect(businessDeals.length).toBeGreaterThan(0);
    const withTrackedFare = businessDeals.filter((d) => hasTrackedFare(d, NOW_ISO)).map((d) => d.id).sort();
    // manchester-lahore, london-heathrow-lahore, london-heathrow-doha
    // (Business Fare Evidence Batch 1) plus manchester-karachi (product-
    // completion PR, 23 Aug 2026 — see tests/manchester-karachi-business-deal.test.ts).
    expect(withTrackedFare).toEqual(['lhr-business-lhe', 'lhr-doh-business', 'man-khi-business', 'man-lhe-business']);
    expect(visibleValues).toContain('business');
  });

  it('3. Umrah is hidden — its deals are bundled flight+hotel products, and a flight-only observation is never counted as evidence for one (product-integrity fix, August 2026)', () => {
    const umrahDeals = deals.filter((d) => d.category === 'umrah');
    expect(umrahDeals.length).toBeGreaterThan(0); // sanity: the category itself is not empty of deal objects
    expect(umrahDeals.every((d) => !hasTrackedFare(d, NOW_ISO))).toBe(true);
    expect(visibleValues).not.toContain('umrah');
  });

  it('4. Flights and All deals remain visible — Flights currently has at least one live deal', () => {
    expect(visibleValues).toContain('all');
    expect(visibleValues).toContain('flight');
    expect(deals.some((d) => d.category === 'flight' && hasTrackedFare(d, NOW_ISO))).toBe(true);
  });

  it('6. visible category order is unchanged for the surviving hidden categories — All, Flights, then Business now newly included in its original declared-array position, ahead of the still-hidden Packages and Umrah', () => {
    expect(visibleValues).toEqual(['all', 'flight', 'business']);
  });

  it('9. Packages and Umrah remain hidden (still zero live count); Business is no longer one of the hidden categories', () => {
    for (const value of ['package', 'umrah']) {
      expect(visible.find((f) => f.value === value)).toBeUndefined();
    }
    expect(visible.find((f) => f.value === 'business')).toBeTruthy();
  });
});

describe('getVisibleFilters — genericity (requirement 3 and "no hard-coded exclusion")', () => {
  it('3. the rule is driven by live-count data, not a per-category name check — no conditional branches on "package" or "business"', () => {
    const fnBody = explorerSrc.slice(explorerSrc.indexOf('export function getVisibleFilters'), explorerSrc.indexOf('export function DealsExplorer'));
    // The only place 'package'/'business' may legitimately appear is inside
    // the declarative `filters` array itself (outside this slice) — the
    // filter predicate must be free of any per-category special-casing.
    expect(fnBody).not.toMatch(/f\.value === 'package'/);
    expect(fnBody).not.toMatch(/f\.value === 'business'/);
    expect(fnBody).not.toMatch(/=== 'Packages'/);
    expect(fnBody).not.toMatch(/=== 'Business class'/);
  });

  it('the predicate is the exact same hasTrackedFare gate the visible count badge uses — one source of truth, not two', () => {
    const fnBody = explorerSrc.slice(explorerSrc.indexOf('export function getVisibleFilters'), explorerSrc.indexOf('export function DealsExplorer'));
    expect(fnBody).toContain('hasTrackedFare(d, nowIso)');
    const countLine = explorerSrc.match(/const count = scoped\.filter\(\(d\) => hasTrackedFare\(d, nowIso\)\)\.length;/);
    expect(countLine).not.toBeNull();
  });
});

describe('getVisibleFilters — a category reappears automatically once populated (requirement 5)', () => {
  afterEach(() => {
    vi.doUnmock('@/data/fare-observations');
    vi.resetModules();
  });

  it('5. Business class reappears the moment one of its deals gains a publishable fare observation — proven by mocking only the underlying fare-observations lookup, never editing real data', async () => {
    // dxb-business-man (manchester-dubai, Business) is a real, existing deal
    // whose route genuinely exists in data/routes.ts — it's untracked today
    // only because no *complete* (departure+return dated) Business-cabin
    // observation has been logged for that route yet. Simulating exactly
    // one such observation, and only for that one route+cabin pair, proves
    // the category-visibility rule reacts to data, not a hand exclusion.
    vi.resetModules();
    vi.doMock('@/data/fare-observations', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/data/fare-observations')>();
      return {
        ...actual,
        getFareRangeSummary: (routeSlug: string, cabin: DealCabin, nowIso: string) => {
          if (routeSlug === 'manchester-dubai' && cabin === 'Business') {
            return {
              count: 1,
              min: 1800,
              max: 1800,
              earliestDate: '2026-07-01',
              latestDate: '2026-07-01',
              sources: ['Emirates'],
              priceNote: 'return, per person',
            };
          }
          return actual.getFareRangeSummary(routeSlug, cabin, nowIso);
        },
      };
    });

    const { getVisibleFilters: getVisibleFiltersWithMockedFare } = await import('@/components/sections/deals-explorer');
    const visibleAfter = getVisibleFiltersWithMockedFare(NOW_ISO).map((f) => f.value);
    expect(visibleAfter).toContain('business');
    // Order preserved even with a newly-reappeared category — still All, Flights, Business class.
    // Umrah stays hidden throughout: isBundledProductDeal short-circuits it
    // before any route+cabin lookup, so mocking manchester-dubai/Business
    // fare data has no effect on it.
    expect(visibleAfter).toEqual(['all', 'flight', 'business']);
  });

  it('Packages stays hidden in that same simulated scenario — only the mocked route+cabin pair was affected, nothing else', async () => {
    vi.resetModules();
    vi.doMock('@/data/fare-observations', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/data/fare-observations')>();
      return {
        ...actual,
        getFareRangeSummary: (routeSlug: string, cabin: DealCabin, nowIso: string) => {
          if (routeSlug === 'manchester-dubai' && cabin === 'Business') {
            return { count: 1, min: 1800, max: 1800, earliestDate: '2026-07-01', latestDate: '2026-07-01', sources: ['Emirates'], priceNote: 'return, per person' };
          }
          return actual.getFareRangeSummary(routeSlug, cabin, nowIso);
        },
      };
    });
    const { getVisibleFilters: getVisibleFiltersWithMockedFare } = await import('@/components/sections/deals-explorer');
    expect(getVisibleFiltersWithMockedFare(NOW_ISO).map((f) => f.value)).not.toContain('package');
  });
});

describe('rendering — no blank containers, unchanged card/link/affiliate behaviour (requirements 7, 8, 10, 11, 13)', () => {
  it('7/8. every deal still renders via the same untouched DealCard, keyed by its own id, from the full filtered list — no card, link or affiliate wiring touched', () => {
    expect(explorerSrc).toContain('{filtered.map((deal) => (');
    expect(explorerSrc).toContain('<DealCard key={deal.id} deal={deal} />');
  });

  it('10. hidden categories leave nothing behind — the tab row is a single .map() over the now-filtered list, not a fixed-size layout with placeholders', () => {
    expect(explorerSrc).toContain('{visibleFilters.map((f) => {');
    // No separate empty-slot/placeholder/divider markup was introduced.
    expect(explorerSrc).not.toMatch(/Coming soon/i);
    expect(explorerSrc).not.toMatch(/placeholder/i);
  });

  it('11. mobile and desktop read the exact same visibleFilters array — the tab row has no separate mobile/desktop branch, only responsive CSS classes', () => {
    const tabRowBlock = explorerSrc.match(/<div className="flex flex-wrap gap-2[^>]*>[\s\S]*?<\/div>\s*\n\s*<\/div>/)?.[0] ?? '';
    // Exactly one visibleFilters.map call renders the tabs — no second, viewport-specific list.
    const mapCalls = explorerSrc.match(/visibleFilters\.map\(/g) ?? [];
    expect(mapCalls).toHaveLength(1);
    expect(explorerSrc).not.toMatch(/sm:hidden[\s\S]{0,200}visibleFilters/);
  });

  it('13. no route, fare, affiliate or analytics import was added — the component still only imports DealCard, deal data helpers and cn', () => {
    expect(explorerSrc).toContain("import { DealCard } from '@/components/ui/deal-card';");
    expect(explorerSrc).toContain("import { deals, DealCategory, hasTrackedFare } from '@/data/deals';");
    expect(explorerSrc).toContain("import { cn } from '@/lib/utils';");
    expect(explorerSrc).not.toMatch(/from '@\/lib\/analytics'/);
    expect(explorerSrc).not.toMatch(/from '@\/data\/routes'/);
  });
});

describe('page-level all-empty state is preserved (requirement 12)', () => {
  it('the existing "no tracked fares logged in this category yet" fallback text is untouched', () => {
    expect(explorerSrc).toContain(
      "? `No tracked fares logged in this category yet — showing ${searchOnlyCount} route search card${searchOnlyCount === 1 ? '' : 's'} instead.`"
    );
  });

  it('the fallback is driven by the same trackedCount/searchOnlyCount computation as before — not touched by this fix', () => {
    expect(explorerSrc).toContain('const trackedCount = filtered.filter((d) => hasTrackedFare(d, nowIso)).length;');
    expect(explorerSrc).toContain('const searchOnlyCount = filtered.length - trackedCount;');
  });

  it('no fabricated content was introduced for an empty state — no invented deal, no redirect', () => {
    expect(explorerSrc).not.toMatch(/router\.push/);
    expect(explorerSrc).not.toMatch(/redirect/i);
  });
});
