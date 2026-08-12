import { SearchX, ArrowUpRight } from 'lucide-react';
import { getTripComFlightHandoffUrl, PROVIDER_REL } from '@/lib/booking-providers';
import { TrackedOutboundLink } from './tracked-outbound-link';

/**
 * Shown wherever a destination/route/cabin combination has no fare
 * observations logged yet. Deliberately avoids implying that fares exist
 * elsewhere and are just hidden.
 *
 * `routeSlug` is only ever passed from a single-route context (the route
 * guide page) — every other call site (region hubs, destination pages,
 * airport pages) spans more than one possible route, so there is no single
 * Trip.com link that honestly represents "this page." Per JetStash's
 * fail-closed booking rule, those contexts get no provider CTA at all
 * rather than a generic Trip.com link — see lib/booking-providers.ts.
 */
export function NoFareFallback({ cityLabel, routeSlug }: { cityLabel: string; routeSlug?: string }) {
  const tripComUrl = routeSlug ? getTripComFlightHandoffUrl(routeSlug) : null;
  return (
    <div className="flex flex-col items-center rounded-md border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 text-ink-400">
        <SearchX className="h-5 w-5" strokeWidth={2} />
      </div>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-600">
        We haven't logged a tracked fare for {cityLabel} yet.
        {tripComUrl ? ' Compare flights on Trip.com to see current options.' : ''}
      </p>
      {tripComUrl ? (
        <>
          <TrackedOutboundLink
            event="tripcom_click"
            properties={{ route: routeSlug!, source: 'no-fare-fallback' }}
            href={tripComUrl}
            target="_blank"
            rel={PROVIDER_REL}
            className="mt-5 inline-flex items-center gap-1.5 rounded-sm bg-ink-900 px-5 py-3 text-sm font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985]"
          >
            Compare flights on Trip.com
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
          </TrackedOutboundLink>
          <p className="mt-3 text-xs text-ink-400">
            Partner link, opens Trip.com in a new tab. Check the itinerary, baggage allowance and booking terms
            before paying.
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs text-ink-400">Direct flight comparison is not available for this airport yet.</p>
      )}
    </div>
  );
}
