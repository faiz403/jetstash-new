import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Route Atlas and Journey Check engagement analytics. Both are 'use client'
 * components with hooks (useState/useMemo/useRouter), so — matching this
 * repo's established pattern (see tests/quote-request-trip-type.test.ts,
 * tests/homepage-journey-check-form.test.ts) — these are source-text
 * regression assertions on the real component, not a rendered one.
 */

const atlasSrc = readFileSync(join(process.cwd(), 'components/founder/atlas-feel-test.tsx'), 'utf8');
const journeyCheckSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/journey-check-form.tsx'), 'utf8');

describe('Route Atlas — atlas_origin_selected', () => {
  const selectAirportBody = atlasSrc.slice(
    atlasSrc.indexOf('function selectAirport'),
    atlasSrc.indexOf('function selectDestination')
  );

  it('fires exactly once in the whole file, from inside selectAirport', () => {
    const matches = atlasSrc.match(/track\('atlas_origin_selected'/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(selectAirportBody).toContain("track('atlas_origin_selected'");
  });

  it('only fires on a genuine change of airport, not a re-click of the already-selected one', () => {
    expect(selectAirportBody).toMatch(/if \(a\.airportSlug !== selectedAirportSlug\) \{\s*track\('atlas_origin_selected'/);
  });

  it('carries only the departure airport slug', () => {
    expect(selectAirportBody).toContain("track('atlas_origin_selected', { airport: a.airportSlug });");
  });

  it('is never called from a useState initializer or at module/component top level — only from selectAirport, which only fires from a click handler', () => {
    const beforeSelectAirport = atlasSrc.slice(0, atlasSrc.indexOf('function selectAirport'));
    expect(beforeSelectAirport).not.toMatch(/track\(/);
  });

  it('selectAirport is wired to the airport pill button onClick', () => {
    expect(atlasSrc).toMatch(/onClick=\{\(\) => selectAirport\(a\.airportSlug\)\}/);
  });
});

describe('Route Atlas — atlas_destination_selected', () => {
  const selectDestinationBody = atlasSrc.slice(
    atlasSrc.indexOf('function selectDestination'),
    atlasSrc.indexOf('// Size-driven visual emphasis')
  );

  it('fires exactly once in the whole file, from inside selectDestination', () => {
    const matches = atlasSrc.match(/track\('atlas_destination_selected'/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(selectDestinationBody).toContain("track('atlas_destination_selected'");
  });

  it('only fires when the destination actually changes, not on redundant re-hover of the already-active one — deduped via a ref, not React state', () => {
    // A ref, not activeDestSlug state: state only updates after a render,
    // but one hover gesture dispatches mouseenter/pointerenter/pointerdown
    // as separate synchronous calls before any render happens, so a
    // state-based check would let all of them through. See
    // lastTrackedDestRef's own comment in the component.
    expect(selectDestinationBody).toMatch(
      /if \(lastTrackedDestRef\.current !== slug\) \{\s*lastTrackedDestRef\.current = slug;\s*track\('atlas_destination_selected'/
    );
  });

  it('the dedup ref is declared once, initialised from the real initial destination', () => {
    expect(atlasSrc).toContain('const lastTrackedDestRef = useRef(activeDestSlug);');
  });

  it('carries the departure airport slug and the destination slug, nothing else', () => {
    expect(selectDestinationBody).toContain(
      "track('atlas_destination_selected', { airport: selectedAirportSlug, destination: slug });"
    );
  });

  it('activateCountry (country hover/selection, and its automatic default-destination reset) never fires it', () => {
    const activateCountryBody = atlasSrc.slice(
      atlasSrc.indexOf('function activateCountry'),
      atlasSrc.indexOf('function selectAirport')
    );
    expect(activateCountryBody).not.toMatch(/track\(/);
    // Confirms the reset really is still there (unchanged behaviour) — just untracked.
    expect(activateCountryBody).toContain('setActiveDestSlug(nextDest);');
    // The dedup ref is kept in sync with the automatic reset too, so a later
    // genuine hover of this same auto-selected destination doesn't wrongly fire.
    expect(activateCountryBody).toContain('lastTrackedDestRef.current = nextDest;');
  });

  it("selectAirport's own automatic default-destination reset never fires it either", () => {
    const selectAirportBody = atlasSrc.slice(
      atlasSrc.indexOf('function selectAirport'),
      atlasSrc.indexOf('function selectDestination')
    );
    // Only one track( call in this function, and it's the origin-selected one already asserted above.
    const trackCalls = selectAirportBody.match(/track\(/g) ?? [];
    expect(trackCalls).toHaveLength(1);
    expect(selectAirportBody).toContain('setActiveDestSlug(nextDest);');
    expect(selectAirportBody).toContain('lastTrackedDestRef.current = nextDest;');
  });

  it('every real destination interaction handler (desktop hover/focus/click and the mobile chip) calls selectDestination, not setActiveDestSlug directly', () => {
    expect(atlasSrc).not.toMatch(/=> setActiveDestSlug\(d\.slug\)/);
    const selectDestCalls = atlasSrc.match(/=> selectDestination\(d\.slug\)/g) ?? [];
    // 5 desktop handlers (mouseEnter/pointerEnter/pointerDown/focus/click) + 1 mobile chip.
    expect(selectDestCalls).toHaveLength(6);
  });

  it('no event fires from the two useState initial-value expressions (initial render/default state)', () => {
    const initBlock = atlasSrc.slice(atlasSrc.indexOf('const [selectedAirportSlug'), atlasSrc.indexOf('const [hasScrolledMap'));
    expect(initBlock).not.toMatch(/track\(/);
  });
});

describe('Route Atlas — atlas_route_opened', () => {
  it('fires exactly once, from the "Route guide" link, not the "Explore destination" link', () => {
    const matches = atlasSrc.match(/track\('atlas_route_opened'/g) ?? [];
    expect(matches).toHaveLength(1);
    const routeGuideBlock = atlasSrc.match(/\{activeDest\.routeHref && \([\s\S]*?<\/Link>\s*\)\}/)?.[0] ?? '';
    expect(routeGuideBlock).toContain("track('atlas_route_opened'");
    expect(routeGuideBlock).toContain('Route guide');
  });

  it('sends only the real route slug (extracted from the href), never the full href or destination label', () => {
    expect(atlasSrc).toContain(
      "onClick={() => track('atlas_route_opened', { route: activeDest.routeHref!.split('/').pop()! })}"
    );
  });

  it('the "Explore destination" link (a different, non-route-guide page) is not tracked by this event', () => {
    const exploreDestBlock = atlasSrc.match(/<Link href=\{activeDest\.href\}[\s\S]*?<\/Link>/)?.[0] ?? '';
    expect(exploreDestBlock).not.toMatch(/track\(/);
  });
});

describe('Route Atlas — no PII, unchanged behaviour otherwise', () => {
  it('none of the three new Atlas events reference anything beyond airport/destination/route slugs', () => {
    for (const eventName of ['atlas_origin_selected', 'atlas_destination_selected', 'atlas_route_opened']) {
      const idx = atlasSrc.indexOf(`track('${eventName}'`);
      expect(idx, `${eventName} not found`).toBeGreaterThan(-1);
      const line = atlasSrc.slice(atlasSrc.lastIndexOf('\n', idx) + 1, atlasSrc.indexOf('\n', idx));
      for (const forbidden of ['email', 'name', 'phone', 'passport']) {
        expect(line.toLowerCase()).not.toContain(forbidden);
      }
    }
  });

  it('geography, hit-radius maths, and the country/destination selection state model are untouched', () => {
    expect(atlasSrc).toContain('const lowerBound = Math.min(min, Math.max(0, safe));');
    expect(atlasSrc).toContain('function nearestDistance<T extends { slug: string; x: number; y: number }>(point: T, all: T[]): number {');
  });
});

describe('Journey Check — journey_check_started', () => {
  const markStartedBody = journeyCheckSrc.slice(
    journeyCheckSrc.indexOf('function markStarted'),
    journeyCheckSrc.indexOf('function onSubmit')
  );

  it('fires exactly once in the whole file, from inside markStarted', () => {
    const matches = journeyCheckSrc.match(/track\('journey_check_started'/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(markStartedBody).toContain("track('journey_check_started')");
  });

  it('is guarded by a ref so it can only fire once per mount, never repeatedly', () => {
    expect(journeyCheckSrc).toContain('const startedRef = useRef(false);');
    expect(markStartedBody).toMatch(/if \(startedRef\.current\) return;\s*startedRef\.current = true;\s*track\('journey_check_started'\)/);
  });

  it('does not fire on initial render — only from the two selects\' onChange handlers', () => {
    const beforeMarkStarted = journeyCheckSrc.slice(0, journeyCheckSrc.indexOf('function markStarted'));
    expect(beforeMarkStarted).not.toMatch(/track\(/);
    const onChangeCalls = journeyCheckSrc.match(/onChange=\{\(e\) => \{\s*markStarted\(\);/g) ?? [];
    expect(onChangeCalls).toHaveLength(2);
  });

  it('carries no properties (nothing safe or useful to attach to a bare "began interacting" signal)', () => {
    expect(journeyCheckSrc).toContain("track('journey_check_started');");
  });
});

describe('Journey Check — journey_check_completed', () => {
  const onSubmitBody = journeyCheckSrc.slice(journeyCheckSrc.indexOf('function onSubmit'), journeyCheckSrc.indexOf('return ('));

  it('fires exactly once, unconditionally on submit — every combination resolves to a real page, so every submit is a valid result', () => {
    const matches = journeyCheckSrc.match(/track\('journey_check_completed'/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(onSubmitBody).toContain("track('journey_check_completed'");
  });

  it('uses a safe predefined category (route vs destination_guide), never the full label/city text', () => {
    expect(onSubmitBody).toContain("const resultCategory = routeSlug ? 'route' : 'destination_guide';");
    // Two properties is the standard Vercel Pro ceiling, so the origin and
    // destination slugs are carried as one composite route slug instead of
    // two separate fields — no information is lost.
    expect(onSubmitBody).toContain('track(\'journey_check_completed\', { route: `${fromSlug}-${toSlug}`, resultCategory });');
    expect(onSubmitBody).not.toMatch(/resultCategory.*(fromLabel|toLabel|toCity)/);
  });

  it('only fires from the submit handler (a real user action), never from a render-time computation', () => {
    const beforeOnSubmit = journeyCheckSrc.slice(0, journeyCheckSrc.indexOf('function onSubmit'));
    expect(beforeOnSubmit).not.toMatch(/track\('journey_check_completed'/);
  });
});

describe('Journey Check — journey_check_route_opened', () => {
  const onSubmitBody = journeyCheckSrc.slice(journeyCheckSrc.indexOf('function onSubmit'), journeyCheckSrc.indexOf('return ('));

  it('fires exactly once, only when a real tracked route was found (not the destination-guide fallback)', () => {
    const matches = journeyCheckSrc.match(/track\('journey_check_route_opened'/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(onSubmitBody).toMatch(/if \(routeSlug\) track\('journey_check_route_opened', \{ route: routeSlug \}\);/);
  });

  it('sends only the real route slug', () => {
    expect(onSubmitBody).toContain("track('journey_check_route_opened', { route: routeSlug });");
  });

  it('fires before navigation, so it is never skipped by the route change unmounting the component', () => {
    const trackIdx = onSubmitBody.indexOf("track('journey_check_route_opened'");
    const pushIdx = onSubmitBody.indexOf('router.push(');
    expect(trackIdx).toBeGreaterThan(-1);
    expect(pushIdx).toBeGreaterThan(trackIdx);
  });
});

describe('Journey Check — no PII, unchanged navigation behaviour otherwise', () => {
  it('none of the three new events reference anything beyond origin/destination/route slugs and the safe result category', () => {
    for (const eventName of ['journey_check_started', 'journey_check_completed', 'journey_check_route_opened']) {
      const idx = journeyCheckSrc.indexOf(`track('${eventName}'`);
      expect(idx, `${eventName} not found`).toBeGreaterThan(-1);
      const line = journeyCheckSrc.slice(journeyCheckSrc.lastIndexOf('\n', idx) + 1, journeyCheckSrc.indexOf('\n', idx));
      for (const forbidden of ['email', 'name', 'phone', 'passport', 'Label', 'City']) {
        expect(line).not.toContain(forbidden);
      }
    }
  });

  it('the exact navigation logic (tracked route vs destination-guide fallback) is unchanged', () => {
    expect(journeyCheckSrc).toContain('router.push(routeSlug ? `/routes/${routeSlug}` : `/destinations/${toSlug}`);');
  });

  it('the "never a dead end" fallback copy is unchanged', () => {
    expect(journeyCheckSrc).toContain('Press Check to open the route guide.');
    expect(journeyCheckSrc).toContain('Check will open the {toCity} destination guide instead.');
  });
});
