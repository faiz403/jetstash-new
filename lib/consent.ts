/**
 * Advertising-consent storage and cross-tree signalling for Basic Consent
 * Mode (August 2026, revised from an earlier Advanced Consent Mode draft —
 * see components/ui/cookie-consent-banner.tsx for why that draft was wrong).
 *
 * The only place JetStash reads/writes the visitor's advertising-consent
 * choice. The choice itself lives in `localStorage`, not a cookie, so
 * JetStash's cookieless positioning stays true for everything except the
 * one optional Google Ads measurement tag this choice gates
 * (components/ui/cookie-consent-banner.tsx, lib/google-ads-conversions.ts).
 *
 * This file deliberately does NOT talk to Google at all — no `gtag()` call
 * lives here. Under Basic Consent Mode, the Google tag itself is never
 * downloaded until the visitor accepts, so there is nothing to "update"
 * consent on beforehand; the banner component owns loading (and, on
 * withdrawal, effectively unloading via a reload — see its own comment) the
 * tag once a choice is made.
 */

export const CONSENT_STORAGE_KEY = 'jetstash-ad-consent';

export type ConsentChoice = 'granted' | 'denied';

/**
 * Fired by the permanent "Cookie settings" control (Footer →
 * components/ui/cookie-settings-button.tsx) to reopen the consent banner for
 * a visitor who already made a choice — the ICO's "withdrawal must be as
 * easy as giving consent" requirement, made concrete as an always-available
 * control rather than a one-time banner nobody can find again.
 */
export const CONSENT_SETTINGS_OPEN_EVENT = 'jetstash:cookie-settings-open';

/** Reads the visitor's previously stored choice, or null if they haven't chosen yet. */
export function getStoredConsentChoice(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

/** Persists the visitor's choice locally, in the browser only — never sent to JetStash's own servers. */
export function storeConsentChoice(choice: ConsentChoice): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
}

/** Fired when the visitor accepts optional measurement, so things that only run with consent can start in the current page. */
export const CONSENT_GRANTED_EVENT = 'jetstash:consent-granted';

/** True only when the visitor has actively accepted optional measurement. No decision, Decline and withdrawal are all false. */
export function hasAdMeasurementConsent(): boolean {
  try {
    return getStoredConsentChoice() === 'granted';
  } catch {
    return false; // storage blocked: treat as no consent
  }
}

/**
 * Site statistics consent (October 2026). Vercel Analytics and Speed Insights count visits and page speed. They are OFF by default
 * and their scripts are not requested until the visitor explicitly allows them. This is a separate permission from the Google Ads
 * measurement choice above: neither implies the other. The choice is a plain device-side preference, never sent to JetStash.
 */
export const STATS_CONSENT_STORAGE_KEY = 'jetstash-stats-consent';
export const STATS_PREFERENCE_CHANGED_EVENT = 'jetstash:stats-preference-changed';
/** The one entry Vercel's analytics script itself reads and writes in the visitor's browser storage. */
export const VERCEL_ANALYTICS_STORAGE_KEY = '__va_attribution';

export function getStoredStatisticsChoice(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(STATS_CONSENT_STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null; // storage blocked: no choice, so no statistics
  }
}

/** True only when the visitor has actively allowed site statistics. No decision, Decline and withdrawal are all false. */
export function hasSiteStatisticsConsent(): boolean {
  return getStoredStatisticsChoice() === 'granted';
}

export function storeStatisticsChoice(choice: ConsentChoice): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STATS_CONSENT_STORAGE_KEY, choice);
    // Declining or withdrawing leaves nothing of the statistics script on the device.
    if (choice !== 'granted') window.localStorage.removeItem(VERCEL_ANALYTICS_STORAGE_KEY);
  } catch {
    // storage blocked: nothing could have been stored either
  }
  window.dispatchEvent(new Event(STATS_PREFERENCE_CHANGED_EVENT));
}

/** Asks the consent banner to reopen, wherever it's mounted, so the visitor can change their earlier choice. */
export function requestCookieSettingsOpen(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CONSENT_SETTINGS_OPEN_EVENT));
}
