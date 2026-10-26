import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CONSENT_STORAGE_KEY,
  STATS_CONSENT_STORAGE_KEY,
  STATS_PREFERENCE_CHANGED_EVENT,
  VERCEL_ANALYTICS_STORAGE_KEY,
  hasAdMeasurementConsent,
  hasSiteStatisticsConsent,
  storeStatisticsChoice,
} from '@/lib/consent';
import { ACQUISITION_STORAGE_KEY, getOrClassifyAcquisitionSource, getStoredAcquisitionSource, purgeAcquisitionSource } from '@/lib/acquisition';
import { cleanUrlForStatistics, sanitiseStatisticsEvent } from '@/lib/analytics-privacy';

/**
 * Behavioural coverage (October 2026) for the two privacy changes: advertising attribution only with measurement consent, and the
 * consent-first Site statistics. A fake browser records every storage read/write and every URL/referrer read, so the tests prove what was
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
    expect(b.log.filter((l) => l.includes(ACQUISITION_STORAGE_KEY))).toEqual([]); // session storage untouched, read or write
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
    const b = makeBrowser({ href: ADS_URL, local: { [CONSENT_STORAGE_KEY]: 'granted', [STATS_CONSENT_STORAGE_KEY]: 'granted' } });
    expect(hasAdMeasurementConsent()).toBe(true);
    expect(getOrClassifyAcquisitionSource()).toBe('google_ads');
    expect(b.session.data[ACQUISITION_STORAGE_KEY]).toBe('google_ads'); // never the gclid or utm text
    expect(JSON.stringify(b.session.data)).not.toContain('TEST_GCLID');
    expect(getStoredAcquisitionSource()).toBe('google_ads');
  });

  it('withdrawal after Accept: once the choice is denied again, the stored classification stops being used', () => {
    const b = makeBrowser({ href: ADS_URL, local: { [CONSENT_STORAGE_KEY]: 'granted', [STATS_CONSENT_STORAGE_KEY]: 'granted' }, session: { [ACQUISITION_STORAGE_KEY]: 'google_ads' } });
    expect(getStoredAcquisitionSource()).toBe('google_ads');
    b.local.data[CONSENT_STORAGE_KEY] = 'denied';
    expect(getStoredAcquisitionSource()).toBeNull();
    expect(getOrClassifyAcquisitionSource()).toBe('unknown');
  });

  it('measurement accepted but statistics NOT allowed: attribution still does nothing (no URL, referrer or storage access)', () => {
    for (const local of [{ [CONSENT_STORAGE_KEY]: 'granted' }, { [CONSENT_STORAGE_KEY]: 'granted', [STATS_CONSENT_STORAGE_KEY]: 'denied' }] as Record<string, string>[]) {
      vi.unstubAllGlobals();
      const b = makeBrowser({ href: ADS_URL, local, session: { [ACQUISITION_STORAGE_KEY]: 'google_ads' } });
      expect(getOrClassifyAcquisitionSource()).toBe('unknown');
      expect(getStoredAcquisitionSource()).toBeNull();
      expect(b.log).not.toContain('location.read');
      expect(b.log).not.toContain('referrer.read');
      expect(b.log.filter((l) => l.includes(ACQUISITION_STORAGE_KEY))).toEqual([]);
    }
  });

  // These two use a fresh copy of lib/consent, because a failed write is remembered for the rest of the page load (module state).
  it('survives blocked storage: no consent is assumed, and the choice helpers never throw', async () => {
    vi.resetModules();
    const c = await import('@/lib/consent');
    makeBrowser();
    vi.stubGlobal('window', { get localStorage() { throw new Error('blocked'); }, dispatchEvent: () => true });
    expect(c.hasAdMeasurementConsent()).toBe(false);
    expect(c.hasSiteStatisticsConsent()).toBe(false);
    expect(() => c.getStoredConsentChoice()).not.toThrow();
    expect(() => c.storeConsentChoice('denied')).not.toThrow();
    expect(() => c.storeStatisticsChoice('denied')).not.toThrow();
  });

  it('a withdrawal that cannot be written to storage is still honoured for the rest of the page load', async () => {
    vi.resetModules();
    const c = await import('@/lib/consent');
    const b = makeBrowser({ local: { [CONSENT_STORAGE_KEY]: 'granted' } });
    expect(c.hasAdMeasurementConsent()).toBe(true);
    b.local.setItem = () => {
      throw new Error('quota');
    };
    c.storeConsentChoice('denied');
    expect(c.hasAdMeasurementConsent()).toBe(false);
    // The withdrawal is followed by a reload: a fresh copy of the module (the new page) must still see 'denied', not the old 'granted'.
    vi.resetModules();
    const afterReload = await import('@/lib/consent');
    expect(afterReload.hasAdMeasurementConsent()).toBe(false);
  });

  it('a grant that could not be written is not kept: nothing optional runs on a choice that was never persisted', async () => {
    vi.resetModules();
    const c = await import('@/lib/consent');
    const b = makeBrowser();
    b.local.setItem = () => {
      throw new Error('quota');
    };
    c.storeConsentChoice('granted');
    expect(c.hasAdMeasurementConsent()).toBe(false);
  });
});

describe('Site statistics is consent-first', () => {
  it.each([
    ['no decision', {}],
    ['Decline', { [STATS_CONSENT_STORAGE_KEY]: 'denied' }],
    ['a corrupted value', { [STATS_CONSENT_STORAGE_KEY]: 'yes' }],
    ['the old objection key (a different model)', { 'jetstash-stats-objection': 'objected' }],
  ])('%s: statistics are off', (_name, local) => {
    makeBrowser({ local });
    expect(hasSiteStatisticsConsent()).toBe(false);
  });

  it('only an explicit Accept turns statistics on, and it is stored on the device only', () => {
    const b = makeBrowser();
    storeStatisticsChoice('granted');
    expect(hasSiteStatisticsConsent()).toBe(true);
    expect(b.local.data[STATS_CONSENT_STORAGE_KEY]).toBe('granted');
    expect(b.events).toContain(STATS_PREFERENCE_CHANGED_EVENT);
  });

  it('declining or withdrawing turns statistics off and removes the script\'s own storage entry', () => {
    const b = makeBrowser({ local: { [STATS_CONSENT_STORAGE_KEY]: 'granted', [VERCEL_ANALYTICS_STORAGE_KEY]: '{"x":1}' } });
    expect(hasSiteStatisticsConsent()).toBe(true);
    storeStatisticsChoice('denied');
    expect(hasSiteStatisticsConsent()).toBe(false);
    expect(b.local.data[STATS_CONSENT_STORAGE_KEY]).toBe('denied');
    expect(b.local.data[VERCEL_ANALYTICS_STORAGE_KEY]).toBeUndefined();
    expect(b.events).toContain(STATS_PREFERENCE_CHANGED_EVENT);
  });

  it('is independent of advertising consent in both directions', () => {
    makeBrowser({ local: { [CONSENT_STORAGE_KEY]: 'granted' } });
    expect(hasAdMeasurementConsent()).toBe(true);
    expect(hasSiteStatisticsConsent()).toBe(false); // accepting measurement does not switch statistics on
    vi.unstubAllGlobals();
    makeBrowser({ local: { [STATS_CONSENT_STORAGE_KEY]: 'granted' } });
    expect(hasSiteStatisticsConsent()).toBe(true);
    expect(hasAdMeasurementConsent()).toBe(false); // accepting statistics does not switch measurement on
  });
});

describe('what Vercel may receive in a page URL', () => {
  const U = 'https://jetstash.co.uk/routes/manchester-lahore?gclid=G1&gbraid=B1&wbraid=W1&fbclid=F1&msclkid=M1&gad_source=1&gad_campaignid=99&dclid=D1&ttclid=T1&utm_source=google_ads&utm_medium=cpc&utm_campaign=c1&airport=MAN&destination=lahore';

  it('always removes advertising click identifiers, whatever the consent', () => {
    for (const keepCampaign of [true, false]) {
      const out = cleanUrlForStatistics(U, { keepCampaign });
      for (const p of ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'gad_source', 'gad_campaignid', 'dclid', 'ttclid']) expect(out).not.toContain(p + '=');
      expect(out).toContain('airport=MAN');
      expect(out).toContain('destination=lahore');
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
    const out = cleanUrlForStatistics('https://jetstash.co.uk/routes/a;gclid=SECRET/b?utm_source_platform=ads&utm_creative_format=banner&airport=MAN#gclid=SECRET', { keepCampaign: false });
    expect(out).not.toMatch(/utm_|gclid|SECRET|#/);
    expect(out).toContain('airport=MAN');
    expect(out).toContain('/routes/a/b');
  });

  it('removes percent-encoded path-parameter names as well, and campaign path parameters without consent', () => {
    const out = cleanUrlForStatistics('https://jetstash.co.uk/a;%67clid=SECRET;utm_source=ads;keep=1/b', { keepCampaign: false });
    expect(out).not.toMatch(/gclid|%67clid|SECRET|utm_/i);
    expect(out).toContain('keep=1');
  });

  it('drops an acquisition event inside the Vercel hook when consent is missing, so a queue that drains after a withdrawal sends nothing', () => {
    makeBrowser({ local: { [STATS_CONSENT_STORAGE_KEY]: 'granted' } });
    expect(sanitiseStatisticsEvent({ type: 'event', url: 'https://jetstash.co.uk/a', name: 'acquisition_landing' } as { url: string })).toBeNull();
    expect(sanitiseStatisticsEvent({ type: 'event', url: 'https://jetstash.co.uk/a', name: 'tripcom_click' } as { url: string })).not.toBeNull();
    vi.unstubAllGlobals();
    makeBrowser({ local: { [CONSENT_STORAGE_KEY]: 'granted', [STATS_CONSENT_STORAGE_KEY]: 'granted' } });
    expect(sanitiseStatisticsEvent({ type: 'event', url: 'https://jetstash.co.uk/a', name: 'acquisition_landing' } as { url: string })).not.toBeNull();
  });

  it('keeps only JetStash\'s own simple parameters: unknown parameters, tokens, e-mail addresses and complex values never reach Vercel', () => {
    const out = cleanUrlForStatistics('https://jetstash.co.uk/?email=alice%40example.com&token=secret&ref=abc&airport=MAN&destination=a%20b%40c.com&arrival=LHE', { keepCampaign: true });
    expect(out).toBe('https://jetstash.co.uk/?airport=MAN&arrival=LHE');
    const camp = cleanUrlForStatistics('https://jetstash.co.uk/?utm_source=google_ads&utm_term=alice%40example.com', { keepCampaign: true });
    expect(camp).toContain('utm_source=google_ads');
    expect(camp).not.toMatch(/alice|utm_term/);
  });

  it('drops the fragment even when consent has been given (never needed for statistics)', () => {
    expect(cleanUrlForStatistics('https://jetstash.co.uk/a#route-watch', { keepCampaign: true })).toBe('https://jetstash.co.uk/a');
  });

  it('is case-insensitive, leaves clean URLs untouched and never throws on a bad URL', () => {
    expect(cleanUrlForStatistics('https://jetstash.co.uk/a?GCLID=1&airport=MAN', { keepCampaign: false })).toBe('https://jetstash.co.uk/a?airport=MAN');
    expect(cleanUrlForStatistics('https://jetstash.co.uk/a?airport=MAN', { keepCampaign: false })).toBe('https://jetstash.co.uk/a?airport=MAN');
    expect(cleanUrlForStatistics('not a url', { keepCampaign: false })).toBe('not a url');
  });

  it('the beforeSend hook sends nothing at all unless the visitor has allowed site statistics', () => {
    for (const local of [{}, { [CONSENT_STORAGE_KEY]: 'granted' }, { [STATS_CONSENT_STORAGE_KEY]: 'denied', [CONSENT_STORAGE_KEY]: 'granted' }] as Record<string, string>[]) {
      vi.unstubAllGlobals();
      makeBrowser({ local });
      expect(sanitiseStatisticsEvent({ type: 'pageview', url: 'https://jetstash.co.uk/a' })).toBeNull();
    }
  });

  it('the beforeSend hook reads consent at send time: campaign tags pass only after Accept, and only with statistics allowed', () => {
    makeBrowser({ local: { [STATS_CONSENT_STORAGE_KEY]: 'granted' } });
    expect(sanitiseStatisticsEvent({ type: 'pageview', url: U })!.url).not.toMatch(/utm_|gclid/);
    vi.unstubAllGlobals();
    makeBrowser({ local: { [STATS_CONSENT_STORAGE_KEY]: 'granted', [CONSENT_STORAGE_KEY]: 'granted' } });
    const out = sanitiseStatisticsEvent({ type: 'pageview', url: U })!.url;
    expect(out).toContain('utm_source=google_ads');
    expect(out).not.toContain('gclid');
  });
});

describe('wiring', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

  it('the statistics scripts are mounted only after the preference has been read and allowed, never directly from the layout', () => {
    const src = read('components/analytics/site-statistics.tsx');
    expect(src).toContain('useState(false)'); // nothing mounted until the preference is known
    expect(src).toContain('if (!on) return null;');
    expect(src).toContain('setOn(allowed)');
    expect(src).toContain('hasSiteStatisticsConsent()');
    expect(read('app/layout.tsx')).not.toMatch(/@vercel\/(analytics|speed-insights)/);
  });

  it('the tracker needs BOTH permissions (it is advertising attribution sent through the statistics scripts), and purges otherwise', () => {
    const src = read('components/analytics/acquisition-landing-tracker.tsx');
    expect(src).toContain('!hasAdMeasurementConsent() || !hasSiteStatisticsConsent()');
    expect(src).toContain('purgeAcquisitionSource()');
    expect(src).toContain('CONSENT_GRANTED_EVENT');
  });

  it('other tabs: the tracker handles either permission changing in a storage event, and the statistics wrapper reloads on a withdrawal made elsewhere', () => {
    const tracker = read('components/analytics/acquisition-landing-tracker.tsx');
    expect(tracker).toContain("window.addEventListener('storage', onStorage)");
    expect(tracker).toContain('CONSENT_STORAGE_KEY');
    expect(tracker).toContain('STATS_CONSENT_STORAGE_KEY');
    expect(tracker).toContain('if (hasAdMeasurementConsent() && hasSiteStatisticsConsent()) track(');
    const stats = read('components/analytics/site-statistics.tsx');
    expect(stats).toContain('if (!hasSiteStatisticsConsent() && onRef.current) window.location.reload();');
    expect(stats).toContain('STATS_CONSENT_STORAGE_KEY');
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

  it('the individual settings have two separate groups, each with its own Decline and Accept, and nothing is preselected', () => {
    const src = read('components/ui/cookie-consent-banner.tsx');
    expect(src).toContain("handleStatsChoice('denied')");
    expect(src).toContain("handleStatsChoice('granted')");
    expect(src).toContain("handleChoice('denied')");
    expect(src).toContain("handleChoice('granted')");
    expect(src).not.toMatch(/defaultChecked|checked=\{true\}/);
    // Both permissions start undecided (null), so nothing is on until the visitor chooses.
    expect(src).toContain('useState<ConsentChoice | null>(null)');
    expect(src).toContain('(settingsMode || statsChoice === null) && (');
    expect(src).toContain('(settingsMode || choice === null) && (');
  });

  it('the first layer is a compact summary with equal Reject all and Accept all, and an individual-settings button that grants nothing', () => {
    const src = read('components/ui/cookie-consent-banner.tsx');
    expect(src).toContain('const summaryView = !settingsMode && !showDetails && choice === null && statsChoice === null;');
    expect(src).toContain("handleAll('denied')");
    expect(src).toContain("handleAll('granted')");
    expect(src).toContain('Choose individual settings');
    expect(src).toContain('href="/privacy-policy"');
    // Reject all and Accept all share one style (equal prominence).
    const rejectIdx = src.indexOf("handleAll('denied')");
    const acceptIdx = src.indexOf("handleAll('granted')");
    const cls = (i: number) => src.slice(i, i + 120).match(/className=\{([A-Z_]+)\}/)?.[1];
    expect(cls(rejectIdx)).toBe('CHOICE_BUTTON');
    expect(cls(acceptIdx)).toBe('CHOICE_BUTTON');
    // Opening the individual settings only changes the view: it never stores a choice or loads anything.
    const open = src.slice(src.indexOf('function openDetails'), src.indexOf('function closeDetails'));
    expect(open).not.toMatch(/store(Consent|Statistics)Choice|setLoadTag|CONSENT_GRANTED_EVENT/);
    // Accept all / Reject all set the two stored permissions separately.
    const all = src.slice(src.indexOf('function handleAll'), src.indexOf('function openDetails'));
    expect(all).toContain('storeConsentChoice(next)');
    expect(all).toContain('storeStatisticsChoice(next)');
    expect(all).toContain('if (adsWasOn || statsWasOn) window.location.reload();');
  });

  it('withdrawing site statistics removes the attribution classification and reloads, because the running scripts cannot be unloaded', () => {
    const src = read('components/ui/cookie-consent-banner.tsx');
    const start = src.indexOf('function handleStatsChoice');
    const body = src.slice(start, src.indexOf('function settleAfterChoice'));
    expect(body).toContain("storeStatisticsChoice(next)");
    expect(body).toContain('purgeAcquisitionSource()');
    expect(body).toContain('if (statsWasGranted) window.location.reload();');
  });

  beforeEach(() => undefined);
});
