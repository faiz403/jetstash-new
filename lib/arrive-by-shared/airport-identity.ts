import type { CatalogueAirport } from './airport-catalogue';
import { foldSearchText } from './airport-search';

/**
 * Airport identity verification against Google, run OFFLINE by a capability
 * check (never per keystroke, never per user request) before a catalogue
 * airport may be recorded as `road_supported`.
 *
 * The catalogue's own coordinates stay the trusted routing origin; this only
 * asks "does Google agree that this named airport, in this country, is where
 * the catalogue says?" -- so a text match can't silently land on a similarly
 * named airport, a city centre, a neighbourhood or an unrelated POI. It fails
 * closed: anything short of a clear, single, agreeing airport result is a
 * mismatch, and a mismatched airport must not become road_supported.
 *
 * Evidence required from a single Google result, all at once:
 *   - it is typed `airport`
 *   - its country component is the catalogue country
 *   - it lies within MAX_IDENTITY_DISTANCE_KM of the catalogue coordinates
 *   - its address text carries the airport's distinctive name words or IATA
 * The closest agreeing result is the match. (Every agreeing result is already
 * within MAX_IDENTITY_DISTANCE_KM of the catalogue point, so they cannot be
 * far apart from one another -- no separate ambiguity rule is needed.)
 */

export const MAX_IDENTITY_DISTANCE_KM = 5;

export type AirportIdentityFailure = 'NO_RESULT' | 'NOT_AN_AIRPORT' | 'WRONG_COUNTRY' | 'TOO_FAR' | 'NAME_MISMATCH' | 'REQUEST_FAILED';

export type AirportIdentityResult =
  | { ok: true; distanceKm: number; matchedAddress: string }
  | { ok: false; reason: AirportIdentityFailure };

export interface IdentityGeocodeResult {
  formatted_address?: string;
  types?: string[];
  geometry?: { location?: { lat: number; lng: number } };
  address_components?: Array<{ short_name: string; types: string[] }>;
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Words too generic to prove identity ("International Airport") -- a match on these alone means nothing. */
const GENERIC_NAME_WORDS = new Set(['airport', 'international', 'intl', 'regional', 'municipal', 'national', 'domestic', 'airfield', 'aerodrome', 'field', 'air', 'terminal', 'the', 'of', 'de', 'la', 'le', 'el', 'and']);

function distinctiveWords(name: string): string[] {
  return foldSearchText(name).split(' ').filter((word) => word.length > 2 && !GENERIC_NAME_WORDS.has(word));
}

function addressNamesAirport(airport: CatalogueAirport, formattedAddress: string): boolean {
  const address = foldSearchText(formattedAddress);
  if (new RegExp(`\\b${airport.iata.toLowerCase()}\\b`).test(address)) return true;
  const words = distinctiveWords(airport.name);
  if (words.length === 0) return false;
  const hits = words.filter((word) => address.includes(word)).length;
  return hits / words.length >= 0.5;
}

/**
 * Pure evaluation of Google Geocoding results against a catalogue airport.
 * Exported so the decision logic is tested without any network call.
 */
export function evaluateAirportIdentity(airport: CatalogueAirport, results: IdentityGeocodeResult[]): AirportIdentityResult {
  if (results.length === 0) return { ok: false, reason: 'NO_RESULT' };

  const agreeing: Array<{ distanceKm: number; address: string }> = [];
  // The closest result's first failure is the most informative reason to report.
  let closest: { distanceKm: number; reason: AirportIdentityFailure } | undefined;

  for (const result of results) {
    const location = result.geometry?.location;
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) continue;
    const distanceKm = haversineKm(airport.lat, airport.lng, location.lat, location.lng);
    const country = result.address_components?.find((component) => component.types.includes('country'))?.short_name;

    let reason: AirportIdentityFailure | undefined;
    if (!result.types?.includes('airport')) reason = 'NOT_AN_AIRPORT';
    else if (country !== airport.countryCode) reason = 'WRONG_COUNTRY';
    else if (distanceKm > MAX_IDENTITY_DISTANCE_KM) reason = 'TOO_FAR';
    else if (!addressNamesAirport(airport, result.formatted_address ?? '')) reason = 'NAME_MISMATCH';

    if (reason) {
      if (!closest || distanceKm < closest.distanceKm) closest = { distanceKm, reason };
    } else {
      agreeing.push({ distanceKm, address: result.formatted_address ?? "" });
    }
  }

  if (agreeing.length === 0) return { ok: false, reason: closest?.reason ?? 'NO_RESULT' };
  const best = agreeing.reduce((nearest, candidate) => (candidate.distanceKm < nearest.distanceKm ? candidate : nearest));
  return { ok: true, distanceKm: Math.round(best.distanceKm * 100) / 100, matchedAddress: best.address };
}

const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * One Geocoding request per airport, country-restricted, then the pure
 * evaluation above. Any request failure or non-OK status fails closed.
 * Server-side only (uses the server API key); call from an offline
 * capability-check script, never from a request path.
 */
export async function verifyAirportIdentity(apiKey: string, airport: CatalogueAirport): Promise<AirportIdentityResult> {
  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set('address', `${airport.name} (${airport.iata})`);
  url.searchParams.set('components', `country:${airport.countryCode}`);
  url.searchParams.set('key', apiKey);
  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-store' });
  } catch {
    return { ok: false, reason: 'REQUEST_FAILED' };
  }
  if (!response.ok) return { ok: false, reason: 'REQUEST_FAILED' };
  const json = (await response.json()) as { status?: string; results?: IdentityGeocodeResult[] };
  if (json.status === 'ZERO_RESULTS') return { ok: false, reason: 'NO_RESULT' };
  if (json.status !== 'OK') return { ok: false, reason: 'REQUEST_FAILED' };
  return evaluateAirportIdentity(airport, json.results ?? []);
}
