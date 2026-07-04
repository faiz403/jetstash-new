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
          <h1 className="font-display text-4xl text-sand-50 sm:text-5xl">Fares we're tracking</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-300">
            Every fare below is an indicative example, not a live quote — prices change quickly, so always
            confirm the current price with the airline or partner before booking. "Checked" means a member of our
            team manually searched that route and recorded the fare shown — not an automated price feed. Routes with
            more than one recorded fare build up a real history over time, visible on that route's own guide.{' '}
            <a href="/about" className="font-medium text-brass-300 underline underline-offset-2 hover:text-brass-200">
              Read our standards
            </a>
            .
          </p>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="flex flex-wrap gap-2 border-b border-ink-100 pb-6" role="group" aria-label="Filter fares by category">
            {filters.map((f) => {
              const count = f.value === 'all' ? deals.length : deals.filter((d) => d.category === f.value).length;
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
                  <span className={cn('ml-1.5 text-xs font-normal', active === f.value ? 'text-sand-100/70' : 'text-ink-400')}>
                    {count}
                  </span>
                </button>
              );
            })}
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
