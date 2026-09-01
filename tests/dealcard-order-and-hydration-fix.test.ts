import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { deals, getDealsByDestination, isBundledProductDeal, type DealCabin } from '@/data/deals';
import { getRouteByAirportAndDestination, routes } from '@/data/routes';
import { getFareRangeSummary } from '@/data/fare-observations';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { DealCard } from '@/components/ui/deal-card';

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

describe('Defect 2 follow-up (founder review) — cabin-specific fallback wording replaces the generic sentence', () => {
  const dealCardSrc = readFileSync(join(process.cwd(), 'components/ui/deal-card.tsx'), 'utf8');

  // Mirrors deal-card.tsx's own cabinLabel map exactly (same convention as
  // tests/whatsapp-share-route-status.test.ts mirroring WhatsAppShareButton's
  // own construction) — the source-text assertion below pins the map's real
  // values, so if the two ever diverge this test catches it.
  const cabinLabel: Record<DealCabin, string> = {
    Economy: 'Economy',
    'Premium Economy': 'Premium Economy',
    Business: 'Business class',
  };

  it("deal-card.tsx's cabinLabel map has the exact values this test relies on", () => {
    expect(dealCardSrc).toContain("Economy: 'Economy'");
    expect(dealCardSrc).toContain("'Premium Economy': 'Premium Economy'");
    expect(dealCardSrc).toContain("Business: 'Business class'");
  });

  it('the no-fare fallback is derived from the card\'s own cabin, not hardcoded to any route or cabin', () => {
    expect(dealCardSrc).toContain('`No ${cabinLabel[deal.cabin]} fare checks logged yet — check the live price below`');
    // The generic, cabin-agnostic sentence must be gone — this is exactly
    // the wording Participant 1 misread as contradicting the fare shown
    // elsewhere on the same page.
    expect(dealCardSrc).not.toContain("'No fare checks logged yet — check the live price below'");
  });

  it('the package/Umrah fallback is untouched — a different, already-correct concern (bundled-product price, not cabin)', () => {
    expect(dealCardSrc).toContain("'No package price tracked yet.'");
  });

  it('the CTA below the fallback (route-guide link, Trip.com button) is structurally unchanged', () => {
    expect(dealCardSrc).toContain('More on the route guide');
    expect(dealCardSrc).toContain('Booking-window guidance on the route guide');
    expect(dealCardSrc).toContain('Compare flights on Trip.com');
    expect(dealCardSrc).toContain('Direct flight comparison is not available for this airport yet.');
  });

  // Truthfulness check across every card actually affected today (real
  // data, not a synthetic fixture): every currently no-fare, non-package
  // deal renders a cabin-named sentence — never the old bare wording, never
  // "undefined" (DealCabin is a closed union, so cabinLabel[deal.cabin]
  // cannot miss, but this proves it against real deal entries rather than
  // just trusting the type system).
  it('every currently affected no-fare card (7 as of 22 Aug 2026, after Business Fare Evidence Batch 1: 6 Business, 1 Economy) renders a truthful, cabin-named sentence', () => {
    // Was 10 (9 Business, 1 Economy) earlier the same day, after Fare
    // Coverage Batch 1. Business Fare Evidence Batch 1 (same day, later)
    // gave man-lhe-business, lhr-business-lhe and lhr-doh-business each
    // their first real published fare, dropping all three off this list —
    // the remaining Economy no-fare card (lgw-amd-economy,
    // london-gatwick-ahmedabad) is untouched by this batch (its own
    // unrelated verification dispute is why it stays no-fare — see
    // ROUTE_VERIFICATION_CADENCE_POLICY.md).
    // Classification B: this test's own title names "22 Aug 2026, after
    // Business Fare Evidence Batch 1" -- one day after the file's own
    // nowIso (21 Aug). Fixed at the earliest date that batch's evidence
    // actually existed.
    const nowIsoLocal = '2026-08-22';
    const affected: { id: string; cabin: DealCabin; sentence: string }[] = [];

    for (const d of deals) {
      if (isBundledProductDeal(d)) continue;
      const route = getRouteByAirportAndDestination(d.fromAirportSlug, d.toDestinationSlug);
      if (!route) continue;
      const range = getFareRangeSummary(route.slug, d.cabin, nowIsoLocal);
      if (range) continue;

      const sentence = `No ${cabinLabel[d.cabin]} fare checks logged yet — check the live price below`;
      expect(sentence).not.toContain('undefined');
      expect(sentence.startsWith(`No ${cabinLabel[d.cabin]} `)).toBe(true);
      affected.push({ id: d.id, cabin: d.cabin, sentence });
    }

    expect(affected.length).toBe(7);
    expect(affected.filter((a) => a.cabin === 'Business')).toHaveLength(6);
    expect(affected.filter((a) => a.cabin === 'Economy')).toHaveLength(1);
    // Manchester-Islamabad's own Business card, by name — the exact card
    // Participant 1 read as contradictory. Untouched by this batch
    // (manchester-islamabad is not one of the four routes it evidenced).
    expect(affected.some((a) => a.id === 'man-isb-business' && a.sentence === 'No Business class fare checks logged yet — check the live price below')).toBe(true);
  });

  it('the 4 routes with a has-fare cabin alongside a no-fare cabin (the real ambiguity class) all get a self-contained, cabin-named sentence for their no-fare card', () => {
    // Was 6 before Business Fare Evidence Batch 1. london-heathrow-doha and
    // manchester-lahore both drop off this list — Business Fare Evidence
    // Batch 1 gave their previously-no-fare Business cabin a real
    // observation, so both routes now have EVERY cabin covered rather than
    // a mix of has-fare and no-fare. (london-heathrow-lahore and
    // manchester-karachi were never on this list at all — each has only
    // one curated Deal, so there's no second cabin to be "mixed" with.)
    // Classification B: this test's own comment names "Business Fare
    // Evidence Batch 1" (22 Aug 2026), one day after the file's own nowIso.
    const mixedRoutesEvaluationIso = '2026-08-22';
    const groups = new Map<string, typeof deals>();
    for (const d of deals) {
      const key = `${d.fromAirportSlug}|${d.toDestinationSlug}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }

    const mixedRoutes: string[] = [];
    for (const [key, group] of groups) {
      if (group.length < 2) continue;
      const [fromAirportSlug, toDestinationSlug] = key.split('|');
      const route = getRouteByAirportAndDestination(fromAirportSlug, toDestinationSlug);
      if (!route) continue;
      const flightDeals = group.filter((d) => !isBundledProductDeal(d));
      const withRange = flightDeals.filter((d) => getFareRangeSummary(route.slug, d.cabin, mixedRoutesEvaluationIso));
      const withoutRange = flightDeals.filter((d) => !getFareRangeSummary(route.slug, d.cabin, mixedRoutesEvaluationIso));
      if (withRange.length > 0 && withoutRange.length > 0) {
        mixedRoutes.push(route.slug);
        for (const d of withoutRange) {
          const sentence = `No ${cabinLabel[d.cabin]} fare checks logged yet — check the live price below`;
          expect(sentence).toContain(cabinLabel[d.cabin]);
        }
      }
    }

    expect(mixedRoutes.sort()).toEqual(
      ['birmingham-amritsar', 'london-heathrow-delhi', 'manchester-dubai', 'manchester-islamabad'].sort()
    );
  });

  // Real render, not just a source-text or string-template check — same
  // renderToStaticMarkup(DealCard({ deal })) pattern already established in
  // tests/antalya-fare-package-truth.test.ts. Proves the exact HTML a
  // visitor receives for the two cards at the centre of this whole defect.
  it('man-isb-business genuinely renders "No Business class fare checks logged yet" — the real card Participant 1 misread', () => {
    const dealDef = deals.find((d) => d.id === 'man-isb-business')!;
    const html = renderToStaticMarkup(DealCard({ deal: dealDef }));
    expect(html).toContain('No Business class fare checks logged yet — check the live price below');
    expect(html).not.toMatch(/>No fare checks logged yet/);
  });

  it('man-isb-economy genuinely renders its real fare range, untouched by the wording fix (only the no-fare branch changed)', () => {
    const dealDef = deals.find((d) => d.id === 'man-isb-economy')!;
    const html = renderToStaticMarkup(DealCard({ deal: dealDef }));
    expect(html).toMatch(/£\d/);
    expect(html).not.toContain('fare checks logged yet');
  });
});
