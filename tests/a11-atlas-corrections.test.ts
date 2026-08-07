import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * A11 accessibility corrections (docs/project-control/LAUNCH_CHECKLIST.md,
 * A11) — four verified findings from the production axe-core/keyboard/
 * screen-reader pass:
 *
 *  1. The Atlas SVG had role="img" while containing real, focusable
 *     role="button" country/destination controls — an invalid
 *     nested-interactive ARIA structure (WCAG 4.1.2). Fixed by changing the
 *     SVG's own role to "group" (a container role that doesn't hide or
 *     override its children's roles/names the way role="img" does),
 *     without touching any interaction behaviour.
 *  2. text-ink-400 (~4.14:1) and text-ink-500 (~2.28:1) fell short of
 *     WCAG AA (4.5:1) against the Atlas's dark surfaces (bg-ink-950 header/
 *     legend, bg-ink-900/90 destination panel). Fixed by moving those
 *     specific dark-surface usages to text-ink-300, the token this
 *     codebase had already established elsewhere as proven-readable on
 *     these exact backgrounds (see homepage-opening-hero.tsx's own doc
 *     comment) — not a new token, not a global Tailwind config change.
 *  3. TravellerTipList rendered each tip's title as <h4> directly under a
 *     parent <h2> section heading at every call site, skipping <h3>.
 *  4. The Atlas's desktop instruction read "Hover a country…", implying
 *     mouse-only interaction the map doesn't actually require — replaced
 *     with input-neutral wording.
 *
 * atlas-feel-test.tsx is a 'use client' component with hooks, so — matching
 * this repo's established pattern (tests/atlas-audit-fixes.test.ts) — these
 * are source-text regression assertions on the real component, not a
 * rendered one.
 */

const atlasSrc = readFileSync(join(process.cwd(), 'components/founder/atlas-feel-test.tsx'), 'utf8');
const tipListSrc = readFileSync(join(process.cwd(), 'components/route/traveller-tip-list.tsx'), 'utf8');

describe('1. Atlas SVG semantics — no invalid nested-interactive role="img"', () => {
  const svgOpenTag = atlasSrc.match(/<svg viewBox="418 230 336 220"[\s\S]*?>/)?.[0] ?? '';

  it('the SVG root no longer carries role="img"', () => {
    expect(svgOpenTag).not.toMatch(/role="img"/);
  });

  it('the SVG root carries role="group" with a concise accessible label instead', () => {
    expect(svgOpenTag).toMatch(/role="group"/);
    expect(svgOpenTag).toContain('aria-label={`${airportName}');
  });

  it('the SVG is not aria-hidden — its focusable descendants remain in the accessibility tree', () => {
    expect(svgOpenTag).not.toMatch(/aria-hidden/);
  });

  it('country hit-circles remain role="button", keyboard-focusable and carry a meaningful accessible name', () => {
    const countryGroupSrc = atlasSrc.slice(atlasSrc.indexOf('{/* country nodes */}'), atlasSrc.indexOf('{/* destinations within the active country'));
    const countryCircleSrc = countryGroupSrc.match(/<circle\s+cx=\{c\.x\}\s+cy=\{c\.y\}\s+r=\{countryHitRadius[\s\S]*?\/>/)?.[0] ?? '';
    expect(countryCircleSrc).toMatch(/role="button"/);
    expect(countryCircleSrc).toMatch(/tabIndex=\{0\}/);
    expect(countryCircleSrc).toContain('aria-label={`${c.label} — ${colour.label}`}');
  });

  it('destination hit-circles remain role="button", keyboard-focusable and carry a meaningful accessible name', () => {
    const destGroupSrc = atlasSrc.slice(atlasSrc.indexOf('{/* destinations within the active country'), atlasSrc.indexOf('</svg>'));
    const destCircleSrc = destGroupSrc.match(/<circle\s+cx=\{d\.x\}\s+cy=\{d\.y\}\s+r=\{destHitRadius[\s\S]*?\/>/)?.[0] ?? '';
    expect(destCircleSrc).toMatch(/role="button"/);
    expect(destCircleSrc).toMatch(/tabIndex=\{0\}/);
    expect(destCircleSrc).toContain(
      "aria-label={`${d.label} — ${ROUTE_INTELLIGENCE_COLOUR[d.intelligenceLevel].label}${d.serviceNotice ? ' — active service notice' : ''}${d.networkMembership === 'seasonal' ? ' — seasonal service' : ''}`}"
    );
  });

  it('country and destination controls keep explicit Enter/Space keyboard activation, unchanged', () => {
    expect(atlasSrc).toMatch(/onKeyDown=\{\(e\) => \{\s*if \(e\.key === 'Enter' \|\| e\.key === ' '\) \{\s*e\.preventDefault\(\);\s*activateCountry\(c\.slug\);\s*\}\s*\}\}/);
    expect(atlasSrc).toMatch(/onKeyDown=\{\(e\) => \{\s*if \(e\.key === 'Enter' \|\| e\.key === ' '\) \{\s*e\.preventDefault\(\);\s*selectDestination\(d\.slug\);\s*\}\s*\}\}/);
  });

  it('focus-visible outline styling on both hit-circles is unchanged', () => {
    expect(atlasSrc.match(/focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-\[#C8932E\]/g) ?? []).toHaveLength(2);
  });

  it('no focusable element exists beneath any aria-hidden node in the Atlas — the decorative labels stay non-interactive', () => {
    // The two decorative <text> labels (country name, destination name) are
    // the only aria-hidden elements in the SVG; neither carries tabIndex or
    // role, and pointer handlers on them exist only for cursor precision
    // over the glyphs, never for keyboard interaction.
    const ariaHiddenTextBlocks = atlasSrc.match(/<text[^>]*aria-hidden="true"[\s\S]*?<\/text>/g) ?? [];
    expect(ariaHiddenTextBlocks.length).toBeGreaterThan(0);
    for (const block of ariaHiddenTextBlocks) {
      expect(block).not.toMatch(/tabIndex/);
      expect(block).not.toMatch(/role="button"/);
    }
  });

  it('the mobile swipe-cue div (the one other aria-hidden node in this file) carries no interactive role or tabIndex either', () => {
    const swipeCueDiv = atlasSrc.match(/<div\s+aria-hidden="true"[\s\S]*?\/>/)?.[0] ?? '';
    expect(swipeCueDiv).not.toMatch(/tabIndex/);
    expect(swipeCueDiv).not.toMatch(/role="button"/);
  });

  it('the separate, redundant accessible "Choose a country" / "Choose a destination" mobile button groups are untouched', () => {
    expect(atlasSrc).toContain('role="group" aria-label="Choose a country"');
    expect(atlasSrc).toContain('role="group" aria-label={`Choose a destination in ${activeCountry.label}`}');
  });
});

describe('2. Dark-surface text contrast — Atlas moved off text-ink-400/text-ink-500', () => {
  it('no text-ink-400 usage remains anywhere in the Atlas component', () => {
    expect(atlasSrc).not.toMatch(/text-ink-400/);
  });

  it('no text-ink-500 usage remains anywhere in the Atlas component', () => {
    expect(atlasSrc).not.toMatch(/text-ink-500/);
  });

  it('the affected captions now use text-ink-300 — the token this codebase already established as proven-readable on these dark surfaces', () => {
    expect(atlasSrc).toContain('<p className="mt-1 text-xs text-ink-300">');
    expect(atlasSrc).toContain('<span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-300">Flying from</span>');
    expect(atlasSrc).toContain("Country coverage (this destination&apos;s whole country)");
    expect(atlasSrc).toMatch(/text-ink-300">Country coverage/);
    expect(atlasSrc).toMatch(/text-ink-300">Route intelligence \(this specific destination\)/);
  });

  it('the destination panel labels (Route intelligence, Network evidence, flight time, service-notice/network-note detail text) all use text-ink-300', () => {
    expect(atlasSrc).toMatch(/text-\[10px\] font-semibold uppercase tracking-\[0\.18em\] text-ink-300">Route intelligence</);
    expect(atlasSrc).toMatch(/text-\[10px\] font-semibold uppercase tracking-\[0\.18em\] text-ink-300">Network evidence</);
  });

  it('unrelated ink-400/ink-500 usage elsewhere in the codebase (e.g. light-background CommercialPaths copy) is untouched — this fix is targeted, not a global token change', () => {
    const homepageSectionsSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/homepage-sections.tsx'), 'utf8');
    expect(homepageSectionsSrc).toMatch(/text-ink-500/);
  });
});

describe('3. Route-page heading order — TravellerTipList corrected to h3', () => {
  it('each tip title now renders as h3, not h4', () => {
    expect(tipListSrc).toMatch(/<h3 className="mt-2\.5 font-display text-base text-ink-900">\{tip\.title\}<\/h3>/);
    expect(tipListSrc).not.toMatch(/<h4[^>]*>\{tip\.title\}/);
  });

  it('every call site renders TravellerTipList directly under its own h2 section heading, with no intervening h3 — confirming h3 is the correct next level', () => {
    const routePageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');
    const destPageSrc = readFileSync(join(process.cwd(), 'app/destinations/[slug]/page.tsx'), 'utf8');
    const airportPageSrc = readFileSync(join(process.cwd(), 'app/airports/[slug]/page.tsx'), 'utf8');
    for (const src of [routePageSrc, destPageSrc, airportPageSrc]) {
      expect(src).toContain('<TravellerTipList');
    }
    expect(routePageSrc).toMatch(/<h2[^>]*>Traveller tips for this route<\/h2>[\s\S]{0,300}<TravellerTipList/);
    expect(destPageSrc).toMatch(/<h2[^>]*>Traveller tips for \{dest\.city\}<\/h2>[\s\S]{0,300}<TravellerTipList/);
  });

  it('the airport page renders practicalNotes as h3 siblings alongside TravellerTipList — both lists now share the same heading level under their shared h2', () => {
    const airportPageSrc = readFileSync(join(process.cwd(), 'app/airports/[slug]/page.tsx'), 'utf8');
    expect(airportPageSrc).toMatch(/<h3[^>]*>\{note\.title\}<\/h3>/);
  });
});

describe('4. Atlas instruction wording — input-neutral', () => {
  it('the desktop instruction no longer says "Hover a country"', () => {
    expect(atlasSrc).not.toMatch(/Hover a country/);
  });

  it('the desktop instruction reads the input-neutral "Select a country to explore its destinations."', () => {
    expect(atlasSrc).toContain('Select a country to explore its destinations.');
  });

  it('the mobile instruction (already input-neutral) is unchanged', () => {
    expect(atlasSrc).toContain('Select a country, then a destination, to see its route.');
  });
});

describe('Unrelated Atlas behaviour is unchanged by this PR', () => {
  it('the geometry, hit-radius maths and crowding-avoidance system are untouched', () => {
    expect(atlasSrc).toContain('function computeSafeRadius(nearestDist: number, base: number, min: number, margin: number): number {');
  });

  it('analytics event names and dedup guards are untouched', () => {
    expect(atlasSrc).toContain("track('atlas_origin_selected', { airport: a.airportSlug });");
    expect(atlasSrc).toContain("track('atlas_destination_selected', { airport: selectedAirportSlug, destination: slug });");
    expect(atlasSrc).toContain("track('atlas_route_opened', { route: activeDest.routeHref!.split('/').pop()! })");
  });

  it('mobile chip selector buttons and swipe-cue copy are untouched', () => {
    expect(atlasSrc).toContain('Swipe to explore more routes');
    expect(atlasSrc).toContain("onClick={() => activateCountry(c.slug)}");
  });
});
