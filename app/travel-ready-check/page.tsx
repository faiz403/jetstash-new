import type { Metadata } from 'next';
import { PageHero } from '@/components/sections/page-hero';
import { TravelReadyCheck } from '@/components/travel-ready/travel-ready-check';
import { TRAVEL_READY_SUPPORTED_COUNTRIES } from '@/lib/travel-ready-check';
import { destinations, getDestinationBySlug } from '@/data/destinations';

export const metadata: Metadata = {
  alternates: { canonical: '/travel-ready-check' },
  title: 'Travel Ready Check — JetStash',
  description:
    'Check passport validity and visa guidance for your specific trip to Pakistan, India, Saudi Arabia, UAE, Qatar, Turkey or Morocco, sourced from official government pages.',
};

// Derived from the data, never hand-typed — this is what stopped "7 destinations" (the country
// count) from silently standing in for the real destination count across those 7 countries.
const supportedDestinationCount = destinations.filter((d) => TRAVEL_READY_SUPPORTED_COUNTRIES.includes(d.country)).length;

export default async function TravelReadyCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ destination?: string }>;
}) {
  const { destination } = await searchParams;
  // Only trust the query param when it resolves to a destination this feature actually supports —
  // an unsupported or garbage slug falls back to no prefill rather than silently seeding state
  // with a value the form's own <select> has no matching option for.
  const requestedDestination = destination ? getDestinationBySlug(destination) : undefined;
  const defaultDestinationSlug =
    requestedDestination && TRAVEL_READY_SUPPORTED_COUNTRIES.includes(requestedDestination.country)
      ? requestedDestination.slug
      : undefined;

  return (
    <>
      <PageHero
        heroKey="travel-ready-check"
        eyebrow="Travel Ready Check"
        title="Ready to travel, not just ready to book"
        description={`A private readiness check before you spend money — passport validity, visa guidance and next steps for ${supportedDestinationCount} destinations across ${TRAVEL_READY_SUPPORTED_COUNTRIES.length} countries, sourced from official government pages, not a blog.`}
      />
      <section className="bg-sand-50 py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="mx-auto max-w-2xl">
            <TravelReadyCheck defaultDestinationSlug={defaultDestinationSlug} />
          </div>
        </div>
      </section>
    </>
  );
}
