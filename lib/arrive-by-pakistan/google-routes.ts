import { resolveDestination, type GeocodeResult } from '@/lib/arrive-by-shared/destination-resolution';
import { computeDriveRouteFrom, type DriveResult } from '@/lib/arrive-by-shared/road-routes';

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


export type { GeocodeResult };

/** Thin Pakistan-specific wrapper over the shared resolver: fixed to Pakistan's own country/region policy. Behaviour is unchanged from before this module's geocoding logic moved to lib/arrive-by-shared/destination-resolution.ts. */
export async function geocodeDestination(apiKey: string, destination: string): Promise<GeocodeResult> {
  return resolveDestination(apiKey, destination, { expectedCountryCodes: ['PK'], regionBias: 'pk' });
}

export type { DriveResult };

/** Pakistan's DRIVE request -- an address-origin call into the shared road-first Routes adapter (lib/arrive-by-shared/road-routes.ts). */
export async function computeDriveRoute(
  apiKey: string,
  originAddress: string,
  destinationAddress: string,
  departureTime: string,
): Promise<DriveResult> {
  return computeDriveRouteFrom(apiKey, { kind: 'address', value: originAddress }, destinationAddress, departureTime);
}
