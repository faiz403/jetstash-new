import { PAKISTAN_AIRPORT_CODES } from './airports';
import type { PakistanAirportCode, PakistanJourneyInput, PakistanPickupMode } from './types';

/**
 * Shared request-body validation for BOTH the founder-only and public
 * Pakistan Arrive By API routes — one place so the two surfaces can never
 * drift on what counts as a valid journey request.
 */

const PICKUP_MODES: readonly PakistanPickupMode[] = ['family', 'pre-booked', 'arrange-after-landing', 'other'];

/** Google place IDs are short, opaque tokens (typically well under 200 chars) — a length cap here costs nothing and closes a trivial amplification/log-noise vector now that this is reachable publicly. Never a Google-specific format regex: place IDs aren't a documented, stable format worth hard-coding against. */
const MAX_PLACE_ID_LENGTH = 200;

export function cleanInput(value: unknown): PakistanJourneyInput {
  if (!value || typeof value !== 'object') throw new Error('Enter the journey details.');
  const body = value as Record<string, unknown>;

  const airportCode = typeof body.airportCode === 'string' ? (body.airportCode as PakistanAirportCode) : undefined;
  if (!airportCode || !PAKISTAN_AIRPORT_CODES.includes(airportCode)) throw new Error('Choose a supported arrival airport.');

  const landingAt = typeof body.landingAt === 'string' ? body.landingAt : '';
  if (!landingAt) throw new Error('Enter your flight landing date and time.');

  const airportExitBufferMinutes = Number(body.airportExitBufferMinutes);
  if (!Number.isSafeInteger(airportExitBufferMinutes) || airportExitBufferMinutes < 0 || airportExitBufferMinutes > 480) {
    throw new Error('Enter a realistic airport-exit time in minutes (0 to 480).');
  }

  const destination = typeof body.destination === 'string' ? body.destination.trim() : '';
  if (destination.length < 2 || destination.length > 180) throw new Error('Enter a final destination.');

  const pickupMode = typeof body.pickupMode === 'string' ? (body.pickupMode as PakistanPickupMode) : undefined;
  if (!pickupMode || !PICKUP_MODES.includes(pickupMode)) throw new Error('Choose how you are leaving the airport.');

  const pickupWaitRaw = body.pickupWaitMinutes;
  const pickupWaitMinutes = pickupWaitRaw === undefined || pickupWaitRaw === '' ? undefined : Number(pickupWaitRaw);
  if (pickupWaitMinutes !== undefined && (!Number.isSafeInteger(pickupWaitMinutes) || pickupWaitMinutes < 0 || pickupWaitMinutes > 480)) {
    throw new Error('Enter a realistic pickup wait in minutes (0 to 480).');
  }

  const deadlineRaw = body.deadline;
  const deadline = typeof deadlineRaw === 'string' && deadlineRaw ? deadlineRaw : undefined;
  const deadlineReasonRaw = body.deadlineReason;
  const deadlineReason = typeof deadlineReasonRaw === 'string' ? deadlineReasonRaw.trim().slice(0, 140) || undefined : undefined;

  const readinessRaw = body.destinationReadinessBufferMinutes;
  const destinationReadinessBufferMinutes = readinessRaw === undefined || readinessRaw === '' ? undefined : Number(readinessRaw);
  if (
    destinationReadinessBufferMinutes !== undefined &&
    (!Number.isSafeInteger(destinationReadinessBufferMinutes) || destinationReadinessBufferMinutes < 0 || destinationReadinessBufferMinutes > 480)
  ) {
    throw new Error('Enter a realistic readiness buffer in minutes (0 to 480).');
  }

  if (deadline && landingAt) {
    // A deadline before landing is never something Arrive By should try to
    // silently reconcile — fail clearly instead.
    if (Date.parse(`${deadline}:00`) <= Date.parse(`${landingAt}:00`)) {
      throw new Error('The deadline must be after your flight lands.');
    }
  }

  const confirmedPlaceIdRaw = body.confirmedPlaceId;
  if (typeof confirmedPlaceIdRaw === 'string' && confirmedPlaceIdRaw.length > MAX_PLACE_ID_LENGTH) {
    throw new Error('That confirmation reference is not valid.');
  }
  const confirmedPlaceId = typeof confirmedPlaceIdRaw === 'string' && confirmedPlaceIdRaw ? confirmedPlaceIdRaw : undefined;

  const selectedPlaceIdRaw = body.selectedPlaceId;
  if (typeof selectedPlaceIdRaw === 'string' && selectedPlaceIdRaw.length > MAX_PLACE_ID_LENGTH) {
    throw new Error('That selection reference is not valid.');
  }
  const selectedPlaceId = typeof selectedPlaceIdRaw === 'string' && selectedPlaceIdRaw ? selectedPlaceIdRaw : undefined;

  return {
    airportCode,
    landingAt,
    airportExitBufferMinutes,
    destination,
    pickupMode,
    pickupWaitMinutes,
    deadline,
    deadlineReason,
    destinationReadinessBufferMinutes,
    confirmedPlaceId,
    selectedPlaceId,
  };
}
