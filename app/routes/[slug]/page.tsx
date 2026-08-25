import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Plane, Calendar, Clock, ArrowUpRight, AlertCircle, GitCompareArrows, History, MessageSquareText, ShieldCheck } from 'lucide-react';
import { routes, getRouteBySlug, getRouteAirport, getRouteDestination, getRoutesByDestination, getRoutePeakPeriods, getRouteStatus } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getRouteStatusCopy, getEffectiveRoutePresentation, formatRouteStatusDate } from '@/lib/route-status-copy';
import { getAirlinesBySlugs } from '@/data/airlines';
import { getDealsByDestination } from '@/data/deals';
import { getTimelineByRoute } from '@/data/route-timeline';
import { getActiveWarningsByRoute } from '@/data/route-warnings';
import { getPublishableObservationsByRoute, getFareRangeSummary, fareObservations as allFareObservations } from '@/data/fare-observations';
import { getBookingWindowsByRoute } from '@/data/booking-windows';
import { getTipsForScope } from '@/data/traveller-tips';
import { getCommunityNotesForScope } from '@/data/community-notes';
import { DealCard } from '@/components/ui/deal-card';
import { NoFareFallback } from '@/components/ui/no-fare-fallback';
import { Badge } from '@/components/ui/badge';
import { RouteStat } from '@/components/ui/route-stat';
import { WarningBanner } from '@/components/route/warning-banner';
import { RouteTimeline } from '@/components/route/route-timeline';
import { FareHistoryPanel } from '@/components/route/fare-history-panel';
import { BookingWindowPanel } from '@/components/route/booking-window-panel';
import { TravellerTipList } from '@/components/route/traveller-tip-list';
import { CommunityNotesPanel } from '@/components/route/community-notes-panel';
import { RouteWatchForm } from '@/components/route/route-watch-form';
import { WhatsAppShareButton } from '@/components/route/whatsapp-share-button';
import { RouteReadinessPanel } from '@/components/route/route-readiness-panel';
import { TravelReadyCheck } from '@/components/travel-ready/travel-ready-check';
import { JsonLd, breadcrumbSchema } from '@/components/seo/json-ld';
import { siteConfig } from '@/lib/site-config';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';
import { computeBookBySnapshot } from '@/lib/booking-intelligence';
import { computeReadiness } from '@/lib/travel-intelligence-engine';
import { TRAVEL_READY_SUPPORTED_COUNTRIES } from '@/lib/travel-ready-check';
import { getDestinationImage } from '@/lib/brand-images';
import { getFareSectionCopy } from '@/lib/fare-section-copy';
import { HeroBackdrop } from '@/components/ui/hero-backdrop';
import { JourneyChoice } from '@/components/route/journey-choice';
import { getJourneyChoiceForRoute } from '@/lib/journey-choice-route-adapter';
import { getJourneyChoiceTripComHandoff } from '@/lib/tripcom-dated-handoff';
import { FareSignal } from '@/components/route/fare-signal';
import { getFareSignalForRoute, shouldShowNoFareFallback } from '@/lib/fare-signal';
import { getApprovedStandoutFare } from '@/lib/standout-fare';
import { FareWindowReconciliationNote } from '@/components/route/fare-window-reconciliation-note';
import { deriveFareWindowReconciliation } from '@/lib/fare-window-reconciliation';
import { getRouteIntelligenceDisplayForRoute } from '@/lib/route-intelligence-display';
import { BusinessClarityPanel } from '@/components/route/business-clarity-panel';

/**
 * Route-hero focal-position overrides, keyed by destination slug. HeroBackdrop's default
 * object-cover crop (no object-position, i.e. centred) is invisible for a centrally-composed
 * photo, but loses one of two focal points for a photo composed toward the frame edges — this
 * hero's box is 100vw wide with content-driven height, so it crops vertically at desktop widths
 * and horizontally at narrow ones. DestinationVisual's fixed near-16:9 boxes don't have this
 * problem and are untouched. Kept here (an app/** file) rather than in lib/brand-images.ts —
 * tailwind.config.js's `content` glob only scans app/** and components/**, so a class string
 * living in lib/ is invisible to the JIT scanner and silently produces no CSS (confirmed the hard
 * way; see git history). Empty for every destination except one so far — every existing route
 * hero keeps its exact current, centred crop with zero visual change. Values are Tailwind
 * `object-position` utility classes, mobile-first with breakpoint overrides, tuned by hand against
 * the actual delivered photo at every required viewport.
 */
const ROUTE_HERO_FOCAL_POSITION: Record<string, string> = {
  bengaluru: 'object-[57%_45%] sm:object-[55%_42%] md:object-[48%_35%] lg:object-[52%_18%]',
};

// Pure ISR — computeBookBySnapshot/computeReadiness are already pure functions of `now`, so
// periodically regenerating this static page keeps the server-rendered snapshot (what SEO
// crawlers and no-JS visitors see) from drifting more than 6 hours stale between deploys. The
// client still recomputes against the visitor's real clock on mount regardless (see
// components/route/book-by-countdown.tsx) — this only tightens the build-time baseline.
export const revalidate = 21600;

export async function generateStaticParams() {
  return routes.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const route = getRouteBySlug(slug);
  if (!route) return {};
  const airport = getRouteAirport(route);
  const dest = getRouteDestination(route);
  if (!airport || !dest) return {};
  const nowIso = new Date().toISOString().slice(0, 10);
  // Verification-pending leakage fix: metadata must never build its
  // description from raw route.intro — getEffectiveRoutePresentation()
  // returns a restrained, claim-free description for a pending or
  // service-ended route instead, reconciled against the Route Status V1
  // ledger for the two managed corridors.
  // Presentation-integrity fix: the title is content-aware too — see
  // metadataTitle's doc comment — never a fixed template that can promise
  // sections (Peak Periods, Fare History) a sparse route doesn't have.
  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
  return {
    title: presentation.metadataTitle,
    description: presentation.metadataDescription,
    alternates: { canonical: `${siteConfig.url}/routes/${route.slug}` },
  };
}

export default async function RoutePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const route = getRouteBySlug(slug);
  if (!route) {
    notFound();
    return null;
  }

  const airport = getRouteAirport(route);
  const dest = getRouteDestination(route);
  const nowIso = new Date().toISOString().slice(0, 10);
  // Verification-pending leakage fix: the single reusable source of truth
  // for everything this page renders about the route — duration, frequency,
  // airlines, hero copy, share text, and whether booking-guidance/peak-
  // period/connecting-alternative sections may render at all. Pending and
  // service-ended routes get their own branches here, never treated as a
  // variant of 'connecting' — see RoutePresentation's doc comment and
  // getEffectiveRoutePresentation's adapter doc comment in data/routes.ts.
  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
  const presentationAirlines = getAirlinesBySlugs(presentation.airlineSlugs);
  // Route Intelligence Completion (August 2026, phase 2) — the same
  // computeRouteIntelligenceLevel() grade the homepage Atlas shows for this
  // exact route, now shown on its own detail page. Deliberately separate
  // from presentation.statusLabel below: that answers Route Status (is this
  // route direct/connecting/pending), this answers the different Route
  // Intelligence question (how much has JetStash actually researched it).
  const routeIntelligence = getRouteIntelligenceDisplayForRoute(route, nowIso);
  // Ledger-managed routes only (getRouteStatus returns null otherwise) —
  // the evidence-validated view model behind the Route Status panel below.
  // A previously-verified direct service that has ended, or an announced
  // change whose date has passed without reverification, gets its exact
  // sourced explanation here; every other route renders no panel at all.
  const routeStatus = getRouteStatus(route, routeStatusEvents, nowIso);
  const routeStatusCopy = routeStatus ? getRouteStatusCopy(route, routeStatus, routeStatusEvents, nowIso) : null;
  if (!airport || !dest) {
    notFound();
    return null;
  }

  const dealsHere = getDealsByDestination(dest.slug).filter((d) => d.fromAirportSlug === airport.slug);
  const alternativeRoutes = getRoutesByDestination(dest.slug).filter((r) => r.slug !== route.slug);
  const peakPeriods = getRoutePeakPeriods(route);
  const activeWarnings = getActiveWarningsByRoute(route.slug);
  const timelineEvents = getTimelineByRoute(route.slug);
  const fareObservations = getPublishableObservationsByRoute(route.slug, nowIso);
  // Journey Choice Brief, MVP pilot (24 Aug 2026, founder-approved) —
  // manchester-islamabad only (see lib/journey-choice-route-adapter.ts's
  // own allowlist doc comment). Reuses getSmartFareComparisonForRoute()
  // internally, so it can never diverge from PR #171's exact-match
  // COMPARABLE OR NOT SHOWN invariant. Deliberately replaces the
  // customer-facing Smart Fare Comparison presentation (below) rather than
  // sitting alongside it — see components/route/journey-choice.tsx's own
  // doc comment for why two comparison products would confuse the exact
  // clarity this feature exists to add. Fare Signal (next section) is
  // UNCHANGED and untouched by this — it answers a different question
  // ("what's the current representative tracked fare") and can carry newer
  // evidence than Journey Choice's own exact-match comparison batch.
  const journeyChoice = getJourneyChoiceForRoute(route.slug, nowIso);
  const fareSignal = getFareSignalForRoute(route.slug, nowIso);
  // First Standout Fare Pilot (25 Aug 2026, founder-approved,
  // manchester-islamabad only — see data/standout-fare-approvals.ts).
  // Evaluated against the FULL archive (not the route-scoped
  // `fareObservations` above) because it must reproduce exactly the same
  // Fare Watcher candidate Step 6/7 verified against — see
  // lib/standout-fare.ts's own doc comment. Fails closed to null for every
  // route without an active approval, which is every route except the
  // pilot; FareSignal only ever shows it when its evidence exactly matches
  // the fare already being displayed there.
  const standoutFare = getApprovedStandoutFare(route.slug, 'Economy', allFareObservations, nowIso);
  // Fare copy must reflect the data actually available — see getFareSectionCopy.
  const fareSectionCopy = getFareSectionCopy(fareObservations.length > 0, dealsHere.length > 0);
  const bookingWindows = getBookingWindowsByRoute(route.slug);
  const travellerTips = getTipsForScope({ routeSlug: route.slug, destinationSlug: dest.slug });
  const communityNotes = getCommunityNotesForScope({ routeSlug: route.slug, destinationSlug: dest.slug });
  // Build-time snapshot for the Book-By panel (priority routes only) — the
  // client component recomputes state against the visitor's clock on mount.
  const bookBySnapshot = computeBookBySnapshot(route.slug, new Date());
  // Travel Intelligence Engine's readiness verdict for the same route —
  // composed from bookBySnapshot plus active warnings (§14.2).
  const engineSnapshot = computeReadiness(route.slug, new Date());
  // True only where Book-By Countdown's own panel already states this route's structured
  // booking-window guidance (e.g. Manchester–Lahore, Manchester–Islamabad) — for every other
  // route this section remains the primary "when to book" content, not a restated duplicate.
  const evidenceReframe = Boolean(bookBySnapshot) && bookingWindows.length > 0;
  // Fail-closed by construction: null for any route not in booking-providers.ts's
  // dashboard-verified map (the 9 London-origin routes today) — never a generic
  // Trip.com fallback. See getTripComFlightHandoffUrl's doc comment.
  const tripComUrl = getTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug);
  // Journey Choice dated Trip.com handoff pilot (24 Aug 2026, founder-
  // approved, manchester-islamabad only — see lib/tripcom-dated-handoff.ts's
  // own doc comment for the two-part commercial evidence this pilot rests
  // on). Fails closed to the exact same tripComUrl every other surface on
  // this page already uses whenever the pilot doesn't apply or Journey
  // Choice's own structured dates/cabin don't support it — never a second,
  // divergent CTA policy.
  const journeyChoiceTripComHandoff = journeyChoice
    ? getJourneyChoiceTripComHandoff(route.slug, journeyChoice, tripComUrl)
    : null;
  // SEO Domination Batch 1B (23 Aug 2026): route.businessClarity is static,
  // hand-authored route-vs-fare context; the actual price and checked-date
  // it renders alongside always come from this live lookup, never from a
  // stored figure, so the panel can never go stale — see
  // BusinessClarityPanel's own doc comment. Fails closed: if the route's
  // Business observation ever stops being current/publishable,
  // businessFareRange is null and the whole panel simply doesn't render,
  // rather than showing a broken or invented fare.
  const businessFareRange = route.businessClarity ? getFareRangeSummary(route.slug, 'Business', nowIso) : null;
  // Route Page Simplification Phase 1 (25 Aug 2026) — the audit's single P0.
  // When BOTH fare blocks render and they cover DIFFERENT travel-date
  // windows, the page says so once, at the point of contrast. Derived
  // entirely from date strings both components already render (see
  // lib/fare-window-reconciliation.ts); returns null — and therefore renders
  // nothing at all — for every route without a second fare block, and for a
  // second block whose window matches the first. Journey Choice itself is
  // read from, never modified.
  const fareWindowReconciliation = deriveFareWindowReconciliation(
    fareSignal.observation,
    journeyChoice ? journeyChoice.lowerFare : null
  );

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
        <HeroBackdrop
          image={(() => { const img = getDestinationImage(dest.slug); return img ? { ...img, alt: '' } : null; })()}
          objectPositionClassName={ROUTE_HERO_FOCAL_POSITION[dest.slug]}
        />
        <div className="relative mx-auto max-w-content px-5 sm:px-8">
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs text-ink-300">
            <Link href="/" className="hover:text-brass-300">Home</Link>
            <span>/</span>
            <Link href={`/airports/${airport.slug}`} className="hover:text-brass-300">{airport.name}</Link>
            <span>/</span>
            <span className="text-ink-200">{dest.city}</span>
          </nav>
          <div className="stagger-in stagger-1 flex animate-fade-up flex-wrap items-center gap-3">
            {/* Presentation-integrity fix: never re-derive label text via a
                local ternary — presentation.statusLabel is the one canonical
                label (see RoutePresentationBase's doc comment), so a new
                status value (e.g. 'service-ended') can never silently fall
                through to the wrong badge. */}
            <Badge variant="dark">{presentation.statusLabel}</Badge>
            {/* Route Intelligence Completion (August 2026, phase 2): a
                quiet dot + label beside the Route Status badge above, never
                a second Badge component — that would read as two competing
                pills for what a visitor would reasonably assume is one
                fact. This is a genuinely separate fact (how much JetStash
                has researched this route, not whether it's direct), so it
                gets its own small, quieter treatment instead. */}
            <span className="flex items-center gap-1.5 text-xs text-ink-300">
              <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${routeIntelligence.dotClassName}`} aria-hidden="true" />
              {routeIntelligence.label}
            </span>
          </div>
          <h1 className="stagger-in stagger-2 mt-4 animate-fade-up font-display text-4xl leading-[1.05] tracking-tight text-sand-50 sm:text-5xl">
            {airport.city} to {dest.city}
          </h1>
          {/* Verification-pending leakage fix: route.intro must never render
              raw here — presentation.summary is centrally-authored neutral
              copy for a pending route, so this never depends on an intro
              string being hedged correctly by whoever added the route. */}
          <p className="stagger-in stagger-3 mt-4 max-w-2xl animate-fade-up text-lg leading-relaxed text-ink-300">{presentation.summary}</p>

          <div className="stagger-in stagger-4 mt-7 flex animate-fade-up flex-wrap gap-6">
            {presentation.status === 'unverified' ? (
              // Premium presentation fix: one concise notice instead of
              // three stat rows carrying a duplicated placeholder sentence.
              <div className="flex max-w-lg items-start gap-3 rounded-md border border-white/15 bg-white/5 px-4 py-3.5">
                <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brass-300" strokeWidth={2} />
                <p className="text-sm leading-relaxed text-ink-200">
                  Flight time, frequency and airline aren&apos;t published for this route until they&apos;re independently confirmed.
                </p>
              </div>
            ) : presentation.status === 'service-ended' ? (
              <div className="flex max-w-lg items-start gap-3 rounded-md border border-white/15 bg-white/5 px-4 py-3.5">
                <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-terracotta-300" strokeWidth={2} />
                <p className="text-sm leading-relaxed text-ink-200">
                  A previously-verified direct service on this route has ended. Flight time, frequency and airline facts from that service are no longer shown — check current options directly with airlines.
                </p>
              </div>
            ) : (
              <>
                <RouteStat icon={<Clock className="h-4 w-4" strokeWidth={2} />} label="Flight time" value={presentation.flightTime} />
                <RouteStat icon={<Calendar className="h-4 w-4" strokeWidth={2} />} label="Frequency" value={presentation.frequency} />
                {presentationAirlines.length > 0 && (
                  <RouteStat icon={<Plane className="h-4 w-4" strokeWidth={2} />} label="Airlines" value={presentationAirlines.map((a) => a.name).join(', ')} />
                )}
              </>
            )}
          </div>

          {/* Route Page Scanability fix (21 Aug 2026): the hero's own Trip.com
              CTA, its "check the itinerary/baggage" caption, and the
              continuation cue that only existed to bridge to that CTA are all
              removed here — see tests/route-hero-scanability.test.ts. Fare
              Signal (the very next section, unconditionally) is now the one
              place the Trip.com action and its full caveat live; a route
              with no safe handoff gets the exact fail-closed sentence there
              instead of here — see components/route/fare-signal.tsx's
              NoCtaFallback. This is a presentation-only change: no Trip.com
              URL, fare data or route evidence is touched. WhatsApp Share
              keeps its exact existing condition (it already moves into the
              Book-By panel when one exists, so it isn't duplicated there
              either) — only its layout position changes, to a standalone row
              now that it no longer shares a flex row with the removed CTA. */}
          {!bookBySnapshot && (
            <div className="mt-7">
              <WhatsAppShareButton
                url={`${siteConfig.url}/routes/${route.slug}`}
                text={presentation.shareText}
                route={route.slug}
                source="route-hero"
              />
            </div>
          )}
        </div>
      </section>

      <section className="bg-white py-8 sm:py-10">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          {/* Route Page Journey Clarity System (20 Aug 2026): routeStatusLabel
              and routeAirlineLabel are the same presentation.statusLabel and
              presentationAirlines values already rendered in the hero above
              (never re-derived), passed through so FareSignal can name the
              route's own verified service when it differs from the tracked
              fare's itinerary — see components/route/fare-signal.tsx's
              RouteVsFareCallout doc comment. routeServiceConnections (added
              22 Aug 2026, Connecting Journey Structure) is route.ts's own
              structured field, passed straight through with no
              re-derivation — undefined for almost every route, which is
              exactly when the new routeServiceFareMismatch() comparison
              must stay silent. */}
          <FareSignal
            signal={fareSignal}
            tripComUrl={tripComUrl}
            routeSlug={route.slug}
            routeDirectness={presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.status : null}
            routeStatusLabel={presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.statusLabel : null}
            routeAirlineLabel={presentationAirlines.length > 0 ? presentationAirlines.map((a) => a.name).join(', ') : null}
            routeServiceConnections={route.routeServiceConnections ?? null}
            standoutFare={standoutFare}
          />
        </div>
      </section>

      {/* Route Status V1 — renders only for ledger-managed routes
          (routeStatusCopy is null otherwise). Every word here is sourced:
          a positive or transition-boundary variant always carries at least
          one resolved citation, and every rendered service notice carries
          its OWN validated citations too (see getRouteStatusCopy's
          fail-closed contract in lib/route-status-copy.ts) — this panel
          never renders a status claim, or a per-airline notice, without its
          evidence directly beside it. A plain 'verified-direct' result with
          no service notices renders no panel at all — nothing unusual to
          disclose beyond the hero's own "Direct" badge. Final audit fix:
          'verified-direct' WITH a non-empty serviceNotices list (e.g.
          another airline's service is ended/in transition while this one
          stays verified) now renders too — it was previously excluded here
          entirely, silently dropping those notices from the public page. */}
      {routeStatusCopy &&
        (routeStatusCopy.kind === 'withdrawal-announced' ||
          routeStatusCopy.kind === 'service-ended' ||
          routeStatusCopy.kind === 'transition-boundary-pending' ||
          (routeStatusCopy.kind === 'verified-direct' && routeStatusCopy.serviceNotices.length > 0)) && (
          <section className="bg-terracotta-50 py-8 sm:py-10">
            <div className="mx-auto max-w-content px-5 sm:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-terracotta-100 text-terracotta-700">
                  <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="font-display text-lg text-ink-900">
                    {routeStatusCopy.kind === 'verified-direct' ? 'Route status' : routeStatusCopy.badgeLabel}
                  </h2>
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-700">
                    {routeStatusCopy.kind === 'transition-boundary-pending'
                      ? routeStatusCopy.body
                      : routeStatusCopy.kind === 'verified-direct'
                        ? 'This route is currently verified direct. One airline on this route has a separate update below.'
                        : routeStatusCopy.explanation}
                  </p>
                  {routeStatusCopy.kind !== 'transition-boundary-pending' && routeStatusCopy.serviceNotices.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-600">
                      {routeStatusCopy.serviceNotices.map((notice) => (
                        <li key={`${notice.airlineSlug}-${notice.kind}`}>
                          <p>
                            {notice.airlineName}: {notice.kind === 'status-reverification-pending'
                              ? `announced change date passed, not yet reverified (from ${formatRouteStatusDate(notice.effectiveFrom)})`
                              : notice.kind === 'service-ended'
                                ? `direct service ended (from ${formatRouteStatusDate(notice.effectiveFrom)})`
                                : `withdrawal announced, with effect from ${formatRouteStatusDate(notice.effectiveFrom)}`}
                          </p>
                          <ul className="mt-0.5 flex flex-col gap-0.5 text-xs text-ink-500">
                            {notice.citations.map((citation, i) => (
                              <li key={i}>
                                Source: {citation.url ? (
                                  <a href={citation.url} target="_blank" rel="noopener noreferrer" className="underline decoration-terracotta-300 underline-offset-2 hover:text-terracotta-700">
                                    {citation.publisher}
                                  </a>
                                ) : (
                                  citation.publisher
                                )}
                                {citation.accessedAt ? ` · checked ${formatRouteStatusDate(citation.accessedAt)}` : ''}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                  {routeStatusCopy.kind !== 'verified-direct' && (
                    <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-500">
                      {routeStatusCopy.citations.map((citation, i) => (
                        <li key={i}>
                          Source: {citation.url ? (
                            <a href={citation.url} target="_blank" rel="noopener noreferrer" className="underline decoration-terracotta-300 underline-offset-2 hover:text-terracotta-700">
                              {citation.publisher}
                            </a>
                          ) : (
                            citation.publisher
                          )}
                          {citation.accessedAt ? ` · checked ${formatRouteStatusDate(citation.accessedAt)}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
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

      {bookBySnapshot ? (
        <section className="bg-sand-50 py-10 sm:py-12">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <RouteReadinessPanel
              initialSnapshot={bookBySnapshot}
              initialEngineSnapshot={engineSnapshot}
              destinationSlug={dest.slug}
              airportSlug={airport.slug}
            />
          </div>
        </section>
      ) : (
        TRAVEL_READY_SUPPORTED_COUNTRIES.includes(dest.country) && (
          <section className="bg-sand-50 py-10 sm:py-12">
            <div className="mx-auto max-w-content px-5 sm:px-8">
              <TravelReadyCheck defaultDestinationSlug={dest.slug} airportSlugForCta={airport.slug} />
            </div>
          </section>
        )
      )}

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              {/* Verification-pending leakage fix: booking-window guidance —
                  route.bookingWindowNote and any logged booking-window
                  records — is a route-specific factual claim about when to
                  book *this* service. It must never render for a route
                  whose own service isn't independently evidenced, and this
                  is structural (canShowBookingGuidance), not a per-route
                  copy edit — it applies to any future pending route too. */}
              {presentation.canShowBookingGuidance ? (
                <>
                  {/* When Book-By Countdown already covers this route's structured guidance above,
                      this section becomes the supporting evidence for that recommendation rather than
                      a second, competing "when to book" narrative restating the same facts. */}
                  {evidenceReframe ? (
                    <>
                      <h2 className="font-display text-2xl text-ink-900">The evidence behind that guidance</h2>
                      <p className="mt-4 leading-relaxed text-ink-600">
                        The exact booking window is in the panel above — here&apos;s the underlying pattern it&apos;s drawn from.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="font-display text-2xl text-ink-900">When to book this route</h2>
                      <p className="mt-4 leading-relaxed text-ink-600">{route.bookingWindowNote}</p>
                    </>
                  )}
                  {bookingWindows.length > 0 && (
                    <div className="mt-7">
                      <BookingWindowPanel windows={bookingWindows} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2 className="font-display text-2xl text-ink-900">Booking guidance not yet available</h2>
                  <p className="mt-4 leading-relaxed text-ink-600">
                    We don&apos;t publish booking-window timing for a route until its service is independently confirmed. Check directly with airlines serving {airport.city} for the current position.
                  </p>
                </>
              )}
            </div>
            {/* Verification-pending leakage fix: peak-period guidance
                carries an implicit "fares on this route behave like this"
                claim, ruled out by the same reasoning as booking guidance —
                canShowPeakPeriods is false for every pending route. */}
            {presentation.canShowPeakPeriods && peakPeriods.length > 0 && (
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
                  Demand — and often price — tends to build in the final 3–4 weeks before these periods. Consider booking earlier if your dates are fixed. Planning guidance, not a fare prediction.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Verification-pending leakage fix: pending must never be mapped to
          the 'connecting' branch here — canShowConnectingAlternative is
          false for every pending route, regardless of what
          route.connectingAlternative happens to contain, so stops/hubs/
          journey-time/airline facts for an unevidenced route can never
          render. This is its own gate, not derived from route.isDirect. */}
      {presentation.canShowConnectingAlternative && route.connectingAlternative && (
        <section className="bg-sand-50 py-14 sm:py-16">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">
              {presentation.status === 'direct' ? 'The realistic 1-stop alternative' : 'How this connecting route usually works'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-500">
              {presentation.status === 'direct'
                ? 'Worth knowing even if you book the direct flight. Useful as a fallback, and this is what the route looks like once the direct service is unavailable.'
                : 'No confirmed direct service currently exists on this route. Here is the realistic connecting pattern most travellers use.'}
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

      {/* Destination-scoped family guidance must not render on route pages — see the "More about {dest.city}" card below for the link to it. */}

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
                // Verification-pending leakage fix: comparison cards must go
                // through the same reusable gate as the route's own page —
                // never read altRoute.flightTime or its airlines raw. Uses
                // the Route Status V1 adapter so a ledger-managed alternative
                // route (e.g. Manchester–Delhi shown from the Mumbai page)
                // never shows stale 'Direct' facts past its own boundary.
                const altPresentation = getEffectiveRoutePresentation(altRoute, routeStatusEvents, nowIso);
                const altAirlines = getAirlinesBySlugs(altPresentation.airlineSlugs);
                return (
                  <Link
                    key={altRoute.slug}
                    href={`/routes/${altRoute.slug}`}
                    className="group flex flex-col rounded-md border border-ink-100 bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-card-hover"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {altPresentation.statusLabel}
                    </span>
                    <h3 className="mt-1.5 font-display text-xl text-ink-900">{altAirport.city} → {dest.city}</h3>
                    <p className="mt-1 text-sm text-ink-500">
                      {altPresentation.status === 'unverified'
                        ? 'Verification in progress — check directly before booking'
                        : altPresentation.status === 'service-ended'
                          ? 'Direct service ended — check current options before booking'
                          : altAirlines.length > 0
                            ? `${altPresentation.flightTime} · ${altAirlines.map((a) => a.name).join(', ')}`
                            : altPresentation.flightTime}
                    </p>
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
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">{fareSectionCopy.heading}</h2>
          {fareSectionCopy.caption && <p className="mt-2 max-w-xl text-sm text-ink-500">{fareSectionCopy.caption}</p>}
          {journeyChoice && fareWindowReconciliation && (
            <div className="mt-8">
              <FareWindowReconciliationNote reconciliation={fareWindowReconciliation} />
            </div>
          )}
          {journeyChoice && (
            <div className={fareWindowReconciliation ? 'mt-4' : 'mt-8'}>
              <JourneyChoice
                journeyChoice={journeyChoice}
                routeLabel={`${airport.city} to ${dest.city}`}
                routeSlug={route.slug}
                tripComHandoff={journeyChoiceTripComHandoff}
                routeDirectness={presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.status : null}
                routeStatusLabel={presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.statusLabel : null}
                routeAirlineLabel={presentationAirlines.length > 0 ? presentationAirlines.map((a) => a.name).join(', ') : null}
              />
            </div>
          )}
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
          ) : shouldShowNoFareFallback(fareSignal) ? (
            <div className="mt-8">
              <NoFareFallback cityLabel={`${airport.city} to ${dest.city}`} routeSlug={route.slug} />
            </div>
          ) : null}
          {/* SEO Domination Batch 1B (23 Aug 2026) — sits directly below the
              Business Deal card it's about, only when a genuine current
              Business observation backs it (businessFareRange is null
              otherwise; see its own computation above). */}
          {route.businessClarity && businessFareRange && (
            <BusinessClarityPanel clarity={route.businessClarity} fareRange={businessFareRange} />
          )}
          {/* id anchors the Book-By panel's "Watch this route" CTA; the global
              scroll-padding-top keeps it clear of the sticky header. */}
          <div id="route-watch" className="mt-8 max-w-xl">
            <RouteWatchForm defaultAirportSlug={airport.slug} defaultDestinationSlug={dest.slug} />
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

      {/* Airport notes are airport-scoped editorial content, not route evidence — same leakage class as destination familyVisitContent. A neutral link keeps discoverability without importing airport-specific claims onto a route page. */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="flex flex-col gap-4 rounded-md border border-ink-100 bg-sand-50 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl text-ink-900">Flying from {airport.city}?</h2>
              <p className="mt-1 text-sm text-ink-500">Terminal, transport and practical information for your departure airport.</p>
            </div>
            <Link
              href={`/airports/${airport.slug}`}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-5 py-3 text-sm font-semibold text-sand-50 transition-all hover:bg-ink-700 active:scale-[0.985]"
            >
              View {airport.name} guide
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </div>
        </div>
      </section>

      {communityNotes.length > 0 && (
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
      )}

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
