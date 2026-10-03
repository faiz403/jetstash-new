'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';

/**
 * Consumer clarity pass (3 Oct 2026). The airport page's destination list: the first thing a
 * visitor wants from an airport page is "where can I go from here?", so the route cards now
 * lead the page. Each card shows the exact route, its verified status, the fare summary
 * (or an honest "No fare logged yet"), and one action. The long flight-time prose that used to
 * sit in every card moved behind "Details".
 *
 * Client component only for the country filter. The server renders every route in the initial
 * HTML (filter = All), so nothing is hidden from crawlers or from visitors without JavaScript,
 * and the fare summary arrives as an already-rendered node so no fare data is bundled here.
 */
export interface AirportRouteItem {
  slug: string;
  country: string;
  /** Exact origin -> destination, e.g. "London Heathrow → Delhi". */
  title: string;
  /** The canonical Route Status label (Direct, Connecting, Verification pending, Direct service ended). */
  statusLabel: string;
  /** Flight-time / timing prose, shown only under "Details". */
  detail: string | null;
  /** The RouteCardFare summary, or null when JetStash has no publishable fare for the route. */
  fare: ReactNode | null;
}

export function AirportRouteGrid({ items }: { items: AirportRouteItem[] }) {
  const countries = [...new Set(items.map((item) => item.country))];
  const [country, setCountry] = useState<string>('All');
  const shown = country === 'All' ? items : items.filter((item) => item.country === country);

  return (
    <>
      {countries.length > 2 && (
        <div role="group" aria-label="Filter routes by country" className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {['All', ...countries].map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={country === name}
              onClick={() => setCountry(name)}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
                country === name
                  ? 'border-ink-900 bg-ink-900 text-sand-50'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {shown.length} {shown.length === 1 ? 'route' : 'routes'} shown
      </p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item) => (
          <article key={item.slug} className="flex flex-col rounded-md border border-ink-100 bg-white p-5 shadow-card">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
              <MapPin className="h-3.5 w-3.5" strokeWidth={2.25} />
              {item.country}
            </span>
            <h3 className="mt-2 font-display text-xl text-ink-900">
              <Link href={`/routes/${item.slug}`} className="hover:underline">
                {item.title}
              </Link>
            </h3>
            <p className="mt-1.5">
              <span className="inline-block rounded-full border border-ink-200 px-2.5 py-0.5 text-xs font-medium text-ink-700">{item.statusLabel}</span>
            </p>
            <div className="mt-4 flex-1">{item.fare ?? <p className="text-sm text-ink-600">No fare logged yet</p>}</div>
            <Link
              href={`/routes/${item.slug}`}
              className="group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900"
            >
              View route guide
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2.25} />
            </Link>
            {item.detail && (
              <details className="mt-3 text-xs text-ink-500">
                <summary className="cursor-pointer font-medium text-ink-600">Details</summary>
                <p className="mt-1.5 leading-relaxed">{item.detail}</p>
              </details>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
