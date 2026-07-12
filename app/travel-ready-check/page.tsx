import type { Metadata } from 'next';
import { PageHero } from '@/components/sections/page-hero';
import { TravelReadyCheck } from '@/components/travel-ready/travel-ready-check';
import { TRAVEL_READY_SUPPORTED_COUNTRIES } from '@/lib/travel-ready-check';

export const metadata: Metadata = {
  alternates: { canonical: '/travel-ready-check' },
  title: 'Travel Ready Check — JetStash',
  description:
    'Check passport validity and visa guidance for your specific trip to Pakistan, India, Saudi Arabia, UAE, Qatar, Turkey or Morocco, sourced from official government pages.',
};

export default function TravelReadyCheckPage({
  searchParams,
}: {
  searchParams: { destination?: string };
}) {
  return (
    <>
      <PageHero
        heroKey="travel-ready-check"
        eyebrow="Travel Ready Check"
        title="Ready to travel, not just ready to book"
        description={`A private readiness check before you spend money — passport validity, visa guidance and next steps for ${TRAVEL_READY_SUPPORTED_COUNTRIES.length} destinations, sourced from official government pages, not a blog.`}
      />
      <section className="bg-sand-50 py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="mx-auto max-w-2xl">
            <TravelReadyCheck defaultDestinationSlug={searchParams.destination} />
          </div>
        </div>
      </section>
    </>
  );
}
