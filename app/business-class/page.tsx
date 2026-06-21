import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Crown, Bed, UtensilsCrossed, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DealCard } from '@/components/ui/deal-card';
import { getDealsByCategory } from '@/data/deals';
import { routes, getRouteAirport, getRouteDestination } from '@/data/routes';

export const metadata: Metadata = {
  title: 'Business Class Deals — Gulf & South Asia Routes from the UK',
  description:
    'Business class flight fares from UK airports to Dubai, Doha, Delhi, Lahore and beyond, checked regularly and shown with the date last verified.',
};

const cabinFeatures = [
  { icon: <Bed className="h-4.5 w-4.5" strokeWidth={2} />, title: 'Flat-bed seating', body: 'Most South Asia and Gulf business cabins on this route set now offer fully flat beds on long-haul sectors — a genuine difference on an 8+ hour flight, not a marginal upgrade.' },
  { icon: <UtensilsCrossed className="h-4.5 w-4.5" strokeWidth={2} />, title: 'Lounge access both ends', body: 'Business class tickets typically include lounge access at both the UK departure airport and the arrival hub — worth factoring into long layovers via Dubai or Doha.' },
  { icon: <Briefcase className="h-4.5 w-4.5" strokeWidth={2} />, title: 'Higher baggage allowance', body: 'Business class allowances are usually 2–3x the economy limit — relevant for family-visit travel where return luggage often exceeds standard limits.' },
];

const decisionPoints = [
  { title: 'Booking window matters less than economy', body: 'Business fares are less sensitive to the typical "book 6 weeks ahead" rule. Airline sales and seasonal corporate demand often matter more than how far ahead you book.' },
  { title: 'Stopover routings can undercut direct fares', body: 'A one-stop business fare via the Gulf sometimes prices well below a direct service in the same cabin — worth comparing both, especially on Pakistan and India routes.' },
  { title: 'Mixed-cabin bookings exist', body: 'Some fare combinations allow economy on one leg and business on a long-haul connecting flight, which can reduce the total cost compared with all-business itineraries.' },
  { title: 'Worth it most on 7+ hour direct sectors', body: 'The case for business class is strongest on long, single-sector flights — Manchester–Dubai, Heathrow–Delhi. On routes with a short connecting hop, the economy-plus option on the long leg sometimes delivers similar comfort for less.' },
];

export default function BusinessClassPage() {
  const businessDeals = getDealsByCategory('business');
  const businessCapableRoutes = routes.filter((r) => r.isDirect);

  return (
    <>
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <Badge variant="dark">Business Class</Badge>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] text-sand-50 sm:text-5xl">
            Long-haul, done properly
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-300">
            Business class fares to the Gulf, Pakistan and India move on different patterns to economy — fuel
            surcharges, seasonal corporate demand, and airline-specific sales all shift the picture. We track the
            routes that UK travellers actually book.
          </p>
        </div>
      </section>

      {/* Cabin comparison — real hub depth */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <Crown className="h-5 w-5 text-terracotta-600" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">What you're actually paying for</span>
          </div>
          <h2 className="mt-2 font-display text-2xl text-ink-900 sm:text-3xl">What separates business from premium economy here</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {cabinFeatures.map((f) => (
              <div key={f.title} className="rounded-md border border-ink-100 bg-sand-50 p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-terracotta-50 text-terracotta-600">{f.icon}</div>
                <h3 className="mt-4 font-display text-lg text-ink-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Route coverage — links into route hubs */}
      <section className="bg-sand-50 py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Routes with strong direct business class coverage</h2>
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            Direct sectors are where business class makes the strongest case — no cabin change at a connection, no risk of an aircraft swap downgrading the seat.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {businessCapableRoutes.map((route) => {
              const airport = getRouteAirport(route);
              const dest = getRouteDestination(route);
              if (!airport || !dest) return null;
              return (
                <Link
                  key={route.slug}
                  href={`/routes/${route.slug}`}
                  className="group flex flex-col rounded-md border border-ink-100 bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
                >
                  <h3 className="font-display text-xl text-ink-900">{airport.city} → {dest.city}</h3>
                  <p className="mt-1.5 text-sm text-ink-500">{route.flightTime} direct · {route.airlines.join(', ')}</p>
                  <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                    View route guide <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {businessDeals.length > 0 && (
        <section className="bg-white py-14 sm:py-16">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Current business class fares</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {businessDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-sand-50 py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">What moves the price — and when it's worth it</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {decisionPoints.map((item) => (
              <div key={item.title} className="rounded-md border border-ink-100 bg-white p-6">
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
