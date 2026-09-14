import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyAcquisitionSource } from '@/lib/acquisition';

/**
 * Acquisition attribution (14 Sept 2026, Astra #19 small closure set,
 * founder-approved). See lib/acquisition.ts's own doc comment for the full
 * privacy design. This file proves:
 *   1. classifyAcquisitionSource() itself — a pure function, testable
 *      directly without a browser environment.
 *   2. The privacy constraints structurally, the same pattern this
 *      codebase already uses for browser-only behaviour it cannot exercise
 *      in this repo's plain-Node Vitest environment (no jsdom) — see
 *      tests/journey-choice-measurement.test.ts's own doc comment for the
 *      precedent this follows.
 *   3. That existing tripcom_click/tripcom_hotel_click payloads and the
 *      consent/Google Ads gating are genuinely untouched.
 */

const acquisitionSrc = readFileSync(join(process.cwd(), 'lib/acquisition.ts'), 'utf8');
const analyticsSrc = readFileSync(join(process.cwd(), 'lib/analytics.ts'), 'utf8');
const trackerSrc = readFileSync(join(process.cwd(), 'components/analytics/acquisition-landing-tracker.tsx'), 'utf8');
const consentSrc = readFileSync(join(process.cwd(), 'lib/consent.ts'), 'utf8');
const googleAdsSrc = readFileSync(join(process.cwd(), 'lib/google-ads-conversions.ts'), 'utf8');
const bannerSrc = readFileSync(join(process.cwd(), 'components/ui/cookie-consent-banner.tsx'), 'utf8');
const fareSignalSrc = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');
const dealCardSrc = readFileSync(join(process.cwd(), 'components/ui/deal-card.tsx'), 'utf8');

describe('classifyAcquisitionSource() — referrer/UTM classification', () => {
  it('a Google referrer classifies as organic_search', () => {
    expect(classifyAcquisitionSource(new URL('https://jetstash.co.uk/routes/manchester-islamabad'), 'https://www.google.com/search?q=manchester+islamabad')).toBe('organic_search');
  });

  it('a Facebook referrer classifies as facebook', () => {
    expect(classifyAcquisitionSource(new URL('https://jetstash.co.uk/routes/manchester-islamabad'), 'https://www.facebook.com/')).toBe('facebook');
  });

  it('a Reddit referrer classifies as reddit', () => {
    expect(classifyAcquisitionSource(new URL('https://jetstash.co.uk/routes/manchester-islamabad'), 'https://www.reddit.com/r/pakistan/')).toBe('reddit');
  });

  it('no referrer classifies as direct', () => {
    expect(classifyAcquisitionSource(new URL('https://jetstash.co.uk/routes/manchester-islamabad'), '')).toBe('direct');
  });

  it('a gclid query parameter classifies as google_ads regardless of referrer', () => {
    expect(classifyAcquisitionSource(new URL('https://jetstash.co.uk/routes/manchester-islamabad?gclid=abc123'), 'https://www.google.com/')).toBe('google_ads');
  });

  it('a recognised utm_source=facebook classifies as facebook even with no referrer', () => {
    expect(classifyAcquisitionSource(new URL('https://jetstash.co.uk/routes/manchester-islamabad?utm_source=facebook'), '')).toBe('facebook');
  });

  it('a recognised utm_source=reddit classifies as reddit', () => {
    expect(classifyAcquisitionSource(new URL('https://jetstash.co.uk/routes/manchester-islamabad?utm_source=reddit'), '')).toBe('reddit');
  });

  it('an unrecognised utm_source collapses to other_referral, never leaking the raw value', () => {
    const result = classifyAcquisitionSource(new URL('https://jetstash.co.uk/routes/manchester-islamabad?utm_source=some-random-newsletter-value'), '');
    expect(result).toBe('other_referral');
    expect(result).not.toContain('newsletter');
  });

  it('an unrelated external referrer classifies as other_referral', () => {
    expect(classifyAcquisitionSource(new URL('https://jetstash.co.uk/routes/manchester-islamabad'), 'https://www.bing.com/search?q=manchester+islamabad')).toBe('other_referral');
  });

  it('a malformed referrer never throws and classifies as unknown', () => {
    expect(classifyAcquisitionSource(new URL('https://jetstash.co.uk/'), 'not a valid url')).toBe('unknown');
  });

  it('the return value is always one of the fixed seven enum members, never arbitrary text', () => {
    const valid = ['organic_search', 'google_ads', 'facebook', 'reddit', 'other_referral', 'direct', 'unknown'];
    const cases: [string, string][] = [
      ['https://jetstash.co.uk/?utm_source=weird', ''],
      ['https://jetstash.co.uk/', 'https://news.ycombinator.com/'],
      ['https://jetstash.co.uk/?gclid=x', ''],
    ];
    for (const [url, referrer] of cases) {
      expect(valid).toContain(classifyAcquisitionSource(new URL(url), referrer));
    }
  });
});

describe('privacy design — structural guarantees (no browser environment available; see file doc comment for why this pattern is used)', () => {
  it('lib/acquisition.ts never writes a cookie', () => {
    expect(acquisitionSrc).not.toMatch(/document\.cookie\s*=/);
  });

  it('lib/acquisition.ts only ever uses sessionStorage, never localStorage, for this classification', () => {
    expect(acquisitionSrc).toContain('window.sessionStorage');
    expect(acquisitionSrc).not.toContain('window.localStorage');
  });

  it('never stores or forwards the raw referrer URL, gclid value, or raw utm_source string — only the classified enum member', () => {
    // The classifier reads these inputs but the only thing ever written to
    // sessionStorage or returned is `classified` (the enum), never `referrer`,
    // `gclid`, or `utmSourceRaw`/`utmSource` themselves.
    expect(acquisitionSrc).toMatch(/sessionStorage\.setItem\(STORAGE_KEY, classified\)/);
    expect(acquisitionSrc).not.toMatch(/sessionStorage\.setItem\(STORAGE_KEY, (referrer|gclid|utmSource)/);
  });

  it('no persistent visitor ID is generated anywhere in the acquisition module', () => {
    expect(acquisitionSrc).not.toMatch(/uuid|crypto\.randomUUID|visitorId|clientId/i);
  });

  it('the landing tracker fires at most once per session (empty effect dependency array, guarded by prior-classification check)', () => {
    expect(trackerSrc).toMatch(/\},\s*\[\]\s*\);/);
    expect(trackerSrc).toContain('alreadyClassifiedThisSession');
  });

  it('the landing tracker renders nothing (no visible UI, no layout impact)', () => {
    expect(trackerSrc).toMatch(/return null;/);
  });
});

describe('existing events are genuinely untouched', () => {
  it('fare-signal.tsx\'s tripcom_click still sends exactly route + source', () => {
    const match = fareSignalSrc.match(/event="tripcom_click"[\s\S]{0,200}?properties=\{\{[\s\S]*?\}\}/);
    expect(match).toBeTruthy();
    expect(match![0]).toMatch(/route:/);
    expect(match![0]).toMatch(/source:/);
    expect(match![0]).not.toMatch(/channel:/);
  });

  it('deal-card.tsx\'s tripcom_click still sends exactly route + source', () => {
    const match = dealCardSrc.match(/event="tripcom_click"[\s\S]{0,200}?properties=\{\{[\s\S]*?\}\}/);
    expect(match).toBeTruthy();
    expect(match![0]).toMatch(/route:/);
    expect(match![0]).toMatch(/source:/);
    expect(match![0]).not.toMatch(/channel:/);
  });

  it('acquisition_landing and acquisition_handoff are not mapped to any Google Ads conversion', () => {
    expect(googleAdsSrc).not.toMatch(/acquisition_landing/);
    expect(googleAdsSrc).not.toMatch(/acquisition_handoff/);
  });

  it('consent.ts and cookie-consent-banner.tsx are untouched by this change (no acquisition reference)', () => {
    expect(consentSrc).not.toMatch(/acquisition/i);
    expect(bannerSrc).not.toMatch(/acquisition/i);
  });

  it('Google Ads conversion firing remains gated on window.gtag existing, unaffected by this change', () => {
    expect(googleAdsSrc).toContain("typeof window.gtag !== 'function'");
  });
});

describe('acquisition_handoff pairing — structural proof', () => {
  it('only tripcom_click and tripcom_hotel_click trigger the paired acquisition_handoff event', () => {
    const match = analyticsSrc.match(/ACQUISITION_HANDOFF_EVENTS[^=]*=\s*new Set\(\[([^\]]*)\]\)/);
    expect(match).toBeTruthy();
    const members = match![1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
    expect(members.sort()).toEqual(['tripcom_click', 'tripcom_hotel_click']);
  });

  it('acquisition_handoff is fired exactly once per matching event (single recursive track() call, not a loop)', () => {
    const occurrences = (analyticsSrc.match(/track\('acquisition_handoff'/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it('acquisition_handoff carries only route + channel, never the original event name or any extra field', () => {
    const match = analyticsSrc.match(/track\('acquisition_handoff',\s*\{([^}]*)\}\)/);
    expect(match).toBeTruthy();
    const props = match![1].split(',').map((s) => s.trim().split(':')[0].trim()).filter(Boolean);
    expect(props.sort()).toEqual(['channel', 'route']);
  });
});
