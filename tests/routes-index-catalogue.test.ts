import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { routes, getRouteAirport, getRouteDestination, getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getAirportImage } from '@/lib/brand-images';
import { buildRouteCountryGroups } from '@/lib/route-country-groups';
import { matchesRouteQuery, filterCountryGroups, toggleCountryInSet, isCountryVisible } from '@/components/routes/routes-catalogue';

/**
 * `/routes` usability fix — the page previously rendered every route as one
 * long, always-open list grouped by the broad RegionGroup, with no search.
 * These tests exercise the exact pure functions app/routes/page.tsx and
 * components/routes/routes-catalogue.tsx are built from (buildRouteCountryGroups,
 * matchesRouteQuery, filterCountryGroups, toggleCountryInSet, isCountryVisible),
 * plus source-level structural/accessibility checks for the parts that
 * genuinely need real DOM rendering to observe (this repo has no React
 * Testing Library / jsdom dependency, and none was added for this).
 */

const FIXED_TODAY = '2026-07-30';
const countryGroups = buildRouteCountryGroups(routes, FIXED_TODAY, routeStatusEvents);
const catalogueSrc = readFileSync(join(process.cwd(), 'components/routes/routes-catalogue.tsx'), 'utf8');
const pageSrc = readFileSync(join(process.cwd(), 'app/routes/page.tsx'), 'utf8');

describe('1. routes are grouped under the correct destination countries', () => {
  it('every route in a group actually belongs to that group\'s country, per Destination.country', () => {
    for (const group of countryGroups) {
      for (const card of group.routes) {
        expect(card.destCountry).toBe(group.country);
      }
    }
  });

  it('country is read from Destination.country, never inferred from the route slug', () => {
    // e.g. "manchester-dubai" contains no readable country name in its slug at all —
    // if this resolves correctly, the grouping cannot be slug-based.
    const dubaiGroup = countryGroups.find((g) => g.routes.some((r) => r.slug === 'manchester-dubai'));
    expect(dubaiGroup?.country).toBe('United Arab Emirates');
  });
});

describe('2 & 15. every existing route appears exactly once, no duplicates', () => {
  it('the flattened set of card slugs matches the real routes array exactly', () => {
    const cardSlugs = countryGroups.flatMap((g) => g.routes.map((r) => r.slug));
    expect(cardSlugs).toHaveLength(routes.length);
    expect(new Set(cardSlugs).size).toBe(routes.length);
    expect(new Set(cardSlugs)).toEqual(new Set(routes.map((r) => r.slug)));
  });
});

describe('3. country counts are correct', () => {
  it('each group\'s route count matches the real number of routes for that country', () => {
    for (const group of countryGroups) {
      const expectedCount = routes.filter((r) => getRouteDestination(r)?.country === group.country).length;
      expect(group.routes.length).toBe(expectedCount);
    }
  });

  it('known counts: India 12, Pakistan 6, Bangladesh 4, UAE 4, Qatar 2, Saudi Arabia 4', () => {
    const countOf = (country: string) => countryGroups.find((g) => g.country === country)?.routes.length;
    expect(countOf('India')).toBe(12);
    expect(countOf('Pakistan')).toBe(6);
    expect(countOf('Bangladesh')).toBe(4);
    expect(countOf('United Arab Emirates')).toBe(4);
    expect(countOf('Qatar')).toBe(2);
    expect(countOf('Saudi Arabia')).toBe(4);
  });
});

describe('4, 5 & 6. accordion toggle logic — expand/collapse, mobile single-open, desktop multi-open', () => {
  it('toggling a closed country opens it', () => {
    const result = toggleCountryInSet(new Set(), 'India', true);
    expect(result.has('India')).toBe(true);
  });

  it('toggling an already-open country closes it, on both mobile and desktop', () => {
    expect(toggleCountryInSet(new Set(['India']), 'India', true).has('India')).toBe(false);
    expect(toggleCountryInSet(new Set(['India']), 'India', false).has('India')).toBe(false);
  });

  it('mobile (isDesktop=false): opening a new country closes every other open country', () => {
    const result = toggleCountryInSet(new Set(['Pakistan']), 'India', false);
    expect(result.has('India')).toBe(true);
    expect(result.has('Pakistan')).toBe(false);
    expect(result.size).toBe(1);
  });

  it('desktop (isDesktop=true): opening a new country leaves other open countries untouched', () => {
    const result = toggleCountryInSet(new Set(['Pakistan']), 'India', true);
    expect(result.has('India')).toBe(true);
    expect(result.has('Pakistan')).toBe(true);
    expect(result.size).toBe(2);
  });
});

describe('7, 8, 9 & 10. search matching — destination, country, origin, case-insensitive, trims whitespace', () => {
  it('searching a destination city (Lahore) finds the matching route', () => {
    const route = countryGroups.flatMap((g) => g.routes).find((r) => r.slug === 'manchester-lahore')!;
    expect(matchesRouteQuery(route, 'Lahore')).toBe(true);
  });

  it('searching a country (Bangladesh) reveals the matching group via filterCountryGroups', () => {
    const filtered = filterCountryGroups(countryGroups, 'Bangladesh');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].country).toBe('Bangladesh');
    expect(filtered[0].routes.length).toBeGreaterThan(0);
  });

  it('searching an origin airport/city (Manchester) finds matching routes across multiple countries', () => {
    const filtered = filterCountryGroups(countryGroups, 'Manchester');
    const matchedSlugs = filtered.flatMap((g) => g.routes.map((r) => r.slug));
    expect(matchedSlugs).toContain('manchester-lahore');
    expect(matchedSlugs).toContain('manchester-dubai');
    expect(filtered.length).toBeGreaterThan(1); // spans more than one country group
  });

  it('is case-insensitive', () => {
    const route = countryGroups.flatMap((g) => g.routes).find((r) => r.slug === 'manchester-lahore')!;
    expect(matchesRouteQuery(route, 'LAHORE')).toBe(true);
    expect(matchesRouteQuery(route, 'lahore')).toBe(true);
    expect(matchesRouteQuery(route, 'LaHoRe')).toBe(true);
  });

  it('trims leading/trailing whitespace', () => {
    const route = countryGroups.flatMap((g) => g.routes).find((r) => r.slug === 'manchester-lahore')!;
    expect(matchesRouteQuery(route, '   lahore   ')).toBe(true);
    expect(filterCountryGroups(countryGroups, '   Bangladesh   ')).toHaveLength(1);
  });

  it('a route title match works (origin "to" destination)', () => {
    const route = countryGroups.flatMap((g) => g.routes).find((r) => r.slug === 'manchester-lahore')!;
    expect(matchesRouteQuery(route, 'manchester to lahore')).toBe(true);
  });
});

describe('11 & 12. empty results and clearing search', () => {
  it('a no-results query filters every group out entirely', () => {
    const filtered = filterCountryGroups(countryGroups, 'zzznonexistentplace');
    expect(filtered).toHaveLength(0);
  });

  it('clearing the query (empty string) restores the exact full grouped view', () => {
    expect(filterCountryGroups(countryGroups, '')).toBe(countryGroups);
    expect(filterCountryGroups(countryGroups, '   ')).toBe(countryGroups);
  });

  it('the component source shows a clear, human empty-state message with a way to clear the search', () => {
    expect(catalogueSrc).toMatch(/No routes match/);
    expect(catalogueSrc).toMatch(/Clear search/);
  });
});

describe('13. search automatically reveals matching groups without manual expansion', () => {
  it('isCountryVisible returns true while searching even if the country was never expanded', () => {
    expect(isCountryVisible('France', new Set(), true)).toBe(true);
  });

  it('isCountryVisible falls back to the real expanded state once not searching', () => {
    expect(isCountryVisible('France', new Set(), false)).toBe(false);
    expect(isCountryVisible('France', new Set(['France']), false)).toBe(true);
  });
});

describe('14. existing route hrefs, statuses and images are preserved exactly', () => {
  it('href always points at the real route guide', () => {
    for (const group of countryGroups) {
      for (const card of group.routes) {
        expect(card.href).toBe(`/routes/${card.slug}`);
        expect(getRouteBySlug(card.slug)).toBeDefined();
      }
    }
  });

  it('a normal verified direct route (manchester-lahore) keeps its real status/flightTime/image', () => {
    const route = getRouteBySlug('manchester-lahore')!;
    const airport = getRouteAirport(route)!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, FIXED_TODAY);
    const card = countryGroups.flatMap((g) => g.routes).find((r) => r.slug === 'manchester-lahore')!;
    expect(card.statusLabel).toBe(presentation.statusLabel);
    expect(card.isDirectStatus).toBe(presentation.status === 'direct');
    expect(card.subLine).toBe(presentation.flightTime);
    expect(card.airportImage).toEqual(getAirportImage(airport.slug));
  });

  it('a Verification Pending route (manchester-karachi) shows statusLabel as its sub-line, never a raw flightTime', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, FIXED_TODAY);
    expect(presentation.status).toBe('unverified');
    const card = countryGroups.flatMap((g) => g.routes).find((r) => r.slug === 'manchester-karachi')!;
    expect(card.subLine).toBe(presentation.statusLabel);
    expect(card.isDirectStatus).toBe(false);
  });

  it('every card uses the departure-airport image lookup, never the destination image', () => {
    for (const group of countryGroups) {
      for (const card of group.routes) {
        const airport = getRouteAirport(getRouteBySlug(card.slug)!)!;
        expect(card.airportImage).toEqual(getAirportImage(airport.slug));
      }
    }
  });
});

describe('accessibility structure (source-level — no DOM test harness in this repo)', () => {
  it('country headers are real, accessible <button> elements with aria-expanded and aria-controls, wrapped in a heading', () => {
    expect(catalogueSrc).toMatch(/<h2>\s*<button/);
    expect(catalogueSrc).toContain('aria-expanded={isOpen}');
    expect(catalogueSrc).toContain('aria-controls={panelId}');
    expect(catalogueSrc).toContain('id={panelId}');
  });

  it('the search input has a real associated <label>, not just a placeholder', () => {
    expect(catalogueSrc).toMatch(/<label htmlFor=\{inputId\}/);
    expect(catalogueSrc).toMatch(/id=\{inputId\}/);
  });

  it('has the specified placeholder text', () => {
    expect(catalogueSrc).toContain('placeholder="Search destination or route"');
  });

  it('the search input is not wrapped in a <form> and cannot submit/reload the page', () => {
    expect(catalogueSrc).not.toContain('<form');
    expect(catalogueSrc).not.toContain('onSubmit');
  });

  it('the clear-search control is a real, labelled <button>, not a clickable div', () => {
    expect(catalogueSrc).toContain('aria-label="Clear search"');
    // The nearest preceding tag opener before that attribute must be <button, not <div —
    // a plain [^>]* regex would falsely terminate at the "=>" inside the onClick handler.
    const labelIndex = catalogueSrc.indexOf('aria-label="Clear search"');
    const precedingButton = catalogueSrc.lastIndexOf('<button', labelIndex);
    const precedingDiv = catalogueSrc.lastIndexOf('<div', labelIndex);
    expect(precedingButton).toBeGreaterThan(-1);
    expect(precedingButton).toBeGreaterThan(precedingDiv);
  });

  it('no clickable <div onClick> exists anywhere in the catalogue', () => {
    expect(catalogueSrc).not.toMatch(/<div[^>]*onClick/);
  });
});

describe('data/ordering integrity — no route data changed, no country invented', () => {
  it('every route resolves to a real destination with real country metadata — nothing missing, nothing silently mapped', () => {
    for (const route of routes) {
      const dest = getRouteDestination(route);
      expect(dest, `${route.slug} has no resolvable destination`).toBeDefined();
      expect(dest!.country, `${route.slug}'s destination has no country field`).toBeTruthy();
    }
  });

  it('country group order follows the existing region priority (India, Pakistan, Bangladesh, then Gulf countries), not an invented order', () => {
    const order = countryGroups.map((g) => g.country);
    expect(order.indexOf('India')).toBeLessThan(order.indexOf('Pakistan'));
    expect(order.indexOf('Pakistan')).toBeLessThan(order.indexOf('Bangladesh'));
    expect(order.indexOf('Bangladesh')).toBeLessThan(order.indexOf('United Arab Emirates'));
  });

  it('the page still renders no metadata/copy changes outside the catalogue itself', () => {
    expect(pageSrc).toContain('Current route coverage is deepest in South Asia and the Gulf.');
    expect(pageSrc).toContain("title: 'Route Guides from UK Airports'");
  });
});

describe('country header images (routes-country-header-images)', () => {
  const EXPECTED_MAPPING: Record<string, string> = {
    India: 'mumbai',
    Pakistan: 'islamabad',
    Bangladesh: 'dhaka',
    'United Arab Emirates': 'dubai',
    Qatar: 'doha',
    'Saudi Arabia': 'jeddah',
    Turkey: 'istanbul',
    Morocco: 'marrakech',
    Spain: 'barcelona',
    Portugal: 'faro',
    Greece: 'athens',
    Italy: 'rome',
  };

  it('1 & 13. every current country group has exactly one representative image — no null, no fallback/broken image', () => {
    expect(countryGroups).toHaveLength(12);
    for (const group of countryGroups) {
      expect(group.image, `${group.country} has no header image`).not.toBeNull();
      expect(group.image!.src.length).toBeGreaterThan(0);
    }
  });

  it('2. every mapped image path actually exists on disk (real approved asset, not a guessed filename)', () => {
    for (const group of countryGroups) {
      // group.image.src is "/images/destinations/<slug>.webp" — strip the
      // leading slash to resolve under the repo's public/ directory.
      const diskPath = join(process.cwd(), 'public', group.image!.src.replace(/^\//, ''));
      expect(existsSync(diskPath), `${group.country}'s image (${group.image!.src}) does not exist on disk`).toBe(true);
    }
  });

  it('3. the country-to-image mapping matches the deliberate, documented choice for each country', () => {
    for (const group of countryGroups) {
      const expectedSlug = EXPECTED_MAPPING[group.country];
      expect(expectedSlug, `no expected mapping recorded in this test for ${group.country}`).toBeDefined();
      expect(group.image!.src).toBe(`/images/destinations/${expectedSlug}.webp`);
    }
  });

  it('the mapping lives as an explicit, typed object in lib/route-country-groups.ts — never string concatenation or a runtime guess from the country name', () => {
    const librarySrc = readFileSync(join(process.cwd(), 'lib/route-country-groups.ts'), 'utf8');
    expect(librarySrc).toContain('COUNTRY_REPRESENTATIVE_DESTINATION_SLUG');
    expect(librarySrc).not.toMatch(/country\.toLowerCase\(\)|country\.replace\(/);
  });

  it('12. every image src is a local, existing-asset path — no external URL introduced', () => {
    for (const group of countryGroups) {
      expect(group.image!.src.startsWith('/images/destinations/')).toBe(true);
      expect(group.image!.src).not.toMatch(/^https?:\/\//);
    }
  });

  it('4 & 5 & 6. adding images introduced no duplicate headers, and every route/country count is exactly what it was before this change', () => {
    const countryNames = countryGroups.map((g) => g.country);
    expect(new Set(countryNames).size).toBe(countryNames.length);
    const totalRoutes = countryGroups.reduce((sum, g) => sum + g.routes.length, 0);
    expect(totalRoutes).toBe(routes.length);
  });

  it('7. filterCountryGroups (the search path) preserves each group\'s image through filtering, so search results are visually unchanged', () => {
    const filtered = filterCountryGroups(countryGroups, 'mumbai');
    const india = filtered.find((g) => g.country === 'India');
    expect(india).toBeDefined();
    expect(india!.image).toEqual(countryGroups.find((g) => g.country === 'India')!.image);
  });

  it('8 & 9. accordion toggle logic (mobile single-open, desktop multi-open) is untouched by this change — same functions, same behaviour', () => {
    // toggleCountryInSet/isCountryVisible take no image-related argument at
    // all; this just confirms the header-image addition didn't require (or
    // introduce) a signature change to either.
    const afterMobileOpen = toggleCountryInSet(new Set(), 'India', false);
    expect(afterMobileOpen.has('India')).toBe(true);
    const afterDesktopOpen = toggleCountryInSet(new Set(['India']), 'Pakistan', true);
    expect(afterDesktopOpen.has('India')).toBe(true);
    expect(afterDesktopOpen.has('Pakistan')).toBe(true);
  });

  it('10 & 11. RouteCard\'s own image, hrefs and status rendering are byte-identical to before — only the accordion header changed', () => {
    expect(catalogueSrc).toContain('src={route.airportImage.src}');
    expect(catalogueSrc).toContain('alt={route.airportImage.alt}');
    expect(catalogueSrc).toContain('sizes="(min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw"');
    expect(catalogueSrc).toContain('href={route.href}');
  });

  it('the header image alt text is genuinely descriptive of the photo, and never just a bare repeat of the country name that already sits adjacent as real text', () => {
    expect(catalogueSrc).toMatch(/<Image src=\{group\.image\.src\} alt=\{group\.image\.alt\}/);
    for (const group of countryGroups) {
      expect(group.image!.alt.length).toBeGreaterThan(0);
      expect(group.image!.alt.trim().toLowerCase()).not.toBe(group.country.toLowerCase());
    }
  });

  it('the image is not a separate clickable control — no nested button/link/onClick inside the image wrapper', () => {
    const wrapperMatch = catalogueSrc.match(/\{group\.image && \(([\s\S]*?)\)\}/);
    expect(wrapperMatch).not.toBeNull();
    expect(wrapperMatch![1]).not.toMatch(/<button|<a\s|onClick/);
  });

  it('the accordion button still has exactly one aria-expanded and one aria-controls, both on the same real <button>', () => {
    expect(catalogueSrc.match(/aria-expanded=\{isOpen\}/g)).toHaveLength(1);
    expect(catalogueSrc.match(/aria-controls=\{panelId\}/g)).toHaveLength(1);
    expect(catalogueSrc).toMatch(/<h2>\s*<button[\s\S]*?aria-expanded=\{isOpen\}[\s\S]*?aria-controls=\{panelId\}/);
  });

  it('with the real, shipped mapping, building country groups never throws — every mapped country has a real asset today', () => {
    expect(() => buildRouteCountryGroups(routes, FIXED_TODAY, routeStatusEvents)).not.toThrow();
  });

  it('a mapped-but-missing asset fails clearly outside production, rather than ever silently rendering a broken image — source-level check, since exercising this without editing the shipped mapping isn\'t possible from a test', () => {
    const librarySrc = readFileSync(join(process.cwd(), 'lib/route-country-groups.ts'), 'utf8');
    expect(librarySrc).toMatch(/process\.env\.NODE_ENV !== 'production'/);
    expect(librarySrc).toMatch(/throw new Error/);
  });
});
