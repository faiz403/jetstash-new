import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Crown, Plane, BadgeCheck, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DealCard } from '@/components/ui/deal-card';
import { NoFareFallback } from '@/components/ui/no-fare-fallback';
import { NewsletterSection } from '@/components/sections/newsletter-section';
import { HeroBackdrop } from '@/components/ui/hero-backdrop';
import { getDealsByCategory, getDealsByDestination } from '@/data/deals';
import { hasCurrentFareSignalForCabinAmongRoutes } from '@/lib/fare-signal';
import { routes, getRouteAirport, getRouteDestination } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getAirlinesBySlugs } from '@/data/airlines';

// Pure ISR, matching the route detail pages — this page renders
// getEffectiveRoutePresentation() and DealCard, both of which must
// regenerate without a deploy once a ledger event's effective date passes.
export const revalidate = 21600;

export const metadata: Metadata = {
  alternates: { canonical: '/business-class' },
  title: 'Business Class from UK Airports',
  description:
    'Business class guidance and hand-checked examples from UK airports, with current route coverage strongest across South Asia and the Gulf.',
};

const cabinChecks = [
  { icon: <Plane className="h-4.5 w-4.5" strokeWidth={2} />, title: 'Seat on every sector', body: 'A Business label does not establish a flat bed. Check the aircraft and seat for every long-haul and connecting sector before paying.' },
  { icon: <BadgeCheck className="h-4.5 w-4.5" strokeWidth={2} />, title: 'Lounge access on this fare', body: 'Access varies by fare, operating airline and airport. Confirm it for the exact ticket and every airport where you plan to use a lounge.' },
  { icon: <Briefcase className="h-4.5 w-4.5" strokeWidth={2} />, title: 'Baggage in the fare rules', body: 'Allowance is fare- and airline-specific. Compare cabin and checked-baggage terms on the exact itinerary rather than assuming a multiple of Economy.' },
];

const liveResultChecks = [
  { title: 'Dates and total price', body: 'Match the live search dates to the dated JetStash observation, then confirm the final total with required fees before paying.' },
  { title: 'Cabin on each flight', body: 'Open the itinerary detail and confirm the cabin, aircraft and seat information separately for every sector.' },
  { title: 'Stops and transfers', body: 'Check the number and length of stops, operating carriers, airport changes and any self-transfer or separate-ticket warning.' },
  { title: 'Baggage and airport access', body: 'Read the exact baggage allowance and lounge-access terms attached to the fare rather than relying on the cabin name alone.' },
];

export default function BusinessClassPage() {
  const nowIso = new Date().toISOString().slice(0, 10);
  const businessDeals = getDealsByCategory('business');
  // Fare fallback truth fix (August 2026): zero curated Business-class Deals
  // must never be presented as zero tracked Business fares — a separate,
  // unrelated fact (data/deals.ts vs data/fare-observations.ts). Cabin-
  // specific, so this uses hasCurrentFareSignalForCabinAmongRoutes rather
  // than the cabin-agnostic hasCurrentFareSignalAmongRoutes used on the
  // airport/destination/region-hub fallbacks. Checked across every route,
  // not just businessCapableRoutes above (which is itself filtered by
  // existing Business Deals — circular for this check).
  const hasCurrentBusinessFareSignal = hasCurrentFareSignalForCabinAmongRoutes(routes.map((r) => r.slug), 'Business', nowIso);
  // Verification-pending leakage fix: this section's own heading asserts
  // "Direct routes" — it must only ever include routes whose directness is
  // currently evidenced as 'direct', never an 'unverified'/pending one that
  // happens to have a business deal attached. Reconciled against the Route
  // Status V1 ledger via getEffectiveRoutePresentation() so a managed
  // corridor whose direct service has ended or is pending reverification
  // never keeps appearing here on the strength of the legacy, inclusive
  // getDisplayDirectness() check alone.
  const businessCapableRoutes = routes.filter((r) => {
    const airport = getRouteAirport(r);
    if (!airport) return false;
    if (getEffectiveRoutePresentation(r, routeStatusEvents, nowIso).status !== 'direct') return false;
    return getDealsByDestination(r.destinationSlug).some(
      (d) => d.cabin === 'Business' && d.fromAirportSlug === r.airportSlug
    );
  });

  return (
    <>
      <section className="relative overflow-hidden bg-ink-900 py-16 sm:py-20">
        <HeroBackdrop heroKey="business-class" />
        <div className="relative mx-auto max-w-content px-5 sm:px-8">
          <div className="stagger-in stagger-1 animate-fade-up">
            <Badge variant="dark">Business Class</Badge>
          </div>
          <h1 className="stagger-in stagger-2 mt-4 max-w-2xl animate-fade-up font-display text-4xl leading-[1.08] tracking-tight text-sand-50 sm:text-5xl">
            Long-haul, done properly
          </h1>
          <p className="stagger-in stagger-3 mt-4 max-w-xl animate-fade-up text-lg leading-relaxed text-ink-300">
            JetStash shows hand-checked Business fare examples where evidence exists. Each observation is dated and
            route-specific, so use it as context and recheck the live itinerary before paying. Our current route
            intelligence is strongest across South Asia and the Gulf.
          </p>
        </div>
      </section>

      {/* Cabin comparison — real hub depth */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <Crown className="h-5 w-5 text-terracotta-600" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Fare-specific checks</span>
          </div>
          <h2 className="mt-2 font-display text-2xl text-ink-900 sm:text-3xl">What to verify before paying for Business class</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {cabinChecks.map((f) => (
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
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Verified-direct routes in this Business fare set</h2>
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            Route-service evidence and fare evidence are separate. These routes are verified as direct and have a
            curated Business card, but the aircraft, seat and current itinerary still need checking before payment.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {businessCapableRoutes.map((route) => {
              const airport = getRouteAirport(route);
              const dest = getRouteDestination(route);
              if (!airport || !dest) return null;
              // Already filtered to 'direct' routes above, but go through the
              // same reusable gate as every other surface regardless — never
              // read route.flightTime or its airlines raw.
              const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
              const factAirlines = getAirlinesBySlugs(presentation.airlineSlugs);
              return (
                <Link
                  key={route.slug}
                  href={`/routes/${route.slug}`}
                  className="group flex flex-col rounded-md border border-ink-100 bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
                >
                  <h3 className="font-display text-xl text-ink-900">{airport.city} → {dest.city}</h3>
                  <p className="mt-1.5 text-sm text-ink-500">
                    {presentation.status === 'unverified' || presentation.status === 'service-ended'
                      ? presentation.statusLabel
                      : factAirlines.length > 0
                        ? `${presentation.flightTime} · ${factAirlines.map((a) => a.name).join(', ')}`
                        : presentation.flightTime}
                  </p>
                  <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                    View route guide <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Example business class fares</h2>
          {businessDeals.length > 0 ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {businessDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          ) : (
            <div className="mt-8">
              <NoFareFallback cityLabel="business class routes" hasFareSignalElsewhere={hasCurrentBusinessFareSignal} />
            </div>
          )}
        </div>
      </section>

      <section className="bg-sand-50 py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">What to compare in a live result</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {liveResultChecks.map((item) => (
              <div key={item.title} className="rounded-md border border-ink-100 bg-white p-6">
                <h3 className="font-display text-lg text-ink-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Travel Club close — business class is an existing Travel Club segment,
          and long-haul premium fares are exactly the "worth an email" moments. */}
      <NewsletterSection />
    </>
  );
}
