import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

const privacyPage = read('app/privacy-policy/page.tsx');
const privacyProse = privacyPage
  .replace(/&apos;/g, "'")
  .replace(/&rsquo;/g, "'")
  .replace(/&lsquo;/g, "'")
  .replace(/\s+/g, ' ');
const banner = read('components/ui/cookie-consent-banner.tsx').replace(/\s+/g, ' ');
const googleAds = read('lib/google-ads-conversions.ts');
const layout = read('app/layout.tsx');

describe('privacy notice: Google/Vercel fact alignment', () => {
  it('describes contextual Vercel data without narrowing it to route/destination only', () => {
    expect(privacyProse).toContain('Vercel Web Analytics and Vercel Speed Insights');
    expect(privacyProse).toContain('limited contextual fields such as route, destination');
    expect(privacyProse).toContain('state, source, trip type, region, intent, verdict or interest');
    expect(privacyProse).not.toContain('only ever receives page-view and named-event data with route or destination context');
  });

  it('does not promise one cookie or deny every advertising/tracking technology', () => {
    expect(privacyProse).toContain('offers optional Google Ads measurement');
    expect(privacyProse).not.toMatch(/one optional[^.]*measurement cookie/i);
    expect(privacyProse).not.toMatch(/we do not use Google Analytics, advertising pixels, or any other tracking/i);
    expect(privacyProse).toContain('Google\'s tag may also process ordinary browser, page, device or referrer information');
  });

  it('separates JetStash payload facts from vendor-side processing', () => {
    expect(privacyProse).toContain("JetStash's current code does not put your name, email address, phone number");
    expect(privacyProse).toContain('form contents or the partner URL into those conversion-event payloads');
    expect(privacyProse).toContain('according to Google\'s own service behaviour and policies');
    expect(privacyProse).toContain("The current JetStash implementation does not configure remarketing or personalised advertising");
    expect(privacyProse).not.toContain('never your name, email address, or the partner link itself');
  });
});

describe('consent banner: Google Ads remains separate from always-on Vercel telemetry', () => {
  it('explains the accept/decline effect and independent Vercel services', () => {
    expect(banner).toContain('Accepting loads that Google tag; declining keeps it from loading.');
    expect(banner).toContain('Vercel Analytics and Speed Insights run separately either way.');
    expect(banner).toContain('The current JetStash implementation does not configure');
  });

  it('keeps the existing consent implementation and Google payload unchanged', () => {
    expect(banner).toContain("useState(false)");
    expect(banner).toContain("{loadTag && (");
    expect(banner).not.toContain("gtag('consent', 'update'");
    expect(banner).toContain("ad_storage: 'granted'");
    expect(banner).toContain("ad_user_data: 'granted'");
    expect(banner).toContain("ad_personalization: 'denied'");
    expect(banner).toContain("analytics_storage: 'denied'");
    expect(googleAds).toContain("window.gtag('event', 'conversion', { send_to:");
    expect(googleAds).not.toMatch(/send_to:[\s\S]{0,200}(email|phone|name|address|route|region)/i);
    expect(layout).toContain('<Analytics />');
    expect(layout).toContain('<SpeedInsights />');
  });
});
