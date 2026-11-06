import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The shared first-visit consent choice stays in normal page flow and never covers page controls. */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const banner = read('components/ui/cookie-consent-banner.tsx');
const css = read('app/globals.css');
const layout = read('app/layout.tsx');

describe('consent panel clearance', () => {
  it('renders after the shared header and before page content, in normal document flow', () => {
    expect(layout.indexOf('<Header />')).toBeGreaterThan(-1);
    expect(layout.indexOf('<CookieConsentBanner />')).toBeGreaterThan(layout.indexOf('<Header />'));
    expect(layout.indexOf('<CookieConsentBanner />')).toBeLessThan(layout.indexOf('<main id="main-content">'));
    expect(banner).toContain('className="relative w-full');
    expect(banner).not.toMatch(/className="[^\"]*(?:fixed|absolute)\b/);
    expect(banner).not.toContain('--consent-banner-h');
  });

  it('does not reserve artificial viewport space for a fixed panel', () => {
    expect(css).not.toContain('--consent-banner-h');
    expect(css).not.toContain('scroll-padding-bottom');
  });

  it('keeps consent optional, separate and accessible with visible decision controls', () => {
    expect(banner).toContain('aria-label="Cookie consent"');
    expect(banner).toContain('Reject all');
    expect(banner).toContain('Accept all');
    expect(banner).toContain('Choose individual settings');
    expect(banner).toContain('CONSENT_STORAGE_KEY');
    expect(banner).toContain('STATS_CONSENT_STORAGE_KEY');
    expect(banner).toContain('h-11');
    expect(banner).toContain('min-h-11');
  });
});
