import { computeBookBySnapshot, BOOK_BY_PRIORITY_ROUTE_SLUGS, type BookBySnapshot } from '@/lib/booking-intelligence';
import { getActiveWarningsByRoute } from '@/data/route-warnings';
import type { RouteWarning } from '@/data/route-warnings';

/**
 * The Travel Intelligence Engine — the single composition layer that
 * resolves every intelligence module into one customer-facing answer to
 * "Am I ready to book?" (JETSTASH_PRINCIPLES.md §14.2). Book-By Countdown,
 * route warnings, and Travel Ready Check (§14.3, lib/travel-ready-check.ts)
 * all compose here; nothing outside this file resolves multiple signals
 * into a verdict.
 *
 * "One recommendation" means one verdict, never one blended score. Signals
 * resolve via a priority decision tree (the most serious true fact wins),
 * the exact same philosophy as lib/founder-insights.ts's worst() — never an
 * average, never a weighted composite. Every fact behind the verdict stays
 * individually attributed in `reasons`, so the top-line answer never hides
 * what it's built from.
 */

export type ReadinessVerdict =
  /** An active critical fact overrides timing entirely — check before booking. */
  | 'wait-critical'
  /** Booking window hasn't opened yet. */
  | 'not-yet'
  /** Past the recommended window, or inside the typical surge zone — act soon. */
  | 'book-soon'
  /** Booking window is open and nothing overrides it. */
  | 'ready'
  /** Booking window is open, but an active caution-level fact is worth reading first. */
  | 'ready-with-caution';

export interface EngineReason {
  source: 'booking-window' | 'route-warning' | 'travel-ready-check';
  severity: 'info' | 'caution' | 'critical';
  label: string;
  detail: string;
  href?: string;
}

/**
 * The Travel Ready Check signal (JETSTASH_PRINCIPLES.md §14.3) — computed
 * entirely client-side by lib/travel-ready-check.ts from a visitor's own
 * inputs, then threaded into computeReadiness()'s optional 3rd parameter.
 * Null whenever no check has been completed for this route yet.
 */
export interface TravelReadySignal {
  severity: 'info' | 'caution' | 'critical';
  label: string;
  detail: string;
}

export interface EngineSnapshot {
  routeSlug: string;
  verdict: ReadinessVerdict;
  reasons: EngineReason[];
  bookBy: BookBySnapshot;
  activeWarnings: RouteWarning[];
  travelReadySignal: TravelReadySignal | null;
  computedForDate: string;
}

function warningToReason(w: RouteWarning, routeSlug: string): EngineReason {
  return {
    source: 'route-warning',
    severity: w.severity,
    label: w.title,
    detail: w.body,
    href: `/routes/${routeSlug}`,
  };
}

function bookByToReason(bookBy: BookBySnapshot): EngineReason {
  return {
    source: 'booking-window',
    severity: bookBy.state === 'surge' || bookBy.state === 'inside-period' ? 'caution' : 'info',
    label: `${bookBy.event.periodLabel} booking guidance`,
    detail:
      bookBy.state === 'window-open'
        ? `Recommended booking window is open, closes ${bookBy.bookByDate}.`
        : `Book-by date: ${bookBy.bookByDate}.`,
  };
}

function travelReadyToReason(signal: TravelReadySignal): EngineReason {
  return {
    source: 'travel-ready-check',
    severity: signal.severity,
    label: signal.label,
    detail: signal.detail,
  };
}

/**
 * The engine's readiness verdict for one route, or null when the route has
 * no Book-By coverage (outside the V1 priority set) — the engine composes
 * existing modules, it doesn't invent a verdict for a route none of them
 * cover yet.
 *
 * `travelReadySignal` is optional and defaults to null (today's behaviour
 * for every build-time/initial-mount call site). It's supplied by
 * components/route/route-readiness-panel.tsx once a visitor completes a
 * Travel Ready Check for this route, entirely client-side — the engine
 * itself never computes this signal (JETSTASH_PRINCIPLES.md §14.3).
 */
export function computeReadiness(
  routeSlug: string,
  now: Date,
  travelReadySignal: TravelReadySignal | null = null
): EngineSnapshot | null {
  const bookBy = computeBookBySnapshot(routeSlug, now);
  if (!bookBy) return null;

  const activeWarnings = getActiveWarningsByRoute(routeSlug);
  const criticalWarnings = activeWarnings.filter((w) => w.severity === 'critical');
  const cautionWarnings = activeWarnings.filter((w) => w.severity === 'caution');
  const travelReadyCritical = travelReadySignal?.severity === 'critical';
  const travelReadyCaution = travelReadySignal?.severity === 'caution';

  const reasons: EngineReason[] = [
    bookByToReason(bookBy),
    ...activeWarnings.map((w) => warningToReason(w, routeSlug)),
    ...(travelReadySignal ? [travelReadyToReason(travelReadySignal)] : []),
  ];

  // Priority decision tree — worst true fact wins, never blended.
  let verdict: ReadinessVerdict;
  if (criticalWarnings.length > 0 || travelReadyCritical) {
    verdict = 'wait-critical';
  } else if (bookBy.state === 'too-early' || bookBy.state === 'pre-surge') {
    // 'pre-surge' means no route-specific window exists yet but the surge
    // zone is still well off — genuinely calm, not urgent. Bug caught in
    // live testing: this used to fall into 'book-soon' below, which
    // directly contradicted the panel's own "aim to book before <date
    // months away>" headline on routes with no stated recommended window
    // (e.g. Heathrow–Jeddah, ~200 days out). The verdict badge must never
    // disagree with the headline sitting directly beneath it.
    verdict = 'not-yet';
  } else if (bookBy.state === 'window-open') {
    verdict = cautionWarnings.length > 0 || travelReadyCaution ? 'ready-with-caution' : 'ready';
  } else {
    // 'surge' | 'late' | 'inside-period' — timing itself says act soon.
    verdict = 'book-soon';
  }

  return {
    routeSlug,
    verdict,
    reasons,
    bookBy,
    activeWarnings,
    travelReadySignal,
    computedForDate: bookBy.computedForDate,
  };
}

/** Engine snapshots for every route the engine currently covers, for founder-side review. */
export function computeAllReadinessSnapshots(now: Date): EngineSnapshot[] {
  // Reuses the same priority-route set Book-By already gates on — the
  // engine never covers a route Book-By doesn't.
  return BOOK_BY_PRIORITY_ROUTE_SLUGS.map((slug) => computeReadiness(slug, now)).filter(
    (s): s is EngineSnapshot => s !== null
  );
}

export const VERDICT_COPY: Record<ReadinessVerdict, { label: string; tone: 'critical' | 'caution' | 'ready' | 'neutral' }> = {
  'wait-critical': { label: 'Check before booking', tone: 'critical' },
  'not-yet': { label: 'Not yet', tone: 'neutral' },
  'book-soon': { label: 'Book soon', tone: 'caution' },
  ready: { label: 'Ready to book', tone: 'ready' },
  'ready-with-caution': { label: 'Ready, with one thing to check', tone: 'caution' },
};
