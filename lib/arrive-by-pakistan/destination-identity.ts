/**
 * Pakistan's destination-identity helpers are now generic and shared across
 * every Arrive By engine — see lib/arrive-by-shared/destination-resolution.ts
 * for the implementation, the full rationale (village mis-resolution, venue
 * confirmation, multi-POI selection), and how the country gate generalised
 * from a hardcoded Pakistan check to `expectedCountryCodes`. This file keeps
 * the original names and path so nothing importing them (including this
 * module's own history) needs to change.
 */
export {
  type AddressComponent,
  extractPrimaryInputPlace,
  deriveResolvedPrimaryPlace,
  placesMatch,
  isNamedVenueResult,
} from '@/lib/arrive-by-shared/destination-resolution';

import { isDefinitelyNotExpectedCountry, type AddressComponent as SharedAddressComponent } from '@/lib/arrive-by-shared/destination-resolution';

/** Pakistan-specific wrapper over the now-generic country gate — preserved under its original name since lib/arrive-by-pakistan/google-routes.ts still calls it this way. */
export function isDefinitelyNotPakistan(addressComponents: SharedAddressComponent[] | undefined): boolean {
  return isDefinitelyNotExpectedCountry(addressComponents, ['PK']);
}
