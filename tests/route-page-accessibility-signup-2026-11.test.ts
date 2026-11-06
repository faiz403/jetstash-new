import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwind = require('../tailwind.config.js') as { theme: { extend: { colors: Record<string, Record<string, string>> } } };

/**
 * Route-page accessibility and signup fixes (6 Nov 2026 mobile audit of live /routes/[slug]).
 *
 * Measured on Production: the "Flight time / Frequency / Airlines" facts and the WhatsApp share button used dark-hero colours on
 * the light "More route information" section (labels 2.45:1, values and button text 1.08:1), and the Route Watch (18px) and
 * Travel Club (21px) email fields collapsed on phones because `flex-1` sat inside a `flex-col`. Controls were also 14px, which makes
 * iOS Safari zoom the page on focus.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const routeStat = read('components/ui/route-stat.tsx');
const routePage = read('app/routes/[slug]/page.tsx');
const whatsapp = read('components/route/whatsapp-share-button.tsx');
const routeWatch = read('components/route/route-watch-form.tsx');
const newsletter = read('components/sections/newsletter-section.tsx');
const travelReady = read('components/travel-ready/travel-ready-check.tsx');

const colors = tailwind.theme.extend.colors;
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const token = (name: string) => {
  const [family, shade] = name.split('-');
  return colors[family][shade];
};

/** Every `className="..."` string in a source file that contains all the given substrings. */
const classNamesWith = (src: string, ...needles: string[]) =>
  [...src.matchAll(/className="([^"]*)"/g)].map((m) => m[1]).filter((c) => needles.every((n) => c.includes(n)));

/** The colour token in a class string, e.g. `text-ink-500` -> `#454B57`. */
const classColor = (classes: string, prefix: 'text' | 'bg') => {
  const m = classes.match(new RegExp(`(?:^|\\s)${prefix}-([a-z]+-\\d+)(?:\\s|$)`));
  expect(m, `no ${prefix}-* colour in "${classes}"`).not.toBeNull();
  return token(m![1]);
};
/** Blend `fg` at `alpha` over `bg` (hex strings). */
const blend = (fg: string, alpha: number, bg: string) => {
  const c = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [f, b] = [c(fg), c(bg)];
  return '#' + f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('');
};

describe('route facts are readable on the light section they sit in', () => {
  it('the section that renders them is a light surface, and the classes RouteStat actually renders pass WCAG AA on it', () => {
    expect(routePage).toMatch(/<section className="[^"]*bg-sand-50[^"]*" aria-labelledby="more-route-information-heading">/);
    expect(routePage).toContain('<RouteStat');
    const surface = token('sand-50');
    const code = routeStat.replace(/\/\*[\s\S]*?\*\//g, ''); // the explanatory comment names tokens too; only rendered classes count
    const label = code.match(/<p className="([^"]*)">\{label\}<\/p>/);
    const value = code.match(/<p className="([^"]*)">\{value\}<\/p>/);
    const icon = code.match(/<div className="([^"]*)">\{icon\}<\/div>/);
    expect(label && value && icon).toBeTruthy();
    expect(contrast(classColor(label![1], 'text'), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(classColor(value![1], 'text'), surface)).toBeGreaterThanOrEqual(4.5);
    // the icon is a non-text glyph on its own tile (bg-sand-200), WCAG 1.4.11 asks for 3:1
    expect(contrast(classColor(icon![1], 'text'), classColor(icon![1], 'bg'))).toBeGreaterThanOrEqual(3);
  });

  it('no longer uses the dark-hero palette that measured 2.45:1 (labels) and 1.08:1 (values)', () => {
    const code = routeStat.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toContain('text-ink-300');
    expect(code).not.toContain('text-sand-100');
    expect(code).not.toContain('bg-white/10');
    // and the old tokens really did fail on this surface, so the assertion above is not vacuous
    expect(contrast(token('ink-300'), token('sand-50'))).toBeLessThan(4.5);
    expect(contrast(token('sand-100'), token('sand-50'))).toBeLessThan(1.5);
  });
});

describe('WhatsApp share on the route page', () => {
  it('uses the light variant in the light section, and the light variant has dark text on a light surface', () => {
    expect(routePage).toMatch(/<WhatsAppShareButton[\s\S]*?source="route-hero"[\s\S]*?variant="light"[\s\S]*?\/>/);
    const light = whatsapp.match(/variant === 'light'\s*\?\s*'([^']*)'/);
    expect(light).not.toBeNull();
    expect(light![1]).toContain('text-ink-900');
    expect(light![1]).not.toContain('text-sand-100');
    expect(contrast(token('ink-900'), token('sand-50'))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps readable text on hover: the old green hover text (#128C4A on its 10% green tint) measured about 3.87:1', () => {
    const surface = token('sand-50');
    const hoverBg = blend('#25D366', 0.1, surface);
    expect(contrast('#128C4A', hoverBg)).toBeLessThan(4.5); // the regression this guards against
    const light = whatsapp.match(/variant === 'light'\s*\?\s*'([^']*)'/)![1];
    const hoverTexts = [...light.matchAll(/hover:text-(\[#[0-9a-fA-F]{6}\]|[a-z]+-\d+)/g)].map((m) => m[1]);
    for (const h of hoverTexts) {
      const hex = h.startsWith('[#') ? h.slice(1, -1) : token(h);
      expect(contrast(hex, hoverBg), `hover text ${h}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(hoverTexts).not.toContain('[#128C4A]');
    expect(contrast(token('ink-900'), hoverBg)).toBeGreaterThanOrEqual(4.5); // the dark text it keeps
  });

  it('keeps the dark variant for dark surfaces, unchanged', () => {
    expect(whatsapp).toContain("variant = 'dark'");
    expect(whatsapp).toContain('text-sand-100');
  });
});

describe('email fields do not collapse on phones', () => {
  const emailInput = (src: string) => {
    const at = src.indexOf('type="email"');
    const start = src.lastIndexOf('<input', at);
    const tag = src.slice(start, src.indexOf('/>', at));
    const m = tag.match(/className="([^"]*)"/);
    expect(m).not.toBeNull();
    return m![1];
  };

  it.each([
    ['Route Watch', routeWatch],
    ['Travel Club', newsletter],
  ])('%s: the email input is full width on phones and only grows with flex from sm up', (_name, src) => {
    const cls = emailInput(src);
    const tokens = cls.split(/\s+/);
    expect(tokens).toContain('w-full');
    expect(tokens).toContain('min-w-0');
    expect(tokens).toContain('sm:flex-1');
    expect(tokens).not.toContain('flex-1'); // a bare flex-1 inside the phone flex-col makes flex-basis 0 and collapses the height
    expect(tokens.some((t) => /^h-(11|12)$/.test(t))).toBe(true);
  });

  it('the email input sits in a flex-col on phones that becomes a row at sm (the reason a bare flex-1 collapsed)', () => {
    expect(routeWatch).toMatch(/<div className="flex flex-col gap-3 sm:flex-row">\s*<label htmlFor="watch-email"/);
    expect(newsletter).toMatch(/<div className="flex flex-col gap-3 sm:flex-row">\s*<label htmlFor="email"/);
  });
});

describe('controls are 16px on phones (no iOS focus zoom) and unchanged from sm up', () => {
  it.each([
    ['route-watch-form.tsx', routeWatch],
    ['newsletter-section.tsx', newsletter],
    ['travel-ready-check.tsx', travelReady],
  ])('%s: every bordered h-11/h-12 input or select is text-base on phones (text-sm only from sm up)', (_name, src) => {
    const controls = classNamesWith(src, 'rounded-sm', 'border', 'w-full', 'h-1').filter((c) => /\bh-1[12]\b/.test(c) && !/\bbg-ink|\bbg-brass|\binline-flex\b/.test(c));
    expect(controls.length).toBeGreaterThan(0);
    for (const c of controls) {
      const tokens = c.split(/\s+/);
      expect(tokens, c).toContain('text-base');
      expect(tokens, c).not.toContain('text-sm'); // only an sm:-prefixed text-sm may follow
    }
  });
});
