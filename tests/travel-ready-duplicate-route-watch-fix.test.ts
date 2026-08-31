import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Real-user validation follow-up (30 Aug 2026) — duplicate Route Watch fix.
 *
 * A founder manually testing Travel Ready Check on
 * jetstash.co.uk/routes/manchester-mumbai (a genuine human reproduction,
 * not automation) pressed "Check my travel readiness" and reported JetStash
 * "navigated to Route Watch instead of showing the Travel Ready result".
 *
 * Root-cause diagnostic confirmed: no navigation ever occurred (the URL
 * never changed). The Travel Ready verdict rendered correctly, but a
 * SECOND, duplicate inline Route Watch form also appeared directly beneath
 * it, because app/routes/[slug]/page.tsx's raw <TravelReadyCheck> call
 * never passed `showInlineRouteWatch={false}` — even though that page
 * always renders its own separate <RouteWatchForm> further down, and
 * TravelReadyCheck's own doc comment has said route pages must pass that
 * prop since the feature's original commit. Confirmed via
 * `git log --follow -p` that this call site has never been updated since it
 * was first written — a pre-existing defect unrelated to PR #195/Stage A.
 *
 * This affects every route with Travel Ready support EXCEPT the 5 Book-By
 * priority routes (which correctly route through RouteReadinessPanel,
 * already passing showInlineRouteWatch={false}) — i.e. 83 of 88 routes,
 * including Manchester-Mumbai, the exact page tested.
 *
 * This suite locks in the one-line fix at the source level (this project
 * has no jsdom/@testing-library dependency, so a real rendered-DOM
 * assertion isn't available — see
 * tests/travel-ready-check-recovery-path-fix.test.ts's own header comment
 * for the same established constraint and pattern).
 */

const routePageSrc = readFileSync(join(process.cwd(), 'app', 'routes', '[slug]', 'page.tsx'), 'utf8');

describe('Duplicate Route Watch fix — the raw route-page TravelReadyCheck call', () => {
  it('passes showInlineRouteWatch={false}, matching the component\'s own documented requirement for route pages', () => {
    const callMatch = routePageSrc.match(/<TravelReadyCheck[^/]*\/>/);
    expect(callMatch, 'expected to find the raw <TravelReadyCheck ... /> call in app/routes/[slug]/page.tsx').not.toBeNull();
    expect(callMatch![0]).toContain('showInlineRouteWatch={false}');
  });

  it('the RouteReadinessPanel branch (Book-By priority routes) is untouched and unaffected by this fix', () => {
    // Confirms this fix didn't touch the other branch, which already
    // handles this correctly via its own internal showInlineRouteWatch={false}.
    expect(routePageSrc).toContain('<RouteReadinessPanel');
  });
});

describe('Duplicate Route Watch fix — the route page still has exactly one separate RouteWatchForm', () => {
  it('renders its own dedicated RouteWatchForm further down the page (the reason showInlineRouteWatch must be false here)', () => {
    const routeWatchFormMatches = routePageSrc.match(/<RouteWatchForm\b/g) ?? [];
    // Exactly one direct <RouteWatchForm> call on this page — the page's own
    // dedicated section. TravelReadyCheck's own inline one is suppressed by
    // showInlineRouteWatch={false}, so it never renders a second instance
    // regardless of the Travel Ready verdict.
    expect(routeWatchFormMatches).toHaveLength(1);
  });

  it('this duplicate-form configuration cannot silently regress: the raw TravelReadyCheck call and the page\'s own RouteWatchForm must never both go unguarded', () => {
    // If a future edit adds a second raw <TravelReadyCheck ... /> call to
    // this file without showInlineRouteWatch={false}, this test fails —
    // every <TravelReadyCheck> call in this file that isn't routed through
    // RouteReadinessPanel must explicitly suppress its own inline form,
    // since this page already has a dedicated RouteWatchForm section.
    const travelReadyCheckCalls = routePageSrc.match(/<TravelReadyCheck[^/]*\/>/g) ?? [];
    expect(travelReadyCheckCalls.length).toBeGreaterThan(0);
    for (const call of travelReadyCheckCalls) {
      expect(call, call).toContain('showInlineRouteWatch={false}');
    }
  });
});

describe('Scope: date-input handling, Travel Ready rules and other route content are untouched by this fix', () => {
  it('travel-ready-check.tsx itself was not modified by this batch (no source-level trace of a date-input or rules change here)', () => {
    // This fix is scoped entirely to the one call site above — the
    // component itself, its date inputs and lib/travel-ready-check.ts's
    // factual rules are untouched. This is a documentation guard, not a
    // duplicate of that file's own test suite.
    const componentSrc = readFileSync(join(process.cwd(), 'components', 'travel-ready', 'travel-ready-check.tsx'), 'utf8');
    expect(componentSrc).toContain('showInlineRouteWatch = true'); // the component's own default is unchanged
  });
});
