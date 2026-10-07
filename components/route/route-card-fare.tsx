import { AlertTriangle } from 'lucide-react';
import type { FareSignalObservation } from '@/lib/fare-signal';
import { formatChecked } from '@/data/deals';
import { SELF_TRANSFER_LABEL } from '@/lib/fare-self-transfer';
import { describeFareStops } from '@/lib/route-card-fare';
import { FareAgeWarning } from '@/components/route/fare-age-warning';

/**
 * Consumer clarity pass (3 Oct 2026). The one compact fare summary used by route cards on
 * airport and destination pages. Visible hierarchy, in order: the fare, who flies it and how
 * many stops, the checked date, then any material warning (self-transfer, a decisive journey
 * consequence). Methodology, baggage notes and comparisons stay on the route page.
 *
 * It only words an observation the existing Fare Signal already chose (the two-signal policy
 * from PR #301 is untouched): it never selects a fare, never says "from", "cheapest" or "live",
 * and a fare shown here is always dated.
 */
export function RouteCardFare({
  observation,
  state,
  lowerSelfTransfer = null,
  nowIso = new Date().toISOString().slice(0, 10),
}: {
  observation: FareSignalObservation;
  state: 'current' | 'recent';
  lowerSelfTransfer?: FareSignalObservation | null;
  nowIso?: string;
}) {
  const stops = describeFareStops(observation);
  return (
    <div>
      <p className="font-display text-2xl leading-none text-ink-900">
        £{observation.price.toLocaleString('en-GB')} <span className="font-sans text-sm font-normal text-ink-500">return</span>
      </p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-600">
        <span>{observation.airline}</span>
        {stops && <span aria-hidden="true">·</span>}
        {stops && <span>{stops}</span>}
        {observation.isSelfTransfer && (
          <span className="inline-flex items-center gap-1 rounded-sm border border-terracotta-300 bg-terracotta-50 px-1.5 py-0.5 text-[11px] font-semibold text-terracotta-700">
            <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            {SELF_TRANSFER_LABEL}
          </span>
        )}
      </p>
      <p className="mt-1 text-xs text-ink-500">
        {state === 'current' ? 'Checked' : 'Previous fare, checked'} {formatChecked(observation.observedDate)}
      </p>
      <FareAgeWarning observedDate={observation.observedDate} nowIso={nowIso} />
      {observation.journeyConsequences.length > 0 && (
        <p className="mt-1.5 text-xs font-medium text-terracotta-700">{observation.journeyConsequences.join(' · ')}</p>
      )}
      {lowerSelfTransfer && (
        <p className="mt-1.5 text-xs text-ink-500">
          A cheaper self-transfer was seen at £{lowerSelfTransfer.price.toLocaleString('en-GB')} (separate tickets).
        </p>
      )}
    </div>
  );
}
