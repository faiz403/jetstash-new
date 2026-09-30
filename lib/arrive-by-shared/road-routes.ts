import type { Origin } from './airport-registry';

/**
 * Server-side Google Routes API (v2, computeRoutes) DRIVE adapter shared by
 * every road-first Arrive By journey. Traffic-aware (TRAFFIC_AWARE_OPTIMAL,
 * BEST_GUESS), country-independent. The origin is either a free-text
 * address (Pakistan's validated profiles) or a coordinate (generic catalogue
 * airports) -- both come from a server-resolved AirportProfile, never from
 * the client.
 *
 * GOOGLE_ROUTES_API_KEY never reaches the client.
 */

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

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

function routesOrigin(origin: Origin) {
  return origin.kind === 'address'
    ? { address: origin.value }
    : { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } };
}

export async function computeDriveRouteFrom(
  apiKey: string,
  origin: Origin,
  destinationAddress: string,
  departureTime: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DriveResult> {
  const requestBody = {
    origin: routesOrigin(origin),
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
    response = await fetchImpl(ROUTES_ENDPOINT, {
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
