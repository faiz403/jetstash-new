import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Homepage first-visit usability (November 2026). The shared consent panel is in normal flow so it cannot cover the homepage form;
 * the mobile console remains before explanatory copy. Consent behavior and storage are unchanged.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const hero = read('components/homepage-v2/homepage-opening-hero.tsx');
const banner = read('components/ui/cookie-consent-banner.tsx');
const backdrop = read('components/ui/hero-backdrop.tsx');
const pageHero = read('components/sections/page-hero.tsx');
const form = read('components/homepage-v2/journey-check-form.tsx');
const sections = read('components/homepage-v2/homepage-sections.tsx');

/**
 * The full JSX opening tag of `<name`: scans to the first `>` that is outside braces, quotes and `//` comments. A bare
 * `/<PageHero[^>]*description=/` regex stops at the first `>` inside the eyebrow's nested JSX and so never reaches the later
 * props (Codex review of PR #353, P3: re-adding `description=` after the eyebrow would still have passed).
 */
function openingTag(src: string, name: string): string {
  const start = src.indexOf(`<${name}`);
  if (start === -1) throw new Error(`<${name}> not found`);
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
    } else if (c === '>' && depth === 0 && src[i - 1] !== '=') {
      return src.slice(start, i + 1);
    }
  }
  throw new Error(`<${name}> opening tag not closed`);
}

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
      'See dated fares, route changes and travel requirements before you book. Then check the price with a booking provider.'
    );
    const tag = openingTag(hero, 'PageHero');
    expect(tag).toContain('heroOverlay="directional"'); // proves the scan reached the props after the eyebrow
    expect(tag).not.toMatch(/\sdescription\s*=/); // JSX allows whitespace around `=`
  });

  it('would notice a description prop added after the eyebrow (the old regex could not)', () => {
    const mutated = hero.replace('heroKey="routes"', 'heroKey="routes"\n      description="x"');
    expect(mutated).not.toBe(hero);
    expect(openingTag(mutated, 'PageHero')).toMatch(/\sdescription\s*=/);
    expect(mutated).not.toMatch(/<PageHero[^>]*description=/); // the previous assertion's blind spot
    // JSX also allows spaces around `=`; the check must catch `description = "x"` too (Codex re-review, P3)
    const spaced = hero.replace('heroKey="routes"', 'heroKey="routes"\n      description = "x"');
    expect(spaced).not.toBe(hero);
    expect(openingTag(spaced, 'PageHero')).toMatch(/\sdescription\s*=/);
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

  it('stays in normal flow rather than covering page controls', () => {
    expect(banner).toContain('className="relative w-full');
    expect(banner).not.toMatch(/className="[^"]*(?:fixed|absolute)\b/);
    expect(banner).not.toContain('max-h-[85vh]');
  });

  it('is never a gate: nothing is granted until a button says so, and the optional scripts remain consent-gated', () => {
    expect(banner).not.toMatch(/useState<ConsentChoice \| null>\(['"]granted['"]\)/);
    expect(banner).toContain("storeConsentChoice(next)");
    expect(banner).toContain("if (stored === 'granted')");
    expect(banner).toContain('{loadTag && (');
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
