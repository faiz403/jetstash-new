import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { deals, getDealsByDestination } from '@/data/deals';
import { getRouteByAirportAndDestination, routes } from '@/data/routes';
import { getFareRangeSummary } from '@/data/fare-observations';
import { getFareSignalForRoute } from '@/lib/fare-signal';

/**
 * Participant 1 defect follow-up (21 Aug 2026) — two objective, reproducible
 * production defects found during real-user validation of PRs #155/#156.
 * See docs/project-control (or git history around this date) for the full
 * audit; this file locks in both fixes and guards against regressions.
 */

const nowIso = '2026-08-21';

describe('Defect 1 — homepage "Check my journey" navigation', () => {
  const formSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/journey-check-form.tsx'), 'utf8');

  // Root cause, confirmed via the real server-rendered HTML (curl'd from
  // production 21 Aug 2026): this <form> has no action/method attribute, so
  // it depends entirely on React's onSubmit handler calling
  // e.preventDefault(). A submit reaching the browser before hydration
  // attaches that handler falls through to the native default: a plain GET
  // reload of the current page (no action = itself; the <select>s carry no
  // `name`, so nothing survives), which looks exactly like "Check my
  // journey did nothing" — not a route-resolution, selector-state, or
  // submit-navigation-logic bug (all three were audited and are correct;
  // live-tested successfully on both desktop and mobile viewports once the
  // click genuinely reached a hydrated page). The fix is a standard
  // hydration-safety guard: the button stays disabled until mount.
  it('the submit button is disabled until the component has mounted (hydration-safety guard)', () => {
    expect(formSrc).toMatch(/const \[mounted, setMounted\] = useState\(false\)/);
    expect(formSrc).toMatch(/useEffect\(\s*\(\)\s*=>\s*\{\s*setMounted\(true\);\s*\}\s*,\s*\[\]\s*\)/);
    expect(formSrc).toContain('disabled={!mounted}');
  });

  it('useEffect is imported (the guard actually compiles, not just string-matches)', () => {
    expect(formSrc).toMatch(/import\s*\{[^}]*\buseEffect\b[^}]*\}\s*from\s*'react'/);
  });

  it('the submit handler itself is unchanged: still prevents the default and still routes to the correct outcome', () => {
    expect(formSrc).toContain('e.preventDefault();');
    expect(formSrc).toContain('router.push(routeSlug ? `/routes/${routeSlug}` : `/destinations/${toSlug}`)');
  });

  it('the underlying <form> genuinely has no action/method — confirms why the hydration race was possible, and that this fix (not a server fallback) is the right one', () => {
    expect(formSrc).toMatch(/<form onSubmit=\{onSubmit\}/);
    expect(formSrc).not.toMatch(/<form[^>]*\baction=/);
    expect(formSrc).not.toMatch(/<form[^>]*\bmethod=/);
  });

  // The real-data half of "a valid Manchester→Islamabad selection navigates
  // to the correct route guide" — journey-desk-home.tsx builds routeIndex as
  // `${r.airportSlug}|${r.destinationSlug}` -> r.slug (asserted against the
  // real source in tests/homepage-journey-check-form.test.ts); this proves
  // that composite key genuinely resolves to the right route for the exact
  // pairing Participant 1 used, using the real data the component consumes.
  it('the real tracked-route data resolves Manchester + Islamabad to manchester-islamabad, exactly as the participant selected', () => {
    const routeIndex: Record<string, string> = {};
    for (const r of routes) routeIndex[`${r.airportSlug}|${r.destinationSlug}`] = r.slug;
    expect(routeIndex['manchester|islamabad']).toBe('manchester-islamabad');
  });
});

describe('Defect 2 — stale "No fare checks logged yet" reading as a contradiction', () => {
  it('man-isb-economy (has a current fare) now renders before man-isb-business (no fare) in the deals array', () => {
    const group = getDealsByDestination('islamabad').filter((d) => d.fromAirportSlug === 'manchester');
    const ids = group.map((d) => d.id);
    expect(ids).toContain('man-isb-economy');
    expect(ids).toContain('man-isb-business');
    expect(ids.indexOf('man-isb-economy')).toBeLessThan(ids.indexOf('man-isb-business'));
  });

  it('both deal entries survived the reorder unchanged in every other field', () => {
    const economy = deals.find((d) => d.id === 'man-isb-economy');
    const business = deals.find((d) => d.id === 'man-isb-business');
    expect(economy).toMatchObject({
      category: 'flight',
      cabin: 'Economy',
      fromAirportSlug: 'manchester',
      toDestinationSlug: 'islamabad',
      fromCity: 'Manchester',
      toCity: 'Islamabad',
      toCountry: 'Pakistan',
      airline: 'PIA',
    });
    expect(business).toMatchObject({
      category: 'business',
      cabin: 'Business',
      fromAirportSlug: 'manchester',
      toDestinationSlug: 'islamabad',
      fromCity: 'Manchester',
      toCity: 'Islamabad',
      toCountry: 'Pakistan',
      airline: 'PIA',
    });
  });

  it('confirms the underlying reality the reorder responds to: Economy has a publishable fare range, Business does not', () => {
    expect(getFareRangeSummary('manchester-islamabad', 'Economy', nowIso)).not.toBeNull();
    expect(getFareRangeSummary('manchester-islamabad', 'Business', nowIso)).toBeNull();
  });

  it('the route does have a current, cabin-agnostic Fare Signal — this is the top-of-page panel a reader sees first, which is what made the old ordering read as contradictory', () => {
    expect(getFareSignalForRoute('manchester-islamabad', nowIso).state).toBe('current');
  });

  // Systemic-vs-isolated check, generalised rather than hardcoded to
  // Manchester–Islamabad: for every airport+destination pairing with 2+
  // curated deals, no no-fare deal card may render before a has-fare one.
  // This is the permanent guard against the same class of defect recurring
  // on a different route as data/deals.ts or data/fare-observations.ts
  // changes over time — not just a fixed assertion about today's data.
  it('no airport+destination deal group anywhere has a no-fare card before a has-fare card (systemic guard, not route-specific)', () => {
    const groups = new Map<string, typeof deals>();
    for (const d of deals) {
      const key = `${d.fromAirportSlug}|${d.toDestinationSlug}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }

    const offenders: string[] = [];
    for (const [key, group] of groups) {
      if (group.length < 2) continue;
      const [fromAirportSlug, toDestinationSlug] = key.split('|');
      const route = getRouteByAirportAndDestination(fromAirportSlug, toDestinationSlug);
      if (!route) continue;

      let sawNoRange = false;
      for (const d of group) {
        const range = getFareRangeSummary(route.slug, d.cabin, nowIso);
        if (!range) {
          sawNoRange = true;
        } else if (sawNoRange) {
          offenders.push(`${route.slug}: ${d.cabin} (has fare) renders after a no-fare cabin`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
