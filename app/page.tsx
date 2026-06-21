import { ArrowUpRight, ShieldCheck, Users, Crown, BadgeCheck } from 'lucide-react';
import Link from 'next/link';
import { RouteMapHero } from '@/components/sections/route-map-hero';
import { HubCard } from '@/components/ui/hub-card';
import { DealCard } from '@/components/ui/deal-card';
import { NewsletterSection } from '@/components/sections/newsletter-section';
import { LinkButton } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { deals, getDealsByCategory } from '@/data/deals';
import { routes, getRouteAirport, getRouteDestination } from '@/data/routes';
import { placeholderUrl } from '@/lib/images';

export default function HomePage() {
  const featuredFlights = deals.filter((d) => d.category === 'flight').slice(0, 3);
  const businessDeals = getDealsByCategory('business').slice(0, 2);
  const umrahDeals = getDealsByCategory('umrah').slice(0, 1);
  // Deliberately representative spread across the network, not an accident of array order —
  // one Pakistan, one India, one Gulf, one Umrah route, each from a different UK airport.
  const featuredRouteSlugs = ['manchester-lahore', 'birmingham-amritsar', 'manchester-dubai', 'london-heathrow-jeddah'];
  const popularRoutes = featuredRouteSlugs
    .map((slug) => routes.find((r) => r.slug === slug))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <>
      {/* ───────────────────────── HERO ───────────────────────── */}
      <section className="relative overflow-hidden bg-ink-900 pb-16 pt-12 sm:pb-24 sm:pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(200,147,46,0.12),transparent_60%)]" />
        <div className="relative mx-auto max-w-content px-5 sm:px-8">
          <div className="max-w-2xl">
            <Badge variant="dark">The UK's South Asia, Gulf & Umrah travel platform</Badge>
            <h1 className="mt-5 font-display text-[2.5rem] leading-[1.05] tracking-tight text-sand-50 sm:text-6xl">
              Built for the routes other sites treat as an afterthought.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-300">
              JetStash tracks flights and holidays from UK airports to Pakistan, India, the Gulf and Saudi Arabia —
              with dedicated route guides, family-visit logistics, Umrah packages and business class coverage.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <LinkButton href="/deals" size="lg">
                See today's fares
              </LinkButton>
              <LinkButton href="/routes" variant="outline" size="lg">
                Find your route
              </LinkButton>
            </div>
          </div>

          <div className="mt-14">
            <RouteMapHero />
          </div>
        </div>
      </section>

      {/* ───────────────────────── REGION HUBS ───────────────────────── */}
      <section className="bg-sand-50 py-16 sm:py-24">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Where we specialise</span>
          <h2 className="mt-2 font-display text-3xl text-ink-900 sm:text-4xl">Four hubs, built for how you actually travel</h2>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <HubCard
              href="/pakistan"
              eyebrow="Family visits & heritage"
              title="Pakistan"
              description="Lahore, Islamabad and Karachi — direct routes, Eid travel timing, NICOP guidance and what to know before you fly."
              image={placeholderUrl('Lahore, Pakistan')}
            />
            <HubCard
              href="/india"
              eyebrow="Family visits & heritage"
              title="India"
              description="Delhi, Mumbai and Amritsar — OCI guidance, festival season pricing, and the routes that hold value."
              image={placeholderUrl('Delhi, India')}
            />
            <HubCard
              href="/gulf"
              eyebrow="Stopovers & city breaks"
              title="The Gulf"
              description="Dubai and Doha — year-round flights, family-friendly stopovers, and beach-meets-city breaks."
              image={placeholderUrl('Dubai, UAE')}
            />
            <HubCard
              href="/umrah"
              eyebrow="Pilgrimage travel"
              title="Umrah & Saudi Arabia"
              description="Jeddah and Madinah — package structures, Nusuk visa guidance, and what genuinely affects price."
              image={placeholderUrl('Jeddah, Saudi Arabia')}
            />
          </div>
        </div>
      </section>

      {/* ───────────────────────── POPULAR ROUTES — conversion-focused, specific intent ───────────────────────── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Find your exact route</span>
              <h2 className="mt-2 font-display text-3xl text-ink-900 sm:text-4xl">Most-searched UK routes</h2>
              <p className="mt-2 max-w-lg text-sm text-ink-500">
                Each route has its own booking-window guide and peak-period warnings — not a generic destination page.
              </p>
            </div>
            <Link href="/routes" className="flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-terracotta-600">
              All routes <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {popularRoutes.map((route) => {
              const airport = getRouteAirport(route);
              const dest = getRouteDestination(route);
              if (!airport || !dest) return null;
              return (
                <Link
                  key={route.slug}
                  href={`/routes/${route.slug}`}
                  className="group flex flex-col rounded-md border border-ink-100 p-5 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{route.isDirect ? 'Direct' : 'Connecting'}</span>
                  <h3 className="mt-1.5 font-display text-lg text-ink-900">{airport.city} → {dest.city}</h3>
                  <p className="mt-1 text-xs text-ink-500">{route.flightTime}</p>
                  <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-ink-900">
                    View route <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.25} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────────────── FEATURED FARES ───────────────────────── */}
      <section className="bg-sand-50 py-16 sm:py-24">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Checked this week</span>
              <h2 className="mt-2 font-display text-3xl text-ink-900 sm:text-4xl">Featured fares from UK airports</h2>
            </div>
            <Link href="/deals" className="flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-terracotta-600">
              All current deals <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredFlights.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── VISITING FAMILY — distinct content architecture, surfaced on homepage ───────────────────────── */}
      <section className="bg-ink-900 py-16 sm:py-24">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <Users className="h-5 w-5 text-brass-300" strokeWidth={2} />
                <span className="text-xs font-semibold uppercase tracking-wide text-brass-300">Visiting family</span>
              </div>
              <h2 className="mt-3 font-display text-3xl leading-tight text-sand-50 sm:text-4xl">
                Built around how these trips actually happen
              </h2>
              <p className="mt-4 max-w-md text-ink-300">
                Most Pakistan and India travel from the UK isn't a holiday — it's a family visit, with its own
                booking patterns, document requirements and baggage realities. We cover that specifically, not as
                an afterthought to a generic destination page.
              </p>
              <ul className="mt-6 flex flex-col gap-3">
                <li className="flex items-start gap-2.5 text-sm text-ink-300">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" strokeWidth={2} />
                  NICOP and OCI guidance, specific to each destination
                </li>
                <li className="flex items-start gap-2.5 text-sm text-ink-300">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" strokeWidth={2} />
                  Real Eid, Diwali and wedding-season booking windows
                </li>
                <li className="flex items-start gap-2.5 text-sm text-ink-300">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" strokeWidth={2} />
                  Baggage and onward-journey detail most sites skip
                </li>
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <LinkButton href="/pakistan" size="md">Pakistan hub</LinkButton>
                <LinkButton href="/india" variant="outline" size="md">India hub</LinkButton>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <HubCard
                href="/destinations/lahore"
                eyebrow="Pakistan"
                title="Lahore"
                description="NICOP guidance, Eid booking windows and the baggage detail that catches people out."
                image={placeholderUrl('Lahore, Pakistan')}
              />
              <HubCard
                href="/destinations/amritsar"
                eyebrow="India"
                title="Amritsar"
                description="OCI guidance, Baisakhi timing and the Golden Temple route most direct from the UK."
                image={placeholderUrl('Amritsar Golden Temple')}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── BUSINESS CLASS ───────────────────────── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <Crown className="h-5 w-5 text-terracotta-600" strokeWidth={2} />
                <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Travelling further forward</span>
              </div>
              <h2 className="mt-3 font-display text-3xl leading-tight text-ink-900 sm:text-4xl">
                Business class to the Gulf and South Asia, without guesswork
              </h2>
              <p className="mt-4 max-w-md text-ink-600">
                Long-haul business fares move on different patterns to economy. We track the routes UK
                travellers actually fly — and flag when a fare is genuinely worth booking.
              </p>
              <LinkButton href="/business-class" variant="dark" className="mt-6">
                Explore business class
              </LinkButton>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {businessDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── UMRAH ───────────────────────── */}
      <section className="bg-sand-50 py-16 sm:py-24">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <HubCard
              href="/umrah"
              eyebrow="Pilgrimage travel"
              title="Umrah & Saudi Arabia"
              description="What's actually included in a package, how Makkah hotel distance affects price, and the visa route through Nusuk."
              image={placeholderUrl('Masjid al Haram Makkah')}
              size="lg"
            />
            <div className="flex flex-col gap-5">
              {umrahDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
              <Link
                href="/umrah"
                className="flex flex-1 flex-col justify-center rounded-md border border-ink-100 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Read first</span>
                <span className="mt-2 font-display text-xl text-ink-900">What's actually in an Umrah package</span>
                <span className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                  Read the Umrah hub <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── WHY JETSTASH — real comparison, not generic trust badges ───────────────────────── */}
      <section className="bg-ink-900 py-16 sm:py-24">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-wide text-brass-300">Why JetStash, specifically</span>
          <h2 className="mt-2 max-w-2xl font-display text-3xl leading-tight text-sand-50 sm:text-4xl">
            Generic search engines treat these routes as an edge case. We don't.
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-white/10 sm:grid-cols-3">
            <ComparisonColumn
              label="Generic comparison sites"
              points={['One Pakistan/India page, if any', 'No Eid or Diwali pricing context', 'No NICOP/OCI guidance', 'Business class treated identically to economy']}
              tone="muted"
            />
            <ComparisonColumn
              label="JetStash"
              points={['Dedicated hub for every route', 'Peak-period warnings built into every route page', 'Document guidance specific to each destination', 'Business class hub with route-level cabin coverage']}
              tone="highlight"
            />
            <ComparisonColumn
              label="Specialist travel agents"
              points={['Strong on packages', 'Limited on live fare comparison', 'Often phone/in-person only', 'Good for Umrah, thinner on flights-only']}
              tone="muted"
            />
          </div>
        </div>
      </section>

      {/* ───────────────────────── TRAVEL CLUB — elevated, real section ───────────────────────── */}
      <NewsletterSection />
    </>
  );
}

function ComparisonColumn({
  label,
  points,
  tone,
}: {
  label: string;
  points: string[];
  tone: 'muted' | 'highlight';
}) {
  return (
    <div className={tone === 'highlight' ? 'bg-ink-800 p-7' : 'bg-ink-900 p-7'}>
      <h3 className={`font-display text-lg ${tone === 'highlight' ? 'text-brass-300' : 'text-ink-300'}`}>{label}</h3>
      <ul className="mt-4 flex flex-col gap-3">
        {points.map((point) => (
          <li
            key={point}
            className={`flex items-start gap-2.5 text-sm leading-snug ${tone === 'highlight' ? 'text-sand-100' : 'text-ink-400'}`}
          >
            {tone === 'highlight' ? (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" strokeWidth={2} />
            ) : (
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-500" />
            )}
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
