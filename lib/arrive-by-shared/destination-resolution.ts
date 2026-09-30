/**
 * Shared destination-resolution safety layer for every Arrive By engine.
 *
 * Originally built for Pakistan (lib/arrive-by-pakistan/destination-identity.ts
 * + the geocoding half of lib/arrive-by-pakistan/google-routes.ts) after a
 * series of live findings: a village silently resolving to the wrong city
 * ("Chakswari" -> "New Mirpur City", ~42km away), named venues wrongly
 * rejected by the locality-mismatch guard (Pearl Continental, Nishat Hotel),
 * a real single venue misread as "2 candidates" because Google also returned
 * a same-named area polygon (Aga Khan University Hospital), and multiple
 * genuinely different real venues sharing a name needing an explicit choice.
 * None of the resulting logic actually depends on Pakistan as a country —
 * only the expected-country gate and geocoding region bias are
 * country-specific, and both are now plain configuration
 * (`expectedCountryCodes`, `regionBias`) rather than hardcoded.
 *
 * lib/arrive-by-pakistan/destination-identity.ts and the geocoding half of
 * lib/arrive-by-pakistan/google-routes.ts now re-export/delegate to this
 * module rather than duplicating it — see those files for the thin
 * Pakistan-specific wrappers.
 */

/** Google address_components entries, in Google's own resolution order (most specific first is NOT guaranteed, hence the priority list below). */
export interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

/**
 * CONFIRMED: safe to issue a deadline pass/fail verdict.
 * NEEDS_CONFIRMATION: Google resolved a specific named venue/POI (a hotel,
 * wedding hall, mosque, hospital...) plausibly and unambiguously, but the
 * primary-place guard doesn't apply to venues the way it does to
 * localities — a human must explicitly confirm it's the right place before
 * any route or deadline verdict is produced.
 * NEEDS_SELECTION: two or more genuinely different named venues share a
 * name/query — a human must pick one before any route is computed.
 * NEEDS_CLARIFICATION: Google resolved *something*, but not confidently
 * enough to trust for a single-point road journey (a partial match, an
 * overly broad place type such as a whole country/province, more than one
 * plausible locality candidate, or a locality-style result whose primary
 * identity doesn't survive resolution).
 * UNRESOLVED: Google could not geocode the destination at all.
 */
export type DestinationConfidence = 'CONFIRMED' | 'NEEDS_CONFIRMATION' | 'NEEDS_SELECTION' | 'NEEDS_CLARIFICATION' | 'UNRESOLVED';

/** Why a destination didn't reach CONFIRMED — lets the UI explain the specific problem rather than a single generic message. */
export type DestinationClarificationReason =
  | 'MULTIPLE_CANDIDATES'
  | 'PARTIAL_MATCH'
  | 'TOO_BROAD_TYPE'
  | 'NO_LOCATION_TYPE'
  | 'PRIMARY_PLACE_MISMATCH'
  | 'WRONG_COUNTRY'
  | 'GEOCODE_FAILED';

export interface GeocodeResult {
  confidence: DestinationConfidence;
  clarificationReason?: DestinationClarificationReason;
  formattedAddress?: string;
  resolvedPrimaryPlace?: string;
  placeId?: string;
  locationTypes?: string[];
  /** geometry.location_type — diagnostic only. Live Pakistan evidence (Islamabad, Saddar, Mirpur, Dadyal all APPROXIMATE and correct) shows this is not a failure signal by itself. */
  locationType?: string;
  partialMatch: boolean;
  candidateCount: number;
  status: string;
  /** Present only when confidence is NEEDS_SELECTION — the genuinely different named-venue candidates to choose between. */
  candidates?: Array<{ placeId: string; formattedAddress: string }>;
  /**
   * Google's own point for the resolved place, server-side only (never accepted from a client and never sent to one).
   * Used to route FROM a start location: Google Routes cannot route from some locality names/place IDs as text (it
   * returns an empty route for "Durham" but routes fine from that place's coordinate), so the origin side prefers this.
   */
  location?: { lat: number; lng: number };
}

/** Per-airport destination-resolution policy. Both fields are optional: omitting `expectedCountryCodes` runs no hard country gate (used while an airport's destination policy is still pending explicit validation — see lib/arrive-by-shared/airport-registry.ts). */
export interface DestinationResolutionConfig {
  /** ISO 3166-1 alpha-2 codes. A resolved result whose country component names something else is rejected as WRONG_COUNTRY. */
  expectedCountryCodes?: string[];
  /** Google Geocoding API's own `region` bias parameter (ccTLD-style, e.g. 'pk', 'in'). */
  regionBias?: string;
}

const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * Place types too broad to trust for a single-point road journey — country,
 * province (administrative_area_level_1) and district
 * (administrative_area_level_2) matches all mean Google resolved to an area,
 * not the specific locality the traveller named, even when that's the only
 * candidate and the match wasn't partial.
 */
const TOO_BROAD_TYPES = new Set(['country', 'administrative_area_level_1', 'administrative_area_level_2']);

/**
 * A broad top-level type is still not safe on its own, but Google can attach
 * one to a genuine street-level result in some country-specific address
 * hierarchies. These components prove the result identifies an addressable
 * point or street rather than only an administrative area. They never make a
 * result pass by themselves: the ordinary primary-place and country guards
 * below still apply.
 */
const ADDRESSABLE_COMPONENT_TYPES = new Set(['route', 'street_number', 'premise', 'subpremise', 'intersection']);

/**
 * Preference order for "the most specific named place Google actually
 * resolved" — deliberately excludes admin_area levels and country, which
 * are qualifying context, not a place identity a road journey can target.
 *
 * Sublocality types come before locality: a real live case (Saddar,
 * Rawalpindi) resolves with BOTH a locality component ("Rawalpindi", the
 * parent city) and a sublocality_level_1 component ("Saddar", the specific
 * neighbourhood actually requested) — checking locality first would have
 * silently picked the wrong, less specific one.
 */
const PRIMARY_PLACE_COMPONENT_PRIORITY = ['route', 'sublocality_level_1', 'sublocality', 'neighborhood', 'locality', 'administrative_area_level_3', 'postal_town'];

const MAX_SELECTION_CANDIDATES = 5;

function normalizePlaceName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The place the traveller actually asked for — the first comma-separated segment of what they typed, not the qualifying context after it. */
export function extractPrimaryInputPlace(destination: string): string {
  const firstSegment = destination.split(',')[0] ?? destination;
  return normalizePlaceName(firstSegment);
}

/** The most specific named place Google's address_components identify for the resolved result, or undefined if only broad admin/country components exist. */
export function deriveResolvedPrimaryPlace(addressComponents: AddressComponent[] | undefined): string | undefined {
  if (!addressComponents?.length) return undefined;
  for (const type of PRIMARY_PLACE_COMPONENT_PRIORITY) {
    const match = addressComponents.find((component) => component.types.includes(type));
    if (match) return match.long_name;
  }
  return undefined;
}

/**
 * Normalized substring containment, either direction — deliberately not a
 * Levenshtein/fuzzy match. A minimum length guard on the input side avoids
 * a very short typed fragment trivially matching almost anything.
 */
export function placesMatch(primaryInputPlace: string, resolvedPrimaryPlace: string | undefined): boolean {
  if (!resolvedPrimaryPlace) return false;
  const input = normalizePlaceName(primaryInputPlace);
  const resolved = normalizePlaceName(resolvedPrimaryPlace);
  if (input.length < 3 || !resolved) return false;
  return input === resolved || resolved.includes(input) || input.includes(resolved);
}

/**
 * True when Google's top-level result types mark this as a named venue — a
 * hotel, wedding hall, mosque, hospital, station, etc. — rather than a
 * locality/town/village. Google tags virtually every named business,
 * landmark or building with 'establishment' and/or 'point_of_interest',
 * confirmed against three real, currently-existing Lahore venues (a major
 * hotel, a wedding/event venue, and a historic landmark): all three carried
 * one or both types, none carried a locality-style type as their SOLE
 * identity. The primary-place guard is right for a place like Chakswari,
 * but wrong for a venue — its own name is never going to appear as the
 * address_components' locality/sublocality entry, which instead names the
 * surrounding neighbourhood.
 */
export function isNamedVenueResult(types: string[]): boolean {
  return types.includes('establishment') || types.includes('point_of_interest');
}

/**
 * True only when a `country` address_component is present AND explicitly
 * names somewhere other than one of `expectedCountryCodes` — never when
 * country data is simply absent, and never at all when no expected country
 * is configured (an airport whose destination policy hasn't been validated
 * yet runs no country gate — see airport-registry.ts's `POLICY_PENDING`).
 * Compares only the ISO short_name: Google always returns this for a
 * `country`-typed component, and it is more reliable than any localized
 * long_name string comparison would be.
 *
 * Live Pakistan evidence corrected the original single-country version of
 * this check: real Google responses for legitimate Pakistan results ("New
 * Mirpur City", "Dadyal") sometimes return only a bare locality component
 * with no country/admin hierarchy at all. Treating that absence as "wrong
 * country" broke genuinely correct matches; a region bias on the geocoding
 * request is already a strong signal, so the absence of contrary evidence
 * is not itself suspicious.
 */
export function isDefinitelyNotExpectedCountry(addressComponents: AddressComponent[] | undefined, expectedCountryCodes: string[] | undefined): boolean {
  if (!expectedCountryCodes?.length) return false;
  const country = addressComponents?.find((component) => component.types.includes('country'));
  if (!country) return false;
  return !expectedCountryCodes.includes(country.short_name);
}

/**
 * Google occasionally labels a street-level result with an administrative
 * top-level type (notably in some Brazilian responses). The result remains
 * safe only if its components also identify a real addressable street/point;
 * a country, state or district alone still has no such component and remains
 * too broad for a road journey.
 */
function hasAddressableComponent(addressComponents: AddressComponent[] | undefined): boolean {
  return Boolean(addressComponents?.some((component) => component.types.some((type) => ADDRESSABLE_COMPONENT_TYPES.has(type))));
}

interface GeocodeApiResult {
  formatted_address?: string;
  place_id?: string;
  partial_match?: boolean;
  types?: string[];
  geometry?: { location_type?: string; location?: { lat?: number; lng?: number } };
  address_components?: AddressComponent[];
}

/**
 * Classifies a single already-chosen Google result. Shared by the normal
 * single-result path and by the multi-result path once it has been narrowed
 * to exactly one genuine venue candidate (see resolveDestination's comment
 * on why "more than one result" and "more than one real venue" are not the
 * same thing).
 */
function classifyGeocodeResult(
  result: GeocodeApiResult,
  destination: string,
  status: string,
  candidateCount: number,
  config: DestinationResolutionConfig,
): GeocodeResult {
  const partialMatch = Boolean(result.partial_match);
  const types = result.types ?? [];
  const tooBroad = types.some((type) => TOO_BROAD_TYPES.has(type)) && !hasAddressableComponent(result.address_components);
  const locationType = result.geometry?.location_type;
  const resolvedPrimaryPlace = deriveResolvedPrimaryPlace(result.address_components);
  const primaryInputPlace = extractPrimaryInputPlace(destination);
  const primaryPlaceMismatch = !placesMatch(primaryInputPlace, resolvedPrimaryPlace ?? result.formatted_address);
  const isVenue = isNamedVenueResult(types);

  let confidence: DestinationConfidence = 'CONFIRMED';
  let clarificationReason: DestinationClarificationReason | undefined;
  if (isDefinitelyNotExpectedCountry(result.address_components, config.expectedCountryCodes)) {
    confidence = 'NEEDS_CLARIFICATION';
    clarificationReason = 'WRONG_COUNTRY';
  } else if (!isVenue && tooBroad) {
    confidence = 'NEEDS_CLARIFICATION';
    clarificationReason = 'TOO_BROAD_TYPE';
  } else if (!isVenue && partialMatch) {
    confidence = 'NEEDS_CLARIFICATION';
    clarificationReason = 'PARTIAL_MATCH';
  } else if (!locationType) {
    confidence = 'NEEDS_CLARIFICATION';
    clarificationReason = 'NO_LOCATION_TYPE';
  } else if (isVenue) {
    confidence = 'NEEDS_CONFIRMATION';
  } else if (primaryPlaceMismatch) {
    confidence = 'NEEDS_CLARIFICATION';
    clarificationReason = 'PRIMARY_PLACE_MISMATCH';
  }

  return {
    confidence,
    clarificationReason,
    formattedAddress: result.formatted_address,
    location: Number.isFinite(result.geometry?.location?.lat) && Number.isFinite(result.geometry?.location?.lng) ? { lat: result.geometry!.location!.lat as number, lng: result.geometry!.location!.lng as number } : undefined,
    resolvedPrimaryPlace,
    placeId: result.place_id,
    locationTypes: types,
    locationType,
    partialMatch,
    candidateCount,
    status,
  };
}

/**
 * Resolves and safety-classifies a free-text destination for any Arrive By
 * engine. Two separate Google APIs are used deliberately, not one — see
 * lib/arrive-by-pakistan/google-routes.ts's original comment (preserved
 * there) for why the Geocoding API's candidate list is what actually
 * enables ambiguity detection that Routes API v2 alone cannot replicate.
 */
export async function resolveDestination(apiKey: string, destination: string, config: DestinationResolutionConfig, fetchImpl: typeof fetch = fetch): Promise<GeocodeResult> {
  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set('address', destination);
  if (config.regionBias) url.searchParams.set('region', config.regionBias);
  url.searchParams.set('key', apiKey);

  let response: Response;
  try {
    response = await fetchImpl(url.toString(), { cache: 'no-store' });
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

  if (body.results.length > 1) {
    // "More than one result" is not the same thing as "more than one real
    // place to choose between". Live Pakistan evidence (Aga Khan University
    // Hospital, Karachi): Google returned the actual hospital POI AND a
    // same-named sublocality/area polygon for the surrounding
    // neighbourhood — not a second competing hospital. Filtering to only
    // the genuinely venue-typed candidates first is what tells the two
    // situations apart.
    const venueCandidates = body.results.filter((r) => isNamedVenueResult(r.types ?? []));
    if (venueCandidates.length === 1) {
      return classifyGeocodeResult(venueCandidates[0], destination, body.status, 1, config);
    }
    if (venueCandidates.length > 1) {
      const usable = venueCandidates.filter((r) => r.place_id && r.formatted_address).slice(0, MAX_SELECTION_CANDIDATES);
      if (usable.length > 1) {
        return {
          confidence: 'NEEDS_SELECTION',
          candidateCount: body.results.length,
          partialMatch: false,
          status: body.status,
          candidates: usable.map((r) => ({ placeId: r.place_id!, formattedAddress: r.formatted_address! })),
        };
      }
    }
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

  return classifyGeocodeResult(body.results[0], destination, body.status, 1, config);
}
