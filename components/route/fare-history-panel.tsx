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
 *
 * Collapsed by default (MAN→ISB Flagship Verdict pilot, Phase 1, September
 * 2026 — applied universally, not just on the pilot route, since this is a
 * single shared component with no per-route branching; see
 * tests/fare-history-panel-collapse.test.ts for the regression coverage
 * this needed across the wider route catalogue). A native <details> element
 * needs no client-side state, so this stays a server component exactly as
 * before. The header above it (cabin + check count) stays always visible —
 * only the individual checks collapse — so a visitor always sees how much
 * history exists before deciding whether to open it. No observation is
 * removed, reordered or reworded; this changes only whether the list starts
 * open or closed.
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
            <details>
              <summary className="cursor-pointer select-none px-6 py-3 text-sm font-semibold text-ink-700 transition-colors hover:text-ink-900">
                See all {chronological.length} check{chronological.length === 1 ? '' : 's'}
              </summary>
              <div className="flex flex-col divide-y divide-ink-100 border-t border-ink-100">
                {chronological.map((obs) => {
                  const isStale = getFareFreshnessState(daysBetweenIso(obs.observedDate, nowIso)) === 'stale';
                  return (
                    <div key={obs.id} className="flex flex-col gap-3 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-ink-700">{obs.cabin} · {obs.source}</p>
                        <p className="text-xs text-ink-400">
                          Checked {formatChecked(obs.observedDate)}
                          {isStale && ' · old check, for history only'}
                        </p>
                        <p className="mt-1 text-xs text-ink-500">
                          Travel dates: {formatChecked(obs.departureDate!)} – {formatChecked(obs.returnDate!)}
                        </p>
                      </div>
                      <div className="sm:text-right">
                        <p className={`font-display text-lg ${isStale ? 'text-ink-500' : 'text-ink-900'}`}>
                          £{obs.price.toLocaleString('en-GB')}
                        </p>
                        <p className="text-[11px] text-ink-400">{obs.priceNote}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
            <p className="border-t border-ink-100 px-6 py-3 text-xs text-ink-400">
              Every figure above is a fare checked and recorded on the date shown, not a live price feed. Use
              the partner link below to check live prices.
            </p>
          </div>
        );
      })}
    </div>
  );
}
