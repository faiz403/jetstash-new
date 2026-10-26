import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CONSENT_STORAGE_KEY,
  STATS_OBJECTION_STORAGE_KEY,
  STATS_PREFERENCE_CHANGED_EVENT,
  VERCEL_ANALYTICS_STORAGE_KEY,
  hasAdMeasurementConsent,
  isSiteStatisticsObjected,
  setSiteStatisticsObjection,
} from '@/lib/consent';
import { ACQUISITION_STORAGE_KEY, getOrClassifyAcquisitionSource, getStoredAcquisitionSource, purgeAcquisitionSource } from '@/lib/acquisition';
import { cleanUrlForStatistics, sanitiseStatisticsEvent } from '@/lib/analytics-privacy';

/**
 * Behavioural coverage (October 2026) for the two privacy changes: advertising attribution only with measurement consent, and the
 * Site statistics objection. A fake browser records every storage read/write and every URL/referrer read, so the tests prove what was
 * ACCESSED, not just what was returned. The real browser-level proof (network requests, real Vercel scripts) is in the founder
 * evidence run; these are the fast, repeatable guards.
 */

type Log = string[];
function makeBrowser(opts: { href?: string; referrer?: string; local?: Record<string, string>; session?: Record<string, string> } = {}) {
  const log: Log = [];
  const mk = (name: string, init: Record<string, string>) => {
    const data = { ...init };
    return {
      getItem: (k: string) => (log.push(`${name}.get:${k}`), k in data ? data[k] : null),
      setItem: (k: string, v: string) => (log.push(`${name}.set:${k}`), void (data[k] = v)),
      removeItem: (k: string) => (log.push(`${name}.remove:${k}`), void delete data[k]),
      data,
    };
  };
  const local = mk('local', opts.local ?? {});
  const session = mk('session', opts.session ?? {});
  const events: string[] = [];
  const win = {
    localStorage: local,
    sessionStorage: session,
    dispatchEvent: (e: Event) => (events.push(e.type), true),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    get location() {
      log.push('location.read');
      return { href: opts.href ?? 'https://jetstash.co.uk/' };
    },
  };
  const doc = {
    get referrer() {
      log.push('referrer.read');
      return opts.referrer ?? '';
    },
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  return { log, local, session, events };
}

afterEach(() => vi.unstubAllGlobals());

describe('advertising attribution needs the visitor to have accepted measurement', () => {
  const ADS_URL = 'https://jetstash.co.uk/routes/manchester-lahore?gclid=TEST_GCLID_123&utm_source=google_ads';

  it.each([
    ['no decision', {}],
    ['Decline', { [CONSENT_STORAGE_KEY]: 'denied' }],
    ['a corrupted value', { [CONSENT_STORAGE_KEY]: 'maybe' }],
  ])('%s: nothing is classified, the click identifier is never read and nothing is stored', (_name, local) => {
    const b = makeBrowser({ href: ADS_URL, local });
    expect(hasAdMeasurementConsent()).toBe(false);
    expect(getOrClassifyAcquisitionSource()).toBe('unknown');
    expect(getStoredAcquisitionSource()).toBeNull();
    expect(b.log).not.toContain('location.read'); // the URL (and so the gclid) was never read
    expect(b.log).not.toContain('referrer.read');
    expect(b.log.filter((l) => l.startsWith('session.'))).toEqual([]); // session storage untouched, read or write
  });

  it('existing session storage that holds a classification is ignored (and not even read) without consent', () => {
    const b = makeBrowser({ href: ADS_URL, session: { [ACQUISITION_STORAGE_KEY]: 'google_ads' } });
    expect(getStoredAcquisitionSource()).toBeNull();
    expect(b.log).not.toContain(`session.get:${ACQUISITION_STORAGE_KEY}`);
  });

  it('purgeAcquisitionSource removes a classification left over from before the rule (Decline, withdrawal, or old session)', () => {
    const b = makeBrowser({ session: { [ACQUISITION_STORAGE_KEY]: 'google_ads' } });
    purgeAcquisitionSource();
    expect(b.session.data[ACQUISITION_STORAGE_KEY]).toBeUndefined();
  });

  it('after Accept: classifies from the gclid, stores only the enum value and reuses it for the session', () => {
    const b = makeBrowser({ href: ADS_URL, local: { [CONSENT_STORAGE_KEY]: 'granted' } });
    expect(hasAdMeasurementConsent()).toBe(true);
    expect(getOrClassifyAcquisitionSource()).toBe('google_ads');
    expect(b.session.data[ACQUISITION_STORAGE_KEY]).toBe('google_ads'); // never the gclid or utm text
    expect(JSON.stringify(b.session.data)).not.toContain('TEST_GCLID');
    expect(getStoredAcquisitionSource()).toBe('google_ads');
  });

  it('withdrawal after Accept: once the choice is denied again, the stored classification stops being used', () => {
    const b = makeBrowser({ href: ADS_URL, local: { [CONSENT_STORAGE_KEY]: 'granted' }, session: { [ACQUISITION_STORAGE_KEY]: 'google_ads' } });
    expect(getStoredAcquisitionSource()).toBe('google_ads');
    b.local.data[CONSENT_STORAGE_KEY] = 'denied';
    expect(getStoredAcquisitionSource()).toBeNull();
    expect(getOrClassifyAcquisitionSource()).toBe('unknown');
  });

  it('survives blocked storage: no consent is assumed', () => {
    makeBrowser();
    vi.stubGlobal('window', { get localStorage() { throw new Error('blocked'); } });
    expect(hasAdMeasurementConsent()).toBe(false);
    expect(isSiteStatisticsObjected()).toBe(false);
  });
});

describe('Site statistics objection', () => {
  it('is off by default; objecting stores a device-side preference, removes the script\'s own storage entry and announces the change', () => {
    const b = makeBrowser({ local: { [VERCEL_ANALYTICS_STORAGE_KEY]: '{"x":1}' } });
    expect(isSiteStatisticsObjected()).toBe(false);
    setSiteStatisticsObjection(true);
    expect(isSiteStatisticsObjected()).toBe(true);
    expect(b.local.data[STATS_OBJECTION_STORAGE_KEY]).toBe('objected');
    expect(b.local.data[VERCEL_ANALYTICS_STORAGE_KEY]).toBeUndefined();
    expect(b.events).toContain(STATS_PREFERENCE_CHANGED_EVENT);
  });

  it('turning statistics back on removes the objection', () => {
    const b = makeBrowser({ local: { [STATS_OBJECTION_STORAGE_KEY]: 'objected' } });
    expect(isSiteStatisticsObjected()).toBe(true);
    setSiteStatisticsObjection(false);
    expect(isSiteStatisticsObjected()).toBe(false);
    expect(b.local.data[STATS_OBJECTION_STORAGE_KEY]).toBeUndefined();
  });

  it('is independent of advertising consent in both directions', () => {
    makeBrowser({ local: { [CONSENT_STORAGE_KEY]: 'granted', [STATS_OBJECTION_STORAGE_KEY]: 'objected' } });
    expect(hasAdMeasurementConsent()).toBe(true);
    expect(isSiteStatisticsObjected()).toBe(true);
    vi.unstubAllGlobals();
    makeBrowser({ local: { [CONSENT_STORAGE_KEY]: 'denied' } });
    expect(hasAdMeasurementConsent()).toBe(false);
    expect(isSiteStatisticsObjected()).toBe(false);
  });
});

describe('what Vercel may receive in a page URL', () => {
  const U = 'https://jetstash.co.uk/routes/manchester-lahore?gclid=G1&gbraid=B1&wbraid=W1&fbclid=F1&msclkid=M1&gad_source=1&gad_campaignid=99&dclid=D1&ttclid=T1&utm_source=google_ads&utm_medium=cpc&utm_campaign=c1&keep=1&route=lahore';

  it('always removes advertising click identifiers, whatever the consent', () => {
    for (const keepCampaign of [true, false]) {
      const out = cleanUrlForStatistics(U, { keepCampaign });
      for (const p of ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'gad_source', 'gad_campaignid', 'dclid', 'ttclid']) expect(out).not.toContain(p + '=');
      expect(out).toContain('keep=1');
      expect(out).toContain('route=lahore');
    }
  });

  it('removes campaign tags too unless measurement consent has been given', () => {
    const without = cleanUrlForStatistics(U, { keepCampaign: false });
    expect(without).not.toMatch(/utm_/);
    const withConsent = cleanUrlForStatistics(U, { keepCampaign: true });
    expect(withConsent).toContain('utm_source=google_ads');
    expect(withConsent).not.toContain('gclid');
  });

  it('removes every utm_ parameter (not only the five common ones), the fragment, and path-parameter click ids', () => {
    const out = cleanUrlForStatistics('https://jetstash.co.uk/routes/a;gclid=SECRET/b?utm_source_platform=ads&utm_creative_format=banner&x=1#gclid=SECRET', { keepCampaign: false });
    expect(out).not.toMatch(/utm_|gclid|SECRET|#/);
    expect(out).toContain('x=1');
    expect(out).toContain('/routes/a/b');
  });

  it('removes percent-encoded path-parameter names as well, and campaign path parameters without consent', () => {
    const out = cleanUrlForStatistics('https://jetstash.co.uk/a;%67clid=SECRET;utm_source=ads;keep=1/b', { keepCampaign: false });
    expect(out).not.toMatch(/gclid|%67clid|SECRET|utm_/i);
    expect(out).toContain('keep=1');
  });

  it('drops an acquisition event inside the Vercel hook when consent is missing, so a queue that drains after a withdrawal sends nothing', () => {
    makeBrowser({});
    expect(sanitiseStatisticsEvent({ type: 'event', url: 'https://jetstash.co.uk/a', name: 'acquisition_landing' } as { url: string })).toBeNull();
    expect(sanitiseStatisticsEvent({ type: 'event', url: 'https://jetstash.co.uk/a', name: 'tripcom_click' } as { url: string })).not.toBeNull();
    vi.unstubAllGlobals();
    makeBrowser({ local: { [CONSENT_STORAGE_KEY]: 'granted' } });
    expect(sanitiseStatisticsEvent({ type: 'event', url: 'https://jetstash.co.uk/a', name: 'acquisition_landing' } as { url: string })).not.toBeNull();
  });

  it('drops the fragment even when consent has been given (never needed for statistics)', () => {
    expect(cleanUrlForStatistics('https://jetstash.co.uk/a#route-watch', { keepCampaign: true })).toBe('https://jetstash.co.uk/a');
  });

  it('is case-insensitive, leaves clean URLs untouched and never throws on a bad URL', () => {
    expect(cleanUrlForStatistics('https://jetstash.co.uk/a?GCLID=1&x=2', { keepCampaign: false })).toBe('https://jetstash.co.uk/a?x=2');
    expect(cleanUrlForStatistics('https://jetstash.co.uk/a?x=2', { keepCampaign: false })).toBe('https://jetstash.co.uk/a?x=2');
    expect(cleanUrlForStatistics('not a url', { keepCampaign: false })).toBe('not a url');
  });

  it('the beforeSend hook sends nothing at all once the visitor has objected to site statistics', () => {
    makeBrowser({ local: { [STATS_OBJECTION_STORAGE_KEY]: 'objected', [CONSENT_STORAGE_KEY]: 'granted' } });
    expect(sanitiseStatisticsEvent({ type: 'pageview', url: 'https://jetstash.co.uk/a' })).toBeNull();
  });

  it('the beforeSend hook reads consent at send time: campaign tags pass only after Accept', () => {
    makeBrowser({});
    expect(sanitiseStatisticsEvent({ type: 'pageview', url: U })!.url).not.toMatch(/utm_|gclid/);
    vi.unstubAllGlobals();
    makeBrowser({ local: { [CONSENT_STORAGE_KEY]: 'granted' } });
    const out = sanitiseStatisticsEvent({ type: 'pageview', url: U })!.url;
    expect(out).toContain('utm_source=google_ads');
    expect(out).not.toContain('gclid');
  });
});

describe('wiring', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

  it('the statistics scripts are mounted only after the preference has been read, never directly from the layout', () => {
    const src = read('components/analytics/site-statistics.tsx');
    expect(src).toContain('useState(false)'); // nothing mounted until the preference is known
    expect(src).toContain('if (!on) return null;');
    expect(src).toContain('isSiteStatisticsObjected()');
    expect(read('app/layout.tsx')).not.toMatch(/@vercel\/(analytics|speed-insights)/);
  });

  it('the tracker only acts with consent and not when statistics are objected to, and purges otherwise', () => {
    const src = read('components/analytics/acquisition-landing-tracker.tsx');
    expect(src).toContain('hasAdMeasurementConsent()');
    expect(src).toContain('isSiteStatisticsObjected()');
    expect(src).toContain('purgeAcquisitionSource()');
    expect(src).toContain('CONSENT_GRANTED_EVENT');
  });

  it('other tabs: the tracker handles consent changes from storage events, and the statistics wrapper reloads on an objection made elsewhere', () => {
    const tracker = read('components/analytics/acquisition-landing-tracker.tsx');
    expect(tracker).toContain("window.addEventListener('storage', onStorage)");
    expect(tracker).toContain('CONSENT_STORAGE_KEY');
    expect(tracker).toContain('if (hasAdMeasurementConsent() && !isSiteStatisticsObjected()) track(');
    const stats = read('components/analytics/site-statistics.tsx');
    expect(stats).toContain('window.location.reload()');
    expect(stats).toContain('STATS_OBJECTION_STORAGE_KEY');
  });

  it('consent withdrawn in another tab reloads this tab when the Google tag is running here', () => {
    const src = read('components/ui/cookie-consent-banner.tsx');
    expect(src).toContain("window.addEventListener('storage', handleStorage)");
    expect(src).toContain("if (now !== 'granted' && loadTagRef.current) window.location.reload();");
  });

  it('Cookie settings moves focus into the panel and returns it to the opener on close', () => {
    const src = read('components/ui/cookie-consent-banner.tsx');
    expect(src).toContain('panelRef.current?.focus()');
    expect(src).toContain('openerRef.current = document.activeElement');
    expect(src).toContain('opener.focus()');
  });

  it('the banner exposes the Site statistics control only in Cookie settings, with a plain toggle and a reload on objecting', () => {
    const src = read('components/ui/cookie-consent-banner.tsx');
    expect(src).toContain('Turn off site statistics');
    expect(src).toContain('Turn on site statistics');
    expect(src).toContain('setSiteStatisticsObjection(next)');
    expect(src).toContain('window.location.reload()');
    expect(src).toContain('{settingsMode && (');
  });

  beforeEach(() => undefined);
});
