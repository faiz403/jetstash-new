import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardList, Search, UserRound } from 'lucide-react';
import { PageHero } from '@/components/sections/page-hero';
import { QuoteRequestForm } from '@/components/sections/quote-request-form';
import { isQuoteTripType, isQuoteRegion } from '@/lib/quote-request-options';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  // Root layout's title template already appends " | JetStash" — no manual suffix here.
  title: 'Request a Travel Quote',
  // Metadata audit (Aug 2026): was 220 characters, listing every trip type
  // (solo, couple, family, group, business, student, Umrah) and every
  // region (7 named) — exactly the kind of exhaustive feature list a
  // search snippet shouldn't carry. The form itself still offers every
  // option unchanged; only this summary is more concise.
  description:
    'Tell JetStash about a trip to Pakistan, India, the Gulf, Turkey, Morocco or beyond — reviewed by a real person, not an automated price.',
  alternates: { canonical: `${siteConfig.url}/quote-request` },
};

const steps = [
  {
    icon: ClipboardList,
    title: 'Tell us the trip',
    body: 'Dates, group size, where you\'re flying from. The form takes a couple of minutes, and rough dates are fine.',
  },
  {
    icon: Search,
    title: 'We look into it properly',
    body: 'We check your actual dates and routes, not a generic price band pulled from a lookup table.',
  },
  {
    icon: UserRound,
    title: 'A person comes back to you',
    body: 'You get the options and the reasoning behind them by email, current at the time we check — no obligation, and no automated follow-up chase. Any booking is completed directly with the airline, hotel or travel provider, never through JetStash.',
  },
];

export default async function QuoteRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ tripType?: string; region?: string }>;
}) {
  const { tripType, region } = await searchParams;
  const initialTripType = isQuoteTripType(tripType) ? tripType : undefined;
  const initialRegion = isQuoteRegion(region) ? region : undefined;

  return (
    <>
      <PageHero
        heroKey="quote-request"
        eyebrow="Reviewed by a real person"
        title="Tell us the trip. We'll look into it properly."
        description="Tell us where you're travelling, who's going and what matters most. A real person looks into the journey and sends back the options and reasoning worth knowing, current at the time we check. Any booking happens directly with the airline, hotel or provider — JetStash doesn't take payment or make it for you."
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
                <p className="mt-1 text-xs leading-relaxed text-ink-300">{step.body}</p>
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
            and no form is required.
          </p>
        </div>
      </section>
    </>
  );
}
