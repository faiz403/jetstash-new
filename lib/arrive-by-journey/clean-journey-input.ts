import type { RoadPickupMode } from '../arrive-by-shared/road-types';
import type { JourneyInput } from './types';

/**
 * Request-body validation for the full-journey API. Strict and allow-listed:
 * only the fields below are ever copied, so anything else a client sends --
 * coordinates, a timezone, a country, an origin duration -- is ignored and can
 * never steer the origin, the clock or a country gate. (The entered origin
 * duration is deliberately NOT accepted here: the API is always LIVE.)
 */

const PICKUP_MODES: readonly RoadPickupMode[] = ['family', 'pre-booked', 'arrange-after-landing', 'other'];
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const IATA = /^[A-Za-z]{3}$/;
/** Google place IDs are short opaque tokens; a cap closes an amplification vector without hard-coding a format. */
const MAX_PLACE_ID_LENGTH = 200;
const MAX_MINUTES = 480;

function text(value: unknown, label: string, min: number, max: number): string {
  const out = typeof value === 'string' ? value.trim() : '';
  if (out.length < min || out.length > max) throw new Error(`Enter ${label}.`);
  return out;
}

function minutes(value: unknown, label: string, optional: boolean): number | undefined {
  if (value === undefined || value === null || value === '') {
    if (optional) return undefined;
    throw new Error(`Enter ${label}.`);
  }
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > MAX_MINUTES) throw new Error(`Enter ${label} as whole minutes (0 to ${MAX_MINUTES}).`);
  return n;
}

function optionalId(value: unknown, message: string): string | undefined {
  if (typeof value === 'string' && value.length > MAX_PLACE_ID_LENGTH) throw new Error(message);
  return typeof value === 'string' && value ? value : undefined;
}

export function cleanJourneyInput(value: unknown): JourneyInput {
  if (!value || typeof value !== 'object') throw new Error('Enter the journey details.');
  const body = value as Record<string, unknown>;
  const flightRaw = (body.flight && typeof body.flight === 'object' ? body.flight : {}) as Record<string, unknown>;
  const prefsRaw = (body.preferences && typeof body.preferences === 'object' ? body.preferences : {}) as Record<string, unknown>;

  const departureAirport = typeof body.departureAirport === 'string' && IATA.test(body.departureAirport.trim()) ? body.departureAirport.trim().toUpperCase() : '';
  if (!departureAirport) throw new Error('Choose the airport you are flying from.');
  const arrivalAirport = typeof body.arrivalAirport === 'string' && IATA.test(body.arrivalAirport.trim()) ? body.arrivalAirport.trim().toUpperCase() : '';
  if (!arrivalAirport) throw new Error('Choose the airport you are landing at.');

  const departsLocal = typeof flightRaw.departsLocal === 'string' && LOCAL_DATETIME.test(flightRaw.departsLocal) ? flightRaw.departsLocal : '';
  if (!departsLocal) throw new Error('Enter when the flight leaves.');
  const arrivesLocal = typeof flightRaw.arrivesLocal === 'string' && LOCAL_DATETIME.test(flightRaw.arrivesLocal) ? flightRaw.arrivesLocal : '';
  if (!arrivesLocal) throw new Error('Enter when the flight lands.');

  const connections = flightRaw.declaredConnections === undefined || flightRaw.declaredConnections === '' ? 0 : Number(flightRaw.declaredConnections);
  if (!Number.isSafeInteger(connections) || connections < 0 || connections > 5) throw new Error('Enter a valid number of connections.');
  const label = typeof flightRaw.label === 'string' ? flightRaw.label.trim().slice(0, 20) || undefined : undefined;

  const pickupMode = prefsRaw.pickupMode === undefined || prefsRaw.pickupMode === '' ? 'other' : (prefsRaw.pickupMode as RoadPickupMode);
  if (!PICKUP_MODES.includes(pickupMode)) throw new Error('Choose how you are leaving the arrival airport.');

  let finalDeadlineLocal: string | undefined;
  if (prefsRaw.finalDeadlineLocal !== undefined && prefsRaw.finalDeadlineLocal !== '') {
    if (typeof prefsRaw.finalDeadlineLocal !== 'string' || !LOCAL_DATETIME.test(prefsRaw.finalDeadlineLocal)) throw new Error('Enter a valid deadline.');
    finalDeadlineLocal = prefsRaw.finalDeadlineLocal;
  }

  return {
    start: text(body.start, 'where you are starting from', 2, 180),
    departureAirport,
    flight: { departsLocal, arrivesLocal, label, declaredConnections: connections },
    arrivalAirport,
    destination: text(body.destination, 'where you are going', 2, 180),
    preferences: {
      departureAirportBufferMinutes: minutes(prefsRaw.departureAirportBufferMinutes, 'how early you want to be at the departure airport', false) as number,
      arrivalExitMinutes: minutes(prefsRaw.arrivalExitMinutes, 'how long you need to leave the arrival airport', false) as number,
      pickupWaitMinutes: minutes(prefsRaw.pickupWaitMinutes, 'the pickup wait', true),
      pickupMode,
      finalDeadlineLocal,
      destinationReadinessMinutes: minutes(prefsRaw.destinationReadinessMinutes, 'the readiness time', true),
    },
    startConfirmedPlaceId: optionalId(body.startConfirmedPlaceId, 'That start confirmation reference is not valid.'),
    startSelectedPlaceId: optionalId(body.startSelectedPlaceId, 'That start selection reference is not valid.'),
    confirmedPlaceId: optionalId(body.confirmedPlaceId, 'That confirmation reference is not valid.'),
    selectedPlaceId: optionalId(body.selectedPlaceId, 'That selection reference is not valid.'),
  };
}
