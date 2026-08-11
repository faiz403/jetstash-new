import { ArrowRight, Clock3, Luggage, Plane, Route as RouteIcon } from 'lucide-react';
import type { SmartFareBaggage, SmartFareComparison, SmartFareOptionSummary } from '@/lib/smart-fare-comparison';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'Not shown';
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${remaining}m`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function formatStops(option: SmartFareOptionSummary): string {
  if (option.outboundStops !== null && option.returnStops !== null && option.outboundStops === option.returnStops) {
    return `${option.outboundStops} stop${option.outboundStops === 1 ? '' : 's'} each way`;
  }
  if (option.stops !== null) return `${option.stops} stops across the return journey`;
  return 'Stops not shown';
}

function baggageLabel(baggage: SmartFareBaggage): string {
  switch (baggage.kind) {
    case 'included': return 'Checked baggage included';
    case 'extra-charge-known': return `Checked baggage: extra ${baggage.fee === 0 ? 'charge shown as £0' : `charge £${baggage.fee.toLocaleString('en-GB')}`}`;
    case 'extra-charge-unknown': return 'Checked baggage: extra charge, amount not shown';
    case 'not-stated': return 'Checked baggage: not stated';
  }
}

function connectionLabel(option: SmartFareOptionSummary): string {
  if (option.connectionAirports.length === 0) return 'Connection airport not shown';
  return `Via ${option.connectionAirports.join(' and ')}`;
}

function layoverLabel(option: SmartFareOptionSummary): string {
  const outbound = option.outboundLayoverMinutes[0];
  const returning = option.returnLayoverMinutes[0];
  if (outbound === undefined && returning === undefined) return 'Layover not shown';
  const parts = [];
  if (outbound !== undefined) parts.push(`outbound ${formatDuration(outbound)}`);
  if (returning !== undefined) parts.push(`return ${formatDuration(returning)}`);
  return parts.join(' · ');
}

export function SmartFareOptionCard({ option }: { option: SmartFareOptionSummary }) {
  return (
    <article className="rounded-md border border-ink-100 bg-sand-50 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta-600">Observed option</p>
          <h3 className="mt-2 font-display text-xl text-ink-900">{option.airline}</h3>
        </div>
        <p className="shrink-0 font-display text-2xl text-ink-900">£{option.price.toLocaleString('en-GB')}</p>
      </div>
      <p className="mt-1 text-xs text-ink-500">Return fare · checked {formatDate(option.checkedDate)}</p>
      <dl className="mt-5 grid gap-3 text-sm text-ink-700">
        <div className="flex items-start gap-2">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-600" strokeWidth={2} />
          <div><dt className="sr-only">Total journey</dt><dd>{formatDuration(option.totalJourneyMinutes)} total journey</dd></div>
        </div>
        <div className="flex items-start gap-2">
          <Plane className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-600" strokeWidth={2} />
          <div><dt className="sr-only">Routing</dt><dd>{option.directness === 'connecting' ? 'Connecting journey' : option.directness === 'direct' ? 'Direct journey' : 'Routing not established'} · {formatStops(option)}</dd></div>
        </div>
        <div className="flex items-start gap-2">
          <RouteIcon className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-600" strokeWidth={2} />
          <div><dt className="sr-only">Connection</dt><dd>{connectionLabel(option)}</dd></div>
        </div>
        <div className="flex items-start gap-2">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-600" strokeWidth={2} />
          <div><dt className="sr-only">Layover</dt><dd>Layover: {layoverLabel(option)}</dd></div>
        </div>
        <div className="flex items-start gap-2">
          <Luggage className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-600" strokeWidth={2} />
          <div><dt className="sr-only">Baggage</dt><dd>{baggageLabel(option.baggage)}</dd></div>
        </div>
      </dl>
      <p className="mt-5 border-t border-ink-100 pt-3 text-xs text-ink-500">
        Travel dates: {formatDate(option.departureDate)} to {formatDate(option.returnDate)}
      </p>
    </article>
  );
}

export function SmartFareComparison({ comparison, routeLabel }: { comparison: SmartFareComparison; routeLabel: string }) {
  const first = comparison.options[0];
  const dateLabel = first
    ? `${formatDate(first.departureDate)} to ${formatDate(first.returnDate)}`
    : 'dates not shown';

  return (
    <section aria-labelledby="smart-fare-comparison-heading" className="rounded-md border border-ink-200 bg-white p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brass-100 text-brass-700">
          <RouteIcon className="h-4 w-4" strokeWidth={2} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta-600">Smart Fare Comparison</p>
          <h2 id="smart-fare-comparison-heading" className="mt-1 font-display text-2xl text-ink-900 sm:text-3xl">{routeLabel}</h2>
          <p className="mt-2 text-sm text-ink-500">Observed return options for {dateLabel}. This is a factual itinerary comparison, not a live-price feed.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {comparison.options.map((option) => <SmartFareOptionCard key={option.id} option={option} />)}
      </div>
      {comparison.pairStatements.length > 0 && (
        <div className="mt-6 rounded-md border border-brass-200 bg-brass-50 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass-700">What the checked itineraries show</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-ink-700">
            {comparison.pairStatements.map((statement) => <li key={`${statement.optionIds.join('-')}-${statement.text}`}>{statement.text}</li>)}
          </ul>
        </div>
      )}
      <p className="mt-5 text-sm leading-relaxed text-ink-600">
        JetStash can compare the fare and journey time shown here. Checked-baggage pricing was not disclosed, so this is not a complete trip-cost comparison.
      </p>
    </section>
  );
}
