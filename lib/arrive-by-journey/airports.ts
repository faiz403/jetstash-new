import { getCatalogueAirport } from '../arrive-by-shared/airport-catalogue';
import { getAirportCapability, resolveAirportProfile } from '../arrive-by-shared/airport-capability';
import { POLICY_PENDING, type AirportProfile } from '../arrive-by-shared/airport-registry';
import type { SolverAirport } from './solver';
import type { NotEvidencedReason } from './types';

/**
 * Which airports a full journey may use. V1 (founder decision):
 *
 *  - DEPARTURE: a UK airport only (catalogue country GB). Departure-side
 *    capability -- can we route a traveller's home to it? -- is a separate fact
 *    from the arrival evidence in Phase C and is proven in F2; F1 only enforces
 *    the country. (Channel Islands and the Isle of Man are GG/JE/IM in the
 *    catalogue, so they are not UK departures here.)
 *  - ARRIVAL: any airport whose CAPABILITY is approved (an explicit profile or
 *    `road_supported` evidence). The internal beta judges capability only;
 *    `public` mode also requires the release gate, so a released-airport rule
 *    can be switched on for public exposure without touching the solver.
 *    A catalogued-only airport (BEK, LYR ...) is refused, never guessed.
 */

export type AirportMode = 'internal' | 'public';

export interface JourneyAirports {
  departure: SolverAirport;
  arrival: SolverAirport & { profile: AirportProfile };
}

export type AirportCheck =
  | { ok: true; airports: JourneyAirports }
  | { ok: false; reason: NotEvidencedReason; detail: string };

export function resolveJourneyAirports(departureCode: string, arrivalCode: string, mode: AirportMode = 'internal'): AirportCheck {
  const departure = getCatalogueAirport(departureCode);
  if (!departure) return { ok: false, reason: 'AIRPORT_NOT_SUPPORTED', detail: 'That departure airport is not recognised.' };
  if (departure.countryCode !== 'GB') {
    return { ok: false, reason: 'AIRPORT_NOT_SUPPORTED', detail: 'Arrive By only supports departures from UK airports at the moment.' };
  }

  const capability = getAirportCapability(arrivalCode);
  const profile = resolveAirportProfile(arrivalCode);
  const usable = capability && capability.capabilityApproved && (mode === 'internal' || capability.journeyEligible);
  if (!usable || !profile) {
    return { ok: false, reason: 'AIRPORT_NOT_SUPPORTED', detail: "Arrive By can't calculate the journey from that arrival airport yet." };
  }
  if (profile.destinationRules.expectedCountryCodes === POLICY_PENDING) {
    return { ok: false, reason: 'AIRPORT_NOT_SUPPORTED', detail: "Arrive By can't calculate the journey from that arrival airport yet." };
  }

  return {
    ok: true,
    airports: {
      departure: { code: departure.iata, name: departure.name, timeZone: departure.timeZone },
      arrival: { code: profile.code, name: profile.displayName, timeZone: profile.timeZone, profile },
    },
  };
}
