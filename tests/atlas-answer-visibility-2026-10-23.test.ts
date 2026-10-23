import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getAnswerScrollBlock, getAnswerScrollSource } from '@/lib/atlas-answer-scroll';

const atlas = readFileSync(join(process.cwd(), 'components/founder/atlas-feel-test.tsx'), 'utf8');
const norm = atlas.replace(/\r\n/g, '\n');

const target = (over: Partial<Parameters<typeof getAnswerScrollSource>[0]>) =>
  getAnswerScrollSource({ event: 'click', controlTag: 'button', isRoleButton: false, isCountryLabel: false, insideMapStrip: false, insideChipGroup: true, ...over });

describe('getAnswerScrollSource: which interactions count as an explicit activation', () => {
  it('a click on a chip button counts (chip source)', () => {
    expect(target({})).toBe('chip');
  });
  it('a click on an SVG role=button control or a country label inside the map counts (map source)', () => {
    expect(target({ controlTag: 'circle', isRoleButton: true, insideMapStrip: true, insideChipGroup: false })).toBe('map');
    expect(target({ controlTag: 'text', isCountryLabel: true, insideMapStrip: true, insideChipGroup: false })).toBe('map');
  });
  it('Enter/Space on an SVG control counts, but keydown on a native button is ignored (its own click activates it)', () => {
    expect(target({ event: 'keydown', controlTag: 'circle', isRoleButton: true, insideMapStrip: true, insideChipGroup: false })).toBe('map');
    expect(target({ event: 'keydown' })).toBeNull();
    expect(target({ event: 'keydown', insideMapStrip: true, insideChipGroup: false })).toBeNull();
  });
  it('anything else never counts: background press or swipe target, airport pills, unrelated controls, no control', () => {
    expect(target({ controlTag: 'svg', insideMapStrip: true, insideChipGroup: false })).toBeNull();
    // inert SVG text (e.g. the departure-airport label) never counts; only a marked country label does
    expect(target({ controlTag: 'text', isCountryLabel: false, insideMapStrip: true, insideChipGroup: false })).toBeNull();
    expect(target({ controlTag: 'path', insideMapStrip: true, insideChipGroup: false })).toBeNull();
    expect(target({ insideChipGroup: false })).toBeNull(); // airport pill: a button outside the map and chip groups
    expect(target({ controlTag: null })).toBeNull();
    expect(target({ controlTag: 'a', insideChipGroup: false })).toBeNull();
  });
});

describe('getAnswerScrollBlock', () => {
  it('map taps always align the card top under the header', () => {
    expect(getAnswerScrollBlock({ source: 'map', cardHeight: 300, viewportHeight: 844 })).toBe('start');
  });
  it('chip taps scroll the minimum for a card that fits', () => {
    expect(getAnswerScrollBlock({ source: 'chip', cardHeight: 326, viewportHeight: 568 })).toBe('nearest');
    expect(getAnswerScrollBlock({ source: 'chip', cardHeight: 307, viewportHeight: 844 })).toBe('nearest');
  });
  it('chip taps align the top for a card taller than the visible area (nearest would do nothing)', () => {
    expect(getAnswerScrollBlock({ source: 'chip', cardHeight: 1332, viewportHeight: 844 })).toBe('start');
    expect(getAnswerScrollBlock({ source: 'chip', cardHeight: 440, viewportHeight: 568 })).toBe('start');
  });
});

describe('Atlas wiring (source-level; the event sequences are covered by the real-browser evidence in the PR)', () => {
  it('requests are raised in the bubble phase from click and Enter/Space only, never capture, pointerdown, hover or focus', () => {
    expect(norm).toContain("onClick={(e) => requestAnswerScroll(e, 'click')}");
    expect(norm).toContain("if (e.key === 'Enter' || e.key === ' ') requestAnswerScroll(e, 'keydown');");
    expect(norm).not.toContain('onClickCapture={(e) => requestAnswerScroll');
    expect(norm).not.toContain('onKeyDownCapture');
    expect(norm).not.toContain('onPointerDownCapture');
    expect(norm).not.toMatch(/onMouseEnterCapture|onPointerEnterCapture|onFocusCapture/);
    expect(norm).toContain("t.closest('button, [role=\"button\"], text[data-atlas-country-label]')");
    expect((norm.match(/data-atlas-country-label="true"/g) ?? []).length).toBe(1);
    expect(norm).toContain('setAnswerScrollRequest((n) => n + 1)');
    expect(norm).not.toContain('Date.now() - d.at');
  });

  it('each request is handled exactly once; lg+ never scrolls; a hidden card (country tap) scrolls only the hint, only from the map', () => {
    const effect = norm.slice(norm.indexOf('if (answerScrollRequest === 0'), norm.indexOf('const activeCountry = countries.find'));
    expect(effect).toContain('answerScrollHandledRef.current === answerScrollRequest');
    expect(effect).toContain('answerScrollHandledRef.current = answerScrollRequest;');
    expect(effect).toContain("window.matchMedia('(min-width: 1024px)').matches");
    expect(effect).toContain('if (!mobileRevealed) {');
    expect(effect).toContain("if (answerScrollSourceRef.current === 'map') hintRef.current?.scrollIntoView");
    expect(effect).toContain('getAnswerScrollBlock(');
    expect(effect).toContain("behavior: reduce ? 'auto' : 'smooth'");
    expect(effect).toContain('[answerScrollRequest, mobileRevealed]');
  });

  it('relies on the global sticky-header scroll padding rather than stacking its own scroll margin', () => {
    expect(norm).not.toContain('scroll-mt-24 ${mobileRevealed');
    expect(norm).toContain('ref={answerRef}');
    expect(readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')).toMatch(/scroll-padding-top: 6rem;/);
  });

  it('the country-tap next step sits in the answer card slot, directly above the map, and is hidden from lg up', () => {
    const answer = norm.indexOf('ref={answerRef}');
    const hint = norm.indexOf('Tap a destination in {activeCountry.label} to see its route.');
    const map = norm.indexOf('<div className="min-w-0 lg:order-1">');
    expect(answer).toBeGreaterThan(-1);
    expect(hint).toBeGreaterThan(answer);
    expect(map).toBeGreaterThan(hint);
    expect(norm).toContain('<p ref={hintRef} className="min-w-0 text-[13px] leading-snug text-ink-300 lg:hidden">Tap a destination in');
    expect(norm).toContain('{!mobileRevealed && (');
  });

  it('unchanged: one aria-live answer panel, lg always shows it, selection handlers and map panning are untouched', () => {
    expect((norm.match(/aria-live="polite"/g) ?? []).length).toBe(1);
    expect(norm).toContain('lg:order-2 lg:sticky lg:top-6 lg:block');
    expect(norm).toContain('onClick={() => selectDestination(d.slug)}');
    expect(norm).toContain('onMouseEnter={() => selectDestination(d.slug)}');
    expect(norm).toContain('onClickCapture={() => panMapTo(d.x)}');
  });
});
