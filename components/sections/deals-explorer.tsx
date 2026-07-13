'use client';

import { useState, useMemo } from 'react';
import { DealCard } from '@/components/ui/deal-card';
import { deals, DealCategory, hasTrackedFare } from '@/data/deals';
import { cn } from '@/lib/utils';

const filters: { label: string; value: DealCategory | 'all' }[] = [
  { label: 'All deals', value: 'all' },
  { label: 'Flights', value: 'flight' },
  { label: 'Packages', value: 'package' },
  { label: 'Business class', value: 'business' },
  { label: 'Umrah', value: 'umrah' },
];

export function DealsExplorer() {
  const [active, setActive] = useState<DealCategory | 'all'>('all');

  const filtered = useMemo(() => {
    if (active === 'all') return deals;
    return deals.filter((d) => d.category === active);
  }, [active]);

  // Truth Reset (July 2026): "tracked" means a genuine checked-and-publishable
  // fare exists (hasTrackedFare) — a card with no checked price is a route
  // search card, not a tracked fare, and must never inflate this count.
  const trackedCount = filtered.filter(hasTrackedFare).length;
  const searchOnlyCount = filtered.length - trackedCount;

  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <div className="flex flex-wrap gap-2 border-b border-ink-100 pb-6" role="group" aria-label="Filter fares by category">
          {filters.map((f) => {
            const scoped = f.value === 'all' ? deals : deals.filter((d) => d.category === f.value);
            const count = scoped.filter(hasTrackedFare).length;
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
