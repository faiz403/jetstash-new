import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JourneyBriefManchesterMumbai } from '@/components/journey-brief/journey-brief-manchester-mumbai';

/**
 * Journey Brief Phase 1 — Manchester → Mumbai, component-level regression
 * (5 Sept 2026). This component is entirely 'use client' with useState-
 * driven stage transitions and no testing-library/jsdom in this repo (see
 * every other interactive-component test file for the same convention) —
 * so the entry (default) stage is verified by rendering it directly via
 * renderToStaticMarkup, and the 'result' stage's structural properties
 * (mobile-first DOM order, no fabricated claims, honest CTA wording) are
 * verified against the component's own source text, since JSX source order
 * IS DOM order for this file's unconditionally-ordered layout (nothing here
 * reorders sections at runtime based on state).
 */

const componentSrc = readFileSync(
  join(process.cwd(), 'components/journey-brief/journey-brief-manchester-mumbai.tsx'),
  'utf8'
);

describe('Entry stage renders cleanly (default state, hooks-safe via createElement)', () => {
  const html = renderToStaticMarkup(createElement(JourneyBriefManchesterMumbai)).replace(/\s+/g, ' ');

  it('shows the entry form, not the result view, before any submission', () => {
    expect(html).toContain('Build my Journey Brief');
    expect(html).not.toContain('What you could miss');
  });

  it('never claims the ended direct service currently operates, even in the hero copy', () => {
    expect(html.toLowerCase()).not.toMatch(/operates this route direct/);
  });
});

describe('Mobile-first DOM order: the core decision comes before deep research detail', () => {
  // These are the exact eyebrow/heading strings the five-answer sections
  // render, in the order they must appear in markup for a mobile reader
  // scrolling top-to-bottom to reach the decision before the methodology.
  const routeRealityIdx = componentSrc.indexOf('Route reality');
  const journeyOptionIdx = componentSrc.indexOf('Your journey option');
  const missIdx = componentSrc.indexOf('What you could miss');
  const methodologyIdx = componentSrc.indexOf('How JetStash checked this');
  const readinessIdx = componentSrc.indexOf('Entry readiness');
  const nextActionIdx = componentSrc.indexOf('What to do next');

  it('all five answers are present in source', () => {
    expect(routeRealityIdx).toBeGreaterThan(-1);
    expect(journeyOptionIdx).toBeGreaterThan(-1);
    expect(missIdx).toBeGreaterThan(-1);
    expect(readinessIdx).toBeGreaterThan(-1);
    expect(nextActionIdx).toBeGreaterThan(-1);
  });

  it('Route reality, then the journey option, then the decisive consequence appear in that exact order', () => {
    expect(routeRealityIdx).toBeLessThan(journeyOptionIdx);
    expect(journeyOptionIdx).toBeLessThan(missIdx);
  });

  it('Route reality\'s own methodology/citations sit inside a collapsed <details> immediately beneath its own always-visible headline — never a blocking source dump before the answer', () => {
    expect(methodologyIdx).toBeGreaterThan(routeRealityIdx);
    const between = componentSrc.slice(routeRealityIdx, methodologyIdx + 200);
    expect(between).toContain('<details');
    expect(between).toContain('<summary');
    // The always-visible route-reality sentence (presentation.summary) is
    // rendered as plain text OUTSIDE the <details>, before its summary line
    // — the reader sees the answer first without opening anything.
    const detailsOpenIdx = componentSrc.indexOf('<details', routeRealityIdx);
    expect(componentSrc.indexOf('routeReality.headline')).toBeLessThan(detailsOpenIdx);
  });

  it('entry readiness and the primary next action come after the core brief, not before it', () => {
    expect(missIdx).toBeLessThan(readinessIdx);
    expect(readinessIdx).toBeLessThan(nextActionIdx);
  });
});

describe('No fabricated facts in the rendered copy', () => {
  it('never states a £0 or "included" baggage claim — this route has no verified baggage evidence at all', () => {
    expect(componentSrc).not.toMatch(/baggage.{0,20}included/i);
    expect(componentSrc).not.toMatch(/£0.{0,20}baggage/i);
  });

  it('never invents a pseudo-precision score (journey score, risk score, confidence percentage)', () => {
    expect(componentSrc.toLowerCase()).not.toMatch(/journey score|risk score|confidence \d|\bAI recommend/);
  });

  it('the historical fallback option is explicitly framed as a past check, never as "today\'s price" or a live claim', () => {
    expect(componentSrc).toContain('a recent check JetStash logged');
    // Apostrophe rendered as &apos; in JSX text (this codebase's lint rule
    // for unescaped entities) — matched either side of it rather than as
    // one literal string.
    expect(componentSrc).toContain('JetStash doesn');
    expect(componentSrc).toContain('currently track a live representative fare for this route');
  });
});

describe('Travel Ready reuses the existing evaluator, never a second visa/passport rule engine', () => {
  it('imports evaluateTravelReadiness from the canonical lib/travel-ready-check.ts, and defines no country/visa rule of its own', () => {
    expect(componentSrc).toContain("from '@/lib/travel-ready-check'");
    expect(componentSrc).not.toMatch(/visaRequired|stayLimit|passport.{0,10}valid.{0,10}(month|day)s?\s*[:=]/i);
  });

  it('links to the full standalone Travel Ready Check rather than duplicating its entire form', () => {
    expect(componentSrc).toContain('/travel-ready-check');
  });
});

describe('Journey consequences reuse the shared PR #232 module, never a re-implementation', () => {
  it('reads journeyConsequences off the assembled brief\'s evidencedOption, never recomputes extraction logic locally', () => {
    expect(componentSrc).not.toMatch(/GROUND_TRANSFER_PATTERN|LONG_LAYOVER_PATTERN|extractLegDuration/);
    expect(componentSrc).toContain('evidencedOption.journeyConsequences');
  });
});

describe('Partner CTA is honest about live availability', () => {
  it('the Trip.com CTA only ever renders under the search-current-options next action, alongside the affiliate disclosure', () => {
    const ctaBlock = componentSrc.slice(
      componentSrc.indexOf("nextAction.kind === 'search-current-options'"),
      componentSrc.indexOf("nextAction.kind === 'check-travel-ready'")
    );
    expect(ctaBlock).toContain('AffiliateLinkDisclosure');
    expect(ctaBlock).toContain('Check the itinerary, baggage allowance and booking terms before paying.');
  });
});

describe('Trip.com URL construction is untouched', () => {
  it('the component never constructs a Trip.com URL itself — it only renders tripComUrl exactly as the assembled brief supplies it', () => {
    expect(componentSrc).not.toMatch(/trip\.com\/flights/);
    expect(componentSrc).not.toContain('Allianceid');
  });
});
