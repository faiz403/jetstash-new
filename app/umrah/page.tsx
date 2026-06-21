import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DealCard } from '@/components/ui/deal-card';
import { NoFareFallback } from '@/components/ui/no-fare-fallback';
import { LinkButton } from '@/components/ui/button';
import { getDestinationsByRegion } from '@/data/destinations';
import { getDealsByCategory } from '@/data/deals';
import { placeholderUrl } from '@/lib/images';

export const metadata: Metadata = {
  title: 'Umrah & Saudi Arabia — Packages from the UK',
  description:
    'Umrah package guidance for UK travellers, covering Jeddah and Madinah, visa requirements, and how to compare flight-plus-hotel packages.',
};

export default function UmrahHubPage() {
  const destinations = getDestinationsByRegion('gulf').filter((d) => d.country === 'Saudi Arabia');
  const umrahDeals = getDealsByCategory('umrah');

  return (
    <>
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <Badge variant="dark">Umrah & Saudi Arabia</Badge>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] text-sand-50 sm:text-5xl">
            Umrah packages, compared properly
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-300">
            Most Umrah packages bundle flights, hotels in Makkah and Madinah, and ground transport into a single
            price. We help you understand what's actually included before you compare numbers.
          </p>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">What's typically included</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Flights', body: 'Return economy flights, usually to Jeddah or Madinah, occasionally with a connection via the Gulf.' },
              { title: 'Hotel nights', body: 'A split stay — typically a portion of nights in Makkah near the Haram, then Madinah, though ratios vary by package.' },
              { title: 'Ground transport', body: 'Transfers between airport, hotels and the two holy cities — confirm whether this is shared or private transport.' },
              { title: 'Ziyarat tours', body: 'Optional guided visits to historical sites in Makkah and Madinah — sometimes included, often an add-on.' },
            ].map((item) => (
              <div key={item.title} className="rounded-md border border-ink-100 bg-sand-50 p-6">
                <h3 className="font-display text-lg text-ink-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-sand-50 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Destinations</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {destinations.map((dest) => (
              <Link
                key={dest.slug}
                href={`/destinations/${dest.slug}`}
                className="group flex flex-col overflow-hidden rounded-md border border-ink-100 bg-white shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="relative h-40 w-full overflow-hidden">
                  <Image
                    src={placeholderUrl(`${dest.city}, Saudi Arabia`)}
                    alt={`${dest.city}, Saudi Arabia`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Saudi Arabia
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

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Example package fares</h2>
          {umrahDeals.length > 0 ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {umrahDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          ) : (
            <div className="mt-8">
              <NoFareFallback cityLabel="Umrah packages" />
            </div>
          )}
        </div>
      </section>

      <section className="bg-sand-50 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl text-ink-900">Before you book</h2>
              <div className="mt-6 flex flex-col gap-6">
                <div className="border-l-2 border-brass pl-4">
                  <h3 className="font-semibold text-ink-900">Ramadan is the highest-demand period</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-500">
                    Package prices rise significantly during Ramadan and the weeks immediately before Hajj season.
                    Booking 3–4 months ahead is common practice for these windows.
                  </p>
                </div>
                <div className="border-l-2 border-brass pl-4">
                  <h3 className="font-semibold text-ink-900">Check which Makkah hotel zone is included</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-500">
                    Hotels within walking distance of the Haram cost considerably more than those requiring a
                    shuttle. Package prices can look similar while offering very different proximity — always
                    confirm the hotel name and distance, not just the star rating.
                  </p>
                </div>
                <div className="border-l-2 border-brass pl-4">
                  <h3 className="font-semibold text-ink-900">Use an ATOL-protected operator</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-500">
                    For flight-inclusive packages booked with a UK travel provider, confirm ATOL protection before
                    paying. This protects your money if the operator fails financially.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-md border border-ink-100 bg-white p-7">
              <h3 className="font-display text-xl text-ink-900">Visa requirements</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">
                An Umrah visa is required and is typically arranged through an authorised Umrah travel provider, or
                directly via the Saudi government's Nusuk platform. It is separate from a standard tourist visa and
                is tied to your Umrah package dates.
              </p>
              <p className="mt-4 text-xs text-ink-400">
                Requirements change — always confirm directly with your Umrah provider or the Saudi authorities
                before booking.
              </p>
              <LinkButton href="/contact" variant="ghost" size="sm" className="mt-5">
                Ask us a question
              </LinkButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
