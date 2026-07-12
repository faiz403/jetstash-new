import { TrendingUp } from 'lucide-react';
import type { FareObservation } from '@/data/fare-observations';
import { formatChecked } from '@/data/deals';
import { getFareFreshnessState, daysBetweenIso } from '@/lib/freshness-thresholds';

/**
 * Renders a route's fare observation history — the accumulating record
 * that makes fare context on this site editorial ("tracked over time")
 * rather than a single unverifiable snapshot. Renders nothing if no
 * observations have been logged for this route yet. Rows past
 * OBSERVATION_STALE_DAYS are visually de-emphasised (never hidden — the
 * history stays honest and complete) so a years-old check doesn't read as
 * current at a glance.
 */
export function FareHistoryPanel({ observations }: { observations: FareObservation[] }) {
  if (observations.length === 0) return null;

  const chronological = [...observations].sort((a, b) => b.observedDate.localeCompare(a.observedDate));
  const nowIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-md border border-ink-100 bg-white">
      <div className="flex items-center gap-2 border-b border-ink-100 px-6 py-4">
        <TrendingUp className="h-4.5 w-4.5 text-terracotta-600" strokeWidth={2} />
        <h3 className="font-display text-lg text-ink-900">
          {observations.length} fare{observations.length === 1 ? '' : 's'} tracked on this route
        </h3>
      </div>
      <div className="flex flex-col divide-y divide-ink-100">
        {chronological.map((obs) => {
          const isStale = getFareFreshnessState(daysBetweenIso(obs.observedDate, nowIso)) === 'stale';
          return (
            <div key={obs.id} className="flex items-center justify-between px-6 py-3.5">
              <div>
                <p className="text-sm font-medium text-ink-700">{obs.cabin} · {obs.source}</p>
                <p className="text-xs text-ink-400">
                  Checked {formatChecked(obs.observedDate)}
                  {isStale && ' · old check, for history only'}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-display text-lg ${isStale ? 'text-ink-500' : 'text-ink-900'}`}>
                  £{obs.price.toLocaleString('en-GB')}
                </p>
                <p className="text-[11px] text-ink-400">{obs.priceNote}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="border-t border-ink-100 px-6 py-3 text-xs text-ink-400">
        Every figure above is a fare our team checked and recorded on the date shown, not a live price feed. Use the
        partner link below to check live prices.
      </p>
    </div>
  );
}
