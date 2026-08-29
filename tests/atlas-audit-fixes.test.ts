import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Two remaining Route Atlas audit fixes:
 *
 * A. Manchester's initial default was India → Mumbai, the only Manchester
 *    destination (alongside Delhi) with an active 'withdrawal-announced'
 *    route-status-events.ts entry — an unstable first impression, even
 *    though the warning itself is honest. Replaced with UAE → Dubai:
 *    verified + direct + zero events + two logged fare observations
 *    (data/fare-observations.ts) + a verified TravelUp deep link + one of
 *    STATUS.md's own SOFT_LAUNCH_PACK routes. Mumbai is untouched — still
 *    in the network, still selectable, still honestly flagged.
 *
 * B. Country markers had two independently tabbable, identically-labelled
 *    controls (the visible SVG text AND its invisible hit-circle) for the
 *    same action — a duplicate stop in the Tab order and a duplicate
 *    announcement to a screen reader. Fixed by making the text purely
 *    decorative (aria-hidden, no tabIndex/role) and keeping the hit-circle
 *    as the one real control, now also with explicit Enter/Space
 *    activation (absent before on both country and destination markers).
 *
 * atlas-feel-test.tsx is a 'use client' component with hooks
 * (useState/useMemo/useRef), so — matching this repo's established pattern
 * (tests/quote-request-trip-type.test.ts, tests/atlas-journey-check-analytics.test.ts)
 * — these are source-text regression assertions on the real component and
 * the real network-data builder, not a rendered one.
 */

const atlasSrc = readFileSync(join(process.cwd(), 'components/founder/atlas-feel-test.tsx'), 'utf8');
const networkDataSrc = readFileSync(join(process.cwd(), 'lib/atlas-network-data.ts'), 'utf8');
const fareObservationsSrc = readFileSync(join(process.cwd(), 'data/fare-observations.ts'), 'utf8');
const bookingProvidersSrc = readFileSync(join(process.cwd(), 'lib/booking-providers.ts'), 'utf8');
const routeStatusEventsSrc = readFileSync(join(process.cwd(), 'data/route-status-events.ts'), 'utf8');

// Manchester's own builder function only — never the whole file, so an
// assertion here can't accidentally pass because Birmingham/Heathrow/etc.
// happen to contain a similar string.
const manchesterBuilderSrc = networkDataSrc.slice(
  networkDataSrc.indexOf('function buildManchesterNetwork'),
  networkDataSrc.indexOf('function buildBirminghamNetwork')
);

describe('A. Manchester default route — stability', () => {
  it('1. the new initial default country is UAE (Dubai), not India (Mumbai)', () => {
    expect(manchesterBuilderSrc).toMatch(/defaultCountrySlug: 'uae',/);
  });

  it('2. Manchester–Mumbai is not the initial default — India is no longer the default country', () => {
    expect(manchesterBuilderSrc).not.toMatch(/defaultCountrySlug: 'india',/);
  });

  it('the UAE country array resolves unambiguously to Dubai as destinations[0] — no reordering risk', () => {
    const uaeBlock = manchesterBuilderSrc.match(/const uaePoints = \[([\s\S]*?)\]\.filter/)?.[1] ?? '';
    expect(uaeBlock).toContain("buildDestinationPoint('manchester', 'dubai'");
    // Exactly one UAE destination for Manchester — genuinely unambiguous, not just first-in-array.
    expect((uaeBlock.match(/buildDestinationPoint\(/g) ?? []).length).toBe(1);
  });

  it('the new default is a genuinely stable route: verified, direct, and untouched by any withdrawal event', () => {
    // Route-status-events.ts only carries events for Mumbai and Delhi —
    // confirms Dubai has never had a withdrawal/pause/service-ended event.
    expect(routeStatusEventsSrc).toContain("routeSlug: 'manchester-mumbai'");
    expect(routeStatusEventsSrc).toContain("routeSlug: 'manchester-delhi'");
    expect(routeStatusEventsSrc).not.toContain("routeSlug: 'manchester-dubai'");
  });

  it('the new default has real logged fare evidence, not just a route-status verification', () => {
    expect(fareObservationsSrc).toContain("routeSlug: 'manchester-dubai'");
    expect(fareObservationsSrc).toMatch(/obs-man-dxb-economy-1/);
    expect(fareObservationsSrc).toMatch(/obs-man-dxb-business-1/);
  });

  it('the new default has a verified Trip.com link', () => {
    expect(bookingProvidersSrc).toMatch(/'manchester-dubai':\s*'https:\/\/www\.trip\.com/);
  });

  it('3. Mumbai remains in Manchester\'s India network, unchanged, still selectable', () => {
    const indiaBlock = manchesterBuilderSrc.match(/const indiaPoints = \[([\s\S]*?)\]\.filter/)?.[1] ?? '';
    // Matches only the fixed x/y coordinates, not the exact closing
    // arguments — the route verification test determinism batch (29 Aug
    // 2026) added a required nowIso injection parameter to every
    // buildDestinationPoint() call, which this test's own subject
    // (unchanged coordinates) doesn't concern.
    expect(indiaBlock).toContain("buildDestinationPoint('manchester', 'mumbai', 690, 414,");
  });

  it('3. Mumbai\'s honest withdrawal-status derivation logic is preserved (Route Coverage Truth, August 2026: now an additive serviceNotice, kept deliberately separate from intelligenceLevel rather than overriding it — see computeRouteIntelligenceLevel\'s own doc comment)', () => {
    // buildDestinationPoint (the function that actually derives Mumbai's
    // withdrawal-announced state from route-status-events.ts) lives outside
    // buildManchesterNetwork.
    expect(networkDataSrc).toContain("if (status?.status === 'withdrawal-announced') {");
    expect(networkDataSrc).toContain('serviceNotice = {');
  });

  it('Manchester keeps every one of its 11 real routes.ts destinations — none removed to make room for the new default', () => {
    for (const slug of ['lahore', 'islamabad', 'dubai', 'karachi', 'doha', 'jeddah', 'delhi', 'mumbai', 'amritsar', 'ahmedabad', 'madinah']) {
      expect(manchesterBuilderSrc, `manchester-${slug} destination point`).toMatch(
        new RegExp(`buildDestinationPoint\\('manchester', '${slug}'`)
      );
    }
  });

  it('Manchester keeps its origin, airport slug and name unchanged', () => {
    expect(manchesterBuilderSrc).toContain("airportSlug: 'manchester'");
    expect(manchesterBuilderSrc).toContain("airportName: 'Manchester'");
    expect(manchesterBuilderSrc).toContain('const origin = { x: 471.2, y: 286.4 };');
  });

  it('Birmingham, Heathrow, Gatwick, Glasgow, Edinburgh, Newcastle and Leeds Bradford keep their own unrelated defaults untouched', () => {
    expect(networkDataSrc).toMatch(/airportSlug: 'birmingham'[\s\S]*?defaultCountrySlug: 'india'/);
    expect(networkDataSrc).toMatch(/airportSlug: 'london-heathrow'[\s\S]*?defaultCountrySlug: 'india'/);
    expect(networkDataSrc).toMatch(/airportSlug: 'london-gatwick'[\s\S]*?defaultCountrySlug: 'india'/);
    expect(networkDataSrc).toMatch(/airportSlug: 'glasgow'[\s\S]*?defaultCountrySlug: 'uae'/);
  });
});

describe('B. Duplicate keyboard-accessible controls — country markers', () => {
  const countryGroupSrc = atlasSrc.slice(atlasSrc.indexOf('{/* country nodes */}'), atlasSrc.indexOf('{/* destinations within the active country'));
  const countryTextSrc = countryGroupSrc.match(/<text x=\{labelX\}[\s\S]*?<\/text>/)?.[0] ?? '';
  const countryCircleSrc = countryGroupSrc.match(/<circle\s+cx=\{c\.x\}\s+cy=\{c\.y\}\s+r=\{countryHitRadius[\s\S]*?\/>/)?.[0] ?? '';

  it('8/9. the visible country label carries no tabIndex, role or aria-label — only the hit-circle is a real control', () => {
    expect(countryTextSrc).not.toMatch(/tabIndex/);
    expect(countryTextSrc).not.toMatch(/role="button"/);
    expect(countryTextSrc).not.toMatch(/aria-label/);
  });

  it('the visible country label is aria-hidden, so it is never a second node announced to assistive tech', () => {
    expect(countryTextSrc).toMatch(/aria-hidden="true"/);
  });

  it('the country label no longer has onFocus — it can never receive focus once tabIndex is gone, so a dead handler would be misleading', () => {
    expect(countryTextSrc).not.toMatch(/onFocus/);
  });

  it('9. exactly one tabIndex={0} exists per country marker group — the hit-circle', () => {
    expect((countryGroupSrc.match(/tabIndex=\{0\}/g) ?? []).length).toBeLessThanOrEqual(1);
    expect(countryCircleSrc).toMatch(/tabIndex=\{0\}/);
  });

  it('12. pointer/hover handlers remain on both the label (for cursor precision over the glyphs) and the hit-circle', () => {
    expect(countryTextSrc).toMatch(/onMouseEnter=\{\(\) => activateCountry\(c\.slug\)\}/);
    expect(countryTextSrc).toMatch(/onPointerEnter=\{\(\) => activateCountry\(c\.slug\)\}/);
    expect(countryTextSrc).toMatch(/onPointerDown=\{\(\) => activateCountry\(c\.slug\)\}/);
    expect(countryTextSrc).toMatch(/onClick=\{\(\) => activateCountry\(c\.slug\)\}/);
    expect(countryCircleSrc).toMatch(/onMouseEnter=\{\(\) => activateCountry\(c\.slug\)\}/);
  });

  it('10/11. the hit-circle gains explicit Enter/Space keyboard activation, calling the same action exactly once', () => {
    expect(countryCircleSrc).toMatch(/onKeyDown=\{\(e\) => \{\s*if \(e\.key === 'Enter' \|\| e\.key === ' '\) \{\s*e\.preventDefault\(\);\s*activateCountry\(c\.slug\);\s*\}\s*\}\}/);
    // Exactly one call to activateCountry inside the keydown handler — not duplicated.
    const keyDownBlock = countryCircleSrc.match(/onKeyDown=\{[\s\S]*?\}\}/)?.[0] ?? '';
    expect((keyDownBlock.match(/activateCountry\(c\.slug\)/g) ?? []).length).toBe(1);
  });

  it('13. focus-visible outline styling on the hit-circle is unchanged', () => {
    expect(countryCircleSrc).toContain('focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8932E]');
  });

  it('14. the hit-circle keeps a meaningful accessible name (country + confidence label)', () => {
    expect(countryCircleSrc).toContain('aria-label={`${c.label} — ${colour.label}`}');
  });

  it('the hit-circle keeps a generous, crowding-safe hit radius — unchanged from before this fix', () => {
    expect(countryCircleSrc).toMatch(/r=\{countryHitRadius\[c\.slug\]\}/);
    // The shared radius helper remains the single source of truth; its safety
    // bound is tested separately so crowded countries cannot overlap.
    expect(atlasSrc).toContain('const BASE_COUNTRY_HIT_R = 12.5;');
  });
});

describe('B. Duplicate keyboard-accessible controls — destination markers', () => {
  const destGroupSrc = atlasSrc.slice(
    atlasSrc.indexOf('{/* destinations within the active country'),
    atlasSrc.indexOf('</svg>')
  );
  const destTextSrc = destGroupSrc.match(/<text x=\{d\.x \+ 2\.7\}[\s\S]*?<\/text>/)?.[0] ?? '';
  const destCircleSrc = destGroupSrc.match(/<circle\s+cx=\{d\.x\}\s+cy=\{d\.y\}\s+r=\{destHitRadius[\s\S]*?\/>/)?.[0] ?? '';

  it('destinations never had a duplicate control (text was already non-interactive) — confirmed still true', () => {
    expect(destTextSrc).not.toMatch(/tabIndex/);
    expect(destTextSrc).not.toMatch(/role="button"/);
    expect(destTextSrc).not.toMatch(/aria-label/);
  });

  it('the destination label is now explicitly aria-hidden, same defensive treatment as the country label', () => {
    expect(destTextSrc).toMatch(/aria-hidden="true"/);
  });

  it('9. exactly one tabIndex={0} exists per destination marker group — the hit-circle', () => {
    expect((destGroupSrc.match(/tabIndex=\{0\}/g) ?? []).length).toBe(1);
    expect(destCircleSrc).toMatch(/tabIndex=\{0\}/);
  });

  it('10/11. the destination hit-circle gains explicit Enter/Space keyboard activation, calling the same action exactly once', () => {
    expect(destCircleSrc).toMatch(/onKeyDown=\{\(e\) => \{\s*if \(e\.key === 'Enter' \|\| e\.key === ' '\) \{\s*e\.preventDefault\(\);\s*selectDestination\(d\.slug\);\s*\}\s*\}\}/);
    const keyDownBlock = destCircleSrc.match(/onKeyDown=\{[\s\S]*?\}\}/)?.[0] ?? '';
    expect((keyDownBlock.match(/selectDestination\(d\.slug\)/g) ?? []).length).toBe(1);
  });

  it('13. focus-visible outline styling on the destination hit-circle is unchanged', () => {
    expect(destCircleSrc).toContain('focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8932E]');
  });

  it('14. the destination hit-circle keeps its meaningful accessible name, including the active-notice and seasonal-service suffixes where relevant (Route Coverage Truth, August 2026: label now reads from ROUTE_INTELLIGENCE_COLOUR/intelligenceLevel, plus a new active-service-notice suffix, kept separate from the tier itself)', () => {
    expect(destCircleSrc).toContain(
      "aria-label={`${d.label} — ${ROUTE_INTELLIGENCE_COLOUR[d.intelligenceLevel].label}${d.serviceNotice ? ' — active service notice' : ''}${d.networkMembership === 'seasonal' ? ' — seasonal service' : ''}`}"
    );
  });

  it('12. all five pointer/focus handlers remain on the destination hit-circle, unchanged', () => {
    for (const handler of ['onMouseEnter', 'onPointerEnter', 'onPointerDown', 'onFocus', 'onClick']) {
      expect(destCircleSrc).toContain(`${handler}={() => selectDestination(d.slug)}`);
    }
  });
});

describe('Analytics — unchanged names, payloads and dedup behaviour (preserving PR #58)', () => {
  it('17. all three Atlas event names are byte-identical to before this PR', () => {
    expect(atlasSrc).toContain("track('atlas_origin_selected', { airport: a.airportSlug });");
    expect(atlasSrc).toContain("track('atlas_destination_selected', { airport: selectedAirportSlug, destination: slug });");
    expect(atlasSrc).toContain("track('atlas_route_opened', { route: activeDest.routeHref!.split('/').pop()! })");
  });

  it('4. no track() call exists outside a named handler function — nothing can fire on render/mount', () => {
    const beforeFirstFunction = atlasSrc.slice(0, atlasSrc.indexOf('function activateCountry'));
    expect(beforeFirstFunction).not.toMatch(/track\(/);
  });

  it('5. atlas_origin_selected keeps its exact one-genuine-change dedup guard', () => {
    expect(atlasSrc).toMatch(/if \(a\.airportSlug !== selectedAirportSlug\) \{\s*track\('atlas_origin_selected'/);
  });

  it('6. atlas_destination_selected keeps its exact ref-based dedup guard (the fix for the hover-triple-fire bug from PR #58)', () => {
    expect(atlasSrc).toContain('const lastTrackedDestRef = useRef(activeDestSlug);');
    expect(atlasSrc).toMatch(/if \(lastTrackedDestRef\.current !== slug\) \{\s*lastTrackedDestRef\.current = slug;\s*track\('atlas_destination_selected'/);
  });

  it('7. atlas_route_opened fires exactly once, from the Route guide link only', () => {
    const matches = atlasSrc.match(/track\('atlas_route_opened'/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('activateCountry and selectAirport still never fire atlas_destination_selected from their automatic resets', () => {
    const activateCountryBody = atlasSrc.slice(atlasSrc.indexOf('function activateCountry'), atlasSrc.indexOf('function selectAirport'));
    const selectAirportBody = atlasSrc.slice(atlasSrc.indexOf('function selectAirport'), atlasSrc.indexOf('function selectDestination'));
    expect(activateCountryBody).not.toMatch(/track\(/);
    expect(selectAirportBody.match(/track\(/g) ?? []).toHaveLength(1); // only atlas_origin_selected
  });
});

describe('Unrelated Atlas behaviour is unchanged', () => {
  it('15. route links (routeHref/href) are generated exactly as before', () => {
    expect(networkDataSrc).toContain("routeHref: `/routes/${route.slug}`,");
    expect(networkDataSrc).toContain('href: `/destinations/${destSlug}`,');
  });

  it('16. mobile swipe guidance copy and the hasScrolledMap softening logic remain restrained and stateful', () => {
    expect(atlasSrc).toContain('Swipe across the map to explore more destinations');
    expect(atlasSrc).toContain('const [hasScrolledMap, setHasScrolledMap] = useState(false);');
    expect(atlasSrc).toContain('if (!hasScrolledMap && e.currentTarget.scrollLeft > 12) setHasScrolledMap(true);');
  });

  it('mobile country/destination chip buttons are untouched real <button> elements, unaffected by the SVG marker fix', () => {
    expect(atlasSrc).toContain("onClick={() => activateCountry(c.slug)}");
    expect(atlasSrc).toMatch(/key=\{`country-chip-\$\{c\.slug\}`\}/);
    expect(atlasSrc).toMatch(/key=\{`dest-chip-\$\{d\.slug\}`\}/);
  });

  it('the geometry, hit-radius maths and crowding-avoidance system are untouched', () => {
    expect(atlasSrc).toContain('const lowerBound = Math.min(min, Math.max(0, safe));');
    expect(atlasSrc).toContain('function nearestDistance<T extends { slug: string; x: number; y: number }>(point: T, all: T[]): number {');
  });

  it('the country-selection interaction model (hover/focus/click all route through activateCountry) is unchanged', () => {
    expect(atlasSrc).toContain('function activateCountry(slug: string) {');
  });
});
