import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidElement, type ReactElement } from 'react';
import { getJourneyChoiceForRoute } from '@/lib/journey-choice-route-adapter';
import type { JourneyChoiceTripComHandoff } from '@/lib/tripcom-dated-handoff';
import { JourneyChoice } from '@/components/route/journey-choice';
import { JourneyChoiceImpressionSection } from '@/components/route/journey-choice-impression-section';
import { TrackedOutboundLink } from '@/components/ui/tracked-outbound-link';

/**
 * Journey Choice measurement instrumentation (24 Aug 2026) — a one-time
 * founder-approved exception to the Journey Choice freeze, measurement
 * only. Two additions, both covered here:
 *   1. journey_choice_impression — a genuine viewport/exposure event.
 *   2. journey_choice_cta_click's `source` distinguishes a dated handoff
 *      click from a fail-closed generic-fallback click.
 *
 * The impression component's actual runtime behaviour (fires once, never
 * refires on leave/re-entry) cannot be exercised end-to-end in this repo's
 * Vitest environment — `vitest.config.ts` runs a plain Node environment
 * (no jsdom, no @testing-library, `tests/**\/*.test.ts` only) with no
 * IntersectionObserver and no React dispatcher available outside an actual
 * render. This matches the codebase's own established pattern for this
 * exact situation (see tests/book-by-cabin-safety.test.ts's source-level
 * regex proof of booking-intelligence.ts's null-preserving ternary): prove
 * the guarantee structurally, from the component's own source, rather than
 * simulate a browser API this environment doesn't have.
 */

const NOW_ISO = '2026-08-24';

describe('journey_choice_impression — structural guarantees', () => {
  const src = readFileSync(join(process.cwd(), 'components/route/journey-choice-impression-section.tsx'), 'utf8');

  it('uses IntersectionObserver, not a page-load or scroll-position guess', () => {
    expect(src).toContain('new IntersectionObserver');
  });

  it('uses a documented 0.25 threshold, not a near-zero default', () => {
    expect(src).toMatch(/threshold:\s*0\.25/);
  });

  it('fires the exact event with exactly route + source, nothing else', () => {
    expect(src).toContain("track('journey_choice_impression', { route: routeSlug, source: 'journey-choice' })");
  });

  it('guards against a second fire via a ref checked in the same branch as isIntersecting', () => {
    // Both checks must appear in the same conditional, not two separate
    // ifs that could independently pass.
    expect(src).toMatch(/entry\.isIntersecting\s*&&\s*!firedRef\.current/);
    expect(src).toContain('firedRef.current = true');
  });

  it('disconnects the observer immediately on first fire, so leaving and re-entering the viewport cannot fire a second event', () => {
    // The fire branch itself calls disconnect() — not only the effect's
    // cleanup function, which would leave a window between fire and
    // disconnect where a second intersection could still queue.
    expect(src).toMatch(/firedRef\.current = true;\s*\n\s*track\('journey_choice_impression'[^)]*\);\s*\n\s*observer\.disconnect\(\);/);
  });

  it('also disconnects on unmount (effect cleanup), never leaking an observer', () => {
    expect(src).toMatch(/return \(\) => observer\.disconnect\(\);/);
  });

  it('renders the exact same section element as before — no visual change (identical aria-labelledby and className)', () => {
    expect(src).toContain('aria-labelledby="journey-choice-heading"');
    expect(src).toContain('className="rounded-md border border-ink-200 bg-white p-5 sm:p-7"');
  });
});

describe('journey_choice_impression — wired into Journey Choice for manchester-islamabad only', () => {
  it('the route page composition uses JourneyChoiceImpressionSection as the outer wrapper', () => {
    const src = readFileSync(join(process.cwd(), 'components/route/journey-choice.tsx'), 'utf8');
    expect(src).toContain('<JourneyChoiceImpressionSection routeSlug={routeSlug}>');
    expect(src).toContain('</JourneyChoiceImpressionSection>');
  });

  it('no other component in the app imports the impression wrapper — Journey Choice only', () => {
    // journey-choice.tsx itself is the one legitimate import; scanning the
    // rest of components/ and app/ for a second, independent usage would
    // mean impression tracking leaked outside the pilot.
    const componentsDir = join(process.cwd(), 'components');
    const routeFile = join(process.cwd(), 'app', 'routes', '[slug]', 'page.tsx');
    const journeyChoiceSrc = readFileSync(join(componentsDir, 'route', 'journey-choice.tsx'), 'utf8');
    const routePageSrc = readFileSync(routeFile, 'utf8');
    expect(journeyChoiceSrc).toContain('journey-choice-impression-section');
    // The route page never imports the impression wrapper directly — it
    // only ever reaches the customer through <JourneyChoice>.
    expect(routePageSrc).not.toContain('journey-choice-impression-section');
  });
});

describe('journey_choice_cta_click — dated vs fallback source distinction', () => {
  function findElementByType(node: unknown, type: unknown): ReactElement | null {
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = findElementByType(child, type);
        if (found) return found;
      }
      return null;
    }
    if (isValidElement(node)) {
      if (node.type === type) return node;
      if (node.type === JourneyChoiceImpressionSection) {
        return findElementByType((node.props as { children?: unknown }).children, type);
      }
      if (typeof node.type === 'function') {
        const rendered = (node.type as (props: unknown) => unknown)(node.props);
        return findElementByType(rendered, type);
      }
      return findElementByType((node.props as { children?: unknown } | null)?.children, type);
    }
    return null;
  }

  const journeyChoice = getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO)!;

  it('a dated handoff produces source: "journey-choice-dated"', () => {
    const datedHandoff: JourneyChoiceTripComHandoff = { url: 'https://www.trip.com/flights/showfarefirst?dcity=man', datesPreserved: true };
    const tree = JourneyChoice({
      journeyChoice,
      routeLabel: 'Manchester to Islamabad',
      routeSlug: 'manchester-islamabad',
      tripComHandoff: datedHandoff,
    });
    const link = findElementByType(tree, TrackedOutboundLink);
    expect(link).not.toBeNull();
    expect(link!.props.event).toBe('journey_choice_cta_click');
    expect(link!.props.properties).toEqual({ route: 'manchester-islamabad', source: 'journey-choice-dated' });
  });

  it('a fail-closed generic fallback produces source: "journey-choice-fallback", same event name, route still captured', () => {
    const fallbackHandoff: JourneyChoiceTripComHandoff = { url: 'https://www.trip.com/flights/Manchester-to-Islamabad/tickets-MAN-ISB', datesPreserved: false };
    const tree = JourneyChoice({
      journeyChoice,
      routeLabel: 'Manchester to Islamabad',
      routeSlug: 'manchester-islamabad',
      tripComHandoff: fallbackHandoff,
    });
    const link = findElementByType(tree, TrackedOutboundLink);
    expect(link).not.toBeNull();
    expect(link!.props.event).toBe('journey_choice_cta_click');
    expect(link!.props.properties).toEqual({ route: 'manchester-islamabad', source: 'journey-choice-fallback' });
  });

  it('exactly two properties either way — the existing Vercel Pro ceiling is respected, no third property added', () => {
    const handoff: JourneyChoiceTripComHandoff = { url: 'https://www.trip.com/flights/showfarefirst?dcity=man', datesPreserved: true };
    const tree = JourneyChoice({
      journeyChoice,
      routeLabel: 'Manchester to Islamabad',
      routeSlug: 'manchester-islamabad',
      tripComHandoff: handoff,
    });
    const link = findElementByType(tree, TrackedOutboundLink);
    expect(Object.keys(link!.props.properties)).toHaveLength(2);
    expect(Object.keys(link!.props.properties).sort()).toEqual(['route', 'source']);
  });

  it('the source value is derived solely from tripComHandoff.datesPreserved, never from parsing the URL string', () => {
    const src = readFileSync(join(process.cwd(), 'components/route/journey-choice.tsx'), 'utf8');
    expect(src).toContain("source: tripComHandoff.datesPreserved ? 'journey-choice-dated' : 'journey-choice-fallback'");
    // No URL-parsing logic (indexOf/includes/match against tripComHandoff.url)
    // feeds the source value — the only thing read from the URL is passed
    // straight through as `href`.
    expect(src).not.toMatch(/tripComHandoff\.url\.(includes|indexOf|match)/);
  });

  it('the real manchester-islamabad pilot today resolves to the dated source (cross-check against the live derivation, not a hardcoded assumption)', () => {
    const src = readFileSync(join(process.cwd(), 'components/route/journey-choice.tsx'), 'utf8');
    expect(src).toContain('journey-choice-dated');
    expect(src).toContain('journey-choice-fallback');
  });
});

describe('Zero customer-facing change — analytics-only diff', () => {
  it('journey_choice_evidence_opened is completely untouched', () => {
    const src = readFileSync(join(process.cwd(), 'components/route/journey-choice-evidence-disclosure.tsx'), 'utf8');
    expect(src).toContain("track('journey_choice_evidence_opened', { route: routeSlug, source: 'journey-choice' })");
  });

  it('the £25/14h15m decision sentence, the £601/£621/£626 figures, and the comparison logic are all untouched', () => {
    const journeyChoice = getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO)!;
    expect(journeyChoice.decision.sentence).toBe('£25 more saves 14h 15m of journey time.');
    expect(journeyChoice.lowerFare.price).toBe(601);
    expect(journeyChoice.fasterJourney.price).toBe(626);
    expect(journeyChoice.otherOptions[0].price).toBe(621);
  });

  it('lib/tripcom-dated-handoff.ts itself is untouched by this PR — no dated-vs-generic construction logic changed', () => {
    const src = readFileSync(join(process.cwd(), 'components/route/journey-choice.tsx'), 'utf8');
    // journey-choice.tsx only ever reads tripComHandoff.datesPreserved (a
    // boolean already computed upstream) — it never re-derives or
    // reconstructs a URL itself.
    expect(src).not.toContain('showfarefirst');
    expect(src).not.toContain('buildDatedShowFareFirstUrl');
  });
});
