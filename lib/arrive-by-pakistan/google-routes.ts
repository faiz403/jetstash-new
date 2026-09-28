import { resolveDestination, type GeocodeResult } from '@/lib/arrive-by-shared/destination-resolution';

/**
 * Server-side Google API adapter for Arrive By Pakistan. Two separate
 * Google APIs are used deliberately, not one:
 *
 *  - The Geocoding API resolves and classifies the destination BEFORE any
 *    routing is attempted, via the shared lib/arrive-by-shared/
 *    destination-resolution.ts module (originally built here for Pakistan,
 *    generalised in the global Arrive By foundation phase — see that
 *    module for the full rationale, including why the Geocoding API's
 *    results[] array is what actually enables ambiguity detection that
 *    Routes API v2 alone cannot replicate).
 *  - The Routes API (v2, computeRoutes) then does the actual DRIVE
 *    request, using the same traffic-aware pattern already validated in
 *    Manchester's own implementation (TRAFFIC_AWARE_OPTIMAL, trafficModel
 *    BEST_GUESS) — reused because it's country-independent, not because
 *    Pakistan's logic imports Manchester's code.
 *
 * GOOGLE_ROUTES_API_KEY never reaches the client — both calls happen only
 * from the API route, server-side.
 */

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

export type { GeocodeResult };

/** Thin Pakistan-specific wrapper over the shared resolver: fixed to Pakistan's own country/region policy. Behaviour is unchanged from before this module's geocoding logic moved to lib/arrive-by-shared/destination-resolution.ts. */
export async function geocodeDestination(apiKey: string, destination: string): Promise<GeocodeResult> {
  return resolveDestination(apiKey, destination, { expectedCountryCodes: ['PK'], regionBias: 'pk' });
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
