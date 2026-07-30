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
