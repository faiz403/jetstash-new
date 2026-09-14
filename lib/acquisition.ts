/**
 * Acquisition-source classification (14 Sept 2026, founder-approved Astra
 * #19 small closure set). Answers one narrow question: "which coarse
 * channel did this visitor arrive from?" — nothing more.
 *
 * Deliberately the smallest privacy-safe design available:
 *   - No cookie. No persistent visitor ID. No fingerprinting.
 *   - sessionStorage only — the classification naturally disappears the
 *     moment the browser tab/session ends, exactly like Journey Choice's
 *     and other session-scoped state elsewhere in this codebase.
 *   - Only ever one value from the fixed AcquisitionSource enum is stored
 *     or ever reaches analytics — never a raw referrer URL, never a raw
 *     UTM string, never a search term.
 *   - Classified once, on first landing in the session, then reused for
 *     the rest of that session (see getOrClassifyAcquisitionSource).
 *
 * This module never calls track() itself and never touches Google Ads —
 * see lib/analytics.ts for the one place a classified value is actually
 * attached to an event.
 */

export type AcquisitionSource =
  | 'organic_search'
  | 'google_ads'
  | 'facebook'
  | 'reddit'
  | 'other_referral'
  | 'direct'
  | 'unknown';

const STORAGE_KEY = 'jetstash-acquisition-source';

/** Only these exact utm_source values are ever recognised — anything else collapses to other_referral, never passed through raw. */
const KNOWN_UTM_SOURCES: Record<string, AcquisitionSource> = {
  facebook: 'facebook',
  fb: 'facebook',
  reddit: 'reddit',
  google_ads: 'google_ads',
  googleads: 'google_ads',
  google: 'organic_search',
};

function classifyFromReferrer(referrer: string): AcquisitionSource {
  if (!referrer) return 'direct';
  let host: string;
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'unknown';
  }
  if (host.endsWith('google.com') || host.startsWith('google.') || host.includes('.google.')) return 'organic_search';
  if (host.endsWith('facebook.com') || host.endsWith('fb.com')) return 'facebook';
  if (host.endsWith('reddit.com')) return 'reddit';
  return 'other_referral';
}

/**
 * Classifies this session's acquisition source, exactly once. A gclid
 * query parameter (Google's own standard Ads click identifier) or a
 * recognised utm_source both take priority over the referrer, since a
 * deliberately tagged link is stronger evidence than an inferred one — but
 * neither the gclid value nor the utm_source string itself is ever stored;
 * only the resulting enum member is. An unrecognised utm_source is treated
 * as a deliberate-but-unmapped link (other_referral), never leaked as raw
 * text and never silently dropped into "direct".
 */
export function classifyAcquisitionSource(url: URL, referrer: string): AcquisitionSource {
  const gclid = url.searchParams.get('gclid');
  if (gclid) return 'google_ads';

  const utmSourceRaw = url.searchParams.get('utm_source');
  if (utmSourceRaw) {
    const utmSource = utmSourceRaw.toLowerCase();
    return KNOWN_UTM_SOURCES[utmSource] ?? 'other_referral';
  }

  return classifyFromReferrer(referrer);
}

/** The stored classification for this session, or null if not yet classified. Never throws off-window. */
export function getStoredAcquisitionSource(): AcquisitionSource | null {
  if (typeof window === 'undefined') return null;
  const value = window.sessionStorage.getItem(STORAGE_KEY);
  const valid: readonly string[] = ['organic_search', 'google_ads', 'facebook', 'reddit', 'other_referral', 'direct', 'unknown'];
  return value && valid.includes(value) ? (value as AcquisitionSource) : null;
}

/**
 * Returns this session's acquisition source, classifying and caching it in
 * sessionStorage on first call. Every subsequent call in the same tab
 * session returns the cached value, even after the visitor navigates past
 * whatever page they first landed on (matches real acquisition semantics —
 * the channel that brought them in stays attributed to the whole session,
 * not just the first page).
 */
export function getOrClassifyAcquisitionSource(): AcquisitionSource {
  if (typeof window === 'undefined') return 'unknown';
  const stored = getStoredAcquisitionSource();
  if (stored) return stored;
  const classified = classifyAcquisitionSource(new URL(window.location.href), document.referrer);
  window.sessionStorage.setItem(STORAGE_KEY, classified);
  return classified;
}
