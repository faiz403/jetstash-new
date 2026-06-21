import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { routes, getRouteAirport, getRouteDestination } from '@/data/routes';

export const metadata: Metadata = {
  title: 'All Routes — UK Airports to Pakistan, India & the Gulf',
  description: 'Every flight route covered by JetStash, with booking windows and peak periods specific to each airport-destination pairing.',
};

export default function RoutesIndexPage() {
  return (
    <>
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h1 className="font-display text-4xl text-sand-50 sm:text-5xl">All routes</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-300">
            Each specific airport-to-destination pairing has its own booking pattern. Find yours below.
          </p>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((route) => {
              const airport = getRouteAirport(route);
              const dest = getRouteDestination(route);
              if (!airport || !dest) return null;
              return (
                <Link
                  key={route.slug}
                  href={`/routes/${route.slug}`}
                  className="group flex flex-col rounded-md border border-ink-100 p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={2.25} />
                    {dest.country}
                  </span>
                  <h3 className="mt-2 font-display text-xl text-ink-900">{airport.city} → {dest.city}</h3>
                  <p className="mt-1.5 text-sm text-ink-500">{route.flightTime} · {route.isDirect ? 'Direct' : 'Connecting'}</p>
                  <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                    View route guide <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
