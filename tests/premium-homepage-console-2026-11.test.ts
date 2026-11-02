import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Ivory journey console (PR #353, November 2026). The console card is a light
 * surface inside the bg-ink-900 hero, so the global dark-section focus rule
 * would otherwise give it a light brass ring on ivory (about 1.9:1).
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const css = read('app/globals.css');
const hero = read('components/homepage-v2/homepage-opening-hero.tsx');
const form = read('components/homepage-v2/journey-check-form.tsx');

describe('ivory journey console', () => {
  it('restores the ink focus ring on the light card, after the dark-section rule it overrides', () => {
    const dark = css.indexOf("outline-color: theme('colors.brass.300');");
    const light = css.indexOf('.light-surface :focus-visible');
    expect(dark).toBeGreaterThan(-1);
    expect(light).toBeGreaterThan(dark);
    expect(hero).toMatch(/className="light-surface [^"]*bg-sand-50/);
  });

  it('styles the console through tokens in its own components, not structural #your-journey selectors', () => {
    expect(css).not.toContain('#your-journey');
    expect(form).toContain('pb-select pb-select-light');
    expect(form).toContain('aria-[invalid=true]:border-terracotta-600');
  });
});
