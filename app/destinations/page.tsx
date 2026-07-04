import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { destinations } from '@/data/destinations';
import { regionGroups } from '@/lib/site-config';

export const metadata: Metadata = {
  alternates: { canonical: '/destinations' },
  title: 'All Destinations',
  description: 'Every destination covered by JetStash, from Pakistan and India to the Gulf and the Mediterranean.',
};

const groupOrder: (keyof typeof regionGroups)[] = ['pakistan', 'india', 'gulf', 'umrah', 'mediterranean', 'northAfrica'];

export default function DestinationsIndexPage() {
  return (
    <>
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h1 className="font-display text-4xl text-sand-50 sm:text-5xl">All destinations</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-300">{destinations.length} destinations across six regions.</p>
        </div>
      </section>

      {groupOrder.map((key) => {
        const group = regionGroups[key];
        const items = destinations.filter((d) => group.destinationSlugs.includes(d.slug));
        if (items.length === 0) return null;
        return (
          <section key={key} className="border-b border-ink-100 bg-white py-14 sm:py-16">
            <div className="mx-auto max-w-content px-5 sm:px-8">
              <h2 className="font-display text-2xl text-ink-900">{group.label}</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((dest) => (
                  <Link
                    key={dest.slug}
                    href={`/destinations/${dest.slug}`}
                    className="group flex flex-col rounded-md border border-ink-100 p-5 transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                      <MapPin className="h-3.5 w-3.5" strokeWidth={2.25} />
                      {dest.country}
                    </span>
                    <h3 className="mt-2 font-display text-xl text-ink-900">{dest.city}</h3>
                    <span className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                      View guide <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
