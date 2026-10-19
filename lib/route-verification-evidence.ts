import { isVerificationCurrent, type Route } from '@/data/routes';

/**
 * How much route-level confirmation a route's own `verification` record
 * gives today. One shared reading of the existing record and its review
 * date, used by every public surface that labels a route as verified (the
 * homepage atlas and destination pages), so they cannot drift apart.
 *
 *   - 'current': a 'verified' record whose review date has not passed.
 *   - 'historical': a 'verified' record whose review date has passed. The
 *     evidence was real on `lastConfirmedDate` but is not current
 *     confirmation, so public wording must say when it was last confirmed
 *     rather than call the route verified (and must not call it unverified
 *     either).
 *   - 'none': no record, or a record that never reached 'verified'.
 *
 * This deliberately reads the route-level record only. Directness and
 * pending/ended status still come from getEffectiveRoutePresentation(),
 * which already folds in per-airline verification and the Route Status
 * ledger; this helper only answers "is the route-level confirmation behind
 * that shape current?".
 */
export type RouteVerificationEvidence =
  | { state: 'current'; lastConfirmedDate: string }
  | { state: 'historical'; lastConfirmedDate: string }
  | { state: 'none'; lastConfirmedDate: null };

export function getRouteVerificationEvidence(route: Pick<Route, 'verification'>, nowIso: string): RouteVerificationEvidence {
  const v = route.verification;
  if (!v || v.status !== 'verified') return { state: 'none', lastConfirmedDate: null };
  if (isVerificationCurrent(v, nowIso)) return { state: 'current', lastConfirmedDate: v.verifiedDate };
  return { state: 'historical', lastConfirmedDate: v.verifiedDate };
}
