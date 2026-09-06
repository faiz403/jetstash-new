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
    // PR #233 product-acceptance correction: "Your journey option" renamed
    // to a neutral "Recorded example" label, with the observation's
    // "Recorded"/"Checked" date shown explicitly rather than folded into
    // one "a recent check JetStash logged" sentence.
    // Strip JSX comments first — the source legitimately documents the OLD
    // label name in a code comment explaining the rename; only the actual
    // rendered-copy strings matter for this check.
    const srcWithoutComments = componentSrc.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    expect(srcWithoutComments).toContain('Recorded example');
    expect(srcWithoutComments).not.toContain('Your journey option');
    expect(srcWithoutComments).not.toMatch(/\brecommended\b|\bbest\b|\bcurrent option\b|\bdeal\b/i);
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

describe('PR #233 final product-acceptance fix: an open Travel Ready caution stays visible beside the primary action', () => {
  it('renders the reminder from nextAction.openDocumentTask (never a second, hand-written sentence), gated so it only ever appears alongside the search-current-options primary action', () => {
    expect(componentSrc).toContain('nextAction.openDocumentTask');
    expect(componentSrc).toContain('Still open:');
    // Gated inside the same 'search-current-options' branch, never rendered
    // for check-travel-ready (which already IS the Travel Ready action) or
    // enter-travel-details (no signal exists yet to remind about).
    const reminderIdx = componentSrc.indexOf('Still open:');
    const nearestKindCheck = componentSrc.lastIndexOf("nextAction.kind === 'search-current-options'", reminderIdx);
    expect(nearestKindCheck).toBeGreaterThan(-1);
  });

  it('the reminder appears before the Trip.com CTA in source order — seen on the way to the action, not after it', () => {
    const reminderIdx = componentSrc.indexOf('Still open:');
    const ctaIdx = componentSrc.indexOf('Search on Trip.com');
    expect(reminderIdx).toBeLessThan(ctaIdx);
  });

  it('the reminder text is never invented independently — it comes verbatim from the SAME travelReadySignal already rendered in the Entry Readiness section above, not a second copy', () => {
    // Only one place in the component hand-authors Travel Ready copy: the
    // travelReadyResult.headline/nextAction/disclaimer rendered in section
    // 4. Section 5's reminder must reuse the engine's own signal label,
    // never a parallel hardcoded sentence.
    expect(componentSrc).not.toMatch(/Still open:.*['"][A-Za-z]/);
  });
});

describe('PR #233 product-acceptance correction — Finding 1: no functional dead end', () => {
  it('an "Edit journey details" action exists in the result card header, wired to a real onClick handler that returns to the entry stage — never a plain anchor to a non-existent form', () => {
    const srcWithoutComments = componentSrc.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    expect(srcWithoutComments).toContain('Edit journey details');
    expect(srcWithoutComments).toContain('onClick={editJourneyDetails}');
  });

  it('the "Add travel dates and passport details above" enter-travel-details action is a real <button> calling the same editJourneyDetails handler, not the old dead anchor to "#jb-readiness-heading"', () => {
    const enterDetailsBlockStart = componentSrc.indexOf("nextAction.kind === 'enter-travel-details'");
    const enterDetailsBlock = componentSrc.slice(enterDetailsBlockStart, enterDetailsBlockStart + 400);
    expect(enterDetailsBlock).toContain('<button');
    expect(enterDetailsBlock).toContain('onClick={editJourneyDetails}');
    expect(enterDetailsBlock).not.toContain('href="#jb-readiness-heading"');
  });

  it('editJourneyDetails() switches stage back to entry and requests focus on the first field — the same state the previously-entered form values already live in, never cleared by a stage change', () => {
    const fnStart = componentSrc.indexOf('function editJourneyDetails()');
    const fnBody = componentSrc.slice(fnStart, fnStart + 200);
    expect(fnBody).toContain("setStage('entry')");
    expect(fnBody).toContain('setFocusEntryOnReturn(true)');
    // No new state is introduced for the form fields themselves — the
    // existing useState calls (airportSlug, departureDate, etc.) are
    // untouched by this fix, which is exactly why returning to 'entry'
    // preserves them for free.
    expect(componentSrc).not.toMatch(/setAirportSlug\(''\)|setDepartureDate\(''\)|setArrivalDate\(''\)|setReturnDate\(''\)/);
  });
});

describe('PR #233 product-acceptance correction — Finding 2: "What remains unconfirmed" is a first-class answer', () => {
  it('renders as its own labelled section, reusing getManchesterMumbaiUnconfirmedItems() rather than a hand-written list', () => {
    const srcWithoutComments = componentSrc.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    expect(srcWithoutComments).toContain('What remains unconfirmed');
    expect(componentSrc).toContain('getManchesterMumbaiUnconfirmedItems({ evidencedOption, hasCurrentFareSignal })');
    expect(componentSrc).toContain('NO_UNCONFIRMED_ITEMS_COPY');
  });

  it('appears after "What you could miss" and before Travel Ready in source order, matching the locked six-answer hierarchy', () => {
    const missIdx = componentSrc.indexOf('What you could miss');
    const unconfirmedIdx = componentSrc.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').indexOf('What remains unconfirmed');
    const readinessIdx = componentSrc.indexOf('Entry readiness');
    expect(missIdx).toBeLessThan(unconfirmedIdx);
    expect(unconfirmedIdx).toBeLessThan(readinessIdx);
  });
});

describe('PR #233 product-acceptance correction — Finding 3: specific decisive facts, self-transfer explanation, no-false-drama state', () => {
  it('uses formatWhatYouCouldMiss() rather than rendering journeyConsequences directly, and shows the bounded self-transfer explanation only alongside a genuine self-transfer flag', () => {
    expect(componentSrc).toContain('formatWhatYouCouldMiss(evidencedOption)');
    expect(componentSrc).toContain('SELF_TRANSFER_EXPLANATION');
    expect(componentSrc).toContain("evidencedOption.journeyConsequences.includes('Self-transfer')");
  });

  it('renders the honest "no material issue" sentence via hasNoMaterialConsequence(), never an empty section masquerading as "nothing to report"', () => {
    expect(componentSrc).toContain('hasNoMaterialConsequence(evidencedOption)');
    expect(componentSrc).toContain('NO_MATERIAL_CONSEQUENCE_COPY');
  });
});

describe('PR #233 product-acceptance correction — Finding 4: no endorsement language for the recorded example', () => {
  it('the recorded example shows its own travel dates distinctly from the date it was checked/recorded', () => {
    expect(componentSrc).toContain('evidencedOption.departureDate && evidencedOption.returnDate');
    expect(componentSrc).toMatch(/For travel \{formatChecked\(evidencedOption\.departureDate\)\}/);
    expect(componentSrc).toMatch(/\{evidencedOption\.isCurrentRepresentativeFare \? 'Checked' : 'Recorded'\}/);
  });
});

describe('PR #233 product-acceptance correction — Finding 5: fresh search distinguished from the recorded example, verification sequence explicit', () => {
  it('the Trip.com CTA carries the founder-approved supporting verification sentence, distinct from the affiliate disclosure', () => {
    expect(componentSrc).toContain('VERIFY_BEFORE_PAYING_COPY');
    const ctaBlockStart = componentSrc.indexOf("nextAction.kind === 'search-current-options' && tripComUrl");
    const ctaBlock = componentSrc.slice(ctaBlockStart, ctaBlockStart + 1500);
    expect(ctaBlock).toContain('VERIFY_BEFORE_PAYING_COPY');
    expect(ctaBlock).toContain('AffiliateLinkDisclosure');
  });
});

describe('Result-viewport fix (6 Sept 2026): the entry->result transition deliberately lands the reader at the result, not wherever scrollY happened to be', () => {
  it('a scroll ref on the result card and a focus ref on its heading both exist and are wired to the actual DOM elements', () => {
    expect(componentSrc).toContain('ref={resultSectionRef}');
    expect(componentSrc).toContain('ref={resultHeadingRef}');
    // The scroll target is the card itself (starts with the "Journey
    // Brief" eyebrow + heading), not some other element — confirmed by the
    // ref sitting on the same div that also carries the card's own
    // distinctive styling.
    expect(componentSrc).toMatch(/ref=\{resultSectionRef\}\s+className="max-w-2xl rounded-md border border-ink-200 bg-sand-50/);
  });

  it('the heading is programmatically focusable (tabIndex={-1}) without joining the normal Tab order', () => {
    expect(componentSrc).toMatch(/ref=\{resultHeadingRef\}\s+id="jb-heading"\s+tabIndex=\{-1\}/);
  });

  it('runs in a useEffect keyed on `stage` — after React commits the result render, never synchronously inside handleSubmit where the target wouldn\'t exist yet', () => {
    const submitFnStart = componentSrc.indexOf('function handleSubmit');
    const submitFnBody = componentSrc.slice(submitFnStart, submitFnStart + 400);
    expect(submitFnBody).not.toMatch(/scrollIntoView|resultHeadingRef|resultSectionRef/);

    const effectStart = componentSrc.indexOf("if (stage === 'result') {");
    const effectBody = componentSrc.slice(effectStart, effectStart + 800);
    expect(effectBody).toContain('resultSectionRef.current?.scrollIntoView');
    expect(effectBody).toContain("resultHeadingRef.current?.focus({ preventScroll: true })");
    // Confirms this specific scroll/focus call sits inside a useEffect (not
    // the click handler) by checking the nearest preceding useEffect(.
    const nearestUseEffect = componentSrc.lastIndexOf('useEffect(() => {', effectStart);
    expect(nearestUseEffect).toBeGreaterThan(-1);
    expect(nearestUseEffect).toBeLessThan(effectStart);
  });

  it('relies on the existing site-wide scroll-padding-top rule for sticky-header clearance, never a new offset calculation', () => {
    expect(componentSrc).not.toMatch(/scrollBy|getBoundingClientRect\(\).*header|headerHeight/i);
  });

  it('re-fires on every entry->result transition (dependency array is exactly [stage]), so resubmitting after "Edit journey details" gets the same treatment', () => {
    const effectStart = componentSrc.indexOf("if (stage === 'result') {");
    const depArrayEnd = componentSrc.indexOf('}, [stage]);', effectStart);
    expect(depArrayEnd).toBeGreaterThan(effectStart);
    expect(depArrayEnd - effectStart).toBeLessThan(800);
  });
});
