import type { DealCabin } from '@/data/deals';
import type { FareObservation } from '@/data/fare-observations';
import { standoutFareApprovals, type StandoutFareApproval } from '@/data/standout-fare-approvals';
import {
  generateFareWatcherCandidates,
  isFareWatcherCandidateExpired,
  type FareWatcherQualification,
} from '@/lib/fare-watcher';
import { toSignalObservation, type FareSignalObservation } from '@/lib/fare-signal';

/**
 * First Standout Fare Pilot (25 Aug 2026, founder-approved). The one public
 * entry point that turns a founder-approved data/standout-fare-approvals.ts
 * record into a customer-facing presentation — or fails closed to `null`,
 * which every consumer (components/route/fare-signal.tsx) must treat as
 * "render the ordinary Fare Signal, nothing more."
 *
 * Every field on StandoutFarePresentation is derived here, at call time,
 * from Fare Watcher's live verified-candidate evidence
 * (lib/fare-watcher.ts's generateFareWatcherCandidates()) — never
 * hardcoded, never reconstructed independently by a component. This is
 * deliberately the ONLY place a component may obtain Standout Fare
 * evidence from.
 *
 * Fail-closed contract (all of the following must hold, checked in order):
 *   1. An unrevoked approval exists for this exact routeSlug + cabin.
 *   2. Fare Watcher currently produces a candidate anchored to that
 *      approval's exact `detectionObservationId` — absent whenever the
 *      candidate no longer mathematically qualifies (a later recheck raised
 *      the fare past the standing thresholds) or its detection identity has
 *      been superseded by a newer routine observation.
 *   3. That candidate is not expired under Fare Watcher's OWN existing
 *      expiry rule (isFareWatcherCandidateExpired — checked-date age past
 *      OBSERVATION_STALE_DAYS, or travel dates already in the past). No new
 *      expiry window is invented here.
 *   4. The candidate's CURRENT verified evidence
 *      (`candidate.verifiedObservation.id`) still exactly matches the
 *      approval's `approvedVerifiedObservationId`. This is the narrow
 *      price-movement-safety rule: founder approval of £480 is approval of
 *      THAT £480 observation, not of whatever a future recheck happens to
 *      find. A later recheck (any price, even one that would still
 *      qualify) mints a new observation id, which fails this exact-match
 *      check and makes the Standout state disappear until a human
 *      approves the new evidence — it never silently carries the approval
 *      forward.
 *
 * Deliberately does not gate on FareSignal's own 'current'/'recent' state —
 * the caller (the route page) is expected to only surface this alongside a
 * 'current' Fare Signal observation that IS this exact verified evidence
 * (matched by `id`); see components/route/fare-signal.tsx.
 */
export interface StandoutFarePresentation {
  /** The exact same public-safe view model Fare Signal itself renders — same mapping, same evidence, same isSelfTransfer predicate. */
  observation: FareSignalObservation;
  /** JetStash's own comparable tracked median, from Fare Watcher's live baseline — never the whole market. */
  baselineMedian: number;
  differencePounds: number;
  differencePercent: number;
  qualification: Exclude<FareWatcherQualification, 'insufficient-baseline' | 'ordinary-fare'>;
  /** Raw archive baggage text (data/fare-observations.ts `baggage` field) — never reworded into an inclusion/cost claim, never defaulted to "included" or £0. */
  baggageDetail: string;
}

/**
 * Pure derivation, parameterised over the approvals list purely so tests can
 * exercise the fail-closed contract with synthetic approvals/observations
 * without touching the real founder-approval ledger. `getApprovedStandoutFare`
 * below is the one production entry point — always called with the real
 * `standoutFareApprovals` — and every route page must go through it, never
 * this function directly.
 */
export function deriveApprovedStandoutFare(
  approvals: readonly StandoutFareApproval[],
  routeSlug: string,
  cabin: DealCabin,
  observations: readonly FareObservation[],
  nowIso: string
): StandoutFarePresentation | null {
  const approval = approvals.find(
    (candidate) => candidate.routeSlug === routeSlug && candidate.cabin === cabin && !candidate.revokedDate
  );
  if (!approval) return null;

  const candidates = generateFareWatcherCandidates([...observations], nowIso);
  const candidate = candidates.find((item) => item.id === `fare-watcher-${approval.detectionObservationId}`);
  if (!candidate) return null;
  if (candidate.routeSlug !== approval.routeSlug) return null;
  if (isFareWatcherCandidateExpired(candidate, nowIso)) return null;
  if (candidate.verifiedObservation.id !== approval.approvedVerifiedObservationId) return null;
  if (candidate.verifiedObservation.cabin !== approval.cabin) return null;

  const signalObservation = toSignalObservation(candidate.verifiedObservation);
  if (!signalObservation) return null;

  return {
    observation: signalObservation,
    baselineMedian: candidate.baselineMedian,
    differencePounds: candidate.differencePounds,
    differencePercent: candidate.differencePercent,
    qualification: candidate.qualification,
    baggageDetail: candidate.verifiedObservation.baggage ?? 'not stated',
  };
}

export function getApprovedStandoutFare(
  routeSlug: string,
  cabin: DealCabin,
  observations: readonly FareObservation[],
  nowIso: string
): StandoutFarePresentation | null {
  return deriveApprovedStandoutFare(standoutFareApprovals, routeSlug, cabin, observations, nowIso);
}
