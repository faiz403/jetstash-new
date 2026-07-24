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
  description:
    'International destinations covered by JetStash, with deepest route intelligence in South Asia and the Gulf plus destination guidance across Turkey, Morocco and the Mediterranean.',
};

// Matches the site-wide commercial ordering: India first, then Pakistan, Umrah, Gulf.
const groupOrder: (keyof typeof regionGroups)[] = ['india', 'pakistan', 'umrah', 'gulf', 'mediterranean', 'northAfrica'];

const coverageAreas = [
  {
    title: 'South Asia',
    detail: 'Pakistan and India',
    body: 'Our deepest route intelligence: booking timing, service status and travel-ready guidance.',
    href: '#india',
  },
  {
    title: 'Gulf & Saudi',
    detail: 'Dubai, Doha, Jeddah and Madinah',
    body: 'Route guidance, travel readiness and specialist support for Umrah journeys.',
    href: '#umrah',
  },
  {
    title: 'Mediterranean & Southern Europe',
    detail: 'Turkey, Spain, Portugal, Greece and Italy',
    body: 'Destination guidance for the journeys UK travellers make again and again.',
    href: '#mediterranean',
  },
  {
    title: 'North Africa',
    detail: 'Morocco',
    body: 'Destination guidance with practical detail, built route by route as evidence grows.',
    href: '#northAfrica',
  },
];

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

      <section className="border-b border-ink-100 bg-sand-50 py-12 sm:py-14">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Where we currently have guidance</span>
          <h2 className="mt-2 max-w-2xl font-display text-2xl text-ink-900 sm:text-3xl">Explore JetStash by region</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-500">
            Route-level intelligence is deepest in South Asia and the Gulf. Destination guidance also covers selected
            journeys across the Mediterranean, Southern Europe and North Africa.
          </p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {coverageAreas.map((area) => (
              <Link
                key={area.title}
                href={area.href}
                className="group flex min-h-44 flex-col rounded-md border border-ink-100 bg-white p-5 shadow-card transition-all hover:-translate-y-1 hover:border-brass-200 hover:shadow-card-hover"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">{area.detail}</span>
                <h3 className="mt-2 font-display text-xl text-ink-900">{area.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-500">{area.body}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 transition-colors group-hover:text-terracotta-600">
                  Explore coverage
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.25} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {groupOrder.map((key) => {
        const group = regionGroups[key];
        const items = destinations.filter((d) => group.destinationSlugs.includes(d.slug));
        if (items.length === 0) return null;
        return (
          <section id={key} key={key} className="border-b border-ink-100 bg-white py-14 last:border-0 sm:py-16">
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
