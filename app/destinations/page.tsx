import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PageHero } from '@/components/sections/page-hero';
import { DestinationVisual } from '@/components/ui/destination-visual';
import { destinations } from '@/data/destinations';
import { routes, getRoutesByDestination } from '@/data/routes';
import { regionGroups } from '@/lib/site-config';

export const metadata: Metadata = {
  alternates: { canonical: '/destinations' },
  title: 'All Destinations',
  description: 'Every destination covered by JetStash, from Pakistan and India to the Gulf and the Mediterranean.',
};

// Matches the site-wide commercial ordering: India first, then Pakistan, Umrah, Gulf.
const groupOrder: (keyof typeof regionGroups)[] = ['india', 'pakistan', 'umrah', 'gulf', 'mediterranean', 'northAfrica'];

export default function DestinationsIndexPage() {
  const regionCount = groupOrder.filter((key) =>
    destinations.some((d) => regionGroups[key].destinationSlugs.includes(d.slug))
  ).length;

  return (
    <>
      <PageHero
        heroKey="destinations"
        eyebrow="Destinations"
        title="Every destination, covered properly"
        description="Each city gets its own guide: routes from UK airports, booking windows, document guidance and the detail generic sites skip."
        stats={[
          { value: String(destinations.length), label: 'Destinations' },
          { value: String(regionCount), label: 'Regions' },
          { value: String(routes.length), label: 'Route guides' },
        ]}
      />

      {groupOrder.map((key) => {
        const group = regionGroups[key];
        const items = destinations.filter((d) => group.destinationSlugs.includes(d.slug));
        if (items.length === 0) return null;
        return (
          <section key={key} className="border-b border-ink-100 bg-white py-14 last:border-0 sm:py-16">
            <div className="mx-auto max-w-content px-5 sm:px-8">
              <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">{group.label}</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((dest) => {
                  const routeCount = getRoutesByDestination(dest.slug).length;
                  return (
                    <Link
                      key={dest.slug}
                      href={`/destinations/${dest.slug}`}
                      className="group flex flex-col overflow-hidden rounded-md border border-ink-100 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
                    >
                      <div className="relative h-36 overflow-hidden">
                        <DestinationVisual
                          slug={dest.slug}
                          label={dest.city}
                          sublabel={dest.country}
                          className="transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="flex flex-1 items-center justify-between gap-3 bg-white px-5 py-4">
                        <span className="text-sm text-ink-500">
                          {routeCount > 0
                            ? `${routeCount} UK route guide${routeCount === 1 ? '' : 's'}`
                            : 'Destination guide'}
                        </span>
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-900 transition-colors group-hover:text-terracotta-600">
                          View guide
                          <ArrowUpRight
                            className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                            strokeWidth={2.25}
                          />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
