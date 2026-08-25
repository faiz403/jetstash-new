import { ArrowUpRight, Plane } from 'lucide-react';
import type { Destination } from '@/data/destinations';
import { formatRouteStatusDate } from '@/lib/route-status-copy';
import {
  getHolidayFlightHandoffStatuses,
  getPublicHotelExamples,
  getStayAreaCopy,
  HOTEL_PROVIDER_REL,
} from '@/lib/holiday-intelligence';
import { TrackedOutboundLink } from '@/components/ui/tracked-outbound-link';
import { AffiliateLinkDisclosure } from '@/components/ui/affiliate-link-disclosure';

/**
 * The one Holiday Intelligence component, shared by every destination that
 * has it — Antalya (the original pilot) and the Hotel Intelligence +
 * Monetisation Expansion destinations alike (August 2026 consolidation).
 *
 * Antalya's stay-area copy (lib/hotel-stay-areas.ts) deliberately carries
 * `areas: []`, so the "Areas to consider" block below never renders for
 * Antalya — this is a pure refactor, not a content change: Antalya's public
 * page keeps its exact pre-consolidation heading, intro, property ordering,
 * curated fact selection (lib/holiday-intelligence.ts), CTAs and analytics
 * source string. Every layout class is branched on `hasAreas` specifically
 * so Antalya's rendered markup — not just its copy — is byte-identical to
 * before.
 */

interface HolidayIntelligenceProps {
  destination: Destination;
  nowIso: string;
}

export function HolidayIntelligence({ destination, nowIso }: HolidayIntelligenceProps) {
  const stayAreaCopy = getStayAreaCopy(destination.slug);
  const examples = getPublicHotelExamples(destination.slug);
  if (!stayAreaCopy || examples.length === 0) return null;

  const hasAreas = stayAreaCopy.areas.length > 0;
  // Antalya predates per-destination analytics source strings — preserved
  // exactly rather than switched to the newer shared 'holiday-intelligence'
  // value, so existing Antalya analytics history stays continuous.
  const analyticsSource = destination.slug === 'antalya' ? 'antalya-holiday-intelligence' : 'holiday-intelligence';

  const flightStatuses = getHolidayFlightHandoffStatuses(destination, nowIso);
  const flightHandoffs = flightStatuses.filter((entry): entry is typeof entry & { href: string } => entry.status === 'verified' && entry.href !== null);
  const blockedOrigins = flightStatuses.filter((entry) => entry.status === 'blocked');

  return (
    <section aria-labelledby={`${destination.slug}-holiday-intelligence-heading`} className="mt-12 rounded-md border border-ink-100 bg-sand-50 p-5 sm:mt-14 sm:p-7">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-700">{destination.city} holiday intelligence</p>
        <h3 id={`${destination.slug}-holiday-intelligence-heading`} className="mt-2 font-display text-2xl text-ink-900 sm:text-3xl">{stayAreaCopy.heading}</h3>
        {stayAreaCopy.gatewayNote && <p className="mt-3 leading-relaxed text-ink-600">{stayAreaCopy.gatewayNote}</p>}
        <p className="mt-3 leading-relaxed text-ink-600">{stayAreaCopy.intro}</p>
        <p className="mt-3 text-xs leading-relaxed text-ink-500">
          Checked {formatRouteStatusDate(examples[0]?.checkedDate ?? nowIso.slice(0, 10))}. Factual examples only, not a ranking or recommendation. Prices, availability and package inclusions are not shown.
        </p>
      </div>

      {hasAreas && (
        <div className="mt-6 border-y border-ink-200 py-5">
          <h4 className="font-semibold text-ink-900">Areas to consider</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {stayAreaCopy.areas.map((area) => (
              <article key={area.name} className="min-w-0 rounded-sm border border-ink-200 bg-white p-4">
                <p className="text-sm font-semibold text-ink-900">{area.name}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{area.context}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      <div className={hasAreas ? 'border-b border-ink-200 pb-5' : 'mt-6 border-y border-ink-200 py-5'}>
        <div className="flex items-start gap-3">
          <Plane className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" strokeWidth={2} />
          <div className="min-w-0">
            <h4 className="font-semibold text-ink-900">Flights to {destination.city}</h4>
            {flightHandoffs.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {flightHandoffs.map((handoff) => (
                  <article key={handoff.airportSlug} className="min-w-0 rounded-sm border border-ink-200 bg-white p-4">
                    <p className="text-sm font-semibold text-ink-900">{handoff.airportName} → {destination.city}</p>
                    <TrackedOutboundLink
                      event="tripcom_click"
                      properties={{ route: `${handoff.airportSlug}-${destination.slug}`, source: analyticsSource }}
                      href={handoff.href}
                      target="_blank"
                      rel="nofollow sponsored noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-sm bg-ink-900 px-4 py-2.5 text-sm font-semibold text-sand-50 transition-colors hover:bg-brass-600"
                    >
                      Check live flights on Trip.com
                      <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                    </TrackedOutboundLink>
                    <AffiliateLinkDisclosure providerName="Trip.com" className="mt-2 text-ink-500">
                      Check the itinerary, dates and booking terms before paying.
                    </AffiliateLinkDisclosure>
                  </article>
                ))}
              </div>
            ) : flightStatuses.length === 0 ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-600">Flight actions are shown on the individual {destination.city} route guides above.</p>
            ) : null}
            {blockedOrigins.length > 0 && <p className="mt-2 text-xs leading-relaxed text-ink-500">No exact dateless Trip.com handoff was generated for: {blockedOrigins.map((entry) => entry.airportName).join(', ')}. Those origins remain blocked rather than using a generic link.</p>}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {examples.map((example) => (
          <article key={example.hotelName} className="min-w-0 rounded-sm border border-ink-200 bg-white p-4 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Checked property example</p>
            <h4 className="mt-2 break-words font-display text-xl text-ink-900">{example.hotelName}</h4>
            <p className="mt-3 text-sm font-semibold text-brass-700">{example.operationalArea}</p>
            <p className="mt-1 text-xs text-ink-500">{example.operationalSubArea}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-600">{example.locationNote}</p>
            {example.factualSignals.length > 0 && (
              <div className="mt-4 border-t border-ink-100 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Evidence shows</p>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-600">
                  {example.factualSignals.map((signal) => <li key={signal}>• {signal}</li>)}
                </ul>
              </div>
            )}
            <p className="mt-4 text-xs text-ink-400">Provider area label: {example.providerArea}</p>
            {example.bookingUrl && (
              <>
                <TrackedOutboundLink
                  event="tripcom_hotel_click"
                  properties={{ route: destination.slug, source: analyticsSource }}
                  href={example.bookingUrl}
                  target="_blank"
                  rel={HOTEL_PROVIDER_REL}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-sm bg-ink-900 px-4 py-2.5 text-sm font-semibold text-sand-50 transition-colors hover:bg-brass-600"
                >
                  Check current price on Trip.com
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                </TrackedOutboundLink>
                <AffiliateLinkDisclosure providerName="Trip.com" className="mt-2 text-ink-500">
                  Check the property, dates and booking terms before paying.
                </AffiliateLinkDisclosure>
              </>
            )}
          </article>
        ))}
      </div>

      <p className="mt-5 text-xs leading-relaxed text-ink-500">
        {hasAreas
          ? 'This section explains area trade-offs and evidenced property context. It does not sell a package or claim that one area or property is right for every traveller.'
          : 'This section explains location and evidenced property context. It does not sell a package or claim that one area or property is right for every traveller.'}
      </p>
    </section>
  );
}
