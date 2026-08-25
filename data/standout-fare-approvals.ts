import type { DealCabin } from '@/data/deals';

/**
 * First Standout Fare Pilot (25 Aug 2026, founder-approved). The append-only
 * founder-approval ledger for JetStash's public Standout Fare presentation —
 * see lib/standout-fare.ts for the pure derivation that consumes it and
 * JETSTASH_PRINCIPLES.md §14 for Fare Watcher's standing architecture.
 *
 * Fare Watcher candidates recompute as `lifecycle: 'detected'` on every
 * call — nothing about mathematically qualifying (`standout-candidate` /
 * `notable-drop`) makes a candidate publishable on its own (see
 * lib/fare-watcher.ts). This file is the smallest explicit mechanism that
 * turns founder sign-off into publication eligibility, without a CMS or
 * dashboard: a small, auditable, hand-edited record naming EXACTLY which
 * detected candidate and which piece of verified evidence was approved —
 * never a route slug alone, and never "whatever price appears later" (see
 * lib/standout-fare.ts's exact-match contract).
 *
 * Each record is deliberately narrow:
 *   - `detectionObservationId` anchors the approval to the SAME candidate
 *     identity Fare Watcher itself anchors to (lib/fare-watcher.ts's
 *     `toCandidate()` — `id`/`checkedDate` stay pinned to the original
 *     detection observation even once a later recheck supplies the
 *     evaluated evidence). If a future routine observation ever supersedes
 *     this detection under `latestCurrentObservationsByIdentity()`'s own
 *     "one current observation per identity" rule, this approval simply
 *     stops resolving to any live candidate — it is never silently
 *     re-pointed at a new detection.
 *   - `approvedVerifiedObservationId` is the EXACT verification-recheck
 *     observation the founder reviewed and approved (its price, routing,
 *     baggage evidence — everything a customer would see). If a later
 *     recheck arrives with a different id (any price movement, even a
 *     smaller one), `getApprovedStandoutFare()` requires an exact id match
 *     and fails closed rather than silently carrying the approval forward
 *     onto unreviewed evidence. Re-approving after a genuine price move is
 *     a deliberate, separate, auditable act: append a new record (or edit
 *     this one with a new `approvedVerifiedObservationId` and
 *     `approvedDate`) — never automatic.
 *   - `revokedDate`, once set, makes the record permanently inert without
 *     deleting it — consistent with this codebase's append-only evidence
 *     convention elsewhere (data/fare-observations.ts, data/route-status-
 *     events.ts). Nothing currently sets it; it exists so a founder
 *     decision to pull a pilot never requires deleting the audit trail.
 */
export interface StandoutFareApproval {
  id: string;
  routeSlug: string;
  cabin: DealCabin;
  /** The routine observation Fare Watcher's own candidate identity is anchored to. */
  detectionObservationId: string;
  /** The exact emergency-recheck observation the founder reviewed and approved as current evidence. */
  approvedVerifiedObservationId: string;
  approvedDate: string;
  approvedBy: 'founder';
  /** Human audit note — the "why", never read as evidence for any customer-facing claim. */
  note: string;
  /** Set only to permanently retire an approval without deleting its audit trail. Never read except as a publish-blocking gate. */
  revokedDate?: string;
}

export const standoutFareApprovals: StandoutFareApproval[] = [
  {
    id: 'standout-manchester-islamabad-2026-08-25',
    routeSlug: 'manchester-islamabad',
    cabin: 'Economy',
    detectionObservationId: 'obs-man-isb-economy-20260825-8w-v1',
    approvedVerifiedObservationId: 'obs-man-isb-economy-20260825-recheck-v1',
    approvedDate: '2026-08-25',
    approvedBy: 'founder',
    note:
      'First public Standout Fare pilot. Detected £460 (25 Aug routine check), independently rechecked £480 (25 Aug emergency-recheck, Riyadh Air, MAN-RUH-ISB/ISB-RUH-MAN, 1 stop each way, no self-transfer notice, baggage cost/inclusion uncertain). £141 below the £621 comparable tracked median (~22.7%), Fare Watcher qualification standout-candidate. Approved as a tightly controlled single-route pilot — MAN-LHE £547, LHR-JED £361 and BHX-ATQ £591 remain deliberately unapproved.',
  },
];
