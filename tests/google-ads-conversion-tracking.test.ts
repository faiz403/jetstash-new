import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Google Ads conversion tracking (August 2026) — installed ahead of Pilot #2,
 * revised to Basic Consent Mode after founder review flagged the first draft
 * as Advanced Consent Mode (the Google tag loaded unconditionally from
 * app/layout.tsx, gated only by a consent-state signal Google could in
 * principle act on regardless). This file now covers: the central Google
 * Ads dispatch (lib/google-ads-conversions.ts), the consent-storage/
 * cross-tree-signalling module (lib/consent.ts, which no longer talks to
 * Google at all), lib/analytics.ts's track() calling the dispatch without
 * ever letting a Google failure affect Vercel Analytics or the page, and —
 * asserted at the source level, matching this repo's existing convention for
 * 'use client' components with no DOM rendering harness (tests run under
 * Vitest's `node` environment — see vitest.config.ts) — that the Google tag
 * is only ever requested from inside CookieConsentBanner, only after
 * acceptance, and that app/layout.tsx no longer references it at all.
 */

const read = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

const trackMocks = vi.hoisted(() => ({ vercelTrack: vi.fn(), fireGoogleAdsConversion: vi.fn() }));

describe('lib/google-ads-conversions.ts — fireGoogleAdsConversion()', () => {
  let gtagMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtagMock = vi.fn();
    vi.stubGlobal('window', { gtag: gtagMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('maps exactly the three approved events to their real Google Ads conversion labels', async () => {
    const { fireGoogleAdsConversion, GOOGLE_ADS_TAG_ID } = await import('@/lib/google-ads-conversions');
    expect(GOOGLE_ADS_TAG_ID).toBe('AW-18378433991');

    fireGoogleAdsConversion('tripcom_click');
    expect(gtagMock).toHaveBeenLastCalledWith('event', 'conversion', { send_to: 'AW-18378433991/P1GBCNPM_-EcEMfLwrtE' });

    fireGoogleAdsConversion('tripcom_hotel_click');
    expect(gtagMock).toHaveBeenLastCalledWith('event', 'conversion', { send_to: 'AW-18378433991/9ja5CNbM_-EcEMfLwrtE' });

    fireGoogleAdsConversion('ready_check_baggage_cta_click');
    expect(gtagMock).toHaveBeenLastCalledWith('event', 'conversion', { send_to: 'AW-18378433991/J9oQCNnM_-EcEMfLwrtE' });

    expect(gtagMock).toHaveBeenCalledTimes(3);
  });

  it('is a no-op for every event outside the approved three', async () => {
    const { fireGoogleAdsConversion } = await import('@/lib/google-ads-conversions');
    for (const event of ['contact_submit_success', 'bookby_cta_click', 'route_watch_signup'] as const) {
      fireGoogleAdsConversion(event);
    }
    expect(gtagMock).not.toHaveBeenCalled();
  });

  it('never throws when window.gtag is not a function', async () => {
    vi.stubGlobal('window', {});
    const { fireGoogleAdsConversion } = await import('@/lib/google-ads-conversions');
    expect(() => fireGoogleAdsConversion('tripcom_click')).not.toThrow();
  });

  it('never throws when window is undefined (server-side call)', async () => {
    vi.unstubAllGlobals();
    const { fireGoogleAdsConversion } = await import('@/lib/google-ads-conversions');
    expect(() => fireGoogleAdsConversion('tripcom_click')).not.toThrow();
  });
});

describe('lib/consent.ts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('CONSENT_STORAGE_KEY is a stable, JetStash-specific key', async () => {
    const { CONSENT_STORAGE_KEY } = await import('@/lib/consent');
    expect(CONSENT_STORAGE_KEY).toBe('jetstash-ad-consent');
  });

  it('getStoredConsentChoice returns null with no window (server-side)', async () => {
    const { getStoredConsentChoice } = await import('@/lib/consent');
    expect(getStoredConsentChoice()).toBeNull();
  });

  it('getStoredConsentChoice reads a valid stored value, and rejects anything else', async () => {
    const store = new Map<string, string>();
    store.set('jetstash-ad-consent', 'granted');
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => store.get(k) ?? null } });
    const { getStoredConsentChoice } = await import('@/lib/consent');
    expect(getStoredConsentChoice()).toBe('granted');

    store.set('jetstash-ad-consent', 'not-a-real-choice');
    expect(getStoredConsentChoice()).toBeNull();
  });

  it('storeConsentChoice writes to localStorage under the stable key', async () => {
    const setItem = vi.fn();
    vi.stubGlobal('window', { localStorage: { setItem } });
    const { storeConsentChoice, CONSENT_STORAGE_KEY } = await import('@/lib/consent');
    storeConsentChoice('granted');
    expect(setItem).toHaveBeenCalledWith(CONSENT_STORAGE_KEY, 'granted');
  });

  it('does not talk to Google at all — no gtag call anywhere in this module (Basic Consent Mode owns that in the banner component, not here)', async () => {
    const consentSrc = read('lib/consent.ts');
    expect(consentSrc).not.toMatch(/window\.gtag/);
    expect(consentSrc).not.toContain('applyConsentToGoogle');
  });

  it('CONSENT_SETTINGS_OPEN_EVENT dispatches a plain DOM event for the withdrawal control to listen for', async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    const { requestCookieSettingsOpen, CONSENT_SETTINGS_OPEN_EVENT } = await import('@/lib/consent');
    requestCookieSettingsOpen();
    expect(dispatchEvent).toHaveBeenCalledOnce();
    const dispatched = dispatchEvent.mock.calls[0][0] as Event;
    expect(dispatched.type).toBe(CONSENT_SETTINGS_OPEN_EVENT);
  });

  it('requestCookieSettingsOpen never throws with no window (server-side)', async () => {
    const { requestCookieSettingsOpen } = await import('@/lib/consent');
    expect(() => requestCookieSettingsOpen()).not.toThrow();
  });
});

describe('lib/analytics.ts track() — Google Ads dispatch is additive, isolated and non-blocking', () => {
  const mocks = trackMocks;

  beforeEach(() => {
    mocks.vercelTrack.mockReset();
    mocks.fireGoogleAdsConversion.mockReset();
  });

  it('calls both Vercel Analytics and the Google Ads dispatch exactly once for the same event', async () => {
    vi.resetModules();
    vi.doMock('@vercel/analytics', () => ({ track: mocks.vercelTrack }));
    vi.doMock('@/lib/google-ads-conversions', () => ({ fireGoogleAdsConversion: mocks.fireGoogleAdsConversion }));
    const { track } = await import('@/lib/analytics');
    track('tripcom_click', { route: 'manchester-lahore', source: 'route-hero' });
    expect(mocks.vercelTrack).toHaveBeenCalledOnce();
    expect(mocks.fireGoogleAdsConversion).toHaveBeenCalledOnce();
    expect(mocks.fireGoogleAdsConversion).toHaveBeenCalledWith('tripcom_click');
    vi.doUnmock('@vercel/analytics');
    vi.doUnmock('@/lib/google-ads-conversions');
  });

  it('a Google Ads dispatch failure never prevents the Vercel Analytics call, and never throws', async () => {
    vi.resetModules();
    vi.doMock('@vercel/analytics', () => ({ track: mocks.vercelTrack }));
    vi.doMock('@/lib/google-ads-conversions', () => ({
      fireGoogleAdsConversion: () => {
        throw new Error('Google Ads blew up');
      },
    }));
    const { track } = await import('@/lib/analytics');
    expect(() => track('tripcom_click')).not.toThrow();
    expect(mocks.vercelTrack).toHaveBeenCalledOnce();
    vi.doUnmock('@vercel/analytics');
    vi.doUnmock('@/lib/google-ads-conversions');
  });

  it('a Vercel Analytics failure never prevents the Google Ads dispatch from being attempted', async () => {
    vi.resetModules();
    vi.doMock('@vercel/analytics', () => ({
      track: () => {
        throw new Error('Vercel blew up');
      },
    }));
    vi.doMock('@/lib/google-ads-conversions', () => ({ fireGoogleAdsConversion: mocks.fireGoogleAdsConversion }));
    const { track } = await import('@/lib/analytics');
    expect(() => track('tripcom_click')).not.toThrow();
    expect(mocks.fireGoogleAdsConversion).toHaveBeenCalledOnce();
    vi.doUnmock('@vercel/analytics');
    vi.doUnmock('@/lib/google-ads-conversions');
  });
});

describe('app/layout.tsx — no Google tag install here under Basic Consent Mode', () => {
  const layoutSrc = read('app/layout.tsx');

  it('never references next/script, the Google Ads tag ID, or gtag.js — the tag is only ever requested from the banner component', () => {
    expect(layoutSrc).not.toContain("from 'next/script'");
    expect(layoutSrc).not.toMatch(/<Script\b/);
    expect(layoutSrc).not.toContain('googletagmanager.com');
    expect(layoutSrc).not.toContain('GOOGLE_ADS_TAG_ID');
    expect(layoutSrc).not.toMatch(/gtag\(/);
  });

  it('mounts the consent banner exactly once', () => {
    expect(layoutSrc).toContain("import { CookieConsentBanner } from '@/components/ui/cookie-consent-banner';");
    const matches = layoutSrc.match(/<CookieConsentBanner \/>/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('existing Vercel Analytics and Speed Insights are untouched', () => {
    expect(layoutSrc).toContain('<Analytics />');
    expect(layoutSrc).toContain('<SpeedInsights />');
  });
});

describe('components/ui/cookie-consent-banner.tsx — Basic Consent Mode: the tag only loads after acceptance', () => {
  const bannerSrc = read('components/ui/cookie-consent-banner.tsx');

  it('is a client component, and the only place in the app that imports next/script for the Google tag', () => {
    expect(bannerSrc).toContain("'use client';");
    expect(bannerSrc).toContain("import Script from 'next/script';");
    const scriptImportCount = (readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8').match(/next\/script/g) ?? []).length;
    expect(scriptImportCount).toBe(0);
  });

  it('both Script tags render only inside the `loadTag &&` guard — never unconditionally at the top level', () => {
    // Scoped to the function body, not the whole file — the doc comment
    // above it mentions "<Script>" in prose to explain the design, which
    // would otherwise be a false match for the same pattern this test looks
    // for in actual JSX.
    const functionStart = bannerSrc.indexOf('export function CookieConsentBanner()');
    const body = bannerSrc.slice(functionStart);
    const guardStart = body.indexOf('{loadTag && (');
    expect(guardStart).toBeGreaterThan(-1);
    const visibleBlockStart = body.indexOf('{visible && (');
    expect(visibleBlockStart).toBeGreaterThan(guardStart);

    // Everything before the guard, and everything from the visible-banner
    // block onward, must be Script-free — the two tags only exist in the
    // gap between the two guards.
    const before = body.slice(0, guardStart);
    const between = body.slice(guardStart, visibleBlockStart);
    const after = body.slice(visibleBlockStart);
    expect(before).not.toMatch(/<Script\b/);
    expect(after).not.toMatch(/<Script\b/);
    expect(between).toContain('<Script id="google-ads-tag-init"');
    expect(between).toContain('googletagmanager.com/gtag/js?id=');
    expect((between.match(/<Script\b/g) ?? []).length).toBe(2);
  });

  it('uses afterInteractive, never beforeInteractive — nothing about the tag runs ahead of the visitor\'s choice', () => {
    expect(bannerSrc).not.toContain('beforeInteractive');
    const strategyMatches = bannerSrc.match(/strategy="afterInteractive"/g) ?? [];
    expect(strategyMatches).toHaveLength(2);
  });

  it('loadTag starts false and is only ever set true by acceptance (this load or a previous one), never by mere presence of the banner', () => {
    expect(bannerSrc).toContain('useState(false)');
    expect(bannerSrc).toMatch(/setLoadTag\(true\)/);
    expect(bannerSrc).not.toMatch(/useState\(true\).*loadTag/);
  });

  it('the tag-init script still keeps ad_personalization and analytics_storage denied even once measurement is accepted — no remarketing, no Google Analytics', () => {
    expect(bannerSrc).toContain("ad_personalization: 'denied'");
    expect(bannerSrc).toContain("analytics_storage: 'denied'");
    expect(bannerSrc).toContain("ad_storage: 'granted'");
    expect(bannerSrc).toContain("ad_user_data: 'granted'");
  });

  it('offers both Decline and "Accept measurement" with the exact required wording', () => {
    expect(bannerSrc).toContain('Decline');
    expect(bannerSrc).toContain('Accept measurement');
    expect(bannerSrc).toContain("handleChoice('denied')");
    expect(bannerSrc).toContain("handleChoice('granted')");
  });

  it('carries the required banner copy verbatim', () => {
    expect(bannerSrc).toContain(
      'JetStash uses optional Google Ads measurement to understand whether advertising leads to partner-link'
    );
    expect(bannerSrc).toContain('The current JetStash implementation does not configure');
    expect(bannerSrc).toContain('personalised advertising.');
  });

  it('links to the Privacy Policy and mentions the footer Cookie settings control', () => {
    expect(bannerSrc).toContain('href="/privacy-policy"');
    expect(bannerSrc).toContain('Cookie settings');
  });

  it('listens for the permanent settings-reopen event so withdrawal is reachable after the first visit', () => {
    expect(bannerSrc).toContain('CONSENT_SETTINGS_OPEN_EVENT');
    expect(bannerSrc).toContain('addEventListener(CONSENT_SETTINGS_OPEN_EVENT');
    expect(bannerSrc).toContain('removeEventListener(CONSENT_SETTINGS_OPEN_EVENT');
  });

  it('withdrawal (declining after a previous acceptance) reloads the page — the only reliable way to fully unload an already-running Google script — but a first-time decline does not need to', () => {
    expect(bannerSrc).toContain('window.location.reload()');
    // Scoped to the reload branch: only reachable when the previous choice
    // was 'granted', never unconditionally on every decline.
    const reloadIdx = bannerSrc.indexOf('window.location.reload()');
    const precedingBlock = bannerSrc.slice(bannerSrc.lastIndexOf('if (wasGranted)', reloadIdx), reloadIdx);
    expect(precedingBlock).toContain('if (wasGranted)');
  });

  it('a returning visitor with a stored "granted" choice re-loads the tag on this fresh page load without being shown the banner again', () => {
    const grantedBranchStart = bannerSrc.indexOf("if (stored === 'granted') {");
    const grantedBranchEnd = bannerSrc.indexOf('} else if', grantedBranchStart);
    expect(grantedBranchStart).toBeGreaterThan(-1);
    expect(grantedBranchEnd).toBeGreaterThan(grantedBranchStart);
    const grantedBranch = bannerSrc.slice(grantedBranchStart, grantedBranchEnd);
    expect(grantedBranch).toContain('setLoadTag(true)');
    expect(grantedBranch).not.toContain('setVisible(true)');
  });
});

describe('components/ui/cookie-settings-button.tsx — the permanent withdrawal control', () => {
  const settingsButtonSrc = read('components/ui/cookie-settings-button.tsx');

  it('is a client component that calls requestCookieSettingsOpen on click, nothing more', () => {
    expect(settingsButtonSrc).toContain("'use client';");
    expect(settingsButtonSrc).toContain("import { requestCookieSettingsOpen } from '@/lib/consent';");
    expect(settingsButtonSrc).toContain('onClick={requestCookieSettingsOpen}');
  });

  it('is labelled "Cookie settings"', () => {
    expect(settingsButtonSrc).toContain('Cookie settings');
  });
});

describe('components/layout/footer.tsx — Cookie settings is present on every page, not buried', () => {
  const footerSrc = read('components/layout/footer.tsx');

  it('imports and renders CookieSettingsButton exactly once', () => {
    expect(footerSrc).toContain("import { CookieSettingsButton } from '../ui/cookie-settings-button';");
    const matches = footerSrc.match(/<CookieSettingsButton \/>/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});

describe('components/destination/holiday-intelligence.tsx — flight vs hotel event separation (shared component, serves Antalya + the Hotel Intelligence expansion pilot since the August 2026 architecture consolidation)', () => {
  const componentSrc = read('components/destination/holiday-intelligence.tsx');

  it('imports TrackedOutboundLink and no longer uses a bare <a> for either CTA', () => {
    expect(componentSrc).toContain("import { TrackedOutboundLink } from '@/components/ui/tracked-outbound-link';");
  });

  it('the flight handoff fires tripcom_click with a composite route slug, never misclassified as a hotel event', () => {
    expect(componentSrc).toContain('event="tripcom_click"');
    expect(componentSrc).toContain('route: `${handoff.airportSlug}-${destination.slug}`');
    expect(componentSrc).not.toMatch(/href=\{handoff\.href\}[\s\S]{0,80}tripcom_hotel_click/);
  });

  it('the hotel CTA fires tripcom_hotel_click, distinct from the flight event', () => {
    expect(componentSrc).toContain('event="tripcom_hotel_click"');
    expect(componentSrc).toContain('route: destination.slug');
  });

  it('both tracked call sites stay within the two-property ceiling and carry only route+source', () => {
    // Not a plain balanced-brace regex: the flight call site's route value is
    // a template literal (`${handoff.airportSlug}-${destination.slug}`),
    // whose own `${` closes a brace before the properties block's real end —
    // matched here by tests/analytics-property-limit.test.ts's depth-aware
    // scanner instead, this check just confirms both call sites exist and
    // are shaped as expected.
    const occurrences = (componentSrc.match(/properties=\{\{/g) ?? []).length;
    expect(occurrences).toBe(2);
    expect(componentSrc).toContain("properties={{ route: `${handoff.airportSlug}-${destination.slug}`, source: analyticsSource }}");
    expect(componentSrc).toContain("properties={{ route: destination.slug, source: analyticsSource }}");
  });

  it('analyticsSource resolves to the exact, unchanged Antalya value for Antalya specifically, keeping its existing analytics history continuous', () => {
    expect(componentSrc).toContain("const analyticsSource = destination.slug === 'antalya' ? 'antalya-holiday-intelligence' : 'holiday-intelligence';");
  });
});
