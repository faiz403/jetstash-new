import { Deal, DealCabin, formatChecked } from '@/data/deals';
import { getRouteByAirportAndDestination } from '@/data/routes';
import { getObservationsByRoute } from '@/data/fare-observations';
import { Plane, ArrowUpRight, TrendingUp } from 'lucide-react';
import { Badge } from './badge';
import { DestinationVisual } from './destination-visual';

const cabinLabel: Record<DealCabin, string> = {
  Economy: 'Economy',
  'Premium Economy': 'Premium Economy',
  Business: 'Business class',
};

export function DealCard({ deal }: { deal: Deal }) {
  // Fare history context, not a marketing tag — reinforces this is a tracked route, not a one-off "today's deal".
  const matchedRoute = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
  const observations = matchedRoute ? getObservationsByRoute(matchedRoute.slug) : [];

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-md border border-ink-100 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
      <div className="relative h-44 w-full overflow-hidden">
        <DestinationVisual
          slug={deal.toDestinationSlug}
          label={deal.toCity}
          sublabel={deal.toCountry}
          className="transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {deal.tag && (
          <div className="absolute right-4 top-4">
            <Badge variant={deal.cabin === 'Business' ? 'terracotta' : 'brass'}>{deal.tag}</Badge>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
          <Plane className="h-3.5 w-3.5" strokeWidth={2.25} />
          {deal.fromCity} → {deal.toCity}
        </span>
        <span className="text-xs font-medium text-ink-500">{cabinLabel[deal.cabin]}</span>
      </div>

      <div className="flex flex-1 flex-col px-5 py-5">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl tracking-tight text-ink-900 tabular-nums">£{deal.indicativePrice.toLocaleString('en-GB')}</span>
          <span className="text-sm text-ink-400">{deal.priceNote}</span>
        </div>
        <p className="mt-1 text-sm font-medium text-ink-500">{deal.airline}</p>

        <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
          <span className="h-1.5 w-1.5 rounded-full bg-brass-400" />
          Example fare checked {formatChecked(deal.lastChecked)}
        </div>
        {observations.length > 1 && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-400">
            <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />
            {observations.length} fares tracked on this route — see the full history on the route guide
          </div>
        )}

        <a
          href={deal.partnerUrl}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-4 py-3 text-sm font-semibold text-sand-50 transition-all duration-200 hover:bg-brass-600 active:scale-[0.985]"
        >
          Check live price
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
        </a>
        <p className="mt-2 text-center text-[11px] text-ink-400">
          Partner link — prices change quickly, confirm the final price before booking
        </p>
      </div>
    </article>
  );
}
