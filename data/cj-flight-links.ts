/**
 * Exact, unedited CJ Get Code URLs only. An approved advertiser relationship
 * alone is not a verified flight handoff. Keep this empty until both the
 * current account terms and the exact airport landing have been checked.
 * No invented link IDs, generic advertiser homepages or edited redirects.
 */
export interface CjFlightLink {
  routeSlug: string;
  provider: 'air-india';
  url: string;
  originIata: string;
  destinationIata: string;
  accountRelationship: 'active' | 'pending' | 'ended';
  ukWebsitePromotionAllowed: boolean;
  generatedBy: 'cj-get-code';
  searchType: 'dateless-exact-airports';
  /** All checks must be recorded together. No date is advanced automatically. */
  verifiedDate: string;
  reviewDueDate: string;
  /** Where the account/terms and the landing behaviour were inspected. No credentials. */
  evidenceNote: string;
}

export const cjFlightLinks: readonly CjFlightLink[] = [];
