import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClosingBand } from '@/components/homepage-v2/homepage-sections';
import { getHomepageWatchRoute } from '@/lib/homepage-evidence';
import { getMapPanScrollLeft } from '@/lib/atlas-map-pan';
import { getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');
const atlas = read('components/founder/atlas-feel-test.tsx');

describe('Mobile Atlas containment (the actual cause)', () => {
  it('the mobile grid column is a minmax(0,1fr) track and its items can shrink, so chip rows cannot widen the section', () => {
    expect(atlas).toContain('grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10');
    expect(atlas).toContain('<div className="flex min-w-0 flex-col gap-2 lg:hidden">');
    expect(atlas).toMatch(/className=\{`min-w-0 max-w-md overflow-hidden rounded-md border/);
    expect(atlas).toContain('<div className="min-w-0 lg:order-1">');
  });

  it('desktop layout is unchanged: two-column template, order classes and the lg sticky answer card are still there', () => {
    expect(atlas).toContain('lg:grid-cols-[minmax(0,1fr)_22rem]');
    expect(atlas).toContain('lg:order-2 lg:sticky lg:top-6 lg:block');
    expect(atlas).toContain('sm:w-full" role="group"');
  });

  it('tablet widths (640-1023) keep the country/destination chips, because the fitted map hit targets are only a few px there', () => {
    expect(atlas).toContain('<p className="text-[13px] text-ink-300 lg:hidden">Select a country, then a destination, to see its route.</p>');
    expect(atlas).not.toContain('flex min-w-0 flex-col gap-2 sm:hidden');
  });

  it('selecting a country or destination (or switching airport) pans the mobile strip to it', () => {
    expect(atlas).toContain('onClickCapture={() => panMapTo(c.x)}');
    expect(atlas).toContain('onClickCapture={() => panMapTo(d.x)}');
    // Only deliberate chip taps pan; map hover/focus/pointer handlers never do (a moving map under a still pointer must not re-select).
    expect(atlas).toContain('onClick={() => activateCountry(c.slug)}');
    expect(atlas).toContain('onClick={() => selectDestination(d.slug)}');
    expect((atlas.match(/panMapTo\(/g) ?? []).length).toBe(4); // definition, two chip captures, airport switch
    expect(atlas).toContain('onMouseEnter={() => activateCountry(c.slug)}');
    expect(atlas).toContain('onMouseEnter={() => selectDestination(d.slug)}');
    for (const h of ['onMouseEnter', 'onPointerEnter', 'onPointerDown', 'onFocus']) {
      expect(atlas, h).not.toMatch(new RegExp(h + '=\\{[^}]*panMapTo'));
    }
    expect(atlas).toMatch(/setMobileRevealed\(false\);\r?\n\s*panMapTo\(null\);/);
    expect(atlas).toContain("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
    expect(atlas).toContain('ref={mapStripRef}');
    expect(atlas).toContain('ref={mapSvgRef}');
  });
});

describe('getMapPanScrollLeft', () => {
  const base = { viewBoxMinX: 418, viewBoxWidth: 336, svgPixelWidth: 800, clientWidth: 390, scrollWidth: 800 + 48, leadingOffset: 24 };
  it('returns null when the strip does not scroll (desktop)', () => {
    expect(getMapPanScrollLeft({ ...base, pointX: 600, clientWidth: 1000, scrollWidth: 1000 })).toBeNull();
  });
  it('centres a point and clamps to the strip ends', () => {
    // x=600 -> (182/336)*800 = 433 px + 24 px strip padding = 457; centred in a 390 strip -> 457 - 195 = 262
    expect(getMapPanScrollLeft({ ...base, pointX: 600 })).toBe(262);
    expect(getMapPanScrollLeft({ ...base, pointX: 420 })).toBe(0);
    expect(getMapPanScrollLeft({ ...base, pointX: 750 })).toBe(848 - 390);
  });
  it('keeps a spread of representative map x positions (synthetic, across the viewBox) inside the viewport at 320, 375, 390 and 430 px', () => {
    // The strip spans the full viewport width (negative margins cancel its own padding), so clientWidth is the viewport width.
    // The real-geometry check is the browser test recorded in the PR (Pakistan, India and UAE circles in view at each width).
    const xs = [440, 520, 600, 660, 700, 730, 750];
    for (const cw of [320, 375, 390, 430]) {
      for (const pointX of xs) {
        const left = getMapPanScrollLeft({ ...base, pointX, clientWidth: cw, scrollWidth: 848 })!;
        const pointPx = ((pointX - 418) / 336) * 800 + 24; // strip has 24 px left padding
        expect(pointPx - left, `${cw}/${pointX}`).toBeGreaterThanOrEqual(0);
        expect(pointPx - left, `${cw}/${pointX}`).toBeLessThanOrEqual(cw);
        // when not clamped at an end it is centred exactly
        if (left > 0 && left < 848 - cw) expect(Math.abs(pointPx - left - cw / 2)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('Route Watch invitation target', () => {
  it('names a current route (never the ended Manchester-Mumbai service) and the page really has a route-watch block', () => {
    const watch = getHomepageWatchRoute('2026-10-23');
    expect(watch).toEqual({ slug: 'manchester-islamabad', label: 'Manchester → Islamabad' });
    const route = getRouteBySlug(watch!.slug)!;
    expect(['direct', 'connecting']).toContain(getEffectiveRoutePresentation(route, routeStatusEvents, '2026-10-23').status);
    expect(read('app/routes/[slug]/page.tsx')).toContain('<div id="route-watch"');
    // Mumbai is service-ended today: it must never be offered.
    expect(getEffectiveRoutePresentation(getRouteBySlug('manchester-mumbai')!, routeStatusEvents, '2026-10-23').status).toBe('service-ended');
  });
  it('is null when nothing qualifies (far future, verification lapsed), so the section falls back to the route index', () => {
    expect(getHomepageWatchRoute('2030-01-01')).toBeNull();
  });
  it('the homepage no longer contains a hard-coded Manchester-Mumbai Route Watch link', () => {
    expect(read('components/homepage-v2/homepage-sections.tsx')).not.toContain('manchester-mumbai#route-watch');
    expect(read('components/homepage-v2/journey-desk-home.tsx')).toContain('getHomepageWatchRoute(');
  });
});

describe('Closing band wording', () => {
  it('promises only what exists publicly: route status, fares and travel requirements, checked and dated', () => {
    const html = renderToStaticMarkup(ClosingBand());
    expect(html).toContain('Route status, fares and travel requirements, each checked and dated.');
    expect(html).not.toMatch(/Journey Brief/i);
    expect(html).toContain('href="#your-journey"');
  });
});
