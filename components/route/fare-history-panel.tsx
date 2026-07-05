import { TrendingUp } from 'lucide-react';
import type { FareObservation } from '@/data/fare-observations';
import { formatChecked } from '@/data/deals';

/**
 * Renders a route's fare observation history — the accumulating record
 * that makes fare context on this site editorial ("tracked over time")
 * rather than a single unverifiable snapshot. Renders nothing if no
 * observations have been logged for this route yet.
 */
export function FareHistoryPanel({ observations }: { observations: FareObservation[] }) {
  if (observations.length === 0) return null;

  const chronological = [...observations].sort((a, b) => b.observedDate.localeCompare(a.observedDate));

  return (
    <div className="rounded-md border border-ink-100 bg-white">
      <div className="flex items-center gap-2 border-b border-ink-100 px-6 py-4">
        <TrendingUp className="h-4.5 w-4.5 text-terracotta-600" strokeWidth={2} />
        <h3 className="font-display text-lg text-ink-900">
          {observations.length} fare{observations.length === 1 ? '' : 's'} tracked on this route
        </h3>
      </div>
      <div className="flex flex-col divide-y divide-ink-100">
        {chronological.map((obs) => (
          <div key={obs.id} className="flex items-center justify-between px-6 py-3.5">
            <div>
              <p className="text-sm font-medium text-ink-700">{obs.cabin} · {obs.source}</p>
              <p className="text-xs text-ink-400">Checked {formatChecked(obs.observedDate)}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-lg text-ink-900">£{obs.price.toLocaleString('en-GB')}</p>
              <p className="text-[11px] text-ink-400">{obs.priceNote}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="border-t border-ink-100 px-6 py-3 text-xs text-ink-400">
        Every figure above is an example fare recorded manually at the date shown, not a live price feed. Use the
        partner link below to check the current price.
      </p>
    </div>
  );
}
