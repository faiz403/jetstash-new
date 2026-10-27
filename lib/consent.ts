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

/**
 * A WITHDRAWAL (denied) that could not be written to localStorage (blocked, full) must still be honoured, including after the reload
 * that follows a withdrawal. It is kept in memory for this page load and, if possible, in sessionStorage for this tab, and a stored
 * 'denied' there beats an old 'granted' in localStorage. A grant that could not be written is simply not kept: nothing optional runs
 * on the strength of a choice that was never persisted. Another tab's change still arrives normally once storage works again.
 */
const unwrittenDenials = new Set<string>();
const overrideKey = (key: string) => key + ':denied-override';

function readChoice(key: string): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  if (unwrittenDenials.has(key)) return 'denied';
  try {
    if (window.sessionStorage.getItem(overrideKey(key)) === 'denied') return 'denied';
  } catch {
    // no session storage: only the in-memory record applies
  }
  try {
    const value = window.localStorage.getItem(key);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null; // storage blocked: no choice, so nothing optional runs
  }
}

function writeChoice(key: string, choice: ConsentChoice): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, choice);
    unwrittenDenials.delete(key);
    try {
      window.sessionStorage.removeItem(overrideKey(key));
    } catch {
      // nothing to clear
    }
  } catch {
    if (choice !== 'denied') return;
    unwrittenDenials.add(key);
    try {
      window.sessionStorage.setItem(overrideKey(key), 'denied');
    } catch {
      // in-memory record only
    }
  }
}

/** Reads the visitor's previously stored choice, or null if they haven't chosen yet. Never throws. */
export function getStoredConsentChoice(): ConsentChoice | null {
  return readChoice(CONSENT_STORAGE_KEY);
}

/** Persists the visitor's choice locally, in the browser only — never sent to JetStash's own servers. Never throws. */
export function storeConsentChoice(choice: ConsentChoice): void {
  writeChoice(CONSENT_STORAGE_KEY, choice);
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
  return readChoice(STATS_CONSENT_STORAGE_KEY);
}

/** True only when the visitor has actively allowed site statistics. No decision, Decline and withdrawal are all false. */
export function hasSiteStatisticsConsent(): boolean {
  return getStoredStatisticsChoice() === 'granted';
}

export function storeStatisticsChoice(choice: ConsentChoice): void {
  if (typeof window === 'undefined') return;
  writeChoice(STATS_CONSENT_STORAGE_KEY, choice);
  try {
    // Declining or withdrawing leaves nothing of the statistics script on the device.
    if (choice !== 'granted') window.localStorage.removeItem(VERCEL_ANALYTICS_STORAGE_KEY);
  } catch {
    // storage blocked: nothing could have been stored either
  }
  window.dispatchEvent(new Event(STATS_PREFERENCE_CHANGED_EVENT));
}

/**
 * Advertising attribution (reading the click id, keeping a channel for the session, acquisition events) is advertising measurement AND
 * travels through the statistics scripts, so it needs BOTH separate permissions. Every attribution helper checks this one function.
 */
export function hasAttributionConsent(): boolean {
  return hasAdMeasurementConsent() && hasSiteStatisticsConsent();
}

/** Asks the consent banner to reopen, wherever it's mounted, so the visitor can change their earlier choice. */
export function requestCookieSettingsOpen(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CONSENT_SETTINGS_OPEN_EVENT));
}
