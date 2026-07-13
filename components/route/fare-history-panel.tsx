import { TrendingUp } from 'lucide-react';
import type { FareObservation } from '@/data/fare-observations';
import { isPubliclyPublishable } from '@/data/fare-observations';
import { formatChecked, type DealCabin } from '@/data/deals';
import { getFareFreshnessState, daysBetweenIso } from '@/lib/freshness-thresholds';

/**
 * Renders a route's fare observation history — the accumulating record
 * that makes fare context on this site editorial ("tracked over time")
 * rather than a single unverifiable snapshot.
 *
 * Truth Reset (July 2026): grouped by cabin — an Economy and a Business
 * observation are two different journeys, never one combined "N fares
 * tracked" history (§2's comparable-observations rule). Only publicly
 * publishable observations (both travel dates recorded — see
 * `isPubliclyPublishable`) are shown at all; anything incomplete is
 * silently excluded here rather than rendered with a caveat, since an
 * incomplete fare isn't safe to show publicly regardless of framing.
 * Renders nothing if no cabin group has anything publishable.
 *
 * Rows past OBSERVATION_STALE_DAYS are visually de-emphasised (never
 * hidden — the history stays honest and complete) so a years-old check
 * doesn't read as current at a glance.
 */
export function FareHistoryPanel({ observations }: { observations: FareObservation[] }) {
  const publishable = observations.filter(isPubliclyPublishable);
  if (publishable.length === 0) return null;

  const byCabin = new Map<DealCabin, FareObservation[]>();
  for (const obs of publishable) {
    const group = byCabin.get(obs.cabin) ?? [];
    group.push(obs);
    byCabin.set(obs.cabin, group);
  }

  const nowIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      {[...byCabin.entries()].map(([cabin, cabinObservations]) => {
        const chronological = [...cabinObservations].sort((a, b) => b.observedDate.localeCompare(a.observedDate));
        return (
          <div key={cabin} className="rounded-md border border-ink-100 bg-white">
            <div className="flex items-center gap-2 border-b border-ink-100 px-6 py-4">
              <TrendingUp className="h-4.5 w-4.5 text-terracotta-600" strokeWidth={2} />
              <h3 className="font-display text-lg text-ink-900">
                {cabin} · {chronological.length} comparable check{chronological.length === 1 ? '' : 's'} tracked
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
              Every figure above is a fare our team checked and recorded on the date shown, not a live price feed. Use
              the partner link below to check live prices.
            </p>
          </div>
        );
      })}
    </div>
  );
}
