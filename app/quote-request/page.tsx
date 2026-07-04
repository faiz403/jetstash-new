import type { Metadata } from 'next';
import { QuoteRequestForm } from '@/components/sections/quote-request-form';
import { isQuoteTripType, isQuoteRegion } from '@/lib/quote-request-options';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Request a Quote — Umrah, Family & Group Travel',
  description:
    'Request a real quote for an Umrah package, family trip or group booking to Pakistan, India, Bangladesh, the Gulf, Turkey, Morocco or Southern Europe — followed up by a person, not an automated price.',
  alternates: { canonical: `${siteConfig.url}/quote-request` },
};

export default function QuoteRequestPage({
  searchParams,
}: {
  searchParams: { tripType?: string; region?: string };
}) {
  const initialTripType = isQuoteTripType(searchParams.tripType) ? searchParams.tripType : undefined;
  const initialRegion = isQuoteRegion(searchParams.region) ? searchParams.region : undefined;

  return (
    <>
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h1 className="font-display text-4xl text-sand-50 sm:text-5xl">Request a quote</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-300">
            For Umrah packages, family trips and group travel — Pakistan, India, Bangladesh, the Gulf, Turkey,
            Morocco and Southern Europe. Tell us what you need and a real person follows up with real pricing,
            not an instant automated number.
          </p>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-xl px-5 sm:px-8">
          <QuoteRequestForm initialTripType={initialTripType} initialRegion={initialRegion} />
        </div>
      </section>
    </>
  );
}
