import { ArrowUpRight, BellRing } from 'lucide-react';
import type { RoutePresentation } from '@/data/routes';
import type { JourneyChoice as JourneyChoiceData } from '@/lib/journey-choice';
import type { FareSignal as FareSignalData } from '@/lib/fare-signal';
import { formatDate, checkedDateRange, routeServiceNote } from '@/components/route/journey-choice';
import { formatChecked } from '@/data/deals';
import { PROVIDER_REL, TRIPCOM_FRESH_SEARCH_NOTE } from '@/lib/booking-providers';
import { JOURNEY_CHOICE_DATED_HANDOFF_NOTE, type JourneyChoiceTripComHandoff } from '@/lib/tripcom-dated-handoff';
import { TrackedOutboundLink } from '@/components/ui/tracked-outbound-link';
import { AffiliateLinkDisclosure } from '@/components/ui/affiliate-link-disclosure';

/**
 * MAN→ISB Flagship Verdict pilot, Phase 1 (September 2026, founder-approved
 * narrow scope — see the approved brief for the full context this file must
 * not exceed).
 *
 * Renders ONLY when journeyChoice is non-null — i.e. only on
 * manchester-islamabad today, the same gate Journey Choice itself already
 * uses (lib/journey-choice-route-adapter.ts's allowlist). This is
 * deliberate: Phase 1 proves one hypothesis on one route, and must not
 * quietly become a degraded "verdict" on the other 87 routes that lack
 * equivalent evidence.
 *
 * CRITICAL EVIDENCE RULE (founder correction, September 2026): Journey
 * Choice and Fare Signal are two DIFFERENT controlled observation sets —
 * different checked dates, different travel-date windows, sometimes a
 * different comparability group entirely (JetStash's "COMPARABLE OR NOT
 * SHOWN" rule). This component NEVER blends them into one implied
 * current-market comparison. Each of the three blocks below (Route Reality,
 * Journey Choice, Recent Fare Checks) states its own dates and stands on
 * its own; nothing here says "the cheapest fares right now" over a figure
 * that comes from Journey Choice's own, separately-dated batch. There is
 * also no aggregated "N checks since DATE, from £X" claim anywhere in this
 * component — that aggregation lives only in FareHistoryPanel, where the
 * per-check dates sit directly beside each figure.
 *
 * Zero new derivation: every fact below is read from values
 * app/routes/[slug]/page.tsx already computes (journeyChoice, fareSignal,
 * presentation, journeyChoiceTripComHandoff) via the exact same helpers
 * Journey Choice's own component uses (formatDate, checkedDateRange,
 * routeServiceNote — all exported from journey-choice.tsx for this reason).
 * This file does not recompute Journey Choice, does not re-derive the
 * route's directness, and does not introduce a second decision engine.
 */

function routeRealityLine(
  routeStatus: RoutePresentation['status'],
  flightTime: string | null,
  routeAirlineLabel: string | null
): string {
  const flightTimeSuffix = flightTime ? ` (${flightTime})` : '';
  if (routeStatus === 'direct') {
    return routeAirlineLabel
      ? `${routeAirlineLabel} flies this route direct${flightTimeSuffix}.`
      : `This route operates direct${flightTimeSuffix}.`;
  }
  if (routeStatus === 'connecting') {
    return routeAirlineLabel
      ? `${routeAirlineLabel} operates this route with a connection${flightTimeSuffix}.`
      : `This route currently operates via a connection${flightTimeSuffix}.`;
  }
  if (routeStatus === 'service-ended') {
    return 'A previously-verified direct service on this route has ended.';
  }
  return "Flight time and airline aren't yet independently confirmed for this route.";
}

/**
 * The 'poor-itinerary-suppressed' and plain-'none' branches below are
 * copied verbatim, word-for-word, from components/route/fare-signal.tsx's
 * own SuppressedFareExplanation and none-state JSX — see
 * tests/route-verdict.test.ts's byte-for-byte comparison against that file,
 * which fails if the two ever drift apart. The 'current'/'recent' branches
 * are NOT a verbatim copy of a single Fare Signal sentence (Fare Signal
 * renders those as several separate elements, not one sentence) — they
 * compose only the same structured fields Fare Signal already renders
 * (price, airline, cabin, checked date) into one compact line, never a new
 * fact.
 */
function fareCheckLine(signal: FareSignalData): string {
  if (signal.state === 'current' && signal.observation) {
    const o = signal.observation;
    return `£${o.price.toLocaleString('en-GB')} return, ${o.airline} · ${o.cabin}, checked ${formatChecked(o.observedDate)}.`;
  }
  if (signal.state === 'recent' && signal.observation) {
    const o = signal.observation;
    return `£${o.price.toLocaleString('en-GB')} return, last tracked ${o.airline} · ${o.cabin}, checked ${formatChecked(o.observedDate)}. Price may have changed.`;
  }
  if (signal.noneReason === 'poor-itinerary-suppressed') {
    return "The latest options involved extra stops or self-transfers, so JetStash isn't showing them as a representative fare.";
  }
  return 'No current fare tracked.';
}

export function RouteVerdict({
  routeLabel,
  routeSlug,
  routeStatus,
  flightTime,
  routeDirectness,
  routeStatusLabel,
  routeAirlineLabel,
  journeyChoice,
  tripComHandoff,
  fareSignal,
}: {
  routeLabel: string;
  routeSlug: string;
  routeStatus: RoutePresentation['status'];
  flightTime: string | null;
  routeDirectness: 'direct' | 'connecting' | null;
  routeStatusLabel: string | null;
  routeAirlineLabel: string | null;
  journeyChoice: JourneyChoiceData;
  tripComHandoff: JourneyChoiceTripComHandoff | null;
  fareSignal: FareSignalData;
}) {
  const { lowerFare, fasterJourney, decision, otherOptions } = journeyChoice;
  const allOptions = [lowerFare, fasterJourney, ...otherOptions];
  const allOptionsConnecting = allOptions.every((option) => option.directness === 'connecting');
  const service = routeServiceNote({ routeDirectness, routeStatusLabel, routeAirlineLabel }, allOptionsConnecting);
  const travelDatesLabel = `${formatDate(lowerFare.departureDate)} to ${formatDate(lowerFare.returnDate)}`;

  return (
    <section aria-labelledby="route-verdict-heading" className="rounded-md border border-ink-200 bg-white p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta-600">JetStash Verdict</p>
      <h2 id="route-verdict-heading" className="mt-1 font-display text-2xl text-ink-900 sm:text-3xl">{routeLabel}</h2>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Route reality</p>
        <p className="mt-1 text-base leading-relaxed text-ink-800">
          {routeRealityLine(routeStatus, flightTime, routeAirlineLabel)}
        </p>
      </div>

      <div className="mt-5 border-t border-ink-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-terracotta-600">Journey Choice</p>
        <p className="mt-1 text-balance font-display text-2xl leading-snug text-ink-900">{decision.sentence}</p>
        <p className="mt-1.5 text-sm text-ink-500">
          Checked {checkedDateRange(allOptions)} for travel {travelDatesLabel}. Not a live price feed.
        </p>
        {service && (
          <div className="mt-2">
            {/* Two separate lines, matching Journey Choice's own rendering of
                this exact value/note pair — never glued into one dash-joined
                sentence. routeServiceNote()'s own wording is already
                context-neutral (see its doc comment), so this doesn't need
                its own separate copy either. */}
            <p className="text-sm font-medium text-ink-900">{service.value}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-600">{service.note}</p>
          </div>
        )}
        {/* Plain text link, no directional icon — this is a same-page
            anchor (#journey-choice-heading, further down this exact page),
            never an external destination, so it must not carry the
            ArrowUpRight glyph the site's outbound/external links use
            elsewhere. Matches fare-signal.tsx's own in-page "See recent
            fare checks" link (#fare-history), which is plain text with no
            icon for the same reason. */}
        <a
          href="#journey-choice-heading"
          className="mt-2 inline-block text-sm font-semibold text-terracotta-600 underline decoration-terracotta-300 underline-offset-2 hover:text-terracotta-700"
        >
          See the full comparison
        </a>
      </div>

      <div className="mt-5 border-t border-ink-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Recent fare checks</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">{fareCheckLine(fareSignal)}</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {tripComHandoff ? (
          <TrackedOutboundLink
            event="journey_choice_cta_click"
            properties={{ route: routeSlug, source: 'journey-choice-verdict' }}
            href={tripComHandoff.url}
            target="_blank"
            rel={PROVIDER_REL}
            className="inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-6 text-sm font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985]"
          >
            Check today&apos;s price
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
          </TrackedOutboundLink>
        ) : null}
        {/* TrackedOutboundLink is a 'use client' leaf whose only job is
            "fire this analytics event on click" (see its own doc comment) —
            reused here for an in-page anchor rather than an outbound link
            so RouteVerdict itself can stay a server component, matching
            Journey Choice's own architecture, rather than adding a new
            client leaf just for this one click. */}
        <TrackedOutboundLink
          event="route_verdict_watch_click"
          properties={{ route: routeSlug }}
          href="#route-watch"
          className="inline-flex h-12 items-center justify-center gap-1.5 rounded-sm border border-ink-200 px-5 text-sm font-semibold text-ink-900 transition-colors hover:bg-ink-50 active:scale-[0.985]"
        >
          <BellRing className="h-4 w-4" strokeWidth={2} />
          Watch this route
        </TrackedOutboundLink>
      </div>
      {tripComHandoff && (
        <>
          <div className="mt-2">
            <AffiliateLinkDisclosure providerName="Trip.com">
              Check the itinerary, baggage allowance and booking terms before paying.
            </AffiliateLinkDisclosure>
          </div>
          <p className="mt-1.5 text-xs text-ink-400">
            {tripComHandoff.datesPreserved ? JOURNEY_CHOICE_DATED_HANDOFF_NOTE : TRIPCOM_FRESH_SEARCH_NOTE}
          </p>
        </>
      )}
    </section>
  );
}
