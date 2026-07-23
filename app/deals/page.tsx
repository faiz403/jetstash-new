import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/sections/page-hero';
import { DealsExplorer } from '@/components/sections/deals-explorer';
import { deals, formatChecked } from '@/data/deals';
import { fareObservations } from '@/data/fare-observations';
import { siteConfig } from '@/lib/site-config';
import { JsonLd, dealsListSchema } from '@/components/seo/json-ld';

// Pure ISR, matching the route detail pages — this page (via DealsExplorer)
// renders DealCard, which must regenerate without a deploy once fare/route
// facts change.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: 'Tracked Fares: UK to Pakistan, India, the Gulf & Umrah',
  description:
    'Fares from UK airports to Pakistan, India, the Gulf and Umrah, tracked from hand-checked observations logged over time. Never a live price claim.',
  alternates: { canonical: `${siteConfig.url}/deals` },
};

export default function DealsPage() {
  // Derived from data so the hero can never claim a fresher check than actually happened.
  const latestCheck = fareObservations.reduce(
    (max, o) => (o.observedDate > max ? o.observedDate : max),
    fareObservations[0].observedDate
  );
  const airportCount = new Set(deals.map((d) => d.fromAirportSlug)).size;

  return (
    <>
      <JsonLd data={dealsListSchema(deals)} />
      <PageHero
        heroKey="deals"
        eyebrow="Tracked fares"
        title="Fares we're tracking"
        description={
          <>
            Every fare shown below is a real check a member of our team logged by hand, dated. Where we've
            checked a route more than once, you'll see the range we've actually observed — never a single
            price left to quietly go stale. Always confirm the final price before booking.{' '}
            <Link href="/about" className="font-medium text-brass-300 underline underline-offset-2 hover:text-brass-200">
              Read our standards
            </Link>
            .
          </>
        }
        stats={[
          { value: String(fareObservations.length), label: 'Fare checks logged' },
          { value: String(airportCount), label: 'UK airports' },
          { value: formatChecked(latestCheck), label: 'Most recent check' },
        ]}
      />

      <DealsExplorer />
    </>
  );
}
