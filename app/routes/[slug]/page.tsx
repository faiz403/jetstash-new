import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Plane, Calendar, Clock, ArrowUpRight, AlertCircle, GitCompareArrows, CalendarClock, History, MapPinned, MessageSquareText } from 'lucide-react';
import { routes, getRouteBySlug, getRouteAirport, getRouteDestination, getRoutesByDestination, getRouteAirlines, getRoutePeakPeriods } from '@/data/routes';
import { getDealsByDestination } from '@/data/deals';
import { getTimelineByRoute } from '@/data/route-timeline';
import { getActiveWarningsByRoute } from '@/data/route-warnings';
import { getObservationsByRoute } from '@/data/fare-observations';
import { getBookingWindowsByRoute } from '@/data/booking-windows';
import { getTipsForScope } from '@/data/traveller-tips';
import { getCommunityNotesForScope } from '@/data/community-notes';
import { getNotesByAirport } from '@/data/airport-notes';
import { DealCard } from '@/components/ui/deal-card';
import { NoFareFallback } from '@/components/ui/no-fare-fallback';
import { Badge } from '@/components/ui/badge';
import { RouteStat } from '@/components/ui/route-stat';
import { FamilyVisitBlock } from '@/components/sections/family-visit-block';
import { WarningBanner } from '@/components/route/warning-banner';
import { RouteTimeline } from '@/components/route/route-timeline';
import { FareHistoryPanel } from '@/components/route/fare-history-panel';
import { BookingWindowPanel } from '@/components/route/booking-window-panel';
import { TravellerTipList } from '@/components/route/traveller-tip-list';
import { CommunityNotesPanel } from '@/components/route/community-notes-panel';
import { FareWatchForm } from '@/components/route/fare-watch-form';
import { WhatsAppShareButton } from '@/components/route/whatsapp-share-button';
import { BookByCountdown } from '@/components/route/book-by-countdown';
import { JsonLd, breadcrumbSchema } from '@/components/seo/json-ld';
import { siteConfig } from '@/lib/site-config';
import { getRouteBookingUrl, getPrimaryBookingProvider } from '@/lib/booking-providers';
import { computeBookBySnapshot, buildBookByShareText } from '@/lib/booking-intelligence';
import { getDestinationImage } from '@/lib/brand-images';
import { HeroBackdrop } from '@/components/ui/hero-backdrop';

export async function generateStaticParams() {
  return routes.map((r) => ({ slug: r.slug }));
}

function formatEndDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const route = getRouteBySlug(params.slug);
  if (!route) return {};
  const airport = getRouteAirport(route);
  const dest = getRouteDestination(route);
  if (!airport || !dest) return {};
  return {
    title: `${airport.city} to ${dest.city} Flights: Booking Windows & Peak Periods`,
    description: `${route.intro.slice(0, 150)}...`,
    alternates: { canonical: `${siteConfig.url}/routes/${route.slug}` },
  };
}

export default function RoutePage({ params }: { params: { slug: string } }) {
  const route = getRouteBySlug(params.slug);
  if (!route) {
    notFound();
    return null;
  }

  const airport = getRouteAirport(route);
  const dest = getRouteDestination(route);
  if (!airport || !dest) {
    notFound();
    return null;
  }

  const dealsHere = getDealsByDestination(dest.slug).filter((d) => d.fromAirportSlug === airport.slug);
  const alternativeRoutes = getRoutesByDestination(dest.slug).filter((r) => r.slug !== route.slug);
  const airlines = getRouteAirlines(route);
  const peakPeriods = getRoutePeakPeriods(route);
  const activeWarnings = getActiveWarningsByRoute(route.slug);
  const timelineEvents = getTimelineByRoute(route.slug);
  const fareObservations = getObservationsByRoute(route.slug);
  const bookingWindows = getBookingWindowsByRoute(route.slug);
  const travellerTips = getTipsForScope({ routeSlug: route.slug, destinationSlug: dest.slug });
  const communityNotes = getCommunityNotesForScope({ routeSlug: route.slug, destinationSlug: dest.slug });
  const airportAdvice = getNotesByAirport(airport.slug).slice(0, 2);
  // Build-time snapshot for the Book-By panel (priority routes only) — the
  // client component recomputes state against the visitor's clock on mount.
  const bookBySnapshot = computeBookBySnapshot(route.slug, new Date());

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', href: '/' },
          { name: airport.name, href: `/airports/${airport.slug}` },
          { name: `${airport.city} to ${dest.city}`, href: `/routes/${route.slug}` },
        ])}
      />
      {/* Route heroes borrow the destination's photograph (dimmed, decorative) —
          one image per destination serves every surface, per docs/visual-identity.md. */}
      <section className="relative overflow-hidden bg-ink-900 py-16 sm:py-20">
        <HeroBackdrop image={(() => { const img = getDestinationImage(dest.slug); return img ? { ...img, alt: '' } : null; })()} />
        <div className="relative mx-auto max-w-content px-5 sm:px-8">
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs text-ink-300">
            <Link href="/" className="hover:text-brass-300">Home</Link>
            <span>/</span>
            <Link href={`/airports/${airport.slug}`} className="hover:text-brass-300">{airport.name}</Link>
            <span>/</span>
            <span className="text-ink-200">{dest.city}</span>
          </nav>
          <div className="stagger-in stagger-1 animate-fade-up">
            <Badge variant="dark">{route.isDirect ? 'Direct route' : 'Connecting route'}</Badge>
          </div>
          <h1 className="stagger-in stagger-2 mt-4 animate-fade-up font-display text-4xl leading-[1.05] tracking-tight text-sand-50 sm:text-5xl">
            {airport.city} to {dest.city}
          </h1>
          <p className="stagger-in stagger-3 mt-4 max-w-2xl animate-fade-up text-lg leading-relaxed text-ink-300">{route.intro}</p>

          <div className="stagger-in stagger-4 mt-7 flex animate-fade-up flex-wrap gap-6">
            <RouteStat icon={<Clock className="h-4 w-4" strokeWidth={2} />} label="Flight time" value={route.flightTime} />
            <RouteStat icon={<Calendar className="h-4 w-4" strokeWidth={2} />} label="Frequency" value={route.frequency} />
            {airlines.length > 0 && (
              <RouteStat icon={<Plane className="h-4 w-4" strokeWidth={2} />} label="Airlines" value={airlines.map((a) => a.name).join(', ')} />
            )}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href={getRouteBookingUrl(airport, dest)}
              target="_blank"
              rel={getPrimaryBookingProvider().rel}
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-brass px-6 text-sm font-semibold text-ink-900 transition-all hover:bg-brass-400 hover:shadow-brass-glow active:scale-[0.985]"
            >
              Check live prices for this route
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </a>
            <WhatsAppShareButton
              url={`${siteConfig.url}/routes/${route.slug}`}
              text={
                bookBySnapshot
                  ? buildBookByShareText(bookBySnapshot)
                  : `${airport.city} to ${dest.city}: ${route.flightTime}, ${route.frequency}. ${route.bookingWindowNote}`
              }
            />
          </div>
          <p className="mt-2.5 text-xs text-ink-300">Partner link, opens {getPrimaryBookingProvider().name} in a new tab. Booking there never costs you more.</p>
        </div>
      </section>

      {route.directServiceEndDate && (
        <section className="bg-terracotta-50 py-8 sm:py-10">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-terracotta-100 text-terracotta-700">
                <CalendarClock className="h-4.5 w-4.5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="font-display text-lg text-ink-900">
                  Direct service scheduled to end {formatEndDate(route.directServiceEndDate)}
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-700">{route.directServiceEndNote}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeWarnings.length > 0 && (
        <section className="bg-sand-50 py-10 sm:py-12">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <WarningBanner warnings={activeWarnings} />
          </div>
        </section>
      )}

      {bookBySnapshot && (
        <section className="bg-sand-50 py-10 sm:py-12">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <BookByCountdown initialSnapshot={bookBySnapshot} />
          </div>
        </section>
      )}

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="font-display text-2xl text-ink-900">When to book this route</h2>
              <p className="mt-4 leading-relaxed text-ink-600">{route.bookingWindowNote}</p>
              {bookingWindows.length > 0 && (
                <div className="mt-7">
                  <BookingWindowPanel windows={bookingWindows} />
                </div>
              )}
            </div>
            {peakPeriods.length > 0 && (
              <div className="rounded-md border border-ink-100 bg-sand-50 p-6">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4.5 w-4.5 text-terracotta-600" strokeWidth={2} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Peak demand periods</span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {peakPeriods.map((period) => (
                    <div key={period.id} className="flex items-center gap-2 text-sm text-ink-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-terracotta-500" />
                      {period.label}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-ink-400">
                  Fares on this route rise sharply within 3–4 weeks of these periods. Book ahead if your dates are fixed.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {route.connectingAlternative && (
        <section className="bg-sand-50 py-14 sm:py-16">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">
              {route.isDirect ? 'The realistic 1-stop alternative' : 'How this connecting route usually works'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-500">
              {route.isDirect
                ? 'Worth knowing even if you book the direct flight. Useful as a fallback, and this is what the route looks like once the direct service is unavailable.'
                : 'No direct service currently exists on this route. Here is the realistic connecting pattern most travellers use.'}
            </p>
            <div className="mt-7 grid gap-5 sm:grid-cols-3">
              <div className="rounded-md border border-ink-100 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Typical stops</p>
                <p className="mt-1 font-display text-lg text-ink-900">
                  Usually {route.connectingAlternative.typicalStops} stop{route.connectingAlternative.typicalStops > 1 ? 's' : ''}
                </p>
              </div>
              <div className="rounded-md border border-ink-100 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Common hub airports</p>
                <p className="mt-1 font-display text-lg text-ink-900">{route.connectingAlternative.hubAirports.join(', ')}</p>
              </div>
              <div className="rounded-md border border-ink-100 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Typical total journey time</p>
                <p className="mt-1 font-display text-lg text-ink-900">{route.connectingAlternative.typicalJourneyTime}</p>
              </div>
            </div>
            <p className="mt-5 text-sm text-ink-500">
              Airlines commonly used on this connection: {route.connectingAlternative.typicalAirlines.join(', ')}.
            </p>
          </div>
        </section>
      )}

      {timelineEvents.length > 0 && (
        <section className="bg-white py-14 sm:py-16">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <div className="flex items-center gap-2.5">
              <History className="h-5 w-5 text-terracotta-600" strokeWidth={2} />
              <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Route history</span>
            </div>
            <h2 className="mt-2 font-display text-2xl text-ink-900 sm:text-3xl">What's actually changed on this route</h2>
            <p className="mt-2 max-w-xl text-sm text-ink-500">
              Real, dated changes to this specific route, not a generic "things to know" list.
            </p>
            <div className="mt-8">
              <RouteTimeline events={timelineEvents} />
            </div>
          </div>
        </section>
      )}

      {dest.familyVisitContent && <FamilyVisitBlock content={dest.familyVisitContent} city={dest.city} />}

      {alternativeRoutes.length > 0 && (
        <section className="bg-sand-50 py-14 sm:py-16">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <div className="flex items-center gap-2.5">
              <GitCompareArrows className="h-5 w-5 text-terracotta-600" strokeWidth={2} />
              <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Worth comparing</span>
            </div>
            <h2 className="mt-2 font-display text-2xl text-ink-900 sm:text-3xl">Other UK airports for {dest.city}</h2>
            <p className="mt-2 max-w-xl text-sm text-ink-500">
              If more than one airport is realistically within reach, comparing the total journey, not just the
              headline fare, is usually worth the extra few minutes.
            </p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {alternativeRoutes.map((altRoute) => {
                const altAirport = getRouteAirport(altRoute);
                if (!altAirport) return null;
                return (
                  <Link
                    key={altRoute.slug}
                    href={`/routes/${altRoute.slug}`}
                    className="group flex flex-col rounded-md border border-ink-100 bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-card-hover"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {altRoute.isDirect ? 'Direct' : 'Connecting'}
                    </span>
                    <h3 className="mt-1.5 font-display text-xl text-ink-900">{altAirport.city} → {dest.city}</h3>
                    <p className="mt-1 text-sm text-ink-500">{altRoute.flightTime} · {getRouteAirlines(altRoute).map((a) => a.name).join(', ')}</p>
                    <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                      Compare this route
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.25} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Fare history & current example</h2>
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            Every fare below is an example checked on the date shown, not a live quote. The history is what makes
            it worth tracking over time.
          </p>
          {fareObservations.length > 0 && (
            <div className="mt-8">
              <FareHistoryPanel observations={fareObservations} />
            </div>
          )}
          {dealsHere.length > 0 ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {dealsHere.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          ) : (
            <div className="mt-8">
              <NoFareFallback cityLabel={`${airport.city} to ${dest.city}`} />
            </div>
          )}
          {/* id anchors the Book-By panel's "Watch this route" CTA; the global
              scroll-padding-top keeps it clear of the sticky header. */}
          <div id="fare-watch" className="mt-8 max-w-xl">
            <FareWatchForm defaultAirportSlug={airport.slug} defaultDestinationSlug={dest.slug} />
          </div>
        </div>
      </section>

      {travellerTips.length > 0 && (
        <section className="bg-sand-50 py-14 sm:py-16">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Traveller tips for this route</h2>
            <div className="mt-8">
              <TravellerTipList tips={travellerTips} />
            </div>
          </div>
        </section>
      )}

      {airportAdvice.length > 0 && (
        <section className="bg-white py-14 sm:py-16">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <div className="flex items-center gap-2.5">
              <MapPinned className="h-5 w-5 text-terracotta-600" strokeWidth={2} />
              <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Before you fly from {airport.city}</span>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {airportAdvice.map((note) => (
                <div key={note.id} className="rounded-md border border-ink-100 bg-sand-50 p-5">
                  <h3 className="font-display text-base text-ink-900">{note.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{note.body}</p>
                </div>
              ))}
            </div>
            <Link
              href={`/airports/${airport.slug}`}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-terracotta-600"
            >
              Full {airport.name} guide <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </div>
        </section>
      )}

      <section className="bg-sand-50 py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <MessageSquareText className="h-5 w-5 text-terracotta-600" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Community notes</span>
          </div>
          <h2 className="mt-2 font-display text-2xl text-ink-900 sm:text-3xl">What real travellers say about this route</h2>
          <div className="mt-8">
            <CommunityNotesPanel notes={communityNotes} />
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="flex flex-col gap-4 rounded-md border border-ink-100 bg-sand-50 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl text-ink-900">More about {dest.city}</h2>
              <p className="mt-1 text-sm text-ink-500">Full destination guide, visa notes and all current fares, not just this one route.</p>
            </div>
            <Link
              href={`/destinations/${dest.slug}`}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-5 py-3 text-sm font-semibold text-sand-50 transition-all hover:bg-ink-700 active:scale-[0.985]"
            >
              View {dest.city} guide
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
