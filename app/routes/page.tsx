import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, MapPin, Plane } from 'lucide-react';
import { PageHero } from '@/components/sections/page-hero';
import { routes, getRouteAirport, getRouteDestination, type Route } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { airports } from '@/data/airports';
import type { RegionGroup } from '@/data/destinations';

// Pure ISR, matching the route detail pages — every card here renders
// getEffectiveRoutePresentation(), which must regenerate without a deploy
// once a ledger event's effective date passes.
export const revalidate = 21600;

export const metadata: Metadata = {
  alternates: { canonical: '/routes' },
  title: 'Route Guides from UK Airports',
  description:
    'Airport-to-destination route guides with service status, booking timing and honest direct-or-connecting guidance. Current route coverage is deepest in South Asia and the Gulf.',
};

const regionLabels: Record<RegionGroup, string> = {
  pakistan: 'Pakistan',
  india: 'India',
  gulf: 'The Gulf & Umrah',
  mediterranean: 'Mediterranean',
  'north-africa': 'North Africa',
};

// Matches the site-wide commercial ordering: India first, then Pakistan, then Gulf/Umrah.
const regionOrder: RegionGroup[] = ['india', 'pakistan', 'gulf', 'mediterranean', 'north-africa'];

export default function RoutesIndexPage() {
  const grouped = regionOrder
    .map((region) => {
      const routesInRegion = routes.filter((r) => {
        const dest = getRouteDestination(r);
        return dest?.region === region;
      });
      return { region, routesInRegion };
    })
    .filter((g) => g.routesInRegion.length > 0);

  const todayIso = new Date().toISOString().slice(0, 10);
  // Truth Reset (July 2026): only currently-verified direct routes count here —
  // a route claiming isDirect with no fresh verification record must not
  // inflate this headline stat. Final audit fix: goes through
  // getEffectiveRoutePresentation() rather than the legacy
  // getDisplayDirectness() directly, so a ledger-managed corridor past its
  // withdrawal boundary (or ended) is correctly excluded even though the
  // legacy, inclusive check would still count it.
  const directCount = routes.filter((r) => getEffectiveRoutePresentation(r, routeStatusEvents, todayIso).status === 'direct').length;
  const airportCount = airports.filter((a) => routes.some((r) => r.airportSlug === a.slug)).length;

  return (
    <>
      <PageHero
        heroKey="routes"
        eyebrow="Route guides"
        title="International route guides from UK airports"
        description="Every airport-to-destination pairing has its own booking pattern, peak periods and honest direct-or-connecting answer. Current route coverage is deepest in South Asia and the Gulf."
        stats={[
          { value: String(routes.length), label: 'Route guides' },
          { value: String(directCount), label: 'Direct routes' },
          { value: String(airportCount), label: 'UK airports' },
        ]}
      />

      {grouped.map(({ region, routesInRegion }) => (
        <section key={region} className="border-b border-ink-100 bg-white py-14 last:border-0 sm:py-16">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">{regionLabels[region]}</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {routesInRegion.map((route: Route) => {
                const airport = getRouteAirport(route);
                const dest = getRouteDestination(route);
                if (!airport || !dest) return null;
                // Verification-pending leakage fix: never read route.flightTime raw.
                const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, todayIso);
                return (
                  <Link
                    key={route.slug}
                    href={`/routes/${route.slug}`}
                    className="group relative flex flex-col overflow-hidden rounded-md border border-ink-100 p-6 shadow-card transition-all hover:-translate-y-1 hover:border-brass-200 hover:shadow-card-hover"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                        <MapPin className="h-3.5 w-3.5" strokeWidth={2.25} />
                        {dest.country}
                      </span>
                      <span
                        className={
                          presentation.status === 'direct'
                            ? 'inline-flex items-center gap-1.5 rounded-full bg-brass-50 px-2.5 py-0.5 text-xs font-semibold text-brass-700'
                            : 'inline-flex items-center rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-semibold text-ink-500'
                        }
                      >
                        {presentation.status === 'direct' && <Plane className="h-3 w-3" strokeWidth={2.5} />}
                        {presentation.statusLabel}
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-xl text-ink-900">
                      {airport.city}{' '}
                      <span className="inline-block text-brass-500 transition-transform duration-300 group-hover:translate-x-0.5">→</span>{' '}
                      {dest.city}
                    </h3>
                    <p className="mt-1.5 text-sm text-ink-500">
                      {presentation.status === 'unverified' || presentation.status === 'service-ended'
                        ? presentation.statusLabel
                        : presentation.flightTime}
                    </p>
                    <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900 transition-colors group-hover:text-terracotta-600">
                      View route guide
                      <ArrowUpRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        strokeWidth={2.25}
                      />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
