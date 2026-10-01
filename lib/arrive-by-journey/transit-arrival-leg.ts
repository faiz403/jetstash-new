import { resolveRoutingOrigin } from '../arrive-by-shared/airport-registry';
import { resolvePlaceWithChoice } from '../arrive-by-shared/place-choice';
import { computeDriveRouteFrom } from '../arrive-by-shared/road-routes';
import { GOOGLE_ROUTE_FIELD_MASK, normaliseGoogleItinerary, type GoogleItinerary, type GoogleRoutesResponse } from '../arrive-by/google-routes';
import type { GoogleCallLedger } from './call-budget';
import { parseLocalDateTime } from './local-time';
import type { JourneyAirports } from './airports';
import type { JourneyInput, NotEvidencedReason, ResolvedLeg } from './types';

const ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

export interface TransitArrivalOutcome {
  leg: ResolvedLeg;
  detail?: {
    outcome: 'ETA_ONLY' | 'DESTINATION_NEEDS_CONFIRMATION' | 'DESTINATION_NEEDS_SELECTION' | 'DESTINATION_NEEDS_CLARIFICATION' | 'ROUTE_UNAVAILABLE';
    pendingConfirmation?: { placeId: string; formattedAddress: string; display?: string; unnamed?: boolean; name?: string };
    pendingSelection?: { candidates: Array<{ placeId: string; formattedAddress: string; display?: string; unnamed?: boolean; name?: string }> };
    clarificationReason?: string;
    transit?: { firstService: string; expectedArrivalIso: string; missedServiceArrivalIso?: string; missedServiceMeetsReadyBy?: boolean; rescue?: { attempted: boolean; available: boolean; arrivalIso?: string; meetsReadyBy?: boolean } };
  };
}

function notEvidenced(reason: NotEvidencedReason, detail: string): { status: 'NOT_EVIDENCED'; reason: NotEvidencedReason; detail: string } {
  return { status: 'NOT_EVIDENCED', reason, detail };
}

function originBody(origin: ReturnType<typeof resolveRoutingOrigin>) {
  return origin.kind === 'address' ? { address: origin.value } : { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } };
}

async function transit(
  apiKey: string, origin: ReturnType<typeof resolveRoutingOrigin>, destination: string, departureTime: string, ledger: GoogleCallLedger,
): Promise<GoogleItinerary | undefined> {
  try {
    const response = await ledger.fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': GOOGLE_ROUTE_FIELD_MASK },
      body: JSON.stringify({ origin: originBody(origin), destination: { address: destination }, travelMode: 'TRANSIT', departureTime, computeAlternativeRoutes: true, languageCode: 'en-GB', units: 'METRIC', transitPreferences: { routingPreference: 'FEWER_TRANSFERS' } }),
      cache: 'no-store',
    });
    if (!response.ok) return undefined;
    return normaliseGoogleItinerary(await response.json() as GoogleRoutesResponse);
  } catch { return undefined; }
}

/** Manchester's validated TRANSIT_FIRST onward leg. Other airports never call this provider. */
export async function transitArrivalLeg(
  apiKey: string, airports: JourneyAirports, input: JourneyInput, ledger: GoogleCallLedger, checkedAtIso: string,
): Promise<TransitArrivalOutcome> {
  const { profile } = airports.arrival;
  if (!Array.isArray(profile.destinationRules.expectedCountryCodes)) return { leg: notEvidenced('AIRPORT_NOT_SUPPORTED', "Arrive By can't calculate public transport from this arrival airport yet.") };
  const place = await resolvePlaceWithChoice(apiKey, input.destination, { expectedCountryCodes: profile.destinationRules.expectedCountryCodes, regionBias: profile.destinationRules.regionBias }, { confirmedPlaceId: input.confirmedPlaceId, selectedPlaceId: input.selectedPlaceId }, ledger.fetch);
  if (place.confidence !== 'CONFIRMED' || !place.resolvedAddress) {
    const outcome = place.confidence === 'NEEDS_CONFIRMATION' ? 'DESTINATION_NEEDS_CONFIRMATION' : place.confidence === 'NEEDS_SELECTION' ? 'DESTINATION_NEEDS_SELECTION' : 'DESTINATION_NEEDS_CLARIFICATION';
    return { leg: notEvidenced('ARRIVAL_DESTINATION_UNCONFIRMED', 'Your destination needs confirming before the onward public-transport journey can be calculated.'), detail: { outcome, pendingConfirmation: place.pendingConfirmation, pendingSelection: place.pendingSelection, clarificationReason: place.clarificationReason } };
  }
  const lands = parseLocalDateTime(input.flight.arrivesLocal, profile.timeZone);
  if (!lands.ok) return { leg: notEvidenced('INVALID_INPUT', 'Enter a valid arrival date and time.') };
  const readyMs = lands.ms + (input.preferences.arrivalExitMinutes + (input.preferences.pickupWaitMinutes ?? 0)) * 60000;
  const origin = resolveRoutingOrigin(profile);
  const primary = await transit(apiKey, origin, place.resolvedAddress, new Date(readyMs).toISOString(), ledger);
  if (!primary || ledger.exhausted) return { leg: notEvidenced('ARRIVAL_ROUTE_UNAVAILABLE', "We couldn't get a reliable onward public-transport journey from the arrival airport."), detail: { outcome: 'ROUTE_UNAVAILABLE' } };
  const fallback = await transit(apiKey, origin, place.resolvedAddress, new Date(Date.parse(primary.firstImportantService.departureTime) + 60000).toISOString(), ledger);
  let rescue: { attempted: boolean; available: boolean; arrivalIso?: string; meetsReadyBy?: boolean } | undefined;
  const deadline = input.preferences.finalDeadlineLocal ? parseLocalDateTime(input.preferences.finalDeadlineLocal, profile.timeZone) : undefined;
  const latestMs = deadline?.ok ? deadline.ms - (input.preferences.destinationReadinessMinutes ?? 0) * 60000 : undefined;
  const fallbackLate = Boolean(fallback && latestMs !== undefined && Date.parse(fallback.arrivalTime) > latestMs);
  if (fallbackLate && ledger.remaining > 0) {
    const drive = await computeDriveRouteFrom(apiKey, origin, place.resolvedAddress, primary.firstImportantService.departureTime, ledger.fetch);
    const arrivalMs = drive.durationSeconds === undefined ? undefined : Date.parse(primary.firstImportantService.departureTime) + drive.durationSeconds * 1000;
    rescue = { attempted: true, available: drive.status === 'AVAILABLE' && arrivalMs !== undefined, arrivalIso: arrivalMs ? new Date(arrivalMs).toISOString() : undefined, meetsReadyBy: arrivalMs !== undefined && latestMs !== undefined ? arrivalMs <= latestMs : undefined };
  }
  const durationSeconds = Math.max(0, Math.round((Date.parse(primary.arrivalTime) - readyMs) / 1000));
  return {
    leg: { status: 'OK', expectedSeconds: durationSeconds, evidence: { kind: 'GOOGLE_ROUTES', source: 'Google public-transport journey estimate', checkedAt: checkedAtIso } },
    detail: { outcome: 'ETA_ONLY', transit: { firstService: primary.firstImportantService.lineShortName ?? primary.firstImportantService.lineName, expectedArrivalIso: primary.arrivalTime, missedServiceArrivalIso: fallback?.arrivalTime, missedServiceMeetsReadyBy: fallback && latestMs !== undefined ? Date.parse(fallback.arrivalTime) <= latestMs : undefined, rescue } },
  };
}
