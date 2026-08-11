import { ArrowUpRight, CalendarDays, Plane, Search, Route as RouteIcon } from 'lucide-react';
import type { FareSignal as FareSignalData, FareSignalObservation } from '@/lib/fare-signal';
import { formatChecked } from '@/data/deals';
import { PROVIDER_REL } from '@/lib/booking-providers';
import { TrackedOutboundLink } from '@/components/ui/tracked-outbound-link';

function formatStops(observation: FareSignalObservation): string | null {
  if (observation.outboundStops === null || observation.returnStops === null) return null;
  return `${observation.outboundStops} stop${observation.outboundStops === 1 ? '' : 's'} each way`;
}

function formatRouting(observation: FareSignalObservation): string | null {
  const stops = formatStops(observation);
  const connection = observation.connectionAirports.length > 0
    ? ` via ${observation.connectionAirports.join(' and ')}`
    : '';
  if (observation.directness === 'direct') return 'Direct journey';
  if (observation.directness === 'connecting' && stops) return `Connecting · ${stops}${connection}`;
  if (observation.directness === 'connecting') return `Connecting journey${connection}`;
  return null;
}

function SignalCta({ href, routeSlug }: { href: string; routeSlug: string }) {
  return (
    <div className="mt-5 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
      <TrackedOutboundLink
        event="tripcom_click"
        properties={{ route: routeSlug, source: 'fare-signal' }}
        href={href}
        target="_blank"
        rel={PROVIDER_REL}
        className="inline-flex items-center gap-1.5 rounded-sm bg-ink-900 px-4 py-2.5 text-sm font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985]"
      >
        Check current price
        <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
      </TrackedOutboundLink>
      <p className="text-xs text-ink-500">Partner link, opens Trip.com in a new tab.</p>
    </div>
  );
}

function CurrentSignal({ data, tripComUrl, routeSlug }: { data: FareSignalObservation; tripComUrl: string | null; routeSlug: string }) {
  const routing = formatRouting(data);
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta-600">Fare spotted</p>
          <p className="mt-1 font-display text-3xl text-ink-900">£{data.price.toLocaleString('en-GB')} return</p>
        </div>
        <div className="text-sm text-ink-600 sm:text-right">
          <p>{data.airline} · {data.cabin}</p>
          <p className="mt-1">Checked {formatChecked(data.observedDate)}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-700">
        {routing && <span className="inline-flex items-center gap-2"><Plane className="h-4 w-4 text-terracotta-600" />{routing}</span>}
        <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-terracotta-600" />{formatChecked(data.departureDate)} – {formatChecked(data.returnDate)}</span>
      </div>
      {tripComUrl && <SignalCta href={tripComUrl} routeSlug={routeSlug} />}
    </>
  );
}

function RecentSignal({ data, tripComUrl, routeSlug }: { data: FareSignalObservation; tripComUrl: string | null; routeSlug: string }) {
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta-600">Last tracked fare</p>
          <p className="mt-1 font-display text-3xl text-ink-900">£{data.price.toLocaleString('en-GB')} return</p>
        </div>
        <p className="text-sm text-ink-600">Checked {formatChecked(data.observedDate)}</p>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-ink-600">Price may have changed.</p>
      {tripComUrl && <SignalCta href={tripComUrl} routeSlug={routeSlug} />}
    </>
  );
}

export function FareSignal({ signal, tripComUrl, routeSlug }: { signal: FareSignalData; tripComUrl: string | null; routeSlug: string }) {
  return (
    <section aria-labelledby="fare-signal-heading" className="rounded-md border border-ink-200 bg-sand-50 p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <Search className="h-5 w-5 text-terracotta-600" strokeWidth={2} />
        <p id="fare-signal-heading" className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta-600">Fare Signal</p>
      </div>
      {signal.strongerSignal && (
        <p className="mt-4 text-sm font-medium text-ink-700">{signal.strongerSignal}</p>
      )}
      <div className="mt-4">
        {signal.state === 'current' && signal.observation ? <CurrentSignal data={signal.observation} tripComUrl={tripComUrl} routeSlug={routeSlug} /> : null}
        {signal.state === 'recent' && signal.observation ? <RecentSignal data={signal.observation} tripComUrl={tripComUrl} routeSlug={routeSlug} /> : null}
        {signal.state === 'none' ? (
          <div className="flex items-start gap-3 text-sm text-ink-600">
            <RouteIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={2} />
            <p>No current fare tracked.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
