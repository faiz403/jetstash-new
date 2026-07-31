import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Homepage-opening-hero addition, raised from a real mobile review
 * (Samsung Galaxy Z Fold 7): the homepage previously opened directly with
 * the Route Atlas, with nothing explaining what JetStash is first. Source-
 * based checks, matching this repo's existing pattern for copy/structure
 * regressions (tests/trust-cracks-july.test.ts) — confirms the approved
 * copy, both CTA targets, and that the page still has exactly one <h1>.
 *
 * Messaging-clarity fix: a first-time visitor could see JetStash looked
 * premium but not immediately understand what it does. Copy-only change —
 * eyebrow, headline, supporting copy, primary CTA label, trust line and the
 * Atlas's own introduction sentence, approved verbatim by the founder. No
 * layout, CTA destination, or unrelated button changed.
 */

const heroSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/homepage-opening-hero.tsx'), 'utf8');
const homeSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/journey-desk-home.tsx'), 'utf8');
const atlasSrc = readFileSync(join(process.cwd(), 'components/founder/atlas-feel-test.tsx'), 'utf8');

describe('homepage opening hero uses the approved copy', () => {
  it('has the exact eyebrow, headline and supporting copy', () => {
    expect(heroSrc).toContain('Before you book a flight');
    expect(heroSrc).toContain('Check the whole journey before you book.');
    expect(heroSrc).toContain(
      'Choose your UK airport and destination. JetStash shows which routes are operating, what has changed, what travel requirements apply and when the information was last checked.'
    );
  });

  it('has the exact trust line', () => {
    expect(heroSrc).toContain('Checked against airline and official sources. Booking links come last.');
  });

  it('has the exact primary and secondary CTA labels, with no duplicate CTA introduced', () => {
    expect(heroSrc).toContain('Check a journey');
    expect(heroSrc).toContain('Explore the Route Atlas');
    // Exactly one "Check a journey" and one "Explore the Route Atlas" — a
    // second copy of either would mean a duplicate CTA was accidentally added.
    expect(heroSrc.match(/Check a journey/g)).toHaveLength(1);
    expect(heroSrc.match(/Explore the Route Atlas/g)?.length).toBe(1);
  });

  it('states the three proof points without long paragraphs', () => {
    expect(heroSrc).toContain('Route first');
    expect(heroSrc).toContain('Travel ready');
    expect(heroSrc).toContain('Price with context');
  });

  it('reuses the shared PageHero and an existing approved image, not a new one', () => {
    expect(heroSrc).toContain("import { PageHero } from '@/components/sections/page-hero'");
    expect(heroSrc).toMatch(/heroKey=["']routes["']/);
  });

  it('does not use the retired hero phrases "travel intelligence", "second opinion" or "pull the answer"', () => {
    expect(heroSrc.toLowerCase()).not.toMatch(/travel intelligence/);
    expect(heroSrc.toLowerCase()).not.toMatch(/second opinion/);
    expect(heroSrc.toLowerCase()).not.toMatch(/pull the answer/);
  });

  it('no longer contains the old, pre-messaging-fix copy', () => {
    expect(heroSrc).not.toContain('Know the journey before you book the fare.');
    expect(heroSrc).not.toContain('Check my journey');
    expect(heroSrc).not.toContain('Checked, dated and sourced. Booking links come last.');
  });
});

describe('the two hero CTAs point at real, matching anchors', () => {
  it('"Check a journey" targets #your-journey, which exists on the homepage', () => {
    expect(heroSrc).toContain('href="#your-journey"');
    expect(homeSrc).toContain('id="your-journey"');
  });

  it('"Explore the Route Atlas" targets #route-atlas, which exists on the Atlas', () => {
    expect(heroSrc).toContain('href="#route-atlas"');
    expect(atlasSrc).toContain('id="route-atlas"');
  });
});

describe('the Atlas introduction uses the approved copy', () => {
  it('has the exact Atlas introduction sentence', () => {
    expect(atlasSrc).toContain('Explore where you can fly from your UK airport and see what JetStash has verified about each route.');
  });

  it('no longer contains the old, airport-name-interpolated Atlas headline', () => {
    expect(atlasSrc).not.toMatch(/international network, mapped with the route intelligence/);
  });
});

describe('mobile visual-polish pass: trust line, map attribution, swipe cue', () => {
  const ATTRIBUTION = 'Geography: CC BY 4.0 (MapSVG, via VictorCazanave/svg-maps).';

  it('the trust line wording is unchanged', () => {
    expect(heroSrc).toContain('Checked against airline and official sources. Booking links come last.');
  });

  it('the trust line has a mobile-specific (base) size/contrast step, reverting to the exact original at sm:', () => {
    expect(heroSrc).toMatch(/text-sm text-ink-200 sm:text-xs sm:text-ink-300/);
    // Not bold, not a bigger jump than one step in either scale.
    expect(heroSrc).not.toMatch(/Checked against airline[\s\S]{0,40}font-bold/);
  });

  it('the Atlas introduction paragraph no longer contains the technical map attribution', () => {
    const introMatch = atlasSrc.match(/<p className="mt-1 text-xs text-ink-400">([\s\S]*?)<\/p>/);
    expect(introMatch).not.toBeNull();
    expect(introMatch![1]).not.toContain('CC BY 4.0');
    expect(introMatch![1]).not.toContain('VictorCazanave');
    // The user-facing instruction sentence stays — only the attribution moved.
    expect(introMatch![1]).toContain('Choose a departure airport, then follow the light to explore its destinations.');
  });

  it('the attribution still exists beneath the map, with wording preserved exactly', () => {
    expect(atlasSrc).toContain(ATTRIBUTION);
  });

  it('the attribution appears exactly once (no duplicate introduced)', () => {
    // Only the full, rendered attribution string — not a bare "CC BY 4.0"
    // substring match, which would also catch the unrelated provenance
    // note in this file's own top-of-file doc comment.
    expect(atlasSrc.split(ATTRIBUTION).length - 1).toBe(1);
  });

  it('the attribution footnote sits after the map/legend and reads as visually secondary', () => {
    const legendIndex = atlasSrc.indexOf('service confirmed for part of the year only');
    const attributionIndex = atlasSrc.indexOf(ATTRIBUTION);
    expect(legendIndex).toBeGreaterThan(-1);
    expect(attributionIndex).toBeGreaterThan(legendIndex);
    // Smaller than the site's usual text-xs secondary-copy size.
    expect(atlasSrc).toMatch(/text-\[11px\] text-ink-400">\s*Geography: CC BY 4\.0/);
  });

  it('shows a mobile-only "swipe to explore" cue near the map', () => {
    expect(atlasSrc).toContain('Swipe to explore more routes');
    expect(atlasSrc).toContain('ChevronRight');
  });

  it('the swipe cue and its icon are hidden on desktop (sm:hidden), not shown unconditionally', () => {
    // sm:hidden is on the cue's own opening <div ...> tag, which precedes
    // the visible text in source order, so look backward from the text.
    const precedingTag = atlasSrc.match(/className="[^"]*"[\s\S]{0,60}Swipe to explore more routes/)?.[0] ?? '';
    expect(precedingTag).toContain('sm:hidden');
  });

  it('the directional icon is decorative, not a second unlabelled interactive control', () => {
    const cueBlock = atlasSrc.match(/Swipe to explore more routes[\s\S]{0,150}/)?.[0] ?? '';
    expect(cueBlock).toContain('<ChevronRight');
    expect(cueBlock).toMatch(/<ChevronRight[^/]*aria-hidden="true"/);
  });

  it('the cue is not the only affordance — the horizontally scrollable map container is still present and unchanged', () => {
    expect(atlasSrc).toContain('viewBox="418 230 336 220" className="h-auto w-[800px] max-w-none sm:w-full"');
    expect(atlasSrc).toContain('overflow-x-auto px-6 sm:mx-0 sm:overflow-visible sm:px-0');
  });

  it('the swipe cue softens via a single plain boolean (hasScrolledMap), not localStorage or a new dependency', () => {
    expect(atlasSrc).toContain('hasScrolledMap');
    // Actual API usage, not just the word appearing in an explanatory
    // comment about why it's deliberately *not* used.
    expect(atlasSrc).not.toMatch(/\blocalStorage\.|window\.localStorage|\bsessionStorage\./);
  });

  it('no new package.json dependency was introduced for the cue', () => {
    const pkg = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
    expect(pkg).not.toMatch(/react-swipeable|hammerjs|use-gesture/);
  });
});

describe('homepage composition still renders exactly one <h1>', () => {
  it('the opening hero is the first element, before the Atlas', () => {
    const heroImportIndex = homeSrc.indexOf('HomepageOpeningHero');
    const atlasUsageIndex = homeSrc.indexOf('<AtlasFeelTest');
    expect(heroImportIndex).toBeGreaterThan(-1);
    expect(atlasUsageIndex).toBeGreaterThan(-1);
    expect(homeSrc.indexOf('<HomepageOpeningHero')).toBeLessThan(atlasUsageIndex);
  });

  it('the Atlas no longer renders its own <h1> now that the hero owns the page heading', () => {
    expect(atlasSrc).not.toMatch(/<h1[\s>]/);
    expect(atlasSrc).toMatch(/<h2[\s>]/);
  });
});
