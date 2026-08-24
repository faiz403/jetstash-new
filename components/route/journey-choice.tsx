import { ArrowUpRight, Clock3, Info, Plane } from 'lucide-react';
import type { JourneyChoice as JourneyChoiceData, JourneyChoiceOption } from '@/lib/journey-choice';
import { PROVIDER_REL, TRIPCOM_FRESH_SEARCH_NOTE } from '@/lib/booking-providers';
import { JOURNEY_CHOICE_DATED_HANDOFF_NOTE, type JourneyChoiceTripComHandoff } from '@/lib/tripcom-dated-handoff';
import { TrackedOutboundLink } from '@/components/ui/tracked-outbound-link';
import { JourneyChoiceEvidenceDisclosure } from '@/components/route/journey-choice-evidence-disclosure';
import { JourneyChoiceImpressionSection } from '@/components/route/journey-choice-impression-section';

/**
 * Journey Choice (MVP, pilot: manchester-islamabad only, 24 Aug 2026,
 * founder-approved following Journey Choice Brief Hero Project Phase 0).
 *
 * Replaces the customer-facing Smart Fare Comparison presentation
 * (components/route/smart-fare-comparison.tsx) for the pilot route only —
 * see app/routes/[slug]/page.tsx and lib/journey-choice-route-adapter.ts.
 * The underlying derivation stays exactly what PR #171 already built
 * (lib/smart-fare-comparison.ts, lib/smart-fare-route-adapter.ts); this
 * component is presentation only, built around one decision sentence
 * instead of a grid of equal option cards.
 *
 * The comparison-profile ID never reaches this component —
 * JourneyChoiceOption (see lib/journey-choice.ts) has no such field.
 * Baggage state is read only from each option's own structured `baggage`
 * field, never inferred from an identifier's naming history. This
 * component also never renders a self-transfer claim of any kind — the
 * data model has no self-transfer field today, so there is nothing to
 * assert either way.
 *
 * Dated Trip.com handoff pilot (24 Aug 2026): the CTA's `href` and
 * disclosure sentence come from `tripComHandoff` (see
 * lib/tripcom-dated-handoff.ts), resolved once in page.tsx — this
 * component never decides for itself whether the URL preserves dates.
 *
 * Measurement instrumentation (24 Aug 2026, one-time founder-approved
 * exception to the freeze — see
 * components/route/journey-choice-impression-section.tsx for the outer
 * wrapper's own doc comment). The CTA's `source` property distinguishes
 * a dated click (`journey-choice-dated`) from a fail-closed fallback
 * click (`journey-choice-fallback`), derived solely from
 * `tripComHandoff.datesPreserved` — never inferred from the URL string.
 */

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${remaining}m`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function formatStops(option: JourneyChoiceOption): string {
  if (option.outboundStops !== null && option.returnStops !== null && option.outboundStops === option.returnStops) {
    return `${option.outboundStops} stop${option.outboundStops === 1 ? '' : 's'} each way`;
  }
  return 'Stops not shown';
}

function connectionLabel(option: JourneyChoiceOption): string | null {
  if (option.connectionAirports.length === 0) return null;
  return `via ${option.connectionAirports.join(' and ')}`;
}

function baggageLabel(option: JourneyChoiceOption): string {
  switch (option.baggage.kind) {
    case 'included': return 'Checked baggage included';
    case 'extra-charge-known': return `Checked baggage: extra £${option.baggage.fee.toLocaleString('en-GB')}`;
    case 'extra-charge-unknown': return 'Checked baggage: extra charge, amount not shown';
    case 'not-stated': return 'Checked baggage: not stated';
  }
}

function checkedDateRange(options: JourneyChoiceOption[]): string {
  const dates = [...new Set(options.map((o) => o.checkedDate))].sort();
  if (dates.length === 1) return formatDate(dates[0]);
  return `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`;
}

function PrimaryOptionCard({ label, option }: { label: string; option: JourneyChoiceOption }) {
  const connection = connectionLabel(option);
  return (
    <article className="rounded-md border border-ink-100 bg-sand-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terracotta-600">{label}</p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg text-ink-900">{option.airline}</h3>
        <p className="shrink-0 font-display text-2xl text-ink-900">£{option.price.toLocaleString('en-GB')}</p>
      </div>
      <p className="mt-1 text-xs text-ink-500">{option.cabin} return · checked {formatDate(option.checkedDate)}</p>
      <dl className="mt-4 flex flex-col gap-2 text-sm text-ink-700">
        <div className="flex items-start gap-2">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-600" strokeWidth={2} aria-hidden="true" />
          <dd>{formatDuration(option.totalJourneyMinutes)} total · {formatStops(option)}</dd>
        </div>
        <div className="flex items-start gap-2">
          <Plane className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-600" strokeWidth={2} aria-hidden="true" />
          <dd>{connection ?? 'Connection not shown'}</dd>
        </div>
      </dl>
    </article>
  );
}

/**
 * A compact, non-primary comparable option — kept accessible, never hidden,
 * but deliberately not given equal visual weight to the two primaries (see
 * founder's own "two leading, one expandable" structural decision).
 */
function OtherOptionRow({
  option,
  lowerFare,
  fasterJourney,
}: {
  option: JourneyChoiceOption;
  lowerFare: JourneyChoiceOption;
  fasterJourney: JourneyChoiceOption;
}) {
  const priceLow = Math.min(lowerFare.price, fasterJourney.price);
  const priceHigh = Math.max(lowerFare.price, fasterJourney.price);
  const timeLow = Math.min(lowerFare.totalJourneyMinutes, fasterJourney.totalJourneyMinutes);
  const timeHigh = Math.max(lowerFare.totalJourneyMinutes, fasterJourney.totalJourneyMinutes);
  const isGenuineMiddleOption =
    option.price > priceLow && option.price < priceHigh
    && option.totalJourneyMinutes > timeLow && option.totalJourneyMinutes < timeHigh;

  return (
    <li className="rounded-sm border border-ink-100 bg-white px-4 py-3 text-sm text-ink-700">
      <span className="font-medium text-ink-900">{option.airline}</span> · £{option.price.toLocaleString('en-GB')} · {formatDuration(option.totalJourneyMinutes)}
      {isGenuineMiddleOption && (
        <span className="block text-xs text-ink-500">
          {`£${(option.price - priceLow).toLocaleString('en-GB')} more than the lower fare, £${(priceHigh - option.price).toLocaleString('en-GB')} less than the faster one.`}
        </span>
      )}
    </li>
  );
}

export interface JourneyChoiceRouteServiceContext {
  routeDirectness: 'direct' | 'connecting' | null;
  routeStatusLabel: string | null;
  routeAirlineLabel: string | null;
}

function routeServiceNote(
  context: JourneyChoiceRouteServiceContext,
  allOptionsConnecting: boolean
): { value: string; note: string } | null {
  const { routeDirectness, routeStatusLabel, routeAirlineLabel } = context;
  if (!routeDirectness || routeDirectness !== 'direct' || !allOptionsConnecting) return null;
  const label = routeStatusLabel ?? 'direct';
  const value = routeAirlineLabel ? `${routeAirlineLabel} · ${label}` : label;
  return {
    value,
    note: 'The fares above are different, connecting journeys.',
  };
}

export function JourneyChoice({
  journeyChoice,
  routeLabel,
  routeSlug,
  tripComHandoff,
  routeDirectness = null,
  routeStatusLabel = null,
  routeAirlineLabel = null,
}: {
  journeyChoice: JourneyChoiceData;
  routeLabel: string;
  routeSlug: string;
  /**
   * Resolved by lib/tripcom-dated-handoff.ts's getJourneyChoiceTripComHandoff()
   * in app/routes/[slug]/page.tsx — null only when the route has no
   * verified Trip.com CTA at all (matches the pre-existing NoCtaFallback
   * case). `datesPreserved` decides which disclosure sentence is honest;
   * this component never re-derives that itself.
   */
  tripComHandoff: JourneyChoiceTripComHandoff | null;
  routeDirectness?: 'direct' | 'connecting' | null;
  /** Canonical presentation.statusLabel — never a locally re-derived string. */
  routeStatusLabel?: string | null;
  routeAirlineLabel?: string | null;
}) {
  const { lowerFare, fasterJourney, decision, otherOptions, baggageCostConfirmedForAllOptions } = journeyChoice;
  const allOptions = [lowerFare, fasterJourney, ...otherOptions];
  const allOptionsConnecting = allOptions.every((option) => option.directness === 'connecting');
  const service = routeServiceNote({ routeDirectness, routeStatusLabel, routeAirlineLabel }, allOptionsConnecting);
  const travelDatesLabel = `${formatDate(lowerFare.departureDate)} to ${formatDate(lowerFare.returnDate)}`;

  return (
    <JourneyChoiceImpressionSection routeSlug={routeSlug}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta-600">Journey Choice</p>
      <h2 id="journey-choice-heading" className="mt-1 font-display text-2xl text-ink-900 sm:text-3xl">{routeLabel}</h2>
      <p className="mt-2 text-sm text-ink-500">
        Checked {checkedDateRange(allOptions)} for travel {travelDatesLabel}. Not a live price feed.
      </p>

      <p className="mt-6 text-balance font-display text-3xl leading-tight text-ink-900 sm:text-4xl">
        {decision.sentence}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <PrimaryOptionCard label="Lower fare" option={lowerFare} />
        <PrimaryOptionCard label="Faster journey" option={fasterJourney} />
      </div>

      {otherOptions.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
            {otherOptions.length === 1 ? 'Another option' : 'Other options'}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {otherOptions.map((option) => (
              <OtherOptionRow key={option.id} option={option} lowerFare={lowerFare} fasterJourney={fasterJourney} />
            ))}
          </ul>
        </div>
      )}

      {service && (
        <div className="mt-6 flex items-start gap-3 rounded-md border border-terracotta-200 bg-white p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-600" strokeWidth={2} aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-terracotta-600">Route service</p>
            <p className="mt-1 text-sm font-medium text-ink-900">{service.value}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{service.note}</p>
          </div>
        </div>
      )}

      {!baggageCostConfirmedForAllOptions && (
        <p className="mt-5 text-sm text-ink-600">Checked-baggage cost isn&apos;t confirmed.</p>
      )}

      {tripComHandoff ? (
        <div className="mt-5">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
            <TrackedOutboundLink
              event="journey_choice_cta_click"
              properties={{ route: routeSlug, source: tripComHandoff.datesPreserved ? 'journey-choice-dated' : 'journey-choice-fallback' }}
              href={tripComHandoff.url}
              target="_blank"
              rel={PROVIDER_REL}
              className="inline-flex items-center gap-1.5 rounded-sm bg-ink-900 px-4 py-2.5 text-sm font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985]"
            >
              Check today&apos;s price
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </TrackedOutboundLink>
            <p className="text-xs text-ink-500">Check the itinerary, baggage allowance and booking terms before paying. Partner link, opens Trip.com in a new tab.</p>
          </div>
          <p className="mt-1.5 text-xs text-ink-400">
            {tripComHandoff.datesPreserved ? JOURNEY_CHOICE_DATED_HANDOFF_NOTE : TRIPCOM_FRESH_SEARCH_NOTE}
          </p>
        </div>
      ) : (
        <p className="mt-5 text-sm text-ink-400">Exact partner booking link is not currently verified for this route.</p>
      )}

      <JourneyChoiceEvidenceDisclosure routeSlug={routeSlug} summaryLabel="See the evidence">
        <ul className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
          {allOptions.map((option) => (
            <li key={option.id} className="border-t border-ink-100 pt-3 first:border-t-0 first:pt-0">
              <p className="font-medium text-ink-900">{option.airline} · {option.cabin} · £{option.price.toLocaleString('en-GB')}</p>
              <p className="mt-1">Checked {formatDate(option.checkedDate)} · travel {formatDate(option.departureDate)} to {formatDate(option.returnDate)}</p>
              <p className="mt-1">{formatDuration(option.totalJourneyMinutes)} total journey · {formatStops(option)}{connectionLabel(option) ? ` · ${connectionLabel(option)}` : ''}</p>
              <p className="mt-1">{baggageLabel(option)}</p>
            </li>
          ))}
          {service && (
            <li className="border-t border-ink-100 pt-3">
              <p className="font-medium text-ink-900">Route service: {service.value}</p>
              <p className="mt-1">{service.note}</p>
            </li>
          )}
        </ul>
      </JourneyChoiceEvidenceDisclosure>
    </JourneyChoiceImpressionSection>
  );
}
