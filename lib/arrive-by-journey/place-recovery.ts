import type { JourneyPlan } from './types';

/**
 * Independent place-recovery state for the full journey.
 *
 * ROOT CAUSE this module exists to fix: the journey API is stateless. Each request
 * re-resolves BOTH places from their text and honours only the place IDs sent WITH THAT
 * REQUEST. The first UI sent only the choice the user had just made, so confirming the
 * start (request 2) dropped the destination's pending choice, and confirming the
 * destination (request 3) dropped the start's -- each side's prompt came back in turn and
 * the form oscillated forever. The server was correct all along: sent together, both
 * choices resolve in one request.
 *
 * The fix is that the CLIENT holds one choice per side and resubmits both every time:
 *
 *   start       { confirmedPlaceId? | selectedPlaceId? }
 *   destination { confirmedPlaceId? | selectedPlaceId? }
 *
 * This is convenience state, never trust: the server re-verifies each ID against a fresh
 * geocode on every request (place-choice.ts), so a stale or forged ID is simply not
 * honoured and its side asks again -- without disturbing the other side.
 *
 * Pure and client-safe (types only from ./types).
 */

export type PlaceSide = 'start' | 'destination';

export interface PlaceChoice {
  confirmedPlaceId?: string;
  selectedPlaceId?: string;
}

export interface RecoveryState {
  start: PlaceChoice;
  destination: PlaceChoice;
}

export const EMPTY_RECOVERY: RecoveryState = { start: {}, destination: {} };

/** The user said "yes, that place" for one side. Replaces any earlier choice for that side only. */
export function chooseConfirmed(state: RecoveryState, side: PlaceSide, placeId: string): RecoveryState {
  return { ...state, [side]: { confirmedPlaceId: placeId } };
}

/** The user picked one candidate for one side. Replaces any earlier choice for that side only. */
export function chooseSelected(state: RecoveryState, side: PlaceSide, placeId: string): RecoveryState {
  return { ...state, [side]: { selectedPlaceId: placeId } };
}

/** The user edited that side's text: its earlier choice no longer describes what was typed. The other side is untouched. */
export function invalidateSide(state: RecoveryState, side: PlaceSide): RecoveryState {
  const current = state[side];
  return current.confirmedPlaceId || current.selectedPlaceId ? { ...state, [side]: {} } : state;
}

/**
 * Changing the ARRIVAL airport to one in a different country changes the destination's
 * country gate, so only the destination's choice is invalidated. Changing the departure
 * airport never affects either place (the start is always gated to the UK), so nothing is reset.
 */
export function invalidateForArrivalAirportChange(state: RecoveryState, previousCountry: string | undefined, nextCountry: string | undefined): RecoveryState {
  return previousCountry === nextCountry ? state : invalidateSide(state, 'destination');
}

/** The four request fields the API accepts. Only sides that actually have a choice contribute a field. */
export function toRequestFields(state: RecoveryState): {
  startConfirmedPlaceId?: string;
  startSelectedPlaceId?: string;
  confirmedPlaceId?: string;
  selectedPlaceId?: string;
} {
  return {
    ...(state.start.confirmedPlaceId ? { startConfirmedPlaceId: state.start.confirmedPlaceId } : {}),
    ...(state.start.selectedPlaceId ? { startSelectedPlaceId: state.start.selectedPlaceId } : {}),
    ...(state.destination.confirmedPlaceId ? { confirmedPlaceId: state.destination.confirmedPlaceId } : {}),
    ...(state.destination.selectedPlaceId ? { selectedPlaceId: state.destination.selectedPlaceId } : {}),
  };
}

export interface PendingSides {
  start: 'NONE' | 'CONFIRM' | 'SELECT' | 'CLARIFY';
  destination: 'NONE' | 'CONFIRM' | 'SELECT' | 'CLARIFY';
}

const kind = (detail: { pendingConfirmation?: unknown; pendingSelection?: unknown } | undefined, hasClarification: boolean): PendingSides['start'] =>
  !detail ? 'NONE' : detail.pendingSelection ? 'SELECT' : detail.pendingConfirmation ? 'CONFIRM' : hasClarification ? 'CLARIFY' : 'CLARIFY';

/** What each side still needs after a response. NONE means that side resolved. */
export function pendingSides(plan: JourneyPlan): PendingSides {
  return {
    start: kind(plan.startDetail, true),
    // Successful transit keeps arrivalDetail to explain the journey, not to request place recovery.
    destination: kind(plan.arrivalDetail && plan.arrivalDetail.outcome !== 'ROUTE_UNAVAILABLE' && plan.arrivalDetail.outcome !== 'ETA_ONLY' ? plan.arrivalDetail : undefined, true),
  };
}

/**
 * After a response, forget a side's choice ONLY if the server sent that side back for recovery
 * even though we had supplied a choice for it: that means the ID was stale or forged and was not
 * honoured, so keeping it would just resend a dead ID. The other side's resolved choice is kept.
 */
export function reconcileWithPlan(sent: RecoveryState, plan: JourneyPlan): RecoveryState {
  const pending = pendingSides(plan);
  let next = sent;
  if (pending.start !== 'NONE' && (sent.start.confirmedPlaceId || sent.start.selectedPlaceId)) next = invalidateSide(next, 'start');
  if (pending.destination !== 'NONE' && (sent.destination.confirmedPlaceId || sent.destination.selectedPlaceId)) next = invalidateSide(next, 'destination');
  return next;
}
