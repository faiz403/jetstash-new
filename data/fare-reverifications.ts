/**
 * Structured reverification ledger (FARE-SIGNAL-RECHECK-001, 7 October 2026).
 *
 * An append-only record of the cases where a later targeted recheck of the
 * SAME search window did one of two specific things to an earlier observation:
 *
 *   - 'same-itinerary-repriced': the recheck positively found the same
 *     itinerary (carrier, stops, connection airports and journey times, all
 *     structured fields) at a different current price. The earlier price is no
 *     longer what a traveller would pay for that itinerary.
 *   - 'not-reproduced': the recheck's own record states that the earlier fare
 *     could not be reproduced in a fresh search of the exact same query.
 *
 * Effect (lib/fare-reverification.ts, consumed only by the public Fare Signal
 * selector in lib/fare-signal.ts): the TARGET observation stops being
 * eligible for public current-fare selection. Nothing else moves:
 *   - The archive is untouched. Both observations stay exactly as recorded,
 *     keep appearing as history, and keep counting for Fare Watcher baselines.
 *   - The reverifying observation is never promoted by this ledger. It must
 *     still win under the ordinary clean / display-eligibility / lowest-fare
 *     rules, like any other observation.
 *   - Fare Watcher, Route Watch and Standout approvals do not read this file.
 *
 * Why a ledger and not a field on the observation: archive records are
 * append-only and never edited (see data/fare-observations.ts), and the
 * relationship is a researcher's explicit assertion, so it is recorded
 * explicitly rather than inferred from free text. An entry whose structured
 * evidence does not check out at selection time is inert (fail safe: the
 * target simply stays eligible) -- see lib/fare-reverification.ts.
 *
 * Scope is deliberately three entries. A later same-window routine
 * observation, or an implied non-reproduction, is a wider policy question and
 * is NOT expressed here (tracked separately in docs/project-control/ROADMAP.md).
 */
export type FareReverificationOutcome = 'same-itinerary-repriced' | 'not-reproduced';

export interface FareReverification {
  id: string;
  /** The later targeted recheck (must be an `emergency-recheck` observation). */
  reverifyingObservationId: string;
  /** The earlier observation whose public eligibility the recheck ends. */
  targetObservationId: string;
  outcome: FareReverificationOutcome;
  recordedDate: string;
  /** Human audit note -- never rendered publicly. */
  note: string;
}

export const fareReverifications: FareReverification[] = [
  {
    id: 'reverify-man-isb-economy-20260825',
    reverifyingObservationId: 'obs-man-isb-economy-20260825-recheck-v1',
    targetObservationId: 'obs-man-isb-economy-20260825-8w-v1',
    outcome: 'same-itinerary-repriced',
    recordedDate: '2026-10-07',
    note:
      'The 25 August emergency recheck was a fresh search for the exact MAN-ISB window (20 October-3 November 2026) and found the same Riyadh Air itinerary (1 stop each way via RUH, identical journey and layover times) at £480. The routine £460 for that itinerary was not reconfirmed. Recorded 7 October 2026 after the 4 October lowest-fare policy let the lower £460 keep winning over its own same-day recheck.',
  },
  {
    id: 'reverify-bhx-atq-economy-20260818',
    reverifyingObservationId: 'obs-bhx-atq-economy-20260819-8w-v1',
    targetObservationId: 'obs-bhx-atq-economy-20260818-8w-v1',
    outcome: 'not-reproduced',
    recordedDate: '2026-10-07',
    note:
      'The 19 August emergency recheck states the 18 August £579 fare could not be reproduced in a fresh search of exact BHX-ATQ, 13-27 October 2026. The £603 recheck is a different itinerary and is NOT promoted by this entry; it is only used if it wins under the ordinary eligibility and lowest-fare rules.',
  },
  {
    id: 'reverify-lhr-jed-economy-20260818',
    reverifyingObservationId: 'obs-lhr-jed-economy-20260819-8w-v1',
    targetObservationId: 'obs-lhr-jed-economy-20260818-8w-v1',
    outcome: 'not-reproduced',
    recordedDate: '2026-10-07',
    note:
      'The 19 August emergency recheck states the 18 August £367 fare could not be reproduced in a fresh search of exact LHR-JED, 13-27 October 2026. The £535 recheck is a separate-tickets itinerary and is NOT promoted by this entry (a clean fare always outranks a self-transfer one in Fare Signal selection).',
  },
];
