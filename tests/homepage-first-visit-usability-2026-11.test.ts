import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Homepage first-visit usability (PR #353, November 2026). Measured at 320x720, 375x667 and 390x844 on the branch before this
 * change, the first-visit consent panel covered the homepage submit button. The fixes are layout only: a shorter phone panel,
 * and the console ahead of the description on a phone. No consent behaviour, no data and no copy that other tests pin changed.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const hero = read('components/homepage-v2/homepage-opening-hero.tsx');
const banner = read('components/ui/cookie-consent-banner.tsx');
const backdrop = read('components/ui/hero-backdrop.tsx');
const pageHero = read('components/sections/page-hero.tsx');
const form = read('components/homepage-v2/journey-check-form.tsx');
const sections = read('components/homepage-v2/homepage-sections.tsx');

describe('console before description on a phone', () => {
  it('keeps the description in the document before the console but shows it after on a phone only', () => {
    const description = hero.indexOf('{HERO_DESCRIPTION}');
    const console_ = hero.indexOf('<div id="your-journey"');
    expect(description).toBeGreaterThan(-1);
    expect(console_).toBeGreaterThan(description);
    expect(hero).toMatch(/order-2 mt-6 max-w-xl[^"]*sm:order-1 sm:-mt-3 sm:mb-7/);
    expect(hero).toMatch(/id="your-journey" className="order-1 [^"]*sm:order-2/);
    expect(hero).toMatch(/<div className="order-3">\s*<HomepageEvidenceExpiryGuard/);
  });

  it('still says the approved description verbatim and no longer passes it through PageHero', () => {
    expect(hero).toContain(
      "Direct or with stops? What fare did we last see? Has the service changed? Pick your airport and destination to find out, then check today's price with a booking provider."
    );
    expect(hero).not.toMatch(/<PageHero[^>]*description=/);
  });

  it('names who it is for: in the eyebrow from sm up, in its own line on a phone, with the approved eyebrow text intact', () => {
    expect(hero).toContain('Before you book a flight');
    expect(hero).toContain('hidden sm:inline');
    expect(hero).toContain("const AUDIENCE_LINE = 'For UK travellers flying to Pakistan, India and the Gulf.';");
    expect(hero).toMatch(/text-base font-semibold text-sand-100 sm:hidden">\{AUDIENCE_LINE\}/);
  });
});

describe('hero photograph', () => {
  it('lets the photo through on the far side from lg up only on the homepage, and leaves every other hero uniform', () => {
    expect(hero).toContain('heroOverlay="directional"');
    expect(pageHero).toContain('overlay={heroOverlay}');
    expect(backdrop).toContain("overlay = 'uniform'");
    expect(backdrop).toContain("'absolute inset-0 bg-ink-950/75'");
    expect(backdrop).toMatch(/overlay === 'directional' && 'lg:bg-transparent lg:bg-gradient-to-r/);
    const others = ['app/routes/page.tsx', 'app/pakistan/page.tsx', 'app/india/page.tsx'];
    for (const file of others) expect(read(file)).not.toContain('heroOverlay');
  });
});

describe('first-visit consent panel on a phone', () => {
  it('is shorter on a phone but keeps the same two optional permissions, equal Reject all / Accept all and the Privacy Policy link', () => {
    expect(banner).toMatch(/<p className="sm:hidden">[\s\S]*Your privacy choices\.[\s\S]*off until you choose\.[\s\S]*href="\/privacy-policy"/);
    // The full first layer is unchanged from sm up.
    expect(banner).toContain(
      'Optional Vercel Analytics and Speed Insights'
    );
    expect(banner).toContain('Optional Google Ads measurement checks whether ads lead to partner link clicks.');
    expect(banner).toContain("onClick={() => handleAll('denied')} className={CHOICE_BUTTON}");
    expect(banner).toContain("onClick={() => handleAll('granted')} className={CHOICE_BUTTON}");
  });

  it('keeps Choose individual settings reachable on a phone as a 44px control with its full accessible name', () => {
    expect(banner).toMatch(/aria-label="Choose individual settings"[\s\S]{0,80}min-h-11[^"]*sm:hidden/);
  });

  it('cannot grow past the viewport: the panel scrolls inside itself', () => {
    expect(banner).toContain('fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto');
  });

  it('is never a gate: nothing is granted until a button says so, and the page end still scrolls clear of it', () => {
    expect(banner).not.toMatch(/useState<ConsentChoice \| null>\(['"]granted['"]\)/);
    expect(banner).toContain("root.style.setProperty('--consent-banner-h'");
  });
});

describe('console readability and consistency', () => {
  it('labels the two fields at 12px, not 11px', () => {
    expect(form.match(/text-xs font-semibold uppercase tracking-wide text-ink-500/g)?.length).toBe(2);
    expect(form).not.toContain('text-[11px] font-semibold uppercase tracking-wide text-ink-500');
  });

  it('calls the closing action by the same name as the console button', () => {
    expect(sections).toMatch(/href="#your-journey"[\s\S]{0,260}Check my journey/);
    expect(sections).not.toMatch(/>\s*Check my trip\s*</);
  });
});
