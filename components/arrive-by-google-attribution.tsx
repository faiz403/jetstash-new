/**
 * Google Maps attribution for Arrive By (3 November 2026). Arrive By shows Google Maps Platform content (place names,
 * addresses and journey times from the Geocoding, Places and Routes APIs) without a Google Map, so Google's attribution
 * rules apply: the logo where possible, or the text "Google Maps" where space is limited. The text must not be
 * translated, wrapped or re-capitalised, must be 12–16px in normal weight, in white, #1F1F1F or #5E5E5E, and sit near
 * the top or bottom of the content inside the same visual container.
 */
export function GoogleMapsAttribution({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs font-normal leading-4 text-google-attribution ${className}`} data-testid="google-maps-attribution">
      <span translate="no" className="whitespace-nowrap">Google Maps</span>
    </p>
  );
}
