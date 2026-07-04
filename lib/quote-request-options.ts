export type QuoteTripType = 'umrah' | 'family-trip' | 'group-travel';

export type QuoteRegion =
  | 'pakistan'
  | 'india'
  | 'bangladesh'
  | 'gulf'
  | 'turkey'
  | 'morocco'
  | 'southern-europe'
  | 'other';

export const TRIP_TYPE_OPTIONS: { value: QuoteTripType; label: string }[] = [
  { value: 'umrah', label: 'Umrah package' },
  { value: 'family-trip', label: 'Family trip' },
  { value: 'group-travel', label: 'Group travel' },
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
