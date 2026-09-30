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
/** Share of the airport's distinctive name words that must appear in Google's address text (unless the IATA code is there). */
export const NAME_HIT_THRESHOLD = 0.5;

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

function nameEvidence(airport: CatalogueAirport, formattedAddress: string): { iataInAddress: boolean; nameHitRatio: number } {
  const address = foldSearchText(formattedAddress);
  const iataInAddress = new RegExp(`\\b${airport.iata.toLowerCase()}\\b`).test(address);
  const words = distinctiveWords(airport.name);
  const nameHitRatio = words.length === 0 ? 0 : words.filter((word) => address.includes(word)).length / words.length;
  return { iataInAddress, nameHitRatio };
}

function addressNamesAirport(airport: CatalogueAirport, formattedAddress: string): boolean {
  const { iataInAddress, nameHitRatio } = nameEvidence(airport, formattedAddress);
  return iataInAddress || nameHitRatio >= NAME_HIT_THRESHOLD;
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

export interface IdentityCandidateDiagnostic {
  address: string;
  distanceKm: number;
  types: string[];
  country?: string;
  iataInAddress: boolean;
  nameHitRatio: number;
  /** Why this candidate fails, or undefined when it agrees. */
  failure?: AirportIdentityFailure;
}

/**
 * Per-candidate breakdown of the same checks evaluateAirportIdentity makes,
 * for the offline threshold study (which candidate, how far, how much name
 * evidence). Never used to decide anything on a request path.
 */
export function diagnoseAirportIdentity(airport: CatalogueAirport, results: IdentityGeocodeResult[]): IdentityCandidateDiagnostic[] {
  const rows: IdentityCandidateDiagnostic[] = [];
  for (const result of results) {
    const location = result.geometry?.location;
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) continue;
    const distanceKm = haversineKm(airport.lat, airport.lng, location.lat, location.lng);
    const country = result.address_components?.find((component) => component.types.includes('country'))?.short_name;
    const address = result.formatted_address ?? '';
    const evidence = nameEvidence(airport, address);
    let failure: AirportIdentityFailure | undefined;
    if (!result.types?.includes('airport')) failure = 'NOT_AN_AIRPORT';
    else if (country !== airport.countryCode) failure = 'WRONG_COUNTRY';
    else if (distanceKm > MAX_IDENTITY_DISTANCE_KM) failure = 'TOO_FAR';
    else if (!(evidence.iataInAddress || evidence.nameHitRatio >= NAME_HIT_THRESHOLD)) failure = 'NAME_MISMATCH';
    rows.push({ address, distanceKm: Math.round(distanceKm * 100) / 100, types: result.types ?? [], country, iataInAddress: evidence.iataInAddress, nameHitRatio: Math.round(evidence.nameHitRatio * 100) / 100, failure });
  }
  return rows;
}

const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * One Geocoding request per airport, country-restricted, then the pure
 * evaluation above. Any request failure or non-OK status fails closed.
 * Server-side only (uses the server API key); call from an offline
 * capability-check script, never from a request path.
 */
/** The one country-restricted Geocoding request; null means the request itself failed (fails closed upstream). */
export async function fetchIdentityResults(apiKey: string, airport: CatalogueAirport, options: { restrictCountry?: boolean } = {}): Promise<{ status: 'OK' | 'ZERO_RESULTS' | 'REQUEST_FAILED'; results: IdentityGeocodeResult[]; googleStatus?: string }> {
  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set('address', `${airport.name} (${airport.iata})`);
  // Restricting to the catalogue country is the default (fewer false positives). The offline
  // study can lift it once, to tell "no such airport" from "catalogue country code disagrees with Google".
  if (options.restrictCountry !== false) url.searchParams.set('components', `country:${airport.countryCode}`);
  url.searchParams.set('key', apiKey);
  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-store' });
  } catch {
    return { status: 'REQUEST_FAILED', results: [] };
  }
  if (!response.ok) return { status: 'REQUEST_FAILED', results: [] };
  const json = (await response.json()) as { status?: string; results?: IdentityGeocodeResult[] };
  if (json.status === 'ZERO_RESULTS') return { status: 'ZERO_RESULTS', results: [], googleStatus: json.status };
  if (json.status !== 'OK') return { status: 'REQUEST_FAILED', results: [], googleStatus: json.status };
  return { status: 'OK', results: json.results ?? [], googleStatus: json.status };
}

export async function verifyAirportIdentity(apiKey: string, airport: CatalogueAirport): Promise<AirportIdentityResult> {
  const fetched = await fetchIdentityResults(apiKey, airport);
  if (fetched.status === 'REQUEST_FAILED') return { ok: false, reason: 'REQUEST_FAILED' };
  if (fetched.status === 'ZERO_RESULTS') return { ok: false, reason: 'NO_RESULT' };
  return evaluateAirportIdentity(airport, fetched.results);
}
