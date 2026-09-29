import { GOOGLE_ARRIVE_BY_ORIGINS, localDateTimeToIso, type GoogleOriginId, type GooglePrototypeInput } from '@/lib/arrive-by/google-routes';

const MAX_PLACE_ID_LENGTH = 200;

/**
 * Shared by the founder and public Manchester routes so validation never
 * drifts between them. Deliberately lives outside lib/arrive-by (rather
 * than alongside it) so the public route never has to import that
 * directory directly -- lib/arrive-by is reserved for the Stage 1 engine's
 * founder-only-importable, network-free files (see
 * tests/arrive-by-integrity.test.ts). This file itself does no network
 * call; it only shapes/validates a request body.
 */
export function cleanInput(value: unknown): GooglePrototypeInput {
  if (!value || typeof value !== 'object') throw new Error('Enter the journey details.');
  const body = value as Record<string, unknown>;
  const originId = typeof body.originId === 'string' ? body.originId as GoogleOriginId : '' as GoogleOriginId;
  const destination = typeof body.destination === 'string' ? body.destination.trim() : '';
  const availableAt = typeof body.availableAt === 'string' ? body.availableAt : '';
  const deadline = typeof body.deadline === 'string' ? body.deadline : '';
  const deadlineReason = typeof body.deadlineReason === 'string' ? body.deadlineReason.trim() : '';
  const readinessRaw = body.readinessMinutes;
  const readinessMinutes = readinessRaw === undefined || readinessRaw === '' ? undefined : readinessRaw;
  if (!Object.prototype.hasOwnProperty.call(GOOGLE_ARRIVE_BY_ORIGINS, originId)) throw new Error('Choose a supported terminal.');
  if (destination.length < 3 || destination.length > 180) throw new Error('Enter a final destination.');
  if (deadlineReason.length > 140) throw new Error('Keep the deadline reason under 140 characters.');
  if (readinessMinutes !== undefined && (typeof readinessMinutes !== 'number' || !Number.isSafeInteger(readinessMinutes) || readinessMinutes < 0 || readinessMinutes > 720)) {
    throw new Error('Enter a readiness time from 0 to 720 minutes.');
  }
  const timeZone = GOOGLE_ARRIVE_BY_ORIGINS[originId].timeZone;
  const availableIso = localDateTimeToIso(availableAt, timeZone);
  const deadlineIso = localDateTimeToIso(deadline, timeZone);
  if (Date.parse(deadlineIso) <= Date.parse(availableIso)) throw new Error('The deadline must be after the time you are ready to leave the terminal.');
  const confirmedPlaceIdRaw = body.confirmedPlaceId;
  if (typeof confirmedPlaceIdRaw === 'string' && confirmedPlaceIdRaw.length > MAX_PLACE_ID_LENGTH) throw new Error('That confirmation reference is not valid.');
  const confirmedPlaceId = typeof confirmedPlaceIdRaw === 'string' && confirmedPlaceIdRaw ? confirmedPlaceIdRaw : undefined;
  const selectedPlaceIdRaw = body.selectedPlaceId;
  if (typeof selectedPlaceIdRaw === 'string' && selectedPlaceIdRaw.length > MAX_PLACE_ID_LENGTH) throw new Error('That selection reference is not valid.');
  const selectedPlaceId = typeof selectedPlaceIdRaw === 'string' && selectedPlaceIdRaw ? selectedPlaceIdRaw : undefined;
  return { originId, destination, availableAt, deadline, deadlineReason, readinessMinutes: readinessMinutes as number | undefined, confirmedPlaceId, selectedPlaceId };
}
