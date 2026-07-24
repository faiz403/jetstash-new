export type QuoteTripType =
  | 'solo'
  | 'couple'
  | 'family-trip'
  | 'group-travel'
  | 'business'
  | 'student'
  | 'umrah'
  | 'other';

export type QuoteRegion =
  | 'pakistan'
  | 'india'
  | 'bangladesh'
  | 'gulf'
  | 'turkey'
  | 'morocco'
  | 'southern-europe'
  | 'other';

/**
 * Ordered for scanability, not alphabetically: broadly-applicable personal
 * travel patterns first (a solo/couple/family/group visitor should recognise
 * themselves immediately), then the two smaller commercial/personal segments,
 * then Umrah (JetStash's own distinct vertical, not a generic "trip type"),
 * then Other last as the universal escape hatch — never omit Other, or a
 * legitimate enquiry with no matching option has nowhere to go.
 *
 * `value`s for 'umrah', 'family-trip' and 'group-travel' are pre-existing and
 * deliberately unchanged — app/umrah/page.tsx, app/family-holidays/page.tsx,
 * components/sections/region-hub-page.tsx and
 * components/homepage-v2/homepage-sections.tsx all deep-link here via
 * `?tripType=umrah` / `?tripType=family-trip`; only the *labels* were
 * shortened (dropping the redundant "package"/"trip"/"travel" suffix once
 * every option sits inside a field already called "Trip type").
 */
export const TRIP_TYPE_OPTIONS: { value: QuoteTripType; label: string }[] = [
  { value: 'solo', label: 'Solo traveller' },
  { value: 'couple', label: 'Couple / Honeymoon' },
  { value: 'family-trip', label: 'Family' },
  { value: 'group-travel', label: 'Group' },
  { value: 'business', label: 'Business' },
  { value: 'student', label: 'Student' },
  { value: 'umrah', label: 'Umrah' },
  { value: 'other', label: 'Other' },
];

export const QUOTE_REGION_OPTIONS: { value: QuoteRegion; label: string }[] = [
  { value: 'pakistan', label: 'Pakistan' },
  { value: 'india', label: 'India' },
  { value: 'bangladesh', label: 'Bangladesh' },
  { value: 'gulf', label: 'Gulf' },
  { value: 'turkey', label: 'Turkey' },
  { value: 'morocco', label: 'Morocco' },
  { value: 'southern-europe', label: 'Southern Europe' },
  { value: 'other', label: 'Other / not sure yet' },
];

export const VALID_TRIP_TYPES = TRIP_TYPE_OPTIONS.map((o) => o.value);
export const VALID_QUOTE_REGIONS = QUOTE_REGION_OPTIONS.map((o) => o.value);

export function isQuoteTripType(value: unknown): value is QuoteTripType {
  return typeof value === 'string' && (VALID_TRIP_TYPES as string[]).includes(value);
}

export function isQuoteRegion(value: unknown): value is QuoteRegion {
  return typeof value === 'string' && (VALID_QUOTE_REGIONS as string[]).includes(value);
}
