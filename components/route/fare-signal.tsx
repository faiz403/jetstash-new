import { ArrowUpRight, CalendarDays, Info, Plane, Search, Route as RouteIcon } from 'lucide-react';
import type { FareSignal as FareSignalData, FareSignalObservation } from '@/lib/fare-signal';
import { formatChecked } from '@/data/deals';
import { PROVIDER_REL, TRIPCOM_FRESH_SEARCH_NOTE } from '@/lib/booking-providers';
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
    <div className="mt-5">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
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
      <p className="mt-1.5 text-xs text-ink-400">{TRIPCOM_FRESH_SEARCH_NOTE}</p>
    </div>
  );
}

/**
 * Route Page Journey Clarity System (20 Aug 2026). Two genuine first-time
 * users independently found the same P1 problem: a route's own verified
 * service (e.g. PIA direct) and the tracked fare shown right below it (e.g.
 * a lower-priced Etihad connecting itinerary) are individually accurate, but the
 * page didn't make the relationship between them unmistakable. A disclosure
 * sentence already existed here before this fix (`itineraryDifferenceCopy`,
 * git history) and fired correctly for every mismatched route -- the
 * problem was never missing evidence, it was that a single plain-weight
 * sentence, positioned after several other facts, was too easy to skim
 * past. This is a presentation fix, not a new evidence layer: it never
 * renders unless routeDirectness and fareDirectness are both known AND
 * differ (identical to the old function's own gate), so a route whose
 * verified service and tracked fare already agree gets zero extra density
 * -- see tests/fare-signal-route-vs-fare-clarity.test.ts's full 88-route
 * dataset check, which found 56 of 88 routes in this exact mismatched
 * state (verified direct route, connecting tracked fare) -- the majority
 * of the route catalogue, not an edge case.
 */
interface RouteVsFareMismatch {
  /** e.g. "PIA · Direct" (airline known) or "Direct" (airline not evidenced -- never invented). */
  routeValue: string;
  note: string;
}

function routeVsFareMismatch(
  routeDirectness: 'direct' | 'connecting' | null,
  routeStatusLabel: string | null,
  routeAirlineLabel: string | null,
  fareDirectness: FareSignalObservation['directness']
): RouteVsFareMismatch | null {
  if (!routeDirectness || !fareDirectness || routeDirectness === fareDirectness) return null;
  // routeStatusLabel is presentation.statusLabel, passed straight through
  // from the one canonical label (data/routes.ts) rather than re-derived
  // here -- matches the route page's own "never re-derive label text via a
  // local ternary" rule. The fallback only fires if a future caller omits
  // the prop; every real caller today supplies it.
  const label = routeStatusLabel ?? (routeDirectness === 'direct' ? 'Direct' : 'Connecting');
  const routeValue = routeAirlineLabel ? `${routeAirlineLabel} · ${label}` : label;
  const fareDirectnessWord = fareDirectness === 'direct' ? 'direct' : 'connecting';
  return {
    routeValue,
    note: `This tracked fare is a different, ${fareDirectnessWord} journey.`,
  };
}

function RouteVsFareCallout({ mismatch }: { mismatch: RouteVsFareMismatch }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-md border border-terracotta-200 bg-white p-4">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-600" strokeWidth={2} aria-hidden="true" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-terracotta-600">Route service</p>
        <p className="mt-1 text-sm font-medium text-ink-900">{mismatch.routeValue}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{mismatch.note}</p>
      </div>
    </div>
  );
}

interface RouteContextProps {
  routeDirectness: 'direct' | 'connecting' | null;
  routeStatusLabel: string | null;
  routeAirlineLabel: string | null;
}

function CurrentSignal({ data, tripComUrl, routeSlug, routeDirectness, routeStatusLabel, routeAirlineLabel }: { data: FareSignalObservation; tripComUrl: string | null; routeSlug: string } & RouteContextProps) {
  const routing = formatRouting(data);
  const mismatch = routeVsFareMismatch(routeDirectness, routeStatusLabel, routeAirlineLabel, data.directness);
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
      {mismatch && <RouteVsFareCallout mismatch={mismatch} />}
      {tripComUrl && <SignalCta href={tripComUrl} routeSlug={routeSlug} />}
    </>
  );
}

function RecentSignal({ data, tripComUrl, routeSlug, routeDirectness, routeStatusLabel, routeAirlineLabel }: { data: FareSignalObservation; tripComUrl: string | null; routeSlug: string } & RouteContextProps) {
  const mismatch = routeVsFareMismatch(routeDirectness, routeStatusLabel, routeAirlineLabel, data.directness);
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
      {mismatch && <RouteVsFareCallout mismatch={mismatch} />}
      {tripComUrl && <SignalCta href={tripComUrl} routeSlug={routeSlug} />}
    </>
  );
}

export function FareSignal({
  signal,
  tripComUrl,
  routeSlug,
  routeDirectness = null,
  routeStatusLabel = null,
  routeAirlineLabel = null,
}: {
  signal: FareSignalData;
  tripComUrl: string | null;
  routeSlug: string;
  routeDirectness?: 'direct' | 'connecting' | null;
  /** presentation.statusLabel ('Direct' / 'Connecting') -- pass the canonical label, never a locally re-derived one. */
  routeStatusLabel?: string | null;
  /** Joined confirmed-airline names for the route (e.g. "PIA"), or null when none are confirmed -- never invented. */
  routeAirlineLabel?: string | null;
}) {
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
        {signal.state === 'current' && signal.observation ? <CurrentSignal data={signal.observation} tripComUrl={tripComUrl} routeSlug={routeSlug} routeDirectness={routeDirectness} routeStatusLabel={routeStatusLabel} routeAirlineLabel={routeAirlineLabel} /> : null}
        {signal.state === 'recent' && signal.observation ? <RecentSignal data={signal.observation} tripComUrl={tripComUrl} routeSlug={routeSlug} routeDirectness={routeDirectness} routeStatusLabel={routeStatusLabel} routeAirlineLabel={routeAirlineLabel} /> : null}
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
