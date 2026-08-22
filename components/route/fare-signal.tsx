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
        {/* Route Page Scanability fix (21 Aug 2026): this is now the one
            complete partner/trust caveat for the whole page -- the hero's
            former "Check the itinerary, baggage allowance and booking terms
            before paying." sentence is folded in here verbatim (not
            reworded) rather than dropped, since it no longer exists
            anywhere else. The fresh-search note below stays a separate line
            -- it answers a different question (dates don't carry across,
            not "check terms before paying") and is a shared constant reused
            elsewhere, so it isn't merged into this sentence. */}
        <p className="text-xs text-ink-500">Check the itinerary, baggage allowance and booking terms before paying. Partner link, opens Trip.com in a new tab.</p>
      </div>
      <p className="mt-1.5 text-xs text-ink-400">{TRIPCOM_FRESH_SEARCH_NOTE}</p>
    </div>
  );
}

/**
 * Route Page Scanability fix (21 Aug 2026): the hero's own Trip.com CTA was
 * removed (tests/route-hero-scanability.test.ts) so Fare Signal is now the
 * only place a route's booking action lives. That means the hero's old
 * fail-closed sentence for a route with no safe exact Trip.com handoff --
 * "Exact partner booking link is not currently verified for this route." --
 * has to live here too, verbatim, or a route with no CTA would show nothing
 * at all where the action used to be. Deliberately reused word-for-word
 * rather than reworded, and rendered in every state (current, recent, and
 * none) wherever tripComUrl is null, so a route that has a verified CTA but
 * no current fare (e.g. birmingham-lahore) doesn't lose its one working
 * booking link, and a route with neither gets the same honest sentence a
 * no-fare route always showed for its CTA slot.
 */
function NoCtaFallback() {
  return (
    <p className="mt-5 text-sm text-ink-400">Exact partner booking link is not currently verified for this route.</p>
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

/**
 * Connecting Journey Structure + BHX-DEL unlock (22 Aug 2026). The
 * routeVsFareMismatch() function above only fires when a route's own
 * verified directness DIFFERS from the tracked fare's (one 'direct', one
 * 'connecting') -- it returns null whenever both are 'connecting', even
 * when the two connecting journeys route through entirely different
 * cities (e.g. Birmingham-Delhi's own verified Air India/Amritsar service
 * vs. a tracked Lufthansa fare connecting via Frankfurt/Munich). This is
 * a separate, additional comparison, deliberately kept out of
 * routeVsFareMismatch() so that function's existing behaviour (and its
 * test coverage) is untouched.
 *
 * Fail-closed by construction: this only ever compares when the route
 * itself carries structured, evidenced `routeServiceConnections`
 * (data/routes.ts -- populated for exactly the handful of routes with
 * primary-source evidence naming a specific hub for both directions) AND
 * the tracked fare itself carries structured connection-airport evidence
 * (`outboundConnectionAirports`/`returnConnectionAirports` on the
 * observation). A route or fare missing that structured evidence is never
 * compared -- silence is the default, not a guess (e.g. manchester-karachi
 * deliberately has no `routeServiceConnections` because COV-001's live
 * booking-engine search found no single stable hub, so this function
 * never runs for it). Never parses `flightTime`, `verification.note` or
 * any other prose, and never infers a hub from airline identity -- it
 * only ever compares two already-structured airport lists.
 *
 * Airport codes are deliberately never repeated in the note text --
 * formatRouting() above already renders the tracked fare's own connection
 * airports on this same card, so naming them again here would just be
 * noise. Reuses the same RouteVsFareCallout visual treatment as the
 * existing direct-vs-connecting mismatch, and is mutually exclusive with
 * it by construction: routeVsFareMismatch() only fires when directness
 * differs, this only fires when both are 'connecting', so a single card
 * never shows both callouts at once.
 *
 * `routeServiceConnections` stores bare IATA codes (e.g. "IST"); a fare
 * observation's own connection-airport fields store a descriptive label
 * with the code in trailing parentheses (e.g. "Istanbul Airport (IST)") --
 * extractIataCode() below normalises the fare side to the same bare-code
 * form before comparing. If any fare connection airport doesn't carry a
 * recognisable "(XXX)" code, the whole comparison is skipped (fail-closed)
 * rather than risk a false match or false mismatch from comparing a code
 * against a full label.
 */
function extractIataCode(label: string): string | null {
  const match = label.match(/\(([A-Z]{3})\)\s*$/);
  return match ? match[1] : null;
}

function routeServiceFareMismatch(
  routeConnections: { outbound?: string[]; return?: string[] } | null | undefined,
  routeStatusLabel: string | null,
  routeAirlineLabel: string | null,
  fareDirectness: FareSignalObservation['directness'],
  fareConnectionAirports: string[]
): RouteVsFareMismatch | null {
  if (fareDirectness !== 'connecting' || !routeConnections) return null;
  const routeAirports = [...new Set([...(routeConnections.outbound ?? []), ...(routeConnections.return ?? [])])];
  if (routeAirports.length === 0 || fareConnectionAirports.length === 0) return null;
  const fareCodes = fareConnectionAirports.map(extractIataCode);
  if (fareCodes.some((code) => code === null)) return null;
  const routeSet = new Set(routeAirports);
  const fareSet = new Set(fareCodes as string[]);
  const sameRouting = routeSet.size === fareSet.size && [...routeSet].every((code) => fareSet.has(code));
  if (sameRouting) return null;
  const label = routeStatusLabel ?? 'Connecting';
  return {
    routeValue: routeAirlineLabel ? `${routeAirlineLabel} · ${label}` : label,
    note: 'This tracked fare is a different connecting journey.',
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
  /** data/routes.ts `routeServiceConnections` -- undefined/null for the vast majority of routes (no structured evidence), which is exactly when routeServiceFareMismatch() must stay silent. */
  routeServiceConnections?: { outbound?: string[]; return?: string[] } | null;
}

function CurrentSignal({ data, tripComUrl, routeSlug, routeDirectness, routeStatusLabel, routeAirlineLabel, routeServiceConnections }: { data: FareSignalObservation; tripComUrl: string | null; routeSlug: string } & RouteContextProps) {
  const routing = formatRouting(data);
  const mismatch = routeVsFareMismatch(routeDirectness, routeStatusLabel, routeAirlineLabel, data.directness)
    ?? routeServiceFareMismatch(routeServiceConnections, routeStatusLabel, routeAirlineLabel, data.directness, data.connectionAirports);
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
      {tripComUrl ? <SignalCta href={tripComUrl} routeSlug={routeSlug} /> : <NoCtaFallback />}
    </>
  );
}

function RecentSignal({ data, tripComUrl, routeSlug, routeDirectness, routeStatusLabel, routeAirlineLabel, routeServiceConnections }: { data: FareSignalObservation; tripComUrl: string | null; routeSlug: string } & RouteContextProps) {
  const mismatch = routeVsFareMismatch(routeDirectness, routeStatusLabel, routeAirlineLabel, data.directness)
    ?? routeServiceFareMismatch(routeServiceConnections, routeStatusLabel, routeAirlineLabel, data.directness, data.connectionAirports);
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
      {tripComUrl ? <SignalCta href={tripComUrl} routeSlug={routeSlug} /> : <NoCtaFallback />}
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
  routeServiceConnections = null,
}: {
  signal: FareSignalData;
  tripComUrl: string | null;
  routeSlug: string;
  routeDirectness?: 'direct' | 'connecting' | null;
  /** presentation.statusLabel ('Direct' / 'Connecting') -- pass the canonical label, never a locally re-derived one. */
  routeStatusLabel?: string | null;
  /** Joined confirmed-airline names for the route (e.g. "PIA"), or null when none are confirmed -- never invented. */
  routeAirlineLabel?: string | null;
  /** data/routes.ts `route.routeServiceConnections` -- omit/null for any route without structured, evidenced connection data (the default for almost every route). */
  routeServiceConnections?: { outbound?: string[]; return?: string[] } | null;
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
        {signal.state === 'current' && signal.observation ? <CurrentSignal data={signal.observation} tripComUrl={tripComUrl} routeSlug={routeSlug} routeDirectness={routeDirectness} routeStatusLabel={routeStatusLabel} routeAirlineLabel={routeAirlineLabel} routeServiceConnections={routeServiceConnections} /> : null}
        {signal.state === 'recent' && signal.observation ? <RecentSignal data={signal.observation} tripComUrl={tripComUrl} routeSlug={routeSlug} routeDirectness={routeDirectness} routeStatusLabel={routeStatusLabel} routeAirlineLabel={routeAirlineLabel} routeServiceConnections={routeServiceConnections} /> : null}
        {signal.state === 'none' ? (
          <>
            <div className="flex items-start gap-3 text-sm text-ink-600">
              <RouteIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={2} />
              <p>No current fare tracked.</p>
            </div>
            {/* Route Page Scanability fix (21 Aug 2026): a route can have a
                verified Trip.com CTA with no current fare logged (e.g.
                birmingham-lahore) -- that CTA must still render here now
                that the hero no longer carries one, or the route loses its
                only working booking link entirely. */}
            {tripComUrl ? <SignalCta href={tripComUrl} routeSlug={routeSlug} /> : <NoCtaFallback />}
          </>
        ) : null}
      </div>
    </section>
  );
}
