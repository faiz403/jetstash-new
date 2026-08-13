import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/sections/page-hero';
import { DealsExplorer } from '@/components/sections/deals-explorer';
import { deals, formatChecked } from '@/data/deals';
import { fareObservations, getPublishableObservationsByRoute } from '@/data/fare-observations';
import { routes } from '@/data/routes';
import { siteConfig } from '@/lib/site-config';
import { JsonLd, dealsListSchema } from '@/components/seo/json-ld';

// Pure ISR, matching the route detail pages — this page (via DealsExplorer)
// renders DealCard, which must regenerate without a deploy once fare/route
// facts change.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: 'Tracked Fares from UK Airports',
  description:
    'Hand-checked fare observations across JetStash’s current international route coverage, with deepest coverage in South Asia and the Gulf. Never a live price claim.',
  alternates: { canonical: `${siteConfig.url}/deals` },
};

export default function DealsPage() {
  // Derived from data so the hero can never claim a fresher check than actually happened.
  const latestCheck = fareObservations.reduce(
    (max, o) => (o.observedDate > max ? o.observedDate : max),
    fareObservations[0].observedDate
  );
  const airportCount = new Set(deals.map((d) => d.fromAirportSlug)).size;
  // Route Coverage Truth (August 2026): the real denominator, computed live
  // from the same data every route page reads — never a hand-typed number
  // that could silently drift from what's actually tracked. This is what
  // stops "Fares we're tracking" from implying broader coverage than
  // exists: a visitor sees the actual scope (N of 88), not just a raw count
  // of checks logged, which says nothing about how many routes that spans.
  // The hero count is route-level Fare Signal coverage. DealsExplorer below
  // intentionally remains a curated card catalogue, so its card count is not
  // expected to equal this route-level total.
  const nowIsoForCoverage = new Date().toISOString().slice(0, 10);
  const routesWithTrackedFare = routes.filter((r) => getPublishableObservationsByRoute(r.slug, nowIsoForCoverage).length > 0).length;

  return (
    <>
      <JsonLd data={dealsListSchema(deals)} />
      <PageHero
        heroKey="deals"
        eyebrow="Tracked fares"
        title="Fares we're tracking"
        description={
          <>
            We're currently tracking fares on {routesWithTrackedFare} of our {routes.length} routes — coverage is
            being expanded gradually using manually verified observations, not a live price feed. Every fare shown
            below is a real check logged by hand, dated. Where we've checked a route more than
            once, you'll see the range we've actually observed — never a single price left to quietly go stale.
            The cards below are a curated selection of routes and categories, so a route can have a tracked Fare
            Signal even when it is not listed as a Deal card here. Always confirm the final price before booking.{' '}
            <Link href="/about" className="font-medium text-brass-300 underline underline-offset-2 hover:text-brass-200">
              Read our standards
            </Link>
            .
          </>
        }
        stats={[
          { value: `${routesWithTrackedFare} of ${routes.length}`, label: 'Routes with tracked Fare Signals' },
          { value: String(fareObservations.length), label: 'Fare checks logged' },
          { value: String(airportCount), label: 'UK airports' },
          { value: formatChecked(latestCheck), label: 'Most recent check' },
        ]}
      />

      <DealsExplorer />
    </>
  );
}
