import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Homepage route-check copy fix — replaces the vague "Pull the answer" /
 * "Press Check to pull its answer open" wording with a concrete route-check
 * instruction. pull-brief.tsx and pull-brief-hero.tsx are 'use client'
 * components built on refs + an imperative rAF pipeline (see
 * tests/homepage-manchester-mumbai-visual.test.ts's header comment for why
 * they can't be rendered/called directly in this repo's node-environment
 * Vitest setup) — these assertions follow that file's established
 * source-text pattern.
 */

const pullBriefSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/pull-brief.tsx'), 'utf8');
const pullBriefHeroSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/pull-brief-hero.tsx'), 'utf8');

describe('the pull-handle label reads as a concrete route check, not a vague "answer"', () => {
  it('"Pull the answer" is gone from the homepage interaction', () => {
    expect(pullBriefSrc).not.toMatch(/Pull the answer/);
    expect(pullBriefSrc).not.toMatch(/\banswer\b/i);
  });

  it('"Pull to check this route" is present as the visible handle label', () => {
    expect(pullBriefSrc).toContain('Pull to check this route');
  });

  it('the label stays inside the same pull-tab button as the accessible name — this is still one wired control, not a relocated label', () => {
    const ariaLabelIndex = pullBriefSrc.indexOf('aria-label="Pull open the Manchester to Mumbai check"');
    const labelIndex = pullBriefSrc.indexOf('Pull to check this route');
    const buttonCloseIndex = pullBriefSrc.indexOf('</button>', ariaLabelIndex);
    expect(ariaLabelIndex).toBeGreaterThan(-1);
    expect(labelIndex).toBeGreaterThan(ariaLabelIndex);
    expect(labelIndex).toBeLessThan(buttonCloseIndex);
  });

  it('the accessible name (aria-label) is untouched — already clear, no concrete accessibility improvement identified', () => {
    expect(pullBriefSrc).toContain('aria-label="Pull open the Manchester to Mumbai check"');
  });

  it('the visible label stays decorative (aria-hidden) — the aria-label above remains the sole accessible name', () => {
    const labelIndex = pullBriefSrc.indexOf('Pull to check this route');
    const precedingSpanOpen = pullBriefSrc.lastIndexOf('<span', labelIndex);
    const spanTagSlice = pullBriefSrc.slice(precedingSpanOpen, labelIndex);
    expect(spanTagSlice).toMatch(/aria-hidden="true"/);
  });
});

describe('the featured-route helper sentence reads naturally and matches the required wording exactly', () => {
  it('"Press Check to pull its answer open" is gone', () => {
    expect(pullBriefHeroSrc).not.toMatch(/pull its\s+answer open/);
    expect(pullBriefHeroSrc).not.toMatch(/\banswer\b/i);
  });

  it('contains the new sentence, whitespace-normalised (JSX splits it across lines)', () => {
    const normalised = pullBriefHeroSrc.replace(/\s+/g, ' ');
    expect(normalised).toContain('Press Check to open this route check.');
  });

  it('the full rendered sentence reads naturally end-to-end: "This is the featured route above. Press Check to open this route check."', () => {
    const normalised = pullBriefHeroSrc.replace(/\s+/g, ' ');
    expect(normalised).toContain(
      'This is the featured route above.</span> Press Check to open this route check.'
    );
  });
});

describe('no unrelated "answer" copy elsewhere in the app was touched by this fix', () => {
  it('pull-brief.tsx and pull-brief-hero.tsx are the only homepage-v2 files this fix needed to change', () => {
    // Every other homepage-v2 component is untouched by this task — confirmed
    // by the repo-wide grep performed during implementation (book-by-countdown,
    // contact, routes, founder-insights, travel-intelligence-engine and
    // travel-ready-check all use "answer" in unrelated, non-homepage-pull
    // contexts and were deliberately left alone).
    expect(pullBriefSrc).not.toMatch(/\banswer\b/i);
    expect(pullBriefHeroSrc).not.toMatch(/\banswer\b/i);
  });
});

describe('the pull/reveal interaction remains fully wired after the copy change', () => {
  it('the pull-tab button still carries its full gesture handler set', () => {
    const tabButtonStart = pullBriefSrc.indexOf('ref={tabRef}');
    const tabButtonRegionEnd = pullBriefSrc.indexOf('</button>', tabButtonStart);
    const region = pullBriefSrc.slice(tabButtonStart, tabButtonRegionEnd);
    expect(region).toMatch(/onPointerDown={onPointerDown}/);
    expect(region).toMatch(/onPointerMove={onPointerMove}/);
    expect(region).toMatch(/onPointerUp={onPointerUp}/);
    expect(region).toMatch(/onPointerCancel={onPointerUp}/);
    expect(region).toMatch(/onKeyDown={onTabKeyDown}/);
    expect(region).toMatch(/aria-expanded={settled}/);
  });

  it('"Change journey" (close/reverse) is untouched', () => {
    expect(pullBriefSrc).toContain('Change journey');
    expect(pullBriefSrc).toContain('onClick={close}');
  });

  it('reduced-motion handling around the tab button is untouched', () => {
    const tabButtonStart = pullBriefSrc.indexOf('ref={tabRef}');
    const tabButtonRegionEnd = pullBriefSrc.indexOf('</button>', tabButtonStart);
    const region = pullBriefSrc.slice(tabButtonStart, tabButtonRegionEnd);
    expect(region).toMatch(/reducedRef\.current && phaseRef\.current === 'rest'/);
  });
});
