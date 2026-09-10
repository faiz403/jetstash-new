/**
 * Weekly Commercial Funnel — deterministic calculation engine.
 *
 * Not imported by any app page or API route — this is a project-control
 * tool for turning manually-recorded weekly figures
 * (docs/project-control/commercial-funnel/) into rates, never a new
 * analytics platform or public surface. See
 * docs/project-control/commercial-funnel/README.md for the methodology
 * this module implements.
 *
 * The one rule every function here exists to enforce: a rate is only ever
 * computed between two numbers that are genuinely comparable — same scope
 * (the same specific route, or both explicitly account-wide/unallocated),
 * both actually observed. Anything else fails closed to 'N/A' rather than
 * producing a number that looks precise but isn't real. This is the
 * concrete form of the funnel brief's own rule: "route visitors +
 * account-wide Trip.com clicks MUST NOT become a route conversion rate."
 */

/**
 * How trustworthy a single figure is, following the funnel brief's own
 * four labels:
 * - ATTRIBUTED: genuinely tied to this exact route/scope, from a real
 *   source (an event property, a dashboard filter, a partner report row).
 * - PARTIALLY_ATTRIBUTED: some but not all of the figure can be tied to
 *   this scope (e.g. most CTA clicks carry a route, some don't).
 * - UNALLOCATED: real, observed activity that cannot currently be joined
 *   to a specific route (e.g. Trip.com's own commission report, which has
 *   no route-level breakdown until trip_sub1 is confirmed — see
 *   docs/project-control/commercial-funnel/README.md's attribution-gaps
 *   section). Still a real number — just not at route scope.
 * - NOT_OBSERVABLE: no source exists yet, or this session had no access to
 *   the source that would carry it. Never a proxy or an estimate.
 */
export type EvidenceQuality = 'ATTRIBUTED' | 'PARTIALLY_ATTRIBUTED' | 'UNALLOCATED' | 'NOT_OBSERVABLE';

/**
 * What a figure is actually measuring the population of. Two values can
 * only be divided by one another when their scope matches exactly —
 * 'route' values must additionally share the same route slug (checked by
 * the caller via FunnelValue.routeSlug; this module only knows the coarse
 * scope tag itself, since it has no route registry of its own).
 */
export type FunnelScope = 'route' | 'account';

export interface FunnelValue {
  /** null means NOT_OBSERVABLE — no number was ever entered, not zero. */
  value: number | null;
  scope: FunnelScope;
  quality: EvidenceQuality;
  /** Required when scope is 'route' — the exact route slug this figure is attributed to. */
  routeSlug?: string;
}

/** A NOT_OBSERVABLE placeholder — use this rather than inventing a scope/quality for an absent figure. */
export function notObservable(scope: FunnelScope, routeSlug?: string): FunnelValue {
  return { value: null, scope, quality: 'NOT_OBSERVABLE', routeSlug };
}

/** An UNALLOCATED figure — real, observed, but not joinable to a specific route. Always account scope. */
export function unallocated(value: number): FunnelValue {
  return { value, scope: 'account', quality: 'UNALLOCATED' };
}

/** A genuinely route-attributed figure. */
export function attributed(value: number, routeSlug: string): FunnelValue {
  return { value, scope: 'route', quality: 'ATTRIBUTED', routeSlug };
}

/**
 * The one place a rate gets computed. Returns 'N/A' — never 0, never a
 * misleading number — whenever the two values aren't genuinely comparable:
 *
 *  - either is NOT_OBSERVABLE (value === null)
 *  - the denominator is 0 (would divide by zero)
 *  - scopes don't match ('route' vs 'account')
 *  - both are 'route' scope but for different routes
 *
 * A UNALLOCATED/UNALLOCATED pair at matching 'account' scope IS a valid
 * rate — two real account-wide numbers can be divided by each other; what
 * they can never do is masquerade as a specific route's rate. Callers that
 * want to label the *result* accordingly can inspect the inputs' own
 * quality; this function only decides whether division is safe at all.
 */
export function computeRate(numerator: FunnelValue, denominator: FunnelValue): number | 'N/A' {
  if (numerator.value === null || denominator.value === null) return 'N/A';
  if (denominator.value === 0) return 'N/A';
  if (numerator.scope !== denominator.scope) return 'N/A';
  if (numerator.scope === 'route' && numerator.routeSlug !== denominator.routeSlug) return 'N/A';
  return numerator.value / denominator.value;
}

/** computeRate() formatted as a percentage string, or 'N/A' unchanged. */
export function computeRatePercent(numerator: FunnelValue, denominator: FunnelValue, decimals = 1): string {
  const rate = computeRate(numerator, denominator);
  return rate === 'N/A' ? 'N/A' : `${(rate * 100).toFixed(decimals)}%`;
}

/** A currency-per-unit figure (e.g. commission per CTA click) — same fail-closed rule as computeRate. */
export function computePerUnit(totalValue: FunnelValue, unitCount: FunnelValue, currencySymbol = '£'): string {
  const rate = computeRate(totalValue, unitCount);
  return rate === 'N/A' ? 'N/A' : `${currencySymbol}${rate.toFixed(2)}`;
}

/**
 * One week's figures for one scope (a specific route, or the literal
 * string 'ACCOUNT-WIDE' when a figure can't be allocated to a route). This
 * is the shape docs/project-control/commercial-funnel weekly reports are
 * transcribed from/to — kept here as the typed contract so a weekly file
 * and this engine can't silently drift apart.
 */
export interface WeeklyFunnelRow {
  weekLabel: string;
  routeSlugOrScope: string;
  visitors: FunnelValue;
  usefulInteractions: FunnelValue;
  partnerCtaClicks: FunnelValue;
  validatedBookings: FunnelValue;
  commissionSettledGbp: FunnelValue;
  commissionPendingGbp: FunnelValue;
  /** Manually recorded, minutes. null when not logged that week. */
  founderEffortMinutes: number | null;
}

export interface WeeklyFunnelRates {
  visitorToInteractionRate: string;
  interactionToCtaRate: string;
  visitorToCtaRate: string;
  ctaToBookingRate: string;
  visitorToBookingRate: string;
  commissionPerVisitor: string;
  commissionPerCta: string;
  commissionPerFounderHour: string;
}

/** Total settled + pending commission as one FunnelValue, for the commission-per-X helpers. Fails closed if either half is unobserved and the other isn't zero-safe to assume — see doc comment on the branch below. */
function totalCommission(row: WeeklyFunnelRow): FunnelValue {
  const { commissionSettledGbp: settled, commissionPendingGbp: pending } = row;
  // Only combine when both halves are genuinely observed at a matching
  // scope — a NOT_OBSERVABLE pending figure must not silently become 0 and
  // understate total commission next to a real settled figure.
  if (settled.value === null || pending.value === null) return notObservable(settled.scope, settled.routeSlug);
  if (settled.scope !== pending.scope) return notObservable(settled.scope, settled.routeSlug);
  if (settled.scope === 'route' && settled.routeSlug !== pending.routeSlug) return notObservable(settled.scope, settled.routeSlug);
  return {
    value: settled.value + pending.value,
    scope: settled.scope,
    quality: settled.quality === 'ATTRIBUTED' && pending.quality === 'ATTRIBUTED' ? 'ATTRIBUTED' : 'PARTIALLY_ATTRIBUTED',
    routeSlug: settled.routeSlug,
  };
}

/** Computes every named rate from the funnel brief's Step 4, fail-closed throughout. */
export function computeWeeklyFunnelRates(row: WeeklyFunnelRow): WeeklyFunnelRates {
  const commission = totalCommission(row);
  const founderHours: FunnelValue =
    row.founderEffortMinutes === null
      ? notObservable(row.visitors.scope, row.visitors.routeSlug)
      : { value: row.founderEffortMinutes / 60, scope: row.visitors.scope, quality: 'ATTRIBUTED', routeSlug: row.visitors.routeSlug };

  return {
    visitorToInteractionRate: computeRatePercent(row.usefulInteractions, row.visitors),
    interactionToCtaRate: computeRatePercent(row.partnerCtaClicks, row.usefulInteractions),
    visitorToCtaRate: computeRatePercent(row.partnerCtaClicks, row.visitors),
    ctaToBookingRate: computeRatePercent(row.validatedBookings, row.partnerCtaClicks),
    visitorToBookingRate: computeRatePercent(row.validatedBookings, row.visitors),
    commissionPerVisitor: computePerUnit(commission, row.visitors),
    commissionPerCta: computePerUnit(commission, row.partnerCtaClicks),
    commissionPerFounderHour: computePerUnit(commission, founderHours),
  };
}
