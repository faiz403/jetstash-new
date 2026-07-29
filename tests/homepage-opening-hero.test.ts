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
 */

const heroSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/homepage-opening-hero.tsx'), 'utf8');
const homeSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/journey-desk-home.tsx'), 'utf8');
const atlasSrc = readFileSync(join(process.cwd(), 'components/founder/atlas-feel-test.tsx'), 'utf8');

describe('homepage opening hero uses the approved copy', () => {
  it('has the exact eyebrow, headline, body and trust line', () => {
    expect(heroSrc).toContain('Know the journey before you book the fare.');
    expect(heroSrc).toContain(
      'JetStash checks routes, travel requirements, timing, baggage and dated fare evidence for international journeys from UK airports.'
    );
    expect(heroSrc).toContain('Checked, dated and sourced. Booking links come last.');
    expect(heroSrc).toContain('When the journey is clear, JetStash points you to a booking partner.');
  });

  it('has the exact primary and secondary CTA labels', () => {
    expect(heroSrc).toContain('Check my journey');
    expect(heroSrc).toContain('Explore the Route Atlas');
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
});

describe('the two hero CTAs point at real, matching anchors', () => {
  it('"Check my journey" targets #your-journey, which exists on the homepage', () => {
    expect(heroSrc).toContain('href="#your-journey"');
    expect(homeSrc).toContain('id="your-journey"');
  });

  it('"Explore the Route Atlas" targets #route-atlas, which exists on the Atlas', () => {
    expect(heroSrc).toContain('href="#route-atlas"');
    expect(atlasSrc).toContain('id="route-atlas"');
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
