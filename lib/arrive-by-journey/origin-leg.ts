import { computeDriveRouteFrom } from '../arrive-by-shared/road-routes';
import { resolvePlaceWithChoice } from '../arrive-by-shared/place-choice';
import type { GoogleCallLedger } from './call-budget';
import { parseLocalDateTime } from './local-time';
import { searchLatestDeparture, SEARCH_MAX_QUERIES, type SearchResult } from './origin-search';
import type { JourneyAirports } from './airports';
import type { JourneyInput, NotEvidencedReason, ResolvedLeg } from './types';

/**
 * The LIVE origin leg: start location -> departure airport.
 *
 *   1. resolve the START through the same shared resolver + confirm/select safety as the destination
 *      (UK gate, region bias 'uk'); a start that is ambiguous, too broad or outside the UK is never routed
 *   2. search for the latest departure that reaches the airport by
 *      (flight departure - the traveller's chosen buffer), using traffic-aware DRIVE at each candidate time
 *
 * The airport side of every route request is the trusted, server-resolved coordinate (never client-supplied),
 * and every Google request goes through the journey's call ledger, so this can never spend past the whole-journey
 * ceiling. A failure is NOT_EVIDENCED, never a silent fall-back to an entered duration.
 */

/** Calls the arrival side may still need (start geocode is spent before this; destination geocode + drive = 2). Origin search leaves them alone. */
export const ARRIVAL_RESERVE_CALLS = 2;

export interface OriginLegOutcome {
  leg: ResolvedLeg;
  start?: {
    confidence: string;
    resolvedAddress?: string;
    clarificationReason?: string;
    pendingConfirmation?: { placeId: string; formattedAddress: string };
    pendingSelection?: { candidates: Array<{ placeId: string; formattedAddress: string }> };
  };
  search?: SearchResult;
}

const UK_START_RULES = { expectedCountryCodes: ['GB'], regionBias: 'uk' };

function notEvidenced(reason: NotEvidencedReason, detail: string): { status: 'NOT_EVIDENCED'; reason: NotEvidencedReason; detail: string } {
  return { status: 'NOT_EVIDENCED', reason, detail };
}

export async function googleOriginLeg(
  apiKey: string,
  airports: Pick<JourneyAirports, 'departure'>,
  input: JourneyInput,
  ledger: GoogleCallLedger,
  checkedAtIso: string,
): Promise<OriginLegOutcome> {
  const { departure } = airports;

  // The flight departure and buffer were already validated by the pre-flight solve; recompute the deadline here.
  const departs = parseLocalDateTime(input.flight.departsLocal, departure.timeZone);
  if (!departs.ok) return { leg: notEvidenced('INVALID_INPUT', 'Enter a valid departure date and time.') };
  const deadlineMs = departs.ms - input.preferences.departureAirportBufferMinutes * 60000;

  // 1. Start location (1 geocode call)
  const place = await resolvePlaceWithChoice(
    apiKey, input.start, UK_START_RULES,
    { confirmedPlaceId: input.startConfirmedPlaceId, selectedPlaceId: input.startSelectedPlaceId },
    ledger.fetch,
  );
  const start = { confidence: place.confidence, resolvedAddress: place.resolvedAddress, clarificationReason: place.clarificationReason, pendingConfirmation: place.pendingConfirmation, pendingSelection: place.pendingSelection };
  if (ledger.exhausted) return { start, leg: notEvidenced('ORIGIN_ROUTE_UNAVAILABLE', 'The call limit for one journey was reached.') };
  if (place.confidence !== 'CONFIRMED' || !place.resolvedAddress) {
    const unsuitable = place.clarificationReason === 'WRONG_COUNTRY';
    return {
      start,
      leg: notEvidenced(
        unsuitable ? 'START_LOCATION_UNSUITABLE' : 'START_LOCATION_UNCONFIRMED',
        unsuitable
          ? 'Arrive By only supports journeys that start in the UK at the moment. Check your start location.'
          : 'Your start location needs confirming, or is too broad to route from. Try a town, postcode or place name.',
      ),
    };
  }

  // 2. Backward search (bounded by both its own cap and what the ledger can still afford, leaving the arrival side's reserve)
  const affordable = ledger.remaining - ARRIVAL_RESERVE_CALLS;
  if (affordable < 1) return { start, leg: notEvidenced('ORIGIN_ROUTE_UNAVAILABLE', 'The call limit for one journey leaves no room for the drive to the airport.') };
  // Prefer Google's own coordinate for the start: routing from a locality's name/placeId can return no route at all
  // ("Durham"), while its coordinate routes normally. The coordinate came from Google, server-side, never from the client.
  const startOrigin = place.location
    ? { kind: 'coordinate' as const, lat: place.location.lat, lng: place.location.lng }
    : { kind: 'address' as const, value: place.resolvedAddress };

  const search = await searchLatestDeparture({
    deadlineMs,
    nowMs: Date.parse(checkedAtIso),
    maxQueries: Math.min(SEARCH_MAX_QUERIES, affordable),
    query: async (departureMs) => {
      const drive = await computeDriveRouteFrom(apiKey, startOrigin, departure.routeTarget, new Date(departureMs).toISOString(), ledger.fetch);
      if (drive.status === 'AVAILABLE' && drive.durationSeconds !== undefined) {
        return { ok: true, sample: { durationSeconds: drive.durationSeconds, staticSeconds: drive.staticDurationSeconds } };
      }
      return { ok: false, exhausted: ledger.exhausted };
    },
  });

  const evidence = { kind: 'GOOGLE_ROUTES' as const, source: 'Google traffic-aware driving estimate, searched for the latest departure that meets your airport time', checkedAt: checkedAtIso };
  if (search.status === 'OK') {
    return { start, search, leg: { status: 'OK', expectedSeconds: search.durationSeconds, staticSeconds: search.staticSeconds, latestFeasibleDepartureMs: search.departureMs, evidence } };
  }
  if (search.status === 'ALREADY_TOO_LATE') {
    // Even leaving now misses the airport deadline. D - drive is before now, so the solver reports NOT FEASIBLE; it is not presented as a departure to act on.
    return { start, search, leg: { status: 'OK', expectedSeconds: search.durationSeconds, latestFeasibleDepartureMs: search.departureMs, evidence } };
  }
  return {
    start,
    search,
    leg: notEvidenced(
      search.reason === 'NO_FEASIBLE_WITHIN_BUDGET' ? 'ORIGIN_SEARCH_NO_FEASIBLE' : 'ORIGIN_ROUTE_UNAVAILABLE',
      search.reason === 'NO_FEASIBLE_WITHIN_BUDGET'
        ? "We couldn't settle on a reliable time to leave within the lookups allowed for one journey."
        : "We couldn't get a reliable driving route from your start location to the departure airport.",
    ),
  };
}
