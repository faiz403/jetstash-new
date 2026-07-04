export type TravelInterest = 'pakistan' | 'india' | 'gulf' | 'umrah' | 'business-class';

/**
 * Travel Club interest segments — the single source of truth shared by the
 * newsletter form and /api/subscribe, so the two can never drift apart.
 * Each value maps 1:1 to a Brevo TRAVEL_INTEREST attribute value and to the
 * hub page a new subscriber is pointed at after signing up.
 */
export const TRAVEL_INTEREST_OPTIONS: {
  value: TravelInterest;
  label: string;
  shortLabel: string;
  href: string;
}[] = [
  { value: 'pakistan', label: 'Pakistan (Lahore, Islamabad, Karachi)', shortLabel: 'Pakistan', href: '/pakistan' },
  { value: 'india', label: 'India (Delhi, Mumbai, Ahmedabad, Amritsar)', shortLabel: 'India', href: '/india' },
  { value: 'gulf', label: 'Gulf (Dubai, Doha)', shortLabel: 'Gulf', href: '/gulf' },
  { value: 'umrah', label: 'Umrah & Saudi Arabia', shortLabel: 'Umrah', href: '/umrah' },
  { value: 'business-class', label: 'Business class, any route', shortLabel: 'business class', href: '/business-class' },
];

const VALID_TRAVEL_INTERESTS = TRAVEL_INTEREST_OPTIONS.map((o) => o.value);

export function isTravelInterest(value: unknown): value is TravelInterest {
  return typeof value === 'string' && (VALID_TRAVEL_INTERESTS as string[]).includes(value);
}
