import Link from 'next/link';
import { Deal, DealCabin, formatChecked, getDealFareDirectnessLabel, getDealAirlineLabel, isBundledProductDeal } from '@/data/deals';
import { getRouteByAirportAndDestination } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getFareRangeSummary } from '@/data/fare-observations';
import { getTripComFlightHandoffUrl, PROVIDER_REL } from '@/lib/booking-providers';
import { getFareFreshnessState, daysBetweenIso, OBSERVATION_STALE_DAYS } from '@/lib/freshness-thresholds';
import { Plane, ArrowUpRight } from 'lucide-react';
import { Badge } from './badge';
import { DestinationVisual } from './destination-visual';
import { TrackedOutboundLink } from './tracked-outbound-link';
import { AffiliateLinkDisclosure } from './affiliate-link-disclosure';

const cabinLabel: Record<DealCabin, string> = {
  Economy: 'Economy',
  'Premium Economy': 'Premium Economy',
  Business: 'Business class',
};

export function DealCard({ deal, nowIso }: { deal: Deal; nowIso?: string }) {
  // Optional injection seam for deterministic tests only — production
  // callers pass nothing and get the exact prior behaviour (today's real
  // date). Never pass an explicit value from application code.
  const effectiveNowIso = nowIso ?? new Date().toISOString().slice(0, 10);
  const matchedRoute = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
  // The only source of truth for what this card shows as a price: a real
  // logged range/check, or nothing at all — never a hardcoded figure that
  // can go stale. See data/deals.ts's header comment. Never derived for a
  // package/Umrah deal (isBundledProductDeal) — the archive logs flight-only
  // fares, which are not evidence for a bundled product's price; see
  // isBundledProductDeal's doc comment in data/deals.ts.
  const range = matchedRoute && !isBundledProductDeal(deal) ? getFareRangeSummary(matchedRoute.slug, deal.cabin, effectiveNowIso) : null;
  // A duration belongs to a specific airport-to-destination route, never to
  // a destination in general. This presentation removes duration facts when
  // the route is unverified or the service has ended.
  const presentation = matchedRoute ? getEffectiveRoutePresentation(matchedRoute, routeStatusEvents, effectiveNowIso) : undefined;
  // Never fall back to destination flight summaries: they can name a UK
  // airport other than the card's actual departure airport.
  const flightTime = presentation?.flightTime;
  // Presentation-integrity fix: never re-derive label text via a local
  // ternary — presentation.statusLabel is the one canonical label (see
  // RoutePresentationBase's doc comment in data/routes.ts), so a new status
  // value (e.g. 'service-ended') can never silently fall through as
  // `undefined` here.
  const directness = presentation?.statusLabel;
  // Truth Reset (July 2026): the top-right badge must never assert
  // directness independently of the verification system — a category tag
  // (Umrah package, City break) always takes precedence when present.
  // Directness-badge fix (August 2026, product-truth review of PR #74):
  // this badge sits directly above a specific priced fare card, so it must
  // describe THAT FARE's own itinerary, never just the wider route —
  // getDealFareDirectnessLabel() is the one gate for that combination; see
  // its doc comment in data/deals.ts for the full resolution order. Never
  // use the route-only getDealDirectnessLabel() here directly. See TR-009.
  const topBadge = deal.categoryTag ?? getDealFareDirectnessLabel(deal, effectiveNowIso);
  // Truth Reset (final correction): route directness and airline attribution
  // are separate claims — a verified-direct route never automatically
  // verifies the specific airline named on the card. `deal.airline` must
  // never render directly; the publicly shown label is always computed live
  // via getDealAirlineLabel(), which returns undefined (nothing shown) with
  // no matching Route record, or 'Verification pending' when that exact
  // airline isn't currently verified on the matched route. See TR-010.
  const airlineLabel = getDealAirlineLabel(deal, effectiveNowIso);
  const airlineFactLabel = airlineLabel === 'Verification pending'
    ? 'Airline: verification pending'
    : airlineLabel
      ? `Airline: ${airlineLabel}`
      : null;
  const routeFactLabel = directness ? `Route: ${directness}` : null;
  const freshness = range ? getFareFreshnessState(daysBetweenIso(range.latestDate, effectiveNowIso)) : null;
  const isStale = freshness === 'stale';
  // The airline named by a Deal is separate curation data. Once a fare is
  // shown, its attribution must come only from the observation(s) that
  // produced that number — never from the deal's generic airline label.
  const fareSourceLabel = range
    ? range.sources.length === 1
      ? `Fare checked with ${range.sources[0]}`
      : `Fare checks with ${range.sources.join(' and ')}`
    : null;
  // Fail-closed by construction: null for any route not in booking-providers.ts's
  // dashboard-verified map — never a generic Trip.com fallback.
  const tripComUrl = matchedRoute ? getTripComFlightHandoffUrl(matchedRoute.slug) : null;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-md border border-ink-100 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
      <div className="relative h-44 w-full overflow-hidden">
        <DestinationVisual
          slug={deal.toDestinationSlug}
          label={deal.toCity}
          sublabel={deal.toCountry}
          className="transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {topBadge && (
          <div className="absolute right-4 top-4">
            <Badge variant={deal.cabin === 'Business' ? 'terracotta' : 'brass'}>{topBadge}</Badge>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
          <Plane className="h-3.5 w-3.5" strokeWidth={2.25} />
          {deal.fromCity} → {deal.toCity}
        </h3>
        <span className="text-xs font-medium text-ink-500">{cabinLabel[deal.cabin]}</span>
      </div>

      <div className="flex flex-1 flex-col px-5 py-5">
        {range ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className={`font-display text-3xl tracking-tight tabular-nums ${isStale ? 'text-ink-500' : 'text-ink-900'}`}>
                {range.count > 1
                  ? `£${range.min.toLocaleString('en-GB')}–£${range.max.toLocaleString('en-GB')}`
                  : `£${range.min.toLocaleString('en-GB')}`}
              </span>
              <span className="text-sm text-ink-400">{range.priceNote}</span>
            </div>
            {fareSourceLabel && <p className="mt-1 text-sm font-medium text-ink-500">{fareSourceLabel}</p>}
            {/* Route/fare reconciliation (Tier-1 Commercial Readiness QA
                follow-up, September 2026): the top-right badge above already
                states THIS FARE's own directness (via
                getDealFareDirectnessLabel — e.g. "Connecting" on a Gulf Air
                fare found under a route whose own verified service is
                direct), but until this fix nothing in the card's own text
                said so when a real price was shown — only the no-fare
                branch below rendered routeFactLabel/airlineFactLabel, even
                though both were already computed unconditionally above.
                Gated on a genuine mismatch (never shown when the fare
                already agrees with the route, so cards where there's
                nothing to reconcile stay exactly as they were) — mirrors
                the same distinction fare-signal.tsx's RouteVsFareCallout
                already draws elsewhere on the route page itself, reusing
                the already-computed local values rather than a new
                component or a new derivation. */}
            {directness && range.observedDirectness && range.observedDirectness !== presentation?.status && (
              <p className="mt-1 text-xs text-ink-400">
                {airlineFactLabel ? `${airlineFactLabel} · ${routeFactLabel}` : routeFactLabel}. This fare is a different, {range.observedDirectness} journey.
              </p>
            )}

            <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
              <span className={`h-1.5 w-1.5 rounded-full ${isStale ? 'bg-ink-300' : 'bg-brass-400'}`} />
              {range.count > 1
                ? `From ${range.count} checks since ${formatChecked(range.earliestDate)}`
                : `One check, ${formatChecked(range.latestDate)}`}
            </div>
            {isStale && (
              <p className="mt-1 text-xs text-ink-400">
                This check is over {Math.floor(OBSERVATION_STALE_DAYS / 30)} months old — check live price for anything current.
              </p>
            )}
          </>
        ) : (
          <>
            {(presentation?.status === 'unverified' || presentation?.status === 'service-ended' || flightTime) && (
              <p className="font-display text-xl leading-snug text-ink-900">
                {presentation?.status === 'unverified' || presentation?.status === 'service-ended' ? presentation.statusLabel : flightTime}
              </p>
            )}
            {presentation?.status !== 'unverified' && presentation?.status !== 'service-ended' &&
              (() => {
                // Airline verification and route directness are independent
                // facts. Name both explicitly so "verification pending" can
                // never appear to qualify an already-verified Direct or
                // Connecting route state.
                const parts = [airlineFactLabel, routeFactLabel].filter(Boolean) as string[];
                return parts.length > 0 ? <p className="mt-1 text-sm font-medium text-ink-500">{parts.join(' · ')}</p> : null;
              })()}

            <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
              <span className="h-1.5 w-1.5 rounded-full bg-ink-300" />
              {isBundledProductDeal(deal)
                // Antalya fare/package truth fix (PR #144, August 2026): a
                // package/Umrah deal's range is ALWAYS null here — see
                // isBundledProductDeal's own doc comment above — never
                // because no fare checks exist for the underlying route.
                // Birmingham-Antalya (obs-bhx-ayt-economy-20260813-8w-v1) is
                // the proof case: a genuinely current, fresh flight fare is
                // logged and shown elsewhere on the same destination page
                // (DestinationFlightGuides' fareStatusLabel), while this
                // exact card previously said "No fare checks logged yet" —
                // false for the route, and the wrong noun for a package
                // regardless. The missing evidence is specifically a
                // package price, which the archive has no field to record
                // yet (see data/fare-observations.ts's package-price
                // entries note in isBundledProductDeal's comment) — never a
                // claim that no flight fare checks exist.
                ? 'No package price tracked yet.'
                // Participant 1 defect follow-up (21 Aug 2026): this used to
                // read as a bare, cabin-agnostic "No fare checks logged
                // yet" — on a route where a *different* cabin's card (or the
                // route page's own cabin-agnostic top Fare Signal) shows a
                // real price, a reader has no reason to assume this
                // sentence is scoped to just this card's cabin, and a real
                // participant read it as contradicting a fare they'd just
                // seen. Naming the cabin makes the sentence correct and
                // self-contained on its own — derived from the card's own
                // already-trusted `deal.cabin` via the same cabinLabel map
                // the header row above already uses, never a new or
                // route-specific string.
                : `No ${cabinLabel[deal.cabin]} fare checks logged yet — check the live price below`}
            </div>
            {matchedRoute && (
              <Link
                href={`/routes/${matchedRoute.slug}`}
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-ink-400 transition-colors hover:text-ink-600"
              >
                {presentation?.status === 'unverified' ? 'More on the route guide' : 'Booking-window guidance on the route guide'}
                <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} />
              </Link>
            )}
          </>
        )}
        {/* Hub-link root fix (SEO Domination Batch 1B, 23 Aug 2026): the
            `range` branch above only ever gave a route-guide path via
            range.count > 1's plain (non-link) paragraph below — a card
            with exactly one tracked observation (every brand-new
            -baseline-v1 series, e.g. the three new Business Fare Evidence
            Batch 1 cards) fell into neither that condition nor the
            no-range branch's own Link a few lines up, and silently lost
            its route-guide path entirely. Confirmed via the real data
            (not assumed): 5 live cards affected today —
            man-lhe-business, lhr-business-lhe, lhr-doh-business,
            man-khi-economy, lba-isb-economy — see
            tests/dealcard-route-guide-link-fix.test.ts, which derives that
            list from getFareRangeSummary()/getRouteByAirportAndDestination()
            rather than hardcoding it, so it stays correct as the archive
            grows.
            Deliberately scoped to ONLY this case. An earlier version of
            this fix also turned the range.count > 1 paragraph below into a
            real link — founder review (23 Aug 2026, PR #168) correctly
            flagged that as an undisclosed, much larger blast radius (29
            live cards today, none of them related to this batch's actual
            Business-evidence subject) beyond the approved scope ("fix the
            missing route-guide link on all 5 single-observation
            DealCards"), so it was reverted — the count > 1 paragraph stays
            plain text, exactly as it was before this fix, and is left for
            a separate, explicitly-scoped decision if it's wanted later. */}
        {matchedRoute && range && range.count === 1 && (
          <Link
            href={`/routes/${matchedRoute.slug}`}
            className="mt-1.5 inline-flex items-center gap-1 text-xs text-ink-400 transition-colors hover:text-ink-600"
          >
            View route guide
            <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} />
          </Link>
        )}
        {range && range.count > 1 && (
          <p className="mt-1.5 text-xs text-ink-400">See the full history on the route guide.</p>
        )}

        {tripComUrl ? (
          <>
            <TrackedOutboundLink
              event="tripcom_click"
              properties={{ route: matchedRoute!.slug, source: 'deal-card' }}
              href={tripComUrl}
              target="_blank"
              rel={PROVIDER_REL}
              className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-4 py-3 text-sm font-semibold text-sand-50 transition-all duration-200 hover:bg-brass-600 active:scale-[0.985]"
            >
              Compare flights on Trip.com
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </TrackedOutboundLink>
            <AffiliateLinkDisclosure providerName="Trip.com" className="mt-2 text-center text-ink-400">
              Check the itinerary, baggage allowance and booking terms before paying.
            </AffiliateLinkDisclosure>
          </>
        ) : (
          // Fail-closed, deliberately understated — no CTA, no generic Trip.com link.
          <p className="mt-5 text-center text-xs text-ink-400">Direct flight comparison is not available for this airport yet.</p>
        )}
      </div>
    </article>
  );
}
