'use client';

import { useState, useMemo } from 'react';
import { DealCard } from '@/components/ui/deal-card';
import { deals, DealCategory, hasTrackedFare } from '@/data/deals';
import { cn } from '@/lib/utils';

// A9 reposition (August 2026): 'All deals' -> 'All fares' — the one
// remaining "deal" word visible on this page itself. Every other label
// here already names a category, not a claim about the fare being a good
// one; 'All fares' reads the same way.
const filters: { label: string; value: DealCategory | 'all' }[] = [
  { label: 'All fares', value: 'all' },
  { label: 'Flights', value: 'flight' },
  { label: 'Packages', value: 'package' },
  { label: 'Business class', value: 'business' },
  { label: 'Umrah', value: 'umrah' },
];

/**
 * Which category filter tabs should actually render. A category tab whose
 * live count is genuinely 0 (Packages, Business class and Umrah today —
 * Packages and Business class currently lack a fully-dated, publishable
 * fare observation for any of their deals; Umrah's deals are bundled
 * flight+hotel products that a flight-only observation can never count as
 * evidence for, see isBundledProductDeal in data/deals.ts — hasTrackedFare
 * already encodes both cases) reads as broken or abandoned rather than honest, so
 * it's hidden rather than shown with a "0" badge. Driven by the exact same
 * hasTrackedFare gate the visible count badge already uses — never a
 * hand-maintained exclusion list — so a category reappears on its own the
 * moment fare-observations.ts gains one qualifying entry for it. "All
 * deals" is always kept: it's the one escape hatch a visitor can always
 * fall back to, and the page's own "no tracked fares yet" messaging
 * already handles that view honestly if it ever has zero tracked fares
 * too. Kept as a plain, pure, directly-testable function (matching this
 * codebase's existing convention for derivation logic) rather than living
 * inline in the component, so tests can call the exact function the page
 * renders from instead of re-implementing the filter predicate.
 */
export function getVisibleFilters(nowIso: string): typeof filters {
  return filters.filter((f) => {
    if (f.value === 'all') return true;
    return deals.some((d) => d.category === f.value && hasTrackedFare(d, nowIso));
  });
}

export function DealsExplorer() {
  const [active, setActive] = useState<DealCategory | 'all'>('all');

  const filtered = useMemo(() => {
    if (active === 'all') return deals;
    return deals.filter((d) => d.category === active);
  }, [active]);

  // Truth Reset (July 2026): "tracked" means a genuine checked-and-publishable
  // fare exists (hasTrackedFare) — a card with no checked price is a route
  // search card, not a tracked fare, and must never inflate this count.
  const nowIso = new Date().toISOString().slice(0, 10);
  const trackedCount = filtered.filter((d) => hasTrackedFare(d, nowIso)).length;
  const searchOnlyCount = filtered.length - trackedCount;

  const visibleFilters = useMemo(() => getVisibleFilters(nowIso), [nowIso]);

  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <div className="flex flex-wrap gap-2 border-b border-ink-100 pb-6" role="group" aria-label="Filter fares by category">
          {visibleFilters.map((f) => {
            const scoped = f.value === 'all' ? deals : deals.filter((d) => d.category === f.value);
            const count = scoped.filter((d) => hasTrackedFare(d, nowIso)).length;
            return (
              <button
                key={f.value}
                onClick={() => setActive(f.value)}
                aria-pressed={active === f.value}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  active === f.value ? 'bg-ink-900 text-sand-50' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                )}
              >
                {f.label}
                <span className={cn('ml-1.5 text-xs font-normal tabular-nums', active === f.value ? 'text-sand-100/70' : 'text-ink-400')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <p aria-live="polite" className="mt-6 text-sm text-ink-400">
          {trackedCount === 0
            ? `No tracked fares logged in this category yet — showing ${searchOnlyCount} route search card${searchOnlyCount === 1 ? '' : 's'} instead.`
            : `Showing ${trackedCount} tracked fare${trackedCount === 1 ? '' : 's'}${searchOnlyCount > 0 ? ` and ${searchOnlyCount} route search card${searchOnlyCount === 1 ? '' : 's'}` : ''}.`}
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </div>
    </section>
  );
}
