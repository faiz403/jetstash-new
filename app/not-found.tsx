import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { LinkButton } from '@/components/ui/button';
import { routes, getRouteAirport, getRouteDestination } from '@/data/routes';

// Same representative spread the homepage features — one route per major region.
const suggestedRouteSlugs = ['manchester-lahore', 'birmingham-amritsar', 'manchester-dubai', 'london-heathrow-jeddah'];

export default function NotFound() {
  const suggestions = suggestedRouteSlugs
    .map((slug) => routes.find((r) => r.slug === slug))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <section className="flex min-h-[60vh] items-center bg-white py-20">
      <div className="mx-auto max-w-content px-5 text-center sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-terracotta-600">404</p>
        <h1 className="mt-3 font-display text-4xl text-ink-900">That page isn&apos;t here</h1>
        <p className="mx-auto mt-3 max-w-md text-ink-500">
          The page you&apos;re looking for may have moved. Try one of these instead.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <LinkButton href="/" variant="dark">Go home</LinkButton>
          <LinkButton href="/deals" variant="outline" className="border-ink-200 text-ink-900 hover:bg-ink-50">
            See current fares
          </LinkButton>
        </div>

        <div className="mx-auto mt-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Popular route guides</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {suggestions.map((route) => {
              const airport = getRouteAirport(route);
              const dest = getRouteDestination(route);
              if (!airport || !dest) return null;
              return (
                <Link
                  key={route.slug}
                  href={`/routes/${route.slug}`}
                  className="group flex items-center justify-between rounded-sm border border-ink-100 px-4 py-3 text-left transition-colors hover:border-brass/40 hover:bg-sand-50"
                >
                  <span className="text-sm font-medium text-ink-700">
                    {airport.city} → {dest.city}
                  </span>
                  <ArrowUpRight
                    className="h-4 w-4 text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    strokeWidth={2.25}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
