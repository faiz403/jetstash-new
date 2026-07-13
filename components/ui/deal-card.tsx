import Link from 'next/link';
import { Deal, DealCabin, formatChecked, getDealDirectnessLabel } from '@/data/deals';
import { getRouteByAirportAndDestination, getDisplayDirectness } from '@/data/routes';
import { getDestinationBySlug } from '@/data/destinations';
import { getFareRangeSummary } from '@/data/fare-observations';
import { getDealBookingUrl } from '@/lib/booking-providers';
import { getFareFreshnessState, daysBetweenIso, OBSERVATION_STALE_DAYS } from '@/lib/freshness-thresholds';
import { Plane, ArrowUpRight } from 'lucide-react';
import { Badge } from './badge';
import { DestinationVisual } from './destination-visual';
import { TrackedOutboundLink } from './tracked-outbound-link';

const cabinLabel: Record<DealCabin, string> = {
  Economy: 'Economy',
  'Premium Economy': 'Premium Economy',
  Business: 'Business class',
};

export function DealCard({ deal }: { deal: Deal }) {
  const nowIso = new Date().toISOString().slice(0, 10);
  const matchedRoute = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
  // The only source of truth for what this card shows as a price: a real
  // logged range/check, or nothing at all — never a hardcoded figure that
  // can go stale. See data/deals.ts's header comment.
  const range = matchedRoute ? getFareRangeSummary(matchedRoute.slug, deal.cabin) : null;
  const destination = getDestinationBySlug(deal.toDestinationSlug);
  const flightTime = matchedRoute?.flightTime ?? destination?.flightTimeFromUK;
  const displayDirectness = matchedRoute ? getDisplayDirectness(matchedRoute, nowIso) : undefined;
  const directness = displayDirectness === 'direct' ? 'Direct' : displayDirectness === 'unverified' ? 'Verification pending' : displayDirectness === 'connecting' ? 'Via connection' : undefined;
  // Truth Reset (July 2026): the top-right badge must never assert
  // directness independently of the verification system — a category tag
  // (Umrah package, City break) always takes precedence when present;
  // otherwise the badge is computed live via getDealDirectnessLabel(),
  // never a static "Direct flight" string from curation data. See TR-009.
  const topBadge = deal.categoryTag ?? getDealDirectnessLabel(deal, nowIso);
  const freshness = range ? getFareFreshnessState(daysBetweenIso(range.latestDate, nowIso)) : null;
  const isStale = freshness === 'stale';

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
            <p className="mt-1 text-sm font-medium text-ink-500">{deal.airline}</p>

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
            <p className="font-display text-xl leading-snug text-ink-900">
              {matchedRoute ? flightTime : `Typical flight time: ${flightTime ?? 'varies'}`}
            </p>
            <p className="mt-1 text-sm font-medium text-ink-500">
              {deal.airline}
              {directness ? ` · ${directness}` : ''}
            </p>

            <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
              <span className="h-1.5 w-1.5 rounded-full bg-ink-300" />
              No fare checks logged yet — check the live price below
            </div>
            {matchedRoute && (
              <Link
                href={`/routes/${matchedRoute.slug}`}
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-ink-400 transition-colors hover:text-ink-600"
              >
                Booking-window guidance on the route guide
                <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} />
              </Link>
            )}
          </>
        )}
        {range && range.count > 1 && (
          <p className="mt-1.5 text-xs text-ink-400">See the full history on the route guide.</p>
        )}

        <TrackedOutboundLink
          event="travelup_click"
          properties={{ context: 'deal-card', destination: deal.toDestinationSlug, cabin: deal.cabin }}
          href={getDealBookingUrl(deal)}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-4 py-3 text-sm font-semibold text-sand-50 transition-all duration-200 hover:bg-brass-600 active:scale-[0.985]"
        >
          Check live price
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
        </TrackedOutboundLink>
        <p className="mt-2 text-center text-[11px] text-ink-400">
          Partner link. Prices change quickly, confirm the final price before booking
        </p>
      </div>
    </article>
  );
}
