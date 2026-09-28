/**
 * Deterministic "does Google's resolved place still mean what the traveller
 * typed" check — a second, independent signal alongside candidate-count,
 * partial-match and place-type broadness.
 *
 * Why this exists: a live ISB test resolved "Chakswari, Mirpur, Azad
 * Kashmir, Pakistan" to "New Mirpur City" — a real, distinct town roughly
 * 42km away. Every existing signal (1 candidate, no partial match, an
 * acceptable type, a present location_type) came back clean, so nothing
 * caught it. A whole-string token-overlap check would ALSO have missed it,
 * because both strings share the word "Mirpur" — the input's qualifying
 * context, not the place the traveller actually asked for.
 *
 * The fix compares only the PRIMARY place — normally the first
 * comma-separated segment of the typed destination ("Chakswari", not
 * "Chakswari, Mirpur, Azad Kashmir, Pakistan") — against the most specific
 * named-place component Google's own address_components gives back for the
 * resolved result. Deliberately simple: no fuzzy matching, no embeddings,
 * no invented synonyms — normalized substring containment only.
 */

/** Google address_components entries, in Google's own resolution order (most specific first is NOT guaranteed, hence the priority list below). */
export interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

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
const PRIMARY_PLACE_COMPONENT_PRIORITY = ['sublocality_level_1', 'sublocality', 'locality', 'administrative_area_level_3', 'postal_town'];

function normalizePlaceName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, ' ')
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
 * True when Google's top-level result types mark this as a named venue —
 * a hotel, wedding hall, mosque, hospital, station, etc. — rather than a
 * locality/town/village. Google tags virtually every named business,
 * landmark or building with 'establishment' and/or 'point_of_interest',
 * confirmed against three real, currently-existing Lahore venues (a
 * major hotel, a wedding/event venue, and a historic landmark): all
 * three carried one or both types, none carried a locality-style type
 * as their SOLE identity. The primary-place guard is right for a place
 * like Chakswari, but wrong for a venue — its own name is never going
 * to appear as the address_components' locality/sublocality entry,
 * which instead names the surrounding neighbourhood.
 */
export function isNamedVenueResult(types: string[]): boolean {
  return types.includes('establishment') || types.includes('point_of_interest');
}

/**
 * True only when a `country` address_component is present AND explicitly
 * names somewhere other than Pakistan — never when country data is simply
 * absent. Live evidence corrected this: real Google responses for
 * legitimate Pakistan results ("New Mirpur City", "Dadyal") sometimes
 * return only a bare locality component with no country/admin hierarchy
 * at all. Treating that absence as "not Pakistan" broke genuinely correct
 * matches; region=pk on the geocoding request is already a strong bias,
 * so the absence of contrary evidence is not itself suspicious.
 */
export function isDefinitelyNotPakistan(addressComponents: AddressComponent[] | undefined): boolean {
  const country = addressComponents?.find((component) => component.types.includes('country'));
  if (!country) return false;
  return country.short_name !== 'PK' && country.long_name !== 'Pakistan';
}
