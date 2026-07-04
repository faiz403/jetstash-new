import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardList, Search, UserRound } from 'lucide-react';
import { PageHero } from '@/components/sections/page-hero';
import { QuoteRequestForm } from '@/components/sections/quote-request-form';
import { isQuoteTripType, isQuoteRegion } from '@/lib/quote-request-options';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Request a Quote — Umrah, Family & Group Travel',
  description:
    'Request a real quote for an Umrah package, family trip or group booking to Pakistan, India, Bangladesh, the Gulf, Turkey, Morocco or Southern Europe — followed up by a person, not an automated price.',
  alternates: { canonical: `${siteConfig.url}/quote-request` },
};

const steps = [
  {
    icon: ClipboardList,
    title: 'Tell us the trip',
    body: 'Dates, group size, where you\'re flying from — the form takes a couple of minutes. Rough dates are fine.',
  },
  {
    icon: Search,
    title: 'We research it properly',
    body: 'Real availability on your actual dates — not a generic price band pulled from a lookup table.',
  },
  {
    icon: UserRound,
    title: 'A person comes back to you',
    body: 'You get a real quote by email, with the reasoning behind it. No obligation, and no automated follow-up chase.',
  },
];

export default function QuoteRequestPage({
  searchParams,
}: {
  searchParams: { tripType?: string; region?: string };
}) {
  const initialTripType = isQuoteTripType(searchParams.tripType) ? searchParams.tripType : undefined;
  const initialRegion = isQuoteRegion(searchParams.region) ? searchParams.region : undefined;

  return (
    <>
      <PageHero
        eyebrow="Real quotes, from a person"
        title="Tell us the trip. We'll price it properly."
        description="For Umrah packages, family trips and group travel — Pakistan, India, Bangladesh, the Gulf, Turkey, Morocco and Southern Europe. A real person follows up with real pricing, not an instant automated number."
      />

      <section className="border-b border-white/5 bg-ink-950 py-10">
        <div className="mx-auto grid max-w-content gap-8 px-5 sm:grid-cols-3 sm:px-8">
          {steps.map((step, i) => (
            <div key={step.title} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-white/[0.06] text-brass-300">
                <step.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-sand-50">
                  <span className="mr-1.5 font-display text-brass-300">{i + 1}.</span>
                  {step.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-400">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-xl px-5 sm:px-8">
          <QuoteRequestForm initialTripType={initialTripType} initialRegion={initialRegion} />
          <p className="mt-8 text-center text-sm text-ink-400">
            Just exploring for now?{' '}
            <Link href="/routes" className="font-medium text-ink-700 underline underline-offset-2 hover:text-brass-600">
              Browse the route guides
            </Link>{' '}
            — no form required.
          </p>
        </div>
      </section>
    </>
  );
}
