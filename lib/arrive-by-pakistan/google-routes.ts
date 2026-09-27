import type { DestinationConfidence } from './types';

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
 *    someone to the wrong village.
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

/** Place types too broad to trust for a single-point road journey — a bare country/province match means Google didn't find the actual locality. */
const TOO_BROAD_TYPES = new Set(['country', 'administrative_area_level_1']);

export interface GeocodeResult {
  confidence: DestinationConfidence;
  formattedAddress?: string;
  placeId?: string;
  locationTypes?: string[];
  partialMatch: boolean;
  status: string;
}

interface GeocodeApiResult {
  formatted_address?: string;
  place_id?: string;
  partial_match?: boolean;
  types?: string[];
  geometry?: { location_type?: string };
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
    return { confidence: 'UNRESOLVED', partialMatch: false, status: 'REQUEST_FAILED' };
  }
  if (!response.ok) {
    return { confidence: 'UNRESOLVED', partialMatch: false, status: 'REQUEST_FAILED' };
  }

  const body = (await response.json()) as { status: string; results?: GeocodeApiResult[] };
  if (body.status !== 'OK' || !body.results?.length) {
    return { confidence: 'UNRESOLVED', partialMatch: false, status: body.status };
  }

  // More than one candidate is itself a sign the destination wasn't
  // specific enough, regardless of how plausible the top result looks.
  if (body.results.length > 1) {
    const [top] = body.results;
    return {
      confidence: 'NEEDS_CLARIFICATION',
      formattedAddress: top.formatted_address,
      placeId: top.place_id,
      locationTypes: top.types,
      partialMatch: Boolean(top.partial_match),
      status: body.status,
    };
  }

  const [result] = body.results;
  const partialMatch = Boolean(result.partial_match);
  const types = result.types ?? [];
  const tooBroad = types.some((type) => TOO_BROAD_TYPES.has(type));
  const locationType = result.geometry?.location_type;

  const confidence: DestinationConfidence = partialMatch || tooBroad || !locationType ? 'NEEDS_CLARIFICATION' : 'CONFIRMED';

  return {
    confidence,
    formattedAddress: result.formatted_address,
    placeId: result.place_id,
    locationTypes: types,
    partialMatch,
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
