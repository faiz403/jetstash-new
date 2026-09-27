import type { DestinationClarificationReason, DestinationConfidence } from './types';
import { type AddressComponent, deriveResolvedPrimaryPlace, extractPrimaryInputPlace, placesMatch } from './destination-identity';

/**
 * Server-side Google API adapter for Arrive By Pakistan. Two separate
 * Google APIs are used deliberately, not one:
 *
 *  - The Geocoding API resolves and classifies the destination BEFORE any
 *    routing is attempted. Routes API v2's own computeRoutes response can
 *    return per-waypoint confidence too (geocodingResults: geocoderStatus,
 *    type, partialMatch, placeId) when addresses are used, so this isn't
 *    about Routes lacking confidence data in general — it's that Routes
 *    only ever resolves one best-guess waypoint per address, never a list
 *    of candidates. The Geocoding API's results[] array is what actually
 *    lets us detect "more than one plausible match" (results.length > 1),
 *    which is the strongest signal for Pakistan's duplicate/ambiguous
 *    village names (e.g. more than one place called Mirpur) and the one
 *    thing the single-call approach can't replicate. Getting this
 *    classification right is what stops Arrive By confidently routing
 *    someone to the wrong village. A live ISB test found that candidate
 *    count, partial-match and type-broadness aren't enough on their own:
 *    "Chakswari, Mirpur, Azad Kashmir, Pakistan" resolved to a single,
 *    non-partial, correctly-typed "New Mirpur City" — a real, different
 *    town ~42km away — and every one of those signals looked clean. The
 *    primary-place check below (see destination-identity.ts) is what
 *    actually catches that: it compares only the place the traveller
 *    named first ("Chakswari") against Google's own most specific
 *    resolved place component, not the whole input string (which still
 *    shares "Mirpur" with the wrong result).
 *  - The Routes API (v2, computeRoutes) then does the actual DRIVE
 *    request, using the same traffic-aware pattern already validated in
 *    Manchester's own implementation (TRAFFIC_AWARE_OPTIMAL, trafficModel
 *    BEST_GUESS) — reused because it's country-independent, not because
 *    Pakistan's logic imports Manchester's code.
 *
 * GOOGLE_ROUTES_API_KEY never reaches the client — both calls happen only
 * from the API route, server-side.
 */

const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';
const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/**
 * Place types too broad to trust for a single-point road journey — country,
 * province (administrative_area_level_1) and district
 * (administrative_area_level_2) matches all mean Google resolved to an area,
 * not the specific locality the traveller named, even when that's the only
 * candidate and the match wasn't partial.
 */
const TOO_BROAD_TYPES = new Set(['country', 'administrative_area_level_1', 'administrative_area_level_2']);

export interface GeocodeResult {
  confidence: DestinationConfidence;
  clarificationReason?: DestinationClarificationReason;
  formattedAddress?: string;
  resolvedPrimaryPlace?: string;
  placeId?: string;
  locationTypes?: string[];
  /** geometry.location_type — diagnostic only. Live evidence (Islamabad, Saddar, Mirpur, Dadyal all APPROXIMATE and correct) shows this is not a failure signal by itself. */
  locationType?: string;
  partialMatch: boolean;
  candidateCount: number;
  status: string;
}

interface GeocodeApiResult {
  formatted_address?: string;
  place_id?: string;
  partial_match?: boolean;
  types?: string[];
  geometry?: { location_type?: string };
  address_components?: AddressComponent[];
}

export async function geocodeDestination(apiKey: string, destination: string): Promise<GeocodeResult> {
  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set('address', destination);
  url.searchParams.set('region', 'pk');
  url.searchParams.set('key', apiKey);

  let response: Response;
  try {
    response = await fetch(url.toString(), { cache: 'no-store' });
  } catch {
    return { confidence: 'UNRESOLVED', clarificationReason: 'GEOCODE_FAILED', partialMatch: false, candidateCount: 0, status: 'REQUEST_FAILED' };
  }
  if (!response.ok) {
    return { confidence: 'UNRESOLVED', clarificationReason: 'GEOCODE_FAILED', partialMatch: false, candidateCount: 0, status: 'REQUEST_FAILED' };
  }

  const body = (await response.json()) as { status: string; results?: GeocodeApiResult[] };
  if (body.status !== 'OK' || !body.results?.length) {
    return { confidence: 'UNRESOLVED', clarificationReason: 'GEOCODE_FAILED', partialMatch: false, candidateCount: 0, status: body.status };
  }

  // More than one candidate is itself a sign the destination wasn't
  // specific enough, regardless of how plausible the top result looks.
  if (body.results.length > 1) {
    const [top] = body.results;
    return {
      confidence: 'NEEDS_CLARIFICATION',
      clarificationReason: 'MULTIPLE_CANDIDATES',
      formattedAddress: top.formatted_address,
      resolvedPrimaryPlace: deriveResolvedPrimaryPlace(top.address_components),
      placeId: top.place_id,
      locationTypes: top.types,
      locationType: top.geometry?.location_type,
      partialMatch: Boolean(top.partial_match),
      candidateCount: body.results.length,
      status: body.status,
    };
  }

  const [result] = body.results;
  const partialMatch = Boolean(result.partial_match);
  const types = result.types ?? [];
  const tooBroad = types.some((type) => TOO_BROAD_TYPES.has(type));
  const locationType = result.geometry?.location_type;
  const resolvedPrimaryPlace = deriveResolvedPrimaryPlace(result.address_components);
  const primaryInputPlace = extractPrimaryInputPlace(destination);
  const primaryPlaceMismatch = !placesMatch(primaryInputPlace, resolvedPrimaryPlace ?? result.formatted_address);

  let confidence: DestinationConfidence = 'CONFIRMED';
  let clarificationReason: DestinationClarificationReason | undefined;
  if (partialMatch) {
    confidence = 'NEEDS_CLARIFICATION';
    clarificationReason = 'PARTIAL_MATCH';
  } else if (tooBroad) {
    confidence = 'NEEDS_CLARIFICATION';
    clarificationReason = 'TOO_BROAD_TYPE';
  } else if (!locationType) {
    confidence = 'NEEDS_CLARIFICATION';
    clarificationReason = 'NO_LOCATION_TYPE';
  } else if (primaryPlaceMismatch) {
    confidence = 'NEEDS_CLARIFICATION';
    clarificationReason = 'PRIMARY_PLACE_MISMATCH';
  }

  return {
    confidence,
    clarificationReason,
    formattedAddress: result.formatted_address,
    resolvedPrimaryPlace,
    placeId: result.place_id,
    locationTypes: types,
    locationType,
    partialMatch,
    candidateCount: 1,
    status: body.status,
  };
}

export interface DriveResult {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  durationSeconds?: number;
  staticDurationSeconds?: number;
  distanceMeters?: number;
}

const parseDurationSeconds = (value?: string): number | undefined => {
  const matched = value?.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  return matched ? Math.round(Number(matched[1])) : undefined;
};

export async function computeDriveRoute(
  apiKey: string,
  originAddress: string,
  destinationAddress: string,
  departureTime: string,
): Promise<DriveResult> {
  const requestBody = {
    origin: { address: originAddress },
    destination: { address: destinationAddress },
    travelMode: 'DRIVE',
    departureTime,
    routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
    trafficModel: 'BEST_GUESS',
    computeAlternativeRoutes: false,
    languageCode: 'en-GB',
    units: 'METRIC',
  };

  let response: Response;
  try {
    response = await fetch(ROUTES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters',
      },
      body: JSON.stringify(requestBody),
      cache: 'no-store',
    });
  } catch {
    return { status: 'UNAVAILABLE' };
  }
  if (!response.ok) return { status: 'UNAVAILABLE' };

  const json = (await response.json()) as {
    routes?: Array<{ duration?: string; staticDuration?: string; distanceMeters?: number }>;
  };
  const route = json.routes?.[0];
  const duration = parseDurationSeconds(route?.duration);
  if (!route || duration === undefined) return { status: 'UNAVAILABLE' };

  return {
    status: 'AVAILABLE',
    durationSeconds: duration,
    staticDurationSeconds: parseDurationSeconds(route.staticDuration),
    distanceMeters: route.distanceMeters !== undefined ? Math.max(0, Math.round(route.distanceMeters)) : undefined,
  };
}
