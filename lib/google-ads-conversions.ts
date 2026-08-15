import type { AnalyticsEvent } from './analytics';

/**
 * Central Google Ads conversion dispatch (August 2026) — the one place a
 * Google Ads `send_to` string is defined, so lib/analytics.ts's track() can
 * fire a Google Ads conversion without any component calling gtag() itself.
 *
 * Only the three JetStash events approved for Google Ads measurement are
 * mapped below (Pilot #2 conversion-tracking setup); every other event is a
 * deliberate no-op here — most of JetStash's analytics vocabulary has
 * nothing to do with outbound partner clicks and should never reach Google.
 *
 * These are the real conversion action IDs created in the JetStash Google
 * Ads account (Outbound click category, "Set up with a Google tag" flow),
 * not invented values:
 *   - Flight Partner Click (primary)   — verified Trip.com flight CTA click
 *   - Hotel Partner Click (secondary)  — verified Trip.com hotel CTA click
 *   - Baggage Affiliate Click (secondary) — CJ luggage affiliate CTA click
 *
 * JetStash uses Basic Consent Mode (lib/consent.ts +
 * components/ui/cookie-consent-banner.tsx), not Advanced Consent Mode: the
 * Google tag is never downloaded, and `window.gtag` never exists, until the
 * visitor explicitly accepts. This function's own `typeof window.gtag !==
 * 'function'` guard below is what makes that failure mode safe — before
 * acceptance (or after a decline/withdrawal), the guard is always true and
 * this is a pure no-op: no cookieless ping, no consent-state ping, nothing
 * sent to Google. It's not a redundant check on top of Google's own consent
 * gating; for Basic Consent Mode, it's the only gate there is, because
 * there's no tag loaded yet for Google to gate anything on.
 */

export const GOOGLE_ADS_TAG_ID = 'AW-18378433991';

const GOOGLE_ADS_CONVERSION_LABELS: Partial<Record<AnalyticsEvent, string>> = {
  tripcom_click: 'P1GBCNPM_-EcEMfLwrtE',
  tripcom_hotel_click: '9ja5CNbM_-EcEMfLwrtE',
  ready_check_baggage_cta_click: 'J9oQCNnM_-EcEMfLwrtE',
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[][];
  }
}

/**
 * Fires the Google Ads conversion mapped to `event`, if any. Silently does
 * nothing for every unmapped event, on the server, or whenever the Google
 * tag hasn't been loaded (not yet accepted, declined, or withdrawn) — never
 * throws.
 */
export function fireGoogleAdsConversion(event: AnalyticsEvent): void {
  const label = GOOGLE_ADS_CONVERSION_LABELS[event];
  if (!label) return;
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', 'conversion', { send_to: `${GOOGLE_ADS_TAG_ID}/${label}` });
}
