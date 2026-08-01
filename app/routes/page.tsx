import type { Metadata } from 'next';
import { PageHero } from '@/components/sections/page-hero';
import { RoutesCatalogue } from '@/components/routes/routes-catalogue';
import { routes } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { buildRouteCountryGroups } from '@/lib/route-country-groups';
import { airports } from '@/data/airports';

// Pure ISR, matching the route detail pages — every card here renders
// getEffectiveRoutePresentation(), which must regenerate without a deploy
// once a ledger event's effective date passes.
export const revalidate = 21600;

export const metadata: Metadata = {
  alternates: { canonical: '/routes' },
  title: 'Route Guides from UK Airports',
  // Metadata audit (Aug 2026): trimmed from 175 characters.
  description:
    'Airport-to-destination route guides with service status, booking timing and honest direct-or-connecting guidance. Deepest coverage: South Asia and the Gulf.',
};

export default function RoutesIndexPage() {
  const todayIso = new Date().toISOString().slice(0, 10);

  // Routes-usability fix: grouped by Destination.country instead of the
  // broader RegionGroup this page used to render directly — "the Gulf"
  // region alone spans three separate countries (UAE, Qatar, Saudi Arabia),
  // exactly the too-coarse grouping a visitor previously had to scroll
  // through. See lib/route-country-groups.ts for the grouping/ordering rules.
  const countryGroups = buildRouteCountryGroups(routes, todayIso, routeStatusEvents);

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

      <RoutesCatalogue countryGroups={countryGroups} />
    </>
  );
}
