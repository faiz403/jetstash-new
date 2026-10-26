/**
 * What may reach Vercel Analytics and Speed Insights in a page URL (October 2026).
 *
 * Both Vercel scripts send the full page URL, query string included (the real scripts' payloads carry location.href). That means an
 * advertising click identifier such as gclid, or a campaign tag, would reach Vercel automatically, with no consent, even when
 * JetStash's own tracking is switched off. Their beforeSend hooks let the URL be cleaned before it leaves the browser:
 *   - only an allowlist of JetStash's own parameters (with simple values) is kept; every other query parameter is removed, so
 *     advertising click identifiers and anything an inbound link adds never reach Vercel;
 *   - campaign tags (utm_*) are kept only if the visitor has accepted optional measurement, and only with simple values.
 * The referrer is sent by the Vercel script itself and cannot be changed from here; browsers send only the origin of a
 * cross-site referrer by default, which carries no click identifier.
 */
import { hasAdMeasurementConsent, hasSiteStatisticsConsent } from '@/lib/consent';

export const AD_CLICK_ID_PARAMS: readonly string[] = [
  // Google (Ads click ids, the 2023+ campaign parameters, cross-domain linker, Shopping)
  'gclid', 'gbraid', 'wbraid', 'dclid', 'gclsrc', 'gad_source', 'gad_campaignid', '_gl', 'srsltid',
  // Meta, Microsoft, TikTok, X, LinkedIn, Yahoo, Pinterest, Reddit, Snap, Impact
  'fbclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id', 'yclid', 'epik', 'rdt_cid', 'ScCid', 'irclickid',
];
/** Campaign tags: every utm_ parameter (utm_source, utm_medium, utm_source_platform, utm_creative_format and any others). */
export const CAMPAIGN_PARAM_PREFIX = 'utm_';

/** The query parameters JetStash itself writes (airport codes, destination, trip type, region), compared in lower case. */
export const KNOWN_QUERY_PARAMS: ReadonlySet<string> = new Set(['airport', 'departure', 'arrival', 'destination', 'triptype', 'region']);
/** Letters, digits and a few separators, at most 40 characters: enough for a code or slug, too short and plain to carry a token or an address. */
const SIMPLE_VALUE = /^[A-Za-z0-9_.~-]{1,40}$/;

export function cleanUrlForStatistics(url: string, opts: { keepCampaign: boolean }): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  let changed = false;
  // Allowlist (October 2026): only the parameters JetStash itself puts in its own URLs, with simple values, survive. Anything else an
  // inbound link carries (click ids, tokens, email addresses, unknown tracking parameters) is dropped, so it never depends on a
  // blocklist being complete. Campaign tags (utm_*) survive only with measurement consent and only with simple values.
  for (const key of [...new Set(u.searchParams.keys())]) {
    const k = key.toLowerCase();
    const values = u.searchParams.getAll(key);
    const known = KNOWN_QUERY_PARAMS.has(k) && values.every((v) => SIMPLE_VALUE.test(v));
    const campaign = k.startsWith(CAMPAIGN_PARAM_PREFIX) && opts.keepCampaign && values.every((v) => SIMPLE_VALUE.test(v));
    if (!known && !campaign) {
      u.searchParams.delete(key);
      changed = true;
    }
  }
  // A fragment can carry parameters too (#gclid=...) and is never needed for statistics: it is always dropped.
  if (u.hash) {
    u.hash = '';
    changed = true;
  }
  // Path parameters (;gclid=...) on any path segment.
  const decode = (p: string) => {
    try {
      return decodeURIComponent(p).toLowerCase();
    } catch {
      return p.toLowerCase();
    }
  };
  const cleanPath = u.pathname
    .split('/')
    .map((seg) => {
      const parts = seg.split(';');
      const keep = parts.slice(1).filter((p) => {
        const name = decode(p).split('=')[0];
        const isClickId = AD_CLICK_ID_PARAMS.some((id) => id.toLowerCase() === name);
        const isCampaign = name.startsWith(CAMPAIGN_PARAM_PREFIX);
        return !(isClickId || (isCampaign && !opts.keepCampaign));
      });
      return [parts[0], ...keep].join(';');
    })
    .join('/');
  if (cleanPath !== u.pathname) {
    u.pathname = cleanPath;
    changed = true;
  }
  return changed ? u.toString() : url;
}

/**
 * The beforeSend hook for both Vercel scripts: returns the same event with a cleaned URL. Unless the visitor has allowed site
 * statistics, nothing is sent at all (this also stops the final flush a script already running in the page does when it unloads).
 */
export function sanitiseStatisticsEvent<T extends { url: string }>(event: T): T | null {
  if (!hasSiteStatisticsConsent()) return null;
  // Advertising attribution events are re-checked here, inside Vercel's own send hook: an event queued before a withdrawal (in this
  // tab or another) is dropped when the queue drains, however it got there.
  const name = (event as { name?: unknown }).name;
  if (typeof name === 'string' && name.startsWith('acquisition_') && !hasAdMeasurementConsent()) return null;
  return { ...event, url: cleanUrlForStatistics(event.url, { keepCampaign: hasAdMeasurementConsent() }) };
}
