import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, MapPin, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DealCard } from '@/components/ui/deal-card';
import { NoFareFallback } from '@/components/ui/no-fare-fallback';
import { LinkButton } from '@/components/ui/button';
import { destinations } from '@/data/destinations';
import { getDealsByCategory } from '@/data/deals';
import { DestinationMark } from '@/components/ui/destination-mark';

export const metadata: Metadata = {
  alternates: { canonical: '/family-holidays' },
  title: 'Family Holidays — All-Inclusive & Long-Haul Trips from the UK',
  description:
    'Family holiday guidance for UK travellers, covering all-inclusive resorts in Turkey and the Mediterranean alongside long-haul family trips to the Gulf and South Asia.',
};

export default function FamilyHolidaysPage() {
  const familyDestinations = destinations.filter((d) =>
    ['antalya', 'faro', 'barcelona', 'dubai'].includes(d.slug)
  );
  const packageDeals = getDealsByCategory('package');

  return (
    <>
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <Badge variant="dark">Family Holidays</Badge>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] text-sand-50 sm:text-5xl">
            Holidays that work with children, not despite them
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-300">
            All-inclusive resorts that earn the description, long-haul routes worth the flight time, and the
            practical detail that actually matters when you're travelling with a family.
          </p>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Family-suited destinations</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {familyDestinations.map((dest) => (
              <Link
                key={dest.slug}
                href={`/destinations/${dest.slug}`}
                className="group flex flex-col overflow-hidden rounded-md border border-ink-100 bg-white shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="relative h-32 w-full overflow-hidden">
                  <DestinationMark seed={`${dest.city}, ${dest.country}`} />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={2.25} />
                    {dest.country}
                  </span>
                  <h3 className="mt-2 font-display text-2xl text-ink-900">{dest.city}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{dest.tagline}</p>
                  <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                    View guide <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brass-50 py-10 sm:py-12">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="flex flex-col gap-4 rounded-md border border-brass/30 bg-white p-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-brass-50 text-brass-700">
                <FileText className="h-4.5 w-4.5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="font-display text-xl text-ink-900">Planning a family or group trip?</h2>
                <p className="mt-1 text-sm text-ink-500">Tell us where and when — a person follows up with real pricing for your group size.</p>
              </div>
            </div>
            <LinkButton href="/quote-request?tripType=family-trip" size="md" className="shrink-0">
              Request a quote
            </LinkButton>
          </div>
        </div>
      </section>

      <section className="bg-sand-50 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Example family package fares</h2>
          {packageDeals.length > 0 ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {packageDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          ) : (
            <div className="mt-8">
              <NoFareFallback cityLabel="family package holidays" />
            </div>
          )}
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">What actually matters with kids</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Flight time vs. time zone shift',
                body: 'A 4-hour flight to Turkey with no time difference is often easier on young children than a shorter flight that disrupts sleep schedules across time zones.',
              },
              {
                title: 'All-inclusive means different things',
                body: 'Confirm exactly what is and isn\'t included — some "all-inclusive" resorts charge separately for water sports, kids\' clubs, or à la carte restaurants.',
              },
              {
                title: 'Direct flights save more than money',
                body: 'For families, the value of a direct flight over a connection often outweighs a modest price difference — fewer transition points means fewer opportunities for things to go wrong.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-md border border-ink-100 bg-sand-50 p-6">
                <h3 className="font-display text-lg text-ink-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
