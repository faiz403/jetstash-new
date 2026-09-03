import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Pre-existing hydration warning fix (recorded in docs/project-control/STATUS.md
 * "Known risks" before this fix). React SSR HTML-escapes a <style> tag's
 * JSX text child (apostrophes/quotes in the CSS comment get turned into
 * &#x27;/&quot;), but browsers parse <style> content as raw CDATA and never
 * decode those entities — so server and client permanently disagree on the
 * literal DOM text, and React logs a hydration mismatch every render.
 *
 * Fixed by rendering the Atlas's keyframe CSS via `dangerouslySetInnerHTML`
 * instead of a `{cssString}` text child — that sets innerHTML directly on
 * both server and client, bypassing React's text-escaping entirely.
 *
 * atlas-feel-test.tsx is a 'use client' component with hooks, so — matching
 * this repo's established pattern (see tests/atlas-audit-fixes.test.ts) —
 * these are source-text regression assertions on the real component, not a
 * rendered one.
 */

const atlasSrc = readFileSync(join(process.cwd(), 'components/founder/atlas-feel-test.tsx'), 'utf8');

describe('Atlas <style> tag renders via dangerouslySetInnerHTML, never a JSX text child', () => {
  it('the <style> tag uses dangerouslySetInnerHTML', () => {
    expect(atlasSrc).toMatch(/<style dangerouslySetInnerHTML=\{\{ __html: atlasStyleTag \}\} \/>/);
  });

  it('no <style> tag renders CSS as a JSX text-child expression (the exact pattern that caused the mismatch)', () => {
    // The old, broken pattern was `<style>{` followed by a template
    // literal — assert that exact shape is gone, not just that a
    // replacement exists elsewhere in the file.
    expect(atlasSrc).not.toMatch(/<style>\{/);
  });

  it('the fixed tag appears exactly once, and no other tag reintroduces the unsafe text-child pattern', () => {
    // Counted separately rather than a single generic "<style" scan — this
    // file's own explanatory comment above the fix legitimately mentions
    // "<style>" in prose several times, which a broad scan would
    // over-count. These two counts are what actually matter: the real,
    // fixed JSX tag appears exactly once, and the broken pattern (already
    // asserted absent above) never reappears anywhere else.
    const realTagCount = (atlasSrc.match(/<style dangerouslySetInnerHTML=\{\{ __html: atlasStyleTag \}\} \/>/g) ?? []).length;
    const unsafeTextChildCount = (atlasSrc.match(/<style>\{/g) ?? []).length;
    expect(realTagCount).toBe(1);
    expect(unsafeTextChildCount).toBe(0);
  });

  it('the CSS content itself is unchanged — every selector and keyframe from the original block is still present', () => {
    const expectedFragments = [
      '@keyframes originBreathe',
      '.origin-breathe { animation: originBreathe 4s ease-in-out infinite; }',
      '@keyframes countryPulse',
      '.country-pulse { animation: countryPulse 2.2s ease-in-out infinite; }',
      '@keyframes countryLandmassBreathe',
      '.country-landmass-breathe { animation: countryLandmassBreathe 3.6s ease-in-out infinite; }',
      '@keyframes destReveal',
      '.destination-reveal { animation: destReveal 0.4s ease-out; }',
      '@media (prefers-reduced-motion: reduce)',
    ];
    for (const fragment of expectedFragments) {
      expect(atlasSrc, fragment).toContain(fragment);
    }
  });

  it('the style string is built from atlasStyleTag, itself derived only from originGlowR — a value computed purely from fixed module-level constants, never a prop, piece of state, or anything user-controlled', () => {
    // atlasStyleTag's own definition must exist, and its only interpolation
    // must be originGlowR (in either raw or *1.125 form) — never a prop,
    // searchParams, or any other externally-influenced identifier.
    expect(atlasSrc).toMatch(/const atlasStyleTag = `/);
    const styleTagBlock = atlasSrc.slice(atlasSrc.indexOf('const atlasStyleTag = `'), atlasSrc.indexOf('`;', atlasSrc.indexOf('const atlasStyleTag = `')) + 2);
    const interpolations = styleTagBlock.match(/\$\{[^}]+\}/g) ?? [];
    expect(interpolations.length).toBeGreaterThan(0);
    for (const interpolation of interpolations) {
      expect(interpolation, interpolation).toMatch(/^\$\{originGlowR(\s*\*\s*1\.125)?\}$/);
    }
    // originGlowR itself must trace to fixed constants, not a prop/state.
    expect(atlasSrc).toContain('const originGlowR = BASE_COUNTRY_HALO_R * MAX_EMPHASIS_SCALE * 1.2;');
    expect(atlasSrc).toContain('const MAX_EMPHASIS_SCALE = 3.2;');
    expect(atlasSrc).toContain('const BASE_COUNTRY_HALO_R = 11;');
  });
});

describe('Reduced-motion fix: the travelling route dot is hidden under prefers-reduced-motion', () => {
  // Regression test for a real defect (September 2026): the active route's
  // travelling light uses SVG SMIL (animateMotion), a separate animation
  // system the CSS `animation: none` rule in the block above cannot reach —
  // it only ever stops CSS animations. Before this fix, the dot kept moving
  // indefinitely regardless of a visitor's OS-level reduced-motion
  // preference. Fixed with a `.travel-dot` class on the circle plus one
  // `display: none` rule inside the existing @media block — no new React
  // state/effect. Locks in both halves so neither can silently regress:
  // removing the class from the circle, or removing/relocating the CSS rule
  // out of the reduced-motion block, would each break one of these.
  it('the travelling route dot circle carries the travel-dot class', () => {
    expect(atlasSrc).toContain('<circle r="0.8" fill="#F7F2E9" className="travel-dot">');
  });

  it('.travel-dot is hidden inside the existing prefers-reduced-motion block', () => {
    const mediaStart = atlasSrc.indexOf('@media (prefers-reduced-motion: reduce)');
    const reducedMotionSection = atlasSrc.slice(mediaStart, atlasSrc.indexOf('`;', mediaStart));
    expect(reducedMotionSection).toContain('.travel-dot { display: none; }');
  });
});

describe('Atlas rendering and accessibility behaviour are unchanged by this fix', () => {
  // Mirrors tests/atlas-audit-fixes.test.ts and tests/atlas-route-status.test.ts's
  // own structural assertions — re-affirmed here from the style-tag fix's
  // point of view: none of the interaction/accessibility logic lives inside
  // or near the <style> tag this fix touched.
  it('activateCountry and selectDestination function definitions are untouched', () => {
    expect(atlasSrc).toContain('function activateCountry(slug: string) {');
    expect(atlasSrc).toContain('function selectDestination(slug: string) {');
  });

  it('every marker keeps exactly one real keyboard-accessible control (the hit-circle), never the decorative label', () => {
    expect(atlasSrc).toContain('tabIndex={0}');
    expect(atlasSrc).toMatch(/aria-hidden="true"[\s\S]{0,400}onClick=\{\(\) => activateCountry\(c\.slug\)\}/);
  });

  it('mobile chip selectors still call the exact same activateCountry/selectDestination handlers as the desktop map', () => {
    expect(atlasSrc).toContain('onClick={() => activateCountry(c.slug)}');
    expect(atlasSrc).toContain('onClick={() => selectDestination(d.slug)}');
  });

  it('the route-intelligence and country-intelligence colour/label maps are untouched', () => {
    expect(atlasSrc).toContain("strong: { fill: '#E0B158', label: 'JetStash knows this route well' }");
    expect(atlasSrc).toContain("useful: { fill: '#A39D8C', label: 'Useful route guidance available' }");
    expect(atlasSrc).toContain("expanding: { fill: '#5B6472', label: 'Intelligence still being expanded' }");
  });

  it('the active-service-notice rendering and its accent colour are untouched', () => {
    expect(atlasSrc).toContain('Active service notice');
    expect(atlasSrc).toContain('SERVICE_NOTICE_ACCENT');
  });

  it('the origin-glow circle still reads its radius from the same originGlowR the style tag uses — the two never drift apart', () => {
    expect(atlasSrc).toContain('<circle cx={origin.x} cy={origin.y} r={originGlowR} fill="url(#ft-origin-glow)" className="origin-breathe"');
  });
});
