'use client';

import { useState, useMemo } from 'react';
import { DealCard } from '@/components/ui/deal-card';
import { deals, DealCategory } from '@/data/deals';
import { cn } from '@/lib/utils';

const filters: { label: string; value: DealCategory | 'all' }[] = [
  { label: 'All deals', value: 'all' },
  { label: 'Flights', value: 'flight' },
  { label: 'Packages', value: 'package' },
  { label: 'Business class', value: 'business' },
  { label: 'Umrah', value: 'umrah' },
];

export default function DealsPage() {
  const [active, setActive] = useState<DealCategory | 'all'>('all');

  const filtered = useMemo(() => {
    if (active === 'all') return deals;
    return deals.filter((d) => d.category === active);
  }, [active]);

  return (
    <>
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h1 className="font-display text-4xl text-sand-50 sm:text-5xl">Example fares</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-300">
            Every fare below is an indicative example, not a live quote — prices change quickly, so always
            confirm the current price with the airline or partner before booking.
          </p>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="flex flex-wrap gap-2 border-b border-ink-100 pb-6">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setActive(f.value)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  active === f.value ? 'bg-ink-900 text-sand-50' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <p className="mt-6 text-sm text-ink-400">
            Showing {filtered.length} {filtered.length === 1 ? 'fare' : 'fares'}
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
