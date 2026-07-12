import type { Metadata } from 'next';
import { ArrowUpRight, ShieldCheck, Users, Crown, BadgeCheck, CalendarCheck, Plane, Compass, BookOpen, Globe, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { RouteMapHero } from '@/components/sections/route-map-hero';
import { NextTravelMomentRibbon } from '@/components/sections/next-travel-moment-ribbon';
import { HubCard } from '@/components/ui/hub-card';
import { DealCard } from '@/components/ui/deal-card';
import { NewsletterSection } from '@/components/sections/newsletter-section';
import { computeAllBookBySnapshots } from '@/lib/booking-intelligence';
import { LinkButton } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { deals, getDealsByCategory, formatChecked } from '@/data/deals';
import { fareObservations } from '@/data/fare-observations';
import { routes, getRouteAirport, getRouteDestination } from '@/data/routes';
import { getDestinationBySlug } from '@/data/destinations';
import { getGuideBySlug } from '@/data/guides';
import { getDestinationImage, getHeroImage, getAirportImage } from '@/lib/brand-images';
import { DestinationVisual } from '@/components/ui/destination-visual';
import { HeroBackdrop } from '@/components/ui/hero-backdrop';
import { siteConfig } from '@/lib/site-config';

// A plain string here would run through the root layout's "%s | JetStash"
// title template, duplicating the brand name — title.absolute keeps this
// exact brand-first framing explicit at the page level (matching every
// other page having its own metadata) without changing what's rendered.
// openGraph/twitter are deliberately left unset so they inherit the root
// layout's images/type/siteName untouched — Next resolves their title and
// description from these fields automatically.
export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name}: ${siteConfig.tagline}` },
  description: siteConfig.description,
  alternates: { canonical: siteConfig.url },
};

// Same reasoning as app/routes/[slug]/page.tsx — computeAllBookBySnapshots() is a pure function
// of `now`, so ISR keeps the homepage's build-time Book-By ribbon from drifting stale between
// deploys without changing any logic.
export const revalidate = 21600;

export default function HomePage() {
  // Explicit commercial selection, not array order: Dubai leads with the lowest price
  // anchor and broadest appeal, then the India and Pakistan flagship routes.
  const featuredFlightIds = ['man-dxb-economy', 'lhr-del-economy', 'man-lhe-economy'];
  const featuredFlights = featuredFlightIds
    .map((id) => deals.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  // Derived from data so the label can never claim a fresher check than actually happened.
  const latestCheck = fareObservations.reduce(
    (max, o) => (o.observedDate > max ? o.observedDate : max),
    fareObservations[0].observedDate
  );
  const businessDeals = getDealsByCategory('business').slice(0, 2);
  const umrahDeals = getDealsByCategory('umrah').slice(0, 1);
  // One flagship route per region, ordered by market size: India, Pakistan, Gulf, Umrah.
  const featuredRouteSlugs = ['london-heathrow-delhi', 'manchester-lahore', 'manchester-dubai', 'london-heathrow-jeddah'];
  const popularRoutes = featuredRouteSlugs
    .map((slug) => routes.find((r) => r.slug === slug))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  // Broadly relevant across the whole audience (not Umrah- or business-class-specific),
  // so they earn a place on the homepage rather than only their region hub.
  const featuredGuideSlugs = ['visa-processing-booking-date', 'eid-diwali-vs-school-holiday-pricing', 'direct-vs-gulf-connecting-fares'];
  const featuredGuides = featuredGuideSlugs
    .map((slug) => getGuideBySlug(slug))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const bookBySnapshots = computeAllBookBySnapshots(new Date());

  return (
    <>
      {/* ───────────────────────── HERO ───────────────────────── */}
      {/* Manchester's own photo (control tower, departing aircraft, routes fanning
          from the UK across the world) rather than a destination shot — it makes
          the "UK departure first" claim visual, and sets up the interactive route
          map immediately below as its literal, clickable version. */}
      <section className="relative overflow-hidden bg-ink-900 pb-16 pt-12 sm:pb-24 sm:pt-16">
        <HeroBackdrop image={getAirportImage('manchester')} />
        <div className="relative mx-auto max-w-content px-5 sm:px-8">
          <div className="max-w-2xl">
            <div className="stagger-in stagger-1 animate-fade-up">
              <Badge variant="dark">UK departure first</Badge>
            </div>
            <h1 className="stagger-in stagger-2 mt-5 animate-fade-up font-display text-[2.5rem] leading-[1.05] tracking-tight text-sand-50 sm:text-6xl">
              Find better flights from the UK to the destinations that matter.
            </h1>
            <p className="stagger-in stagger-3 mt-5 max-w-lg animate-fade-up text-lg leading-relaxed text-ink-300">
              Routes, destination guides and travel inspiration from UK airports to Pakistan, India, Turkey,
              Morocco and the Gulf, checked by people and dated. No manufactured scarcity, no fake price
              pressure — ever.
            </p>
            <div className="stagger-in stagger-4 mt-7 flex animate-fade-up flex-wrap items-center gap-x-7 gap-y-4">
              <LinkButton href="/destinations" size="lg">
                Explore destinations
              </LinkButton>
              <Link
                href="/airports"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-sand-50 underline decoration-white/30 underline-offset-4 hover:text-brass-300 hover:decoration-brass-300"
              >
                Browse UK airports
                <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── INTERACTIVE MANCHESTER ROUTE MAP ───────────────────────── */}
      <section className="border-t border-white/5 bg-ink-950 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <RouteMapHero bookBySnapshots={bookBySnapshots} />
        </div>
      </section>

      {/* ───────────────────────── NEXT TRAVEL MOMENT — Book-By Countdown entry point ───────────────────────── */}
      <NextTravelMomentRibbon snapshots={bookBySnapshots} />

      {/* ───────────────────────── TRAVEL READY CHECK — restrained entry point ───────────────────────── */}
      <section className="border-t border-white/5 bg-ink-950 py-4">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <p className="text-center text-xs text-ink-300 sm:text-sm">
            Ready to book isn&apos;t the same as ready to travel.{' '}
            <Link href="/travel-ready-check" className="font-semibold text-brass-300 underline underline-offset-2 hover:text-brass-200">
              Check your passport and visa readiness
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ───────────────────────── HOW WE WORK — trust strip, every claim true ───────────────────────── */}
      <section className="border-b border-white/5 bg-ink-950 py-8">
        <div className="mx-auto grid max-w-content gap-6 px-5 sm:grid-cols-3 sm:px-8">
          <div className="flex items-start gap-3">
            <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-brass-300" strokeWidth={2} />
            <div>
              <p className="text-sm font-semibold text-sand-50">Checked by a person, dated</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-300">
                Every fare shows the date a member of our team actually checked it. Never a live-price claim.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brass-300" strokeWidth={2} />
            <div>
              <p className="text-sm font-semibold text-sand-50">No manufactured urgency</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-300">
                No fake countdowns, no &ldquo;2 seats left&rdquo;, no invented price pressure. Book-By Countdown above is
                evidence-based booking guidance, not a dark pattern — every date traces to a real festival, fare or
                booking-window record.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-brass-300" strokeWidth={2} />
            <div>
              <p className="text-sm font-semibold text-sand-50">Built for these routes</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-300">
                Route history, booking windows and peak-period warnings, specific to each airport pairing.{' '}
                <Link href="/about" className="font-medium text-brass-300 underline underline-offset-2 hover:text-brass-200">
                  Our standards
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── REGION HUBS ───────────────────────── */}
      <section className="bg-sand-50 py-16 sm:py-24">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Where we specialise</span>
          <h2 className="mt-2 font-display text-3xl text-ink-900 sm:text-4xl">Four hubs, built for how you actually travel</h2>

          {/* Ordered by UK market size and revenue potential: India (largest diaspora and
              traffic), Pakistan (strongest community wedge), Umrah (highest value per
              traveller via the quote funnel), Gulf (broadest mainstream appeal). */}
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <HubCard
              href="/india"
              eyebrow="Family visits & heritage"
              title="India"
              description="Delhi, Mumbai and Amritsar: OCI guidance, festival season pricing, and the routes that hold value."
              image={getHeroImage('india')}
            />
            <HubCard
              href="/pakistan"
              eyebrow="Family visits & heritage"
              title="Pakistan"
              description="Lahore, Islamabad and Karachi: direct routes, Eid travel timing, NICOP guidance and what to know before you fly."
              image={getHeroImage('pakistan')}
            />
            <HubCard
              href="/umrah"
              eyebrow="Pilgrimage travel"
              title="Umrah & Saudi Arabia"
              description="Jeddah and Madinah: package structures, Nusuk visa guidance, and what genuinely affects price."
              image={getHeroImage('umrah')}
            />
            <HubCard
              href="/gulf"
              eyebrow="Stopovers & city breaks"
              title="The Gulf"
              description="Dubai and Doha: year-round flights, family-friendly stopovers, and beach-meets-city breaks."
              image={getHeroImage('gulf')}
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
                Each route has its own booking-window guide and peak-period warnings, not a generic destination page.
              </p>
            </div>
            <Link href="/routes" className="flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-terracotta-600">
              All routes <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {popularRoutes.map((route, i) => {
              const airport = getRouteAirport(route);
              const dest = getRouteDestination(route);
              if (!airport || !dest) return null;
              return (
                <Link
                  key={route.slug}
                  href={`/routes/${route.slug}`}
                  className="group flex flex-col rounded-md border border-ink-100 p-5 shadow-card transition-all hover:-translate-y-1 hover:border-terracotta-200 hover:shadow-card-hover"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-terracotta-50 text-terracotta-600 transition-colors group-hover:bg-terracotta-100">
                      <Plane className="h-4.5 w-4.5" strokeWidth={2} />
                    </span>
                    <span className="font-display text-sm text-ink-200" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <span className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-400">{route.isDirect ? 'Direct' : 'Connecting'}</span>
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
              <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Most recent check: {formatChecked(latestCheck)}</span>
              <h2 className="mt-2 font-display text-3xl text-ink-900 sm:text-4xl">Featured fares from UK airports</h2>
            </div>
            <Link href="/deals" className="flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-terracotta-600">
              All tracked fares <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
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
                Most Pakistan and India travel from the UK isn't a holiday. It's a family visit, with its own
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
                image={getDestinationImage('lahore')}
              />
              <HubCard
                href="/destinations/amritsar"
                eyebrow="India"
                title="Amritsar"
                description="OCI guidance, Baisakhi timing and the Golden Temple route most direct from the UK."
                image={getDestinationImage('amritsar')}
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
                travellers actually fly, and flag when a fare is genuinely worth booking.
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
              size="lg"
              image={getHeroImage('umrah')}
            />
            <div className="flex flex-col gap-5">
              {umrahDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
              <div className="flex flex-1 flex-col justify-center rounded-md border border-ink-100 bg-white p-6 shadow-card">
                <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Real quotes, from a person</span>
                <span className="mt-2 font-display text-xl text-ink-900">Tell us your dates and group size, and we'll come back with real Umrah pricing</span>
                <div className="mt-4 flex flex-wrap gap-3">
                  <LinkButton href="/quote-request?tripType=umrah&region=gulf" variant="dark" size="sm">
                    Request a quote
                  </LinkButton>
                  <Link href="/umrah" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-terracotta-600">
                    Read the Umrah hub <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── TURKEY, MOROCCO & THE MED — short-haul range, honest seasonality ───────────────────────── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Short-haul & winter sun</span>
              <h2 className="mt-2 font-display text-3xl text-ink-900 sm:text-4xl">Turkey, Morocco and the Mediterranean</h2>
              <p className="mt-2 max-w-lg text-sm text-ink-500">
                The same honest coverage, under five hours from the UK, including which routes are genuinely
                seasonal, so you don&apos;t plan around a flight that pauses for winter.
              </p>
            </div>
            <Link href="/destinations" className="flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-terracotta-600">
              All destinations <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {['istanbul', 'dalaman', 'marrakech', 'agadir'].map((slug) => {
              const dest = getDestinationBySlug(slug);
              if (!dest) return null;
              return (
                <Link
                  key={slug}
                  href={`/destinations/${slug}`}
                  className="group flex flex-col overflow-hidden rounded-md border border-ink-100 bg-white shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
                >
                  <div className="relative h-36 w-full overflow-hidden">
                    <DestinationVisual
                      slug={slug}
                      className="transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{dest.country}</span>
                    <h3 className="mt-1.5 font-display text-xl text-ink-900">{dest.city}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-500">{dest.tagline}</p>
                    <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                      View guide
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.25} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────────────── WHY JETSTASH — three editorial cards, no invented stats ───────────────────────── */}
      <section className="bg-ink-900 py-16 sm:py-24">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-wide text-brass-300">Why JetStash</span>
          <h2 className="mt-2 max-w-2xl font-display text-3xl leading-tight text-sand-50 sm:text-4xl">
            Built around how you actually fly from the UK, not a generic search box.
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            <WhyCard
              icon={Plane}
              title="UK departure first"
              description="Every hub starts from a UK airport, not a global search bar. Manchester today, with more UK airports being added as coverage grows."
            />
            <WhyCard
              icon={ShieldCheck}
              title="Honest travel guidance"
              description="Visa timing, booking windows and route history, checked by a person and dated. Booking guidance is evidence-based, never manufactured urgency."
            />
            <WhyCard
              icon={Compass}
              title="Curated destinations"
              description="Every destination we cover gets its own guide, hand-picked for the routes our travellers actually fly."
            />
          </div>
        </div>
      </section>

      {/* ───────────────────────── MANCHESTER, OUR FIRST AIRPORT + LATEST GUIDES ───────────────────────── */}
      <section className="bg-sand-50 py-16 sm:py-24">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="flex flex-col justify-between rounded-md bg-ink-900 p-8">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-brass-300">Starting with Manchester</span>
                <h2 className="mt-3 font-display text-2xl leading-tight text-sand-50 sm:text-3xl">
                  Our first airport, not our only one
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-ink-300">
                  Manchester is the busiest direct gateway to Pakistan, India and the Gulf outside London, which
                  is why it's where JetStash started. It's the beginning of a wider UK airport collection, not
                  the limit of one.
                </p>
              </div>
              <LinkButton href="/airports/manchester" className="mt-6 self-start">
                Explore Manchester Airport
              </LinkButton>
            </div>
            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h3 className="font-display text-xl text-ink-900">Latest travel guides</h3>
                <Link href="/guides" className="flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-terracotta-600">
                  All guides <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                </Link>
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-3">
                {featuredGuides.map((guide, i) => (
                  <Link
                    key={guide.slug}
                    href={`/guides/${guide.slug}`}
                    className="group flex flex-col rounded-md border border-ink-100 bg-white p-5 shadow-card transition-all hover:-translate-y-1 hover:border-terracotta-200 hover:shadow-card-hover"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-terracotta-50 text-terracotta-600 transition-colors group-hover:bg-terracotta-100">
                        <BookOpen className="h-4.5 w-4.5" strokeWidth={2} />
                      </span>
                      <span className="font-display text-sm text-ink-200" aria-hidden="true">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h4 className="mt-3 font-display text-base leading-snug text-ink-900">{guide.title}</h4>
                    <p className="mt-2 text-xs leading-relaxed text-ink-500">{guide.summary}</p>
                    <span className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-ink-900">
                      Read guide
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.25} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── FINAL CTA — simple, minimal, elegant ───────────────────────── */}
      <section className="border-t border-white/5 bg-ink-950 py-10">
        <div className="mx-auto flex max-w-content flex-col items-start justify-between gap-6 px-5 sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-start gap-3">
            <Globe className="mt-0.5 h-6 w-6 shrink-0 text-brass-300" strokeWidth={1.75} />
            <div>
              <p className="font-display text-xl text-sand-50">Your journey starts here.</p>
              <p className="mt-1 max-w-md text-sm text-ink-300">
                Explore flights from UK airports to the destinations that matter, and find the route guide built
                for how you actually travel.
              </p>
            </div>
          </div>
          <LinkButton href="/airports" size="lg" className="shrink-0">
            Explore UK airports
          </LinkButton>
        </div>
      </section>

      {/* ───────────────────────── TRAVEL CLUB — elevated, real section ───────────────────────── */}
      <NewsletterSection />
    </>
  );
}

function WhyCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] p-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-brass/40 text-brass-300">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <h3 className="mt-4 font-display text-lg text-sand-50">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-300">{description}</p>
    </div>
  );
}
