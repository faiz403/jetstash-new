import { Info } from 'lucide-react';
import type { FareWindowReconciliation } from '@/lib/fare-window-reconciliation';

/**
 * Route Page Simplification Phase 1 (25 Aug 2026) — the one reconciliation
 * sentence between two fare blocks that cover different travel dates. See
 * lib/fare-window-reconciliation.ts for the derivation and the audit finding
 * it closes.
 *
 * Presentation notes:
 *   - Rendered by app/routes/[slug]/page.tsx directly ABOVE the second fare
 *     block (Journey Choice), deliberately outside that component, so the
 *     frozen Journey Choice pilot's own markup, evidence drawer, dated
 *     Trip.com handoff and impression instrumentation are untouched.
 *   - Deliberately quieter than RouteVsFareCallout's terracotta treatment.
 *     This is orientation, not a warning: neither fare is wrong, and nothing
 *     here is a caution about booking.
 *   - Adds no CTA, no link and no affiliate disclosure — the page's CTA
 *     count and disclosure count are unchanged by this note.
 */
export function FareWindowReconciliationNote({
  reconciliation,
}: {
  reconciliation: FareWindowReconciliation;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-ink-100 bg-sand-50 p-4">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={2} aria-hidden="true" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Different travel dates</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{reconciliation.sentence}</p>
      </div>
    </div>
  );
}
