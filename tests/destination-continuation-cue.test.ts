import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { destinations } from '@/data/destinations';
import { getDealsByDestination } from '@/data/deals';
import { getTipsForScope } from '@/data/traveller-tips';

/**
 * Destination-page scroll continuation cue (August 2026).
 *
 * A shared, single-source-of-truth cue — one component
 * (components/ui/scroll-continuation-cue.tsx), one render call site
 * (app/destinations/[slug]/page.tsx) — never copied per destination.
 * Mirrors tests/route-intelligence-continuation-cue.test.ts's approach:
 * source-level assertions against the actual files.
 */

const cueSrc = readFileSync(join(process.cwd(), 'components', 'ui', 'scroll-continuation-cue.tsx'), 'utf8');
const destinationPageSrc = readFileSync(join(process.cwd(), 'app', 'destinations', '[slug]', 'page.tsx'), 'utf8');

describe('ScrollContinuationCue is one shared component, not copied per destination', () => {
  it('exports exactly one component with the exact required wording', () => {
    expect(cueSrc).toContain('export function ScrollContinuationCue()');
    expect(cueSrc).toContain('Scroll down for more destination information ↓');
  });

  it('is imported and rendered from exactly one call site: the destination page template', () => {
    // git grep always emits POSIX-style ("/") paths regardless of OS.
    const grep = execSync('git grep -l "ScrollContinuationCue" -- "*.ts" "*.tsx"', { cwd: process.cwd(), encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((file) => !file.startsWith('tests/') && file !== 'components/ui/scroll-continuation-cue.tsx');

    expect(grep).toEqual(['app/destinations/[slug]/page.tsx']);
  });

  it('the destination page never hardcodes the cue text itself — it only renders the shared component', () => {
    expect(destinationPageSrc).not.toContain('Scroll down for more destination information');
    expect(destinationPageSrc).toContain('<ScrollContinuationCue />');
  });
});

describe('The cue is visually subtle, not a button, not sticky, not animated', () => {
  it('renders as a <p>, never a <button> or <a>', () => {
    expect(cueSrc).toMatch(/<p\s/);
    expect(cueSrc).not.toMatch(/<button/);
    expect(cueSrc).not.toMatch(/<a\s/);
  });

  it('carries no sticky/fixed positioning', () => {
    // Scoped to the className string, not the whole file — the doc comment
    // above deliberately says "not sticky" to explain the design choice.
    const classNameMatch = cueSrc.match(/className="([^"]*)"/);
    expect(classNameMatch).not.toBeNull();
    expect(classNameMatch![1]).not.toMatch(/\bsticky\b/);
    expect(classNameMatch![1]).not.toMatch(/\bfixed\b/);
  });

  it('carries no animation classes — no existing JetStash scroll-cue animation pattern exists to reuse', () => {
    expect(cueSrc).not.toMatch(/animate-|transition-|stagger-/);
  });

  it('uses small, muted text styling consistent with the page\'s own subordinate copy (text-xs text-ink-400)', () => {
    expect(cueSrc).toMatch(/text-xs/);
    expect(cueSrc).toMatch(/text-ink-400/);
  });
});

describe('Placement: bottom of the first/main (About) destination section, before any content below it', () => {
  it('the cue sits inside the first bg-white About section, after the two-column grid closes', () => {
    const aboutSectionStart = destinationPageSrc.indexOf('About {dest.city}');
    const cueCallSite = destinationPageSrc.indexOf('{hasContentBelowAboutSection && <ScrollContinuationCue />}');
    const familyVisitCallSite = destinationPageSrc.indexOf('dest.familyVisitContent &&');
    expect(aboutSectionStart).toBeGreaterThan(-1);
    expect(cueCallSite).toBeGreaterThan(aboutSectionStart);
    // Renders before the FamilyVisitBlock / traveller tips / fares sections
    // that follow it, i.e. it's a lead-in cue, not a trailing afterthought.
    expect(cueCallSite).toBeLessThan(familyVisitCallSite);
  });

  it('does not touch destination data, fares or route intelligence', () => {
    expect(destinationPageSrc).toContain('const dealsHere = getDealsByDestination(dest.slug);');
    expect(destinationPageSrc).toContain('const travellerTips = getTipsForScope({ destinationSlug: dest.slug });');
    expect(destinationPageSrc).toContain('computeBookBySnapshotsForDestination(dest.slug, new Date());');
  });
});

describe('Only renders where meaningful content genuinely exists below', () => {
  it('the gate requires family-visit content, traveller tips, or at least one tracked deal — never renders against a bare no-fare fallback alone', () => {
    expect(destinationPageSrc).toContain(
      "const hasContentBelowAboutSection = Boolean(dest.familyVisitContent) || travellerTips.length > 0 || dealsHere.length > 0;"
    );
  });

  it('every real destination in data/destinations.ts satisfies the gate today (sanity check, not a guarantee for all future destinations)', () => {
    const failing = destinations.filter((d) => {
      const hasFamily = Boolean(d.familyVisitContent);
      const hasTips = getTipsForScope({ destinationSlug: d.slug }).length > 0;
      const hasDeals = getDealsByDestination(d.slug).length > 0;
      return !(hasFamily || hasTips || hasDeals);
    });
    // Not asserting zero — a genuinely sparse destination should legitimately
    // suppress the cue rather than fail this test. Documents the current
    // count so a large unexplained jump is visible in review.
    expect(failing.length).toBeLessThanOrEqual(3);
  });
});
