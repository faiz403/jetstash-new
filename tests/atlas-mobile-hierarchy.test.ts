import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Astra product review, 11 Sept 2026 — Mobile Atlas hierarchy.
 *
 * Finding (original): on mobile the Route Atlas rendered the compact
 * selected-route answer AFTER the entire map block (SVG + swipe hint +
 * mobile chip rows + legend + footnote), because the two-column desktop
 * grid collapses to a single stacked column below `lg`, and the answer
 * panel was the grid's *second* DOM child. A mobile visitor had to scroll
 * past the whole map to see the answer for whatever they'd already
 * selected.
 *
 * Correction (founder follow-up, same day): the first pass moved the
 * answer above the map, but left the country/destination chip selector —
 * the actual mobile controls — nested inside the map block, so the real
 * mobile order was still answer -> controls -> map, not the agreed
 * controls -> answer -> map. Fixed by also relocating the chip-selector
 * JSX (unchanged, still sm:hidden, still the same handlers) to be the
 * grid's first DOM child, ahead of the answer panel.
 *
 * Final mobile source order asserted below: chip-selector controls, then
 * the selected-route answer panel, then the map wrapper. No `order` class
 * at the base breakpoint, so mobile's stack is governed purely by this DOM
 * order (visual order = DOM order = focus order). Desktop's existing
 * two-column visual layout (map wide-left, answer narrow-right) is
 * restored purely via `lg:order-1` (map) / `lg:order-2` (answer) — CSS
 * Grid's `order` property affects auto-placement, so at `lg:` and above
 * the columns land exactly where they did before this change. The chip
 * selector stays `sm:hidden` (display:none from `sm` upward), so it takes
 * no grid track and is never reachable by Tab on desktop/tablet regardless
 * of where it sits in the DOM — its relocation has no desktop effect.
 *
 * Explicitly NOT part of this fix, and asserted below so a future edit
 * can't accidentally reintroduce them: no new swipe/drag hint, no hand
 * animation, no second instruction line, no onboarding overlay, no
 * duplicate controls, no duplicate answer panel, no change to
 * route/fare/destination data or its derivation.
 */

const atlasSrc = readFileSync(join(process.cwd(), 'components/founder/atlas-feel-test.tsx'), 'utf8');

describe('Mobile Atlas hierarchy: controls precede the answer, which precedes the map, in source', () => {
  it('the grid opens, then the chip-selector controls, then the selected-route answer panel, then the map wrapper — in that order', () => {
    const gridIndex = atlasSrc.indexOf('lg:grid-cols-[minmax(0,1fr)_22rem]');
    const controlsIndex = atlasSrc.indexOf('aria-label="Choose a country"', gridIndex);
    const answerIndex = atlasSrc.indexOf('{activeDest && (', gridIndex);
    const mapWrapperIndex = atlasSrc.indexOf('<div className="min-w-0 lg:order-1">', gridIndex);

    expect(gridIndex).toBeGreaterThan(-1);
    expect(controlsIndex).toBeGreaterThan(gridIndex);
    expect(answerIndex).toBeGreaterThan(controlsIndex);
    expect(mapWrapperIndex).toBeGreaterThan(answerIndex);
  });

  it('there is exactly one country chip selector and one destination chip selector — no duplication from the move', () => {
    expect(atlasSrc.match(/aria-label="Choose a country"/g) ?? []).toHaveLength(1);
    expect(atlasSrc.match(/aria-label=\{`Choose a destination in/g) ?? []).toHaveLength(1);
  });

  it('there is exactly one selected-route answer panel — no duplication from the move', () => {
    const occurrences = atlasSrc.match(/aria-live="polite"/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });

  it('the chip selector stays sm:hidden, so its relocation has no effect on desktop/tablet layout or tab order', () => {
    const start = atlasSrc.indexOf('aria-label="Choose a country"', atlasSrc.indexOf('lg:grid-cols-[minmax(0,1fr)_22rem]'));
    const wrapperOpenIdx = atlasSrc.lastIndexOf('<div className="flex flex-col gap-2 sm:hidden">', start);
    expect(wrapperOpenIdx).toBeGreaterThan(-1);
  });

  it('applies lg:order classes so desktop keeps its existing visual column arrangement (map left, answer right)', () => {
    expect(atlasSrc).toMatch(/aria-live="polite"[\s\S]{0,1200}?lg:order-2/);
    expect(atlasSrc).toContain('<div className="min-w-0 lg:order-1">');
  });

  it('applies no `order` class at the base (mobile) breakpoint — mobile relies purely on DOM order', () => {
    const answerClassName = atlasSrc.match(/className=\{`([^`]*?)\$\{mobileRevealed[^`]*`\}/)?.[1] ?? '';
    // Only the lg: variant carries order-2; nothing unprefixed sets `order`.
    expect(answerClassName).not.toMatch(/(?<!lg:)\border-\d/);
    expect(answerClassName).toContain('lg:order-2');
  });
});

describe('Mobile Atlas hierarchy: no new interaction hint was added', () => {
  it('the existing swipe cue is still the only mobile map hint, unmodified', () => {
    expect(atlasSrc).toContain('Swipe across the map to explore more destinations');
    const hintOccurrences = atlasSrc.match(/Swipe across the map to explore more destinations/g) ?? [];
    expect(hintOccurrences).toHaveLength(1);
  });

  it('introduces no hand/drag/swipe animation, onboarding overlay, or extra instruction copy', () => {
    expect(atlasSrc).not.toMatch(/hand-?(cue|hint|icon|animation)/i);
    expect(atlasSrc).not.toContain('onboarding');
    expect(atlasSrc.match(/aria-live="polite"/g) ?? []).toHaveLength(1);
  });
});

describe('Mobile Atlas hierarchy: chip-selector controls are unchanged, only relocated', () => {
  it('the country chips still call the same activateCountry handler used by the desktop map', () => {
    expect(atlasSrc).toContain('onClick={() => activateCountry(c.slug)}');
    expect(atlasSrc).toContain('key={`country-chip-${c.slug}`}');
  });

  it('the destination chips still call the same selectDestination handler used by the desktop map', () => {
    expect(atlasSrc).toContain('onClick={() => selectDestination(d.slug)}');
    expect(atlasSrc).toContain('key={`dest-chip-${d.slug}`}');
  });

  it('both chip rows keep their accessible group semantics', () => {
    expect(atlasSrc).toContain('role="group" aria-label="Choose a country"');
    expect(atlasSrc).toMatch(/role="group" aria-label=\{`Choose a destination in \$\{activeCountry\.label\}`\}/);
  });
});

describe('Mobile Atlas hierarchy: existing answer-panel content and behaviour are unchanged, only relocated', () => {
  it('progressive disclosure (mobileRevealed hidden/shown via className, not unmount) is preserved', () => {
    expect(atlasSrc).toMatch(/\$\{mobileRevealed \? '' : 'hidden'\}/);
  });

  it('the panel still reads eyebrow, title, intelligence status, verdict/detail/flightTime, and CTA footer, in that order', () => {
    const start = atlasSrc.indexOf('{activeDest && (');
    const end = atlasSrc.indexOf('<div className="min-w-0 lg:order-1">');
    const panel = atlasSrc.slice(start, end);

    const eyebrowIdx = panel.indexOf('{airportName} → {activeDest.label}');
    const titleIdx = panel.indexOf('<h3 className="font-display text-2xl leading-tight text-sand-50">{activeDest.label}</h3>');
    const verdictIdx = panel.indexOf('Route intelligence');
    const ctaIdx = panel.indexOf('Explore destination');

    expect(eyebrowIdx).toBeGreaterThan(-1);
    expect(titleIdx).toBeGreaterThan(eyebrowIdx);
    expect(verdictIdx).toBeGreaterThan(titleIdx);
    expect(ctaIdx).toBeGreaterThan(verdictIdx);
  });

  it('still fires the pre-existing atlas_route_opened analytics event, unaltered', () => {
    expect(atlasSrc).toContain("track('atlas_route_opened', { route: activeDest.routeHref!.split('/').pop()! })");
  });

  it('renders no new fare, recommendation, or scoring logic — same fields as before the move', () => {
    expect(atlasSrc).toContain('activeDest.intelligenceLevel');
    expect(atlasSrc).toContain('activeDest.verdict');
    expect(atlasSrc).toContain('activeDest.detail');
    expect(atlasSrc).toContain('activeDest.flightTime');
    expect(atlasSrc).toContain('activeDest.serviceNotice');
    expect(atlasSrc).toContain('activeDest.networkNote');
  });
});
