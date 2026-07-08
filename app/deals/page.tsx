import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/sections/page-hero';
import { DealsExplorer } from '@/components/sections/deals-explorer';
import { deals, formatChecked } from '@/data/deals';
import { fareObservations } from '@/data/fare-observations';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Tracked Fares: UK to Pakistan, India, the Gulf & Umrah',
  description:
    'Example fares from UK airports to Pakistan, India, the Gulf and Umrah, each checked by hand on a stated date. Never a live price claim.',
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
      <PageHero
        heroKey="deals"
        eyebrow="Tracked fares"
        title="Fares we're tracking"
        description={
          <>
            Every fare below is an example a member of our team checked by hand on the date shown. Never a
            live price, never an automated feed. Always confirm the final price before booking.{' '}
            <Link href="/about" className="font-medium text-brass-300 underline underline-offset-2 hover:text-brass-200">
              Read our standards
            </Link>
            .
          </>
        }
        stats={[
          { value: String(deals.length), label: 'Tracked fares' },
          { value: String(airportCount), label: 'UK airports' },
          { value: formatChecked(latestCheck), label: 'Most recent check' },
        ]}
      />

      <DealsExplorer />
    </>
  );
}
