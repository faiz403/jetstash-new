import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routes, getRouteAirport, getRouteDestination } from '@/data/routes';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getJourneyChoiceForRoute, JOURNEY_CHOICE_PILOT_ROUTE_SLUGS } from '@/lib/journey-choice-route-adapter';
import { deriveFareWindowReconciliation } from '@/lib/fare-window-reconciliation';
import { FareWindowReconciliationNote } from '@/components/route/fare-window-reconciliation-note';
import { getTripComFlightHandoffUrl, NO_VERIFIED_PARTNER_LINK_NOTE } from '@/lib/booking-providers';

/**
 * Route Page Simplification Phase 1 (25 Aug 2026).
 *
 * Two items, both from the Route Page Decision-First & Density audit's §20
 * "one single recommended next PR":
 *   1. One reconciliation sentence where a second fare block covers a
 *      DIFFERENT travel-date window from the first (the audit's single P0 —
 *      manchester-islamabad's Fare Signal vs Journey Choice's £601/£621/£626
 *      for 6–20 October, never reconciled anywhere on the page). The "real
 *      windows" tests below deliberately assert structure (the windows
 *      differ, both name a real month) rather than a specific fare/date pair
 *      — Fare Signal's own figure moves every time a fare-coverage batch
 *      logs a new manchester-islamabad check (£630 for 13–27 Oct when this
 *      PR was first written; £460 for 20 Oct–3 Nov as of the 25 Aug batch),
 *      and this predicate must keep reconciling correctly either way.
 *   2. The two divergent fail-closed sentences replaced by one shared
 *      constant.
 *
 * Nothing else from the audit's Phases 2–7 is in this PR, and Journey
 * Choice's own derivation, evidence drawer, dated handoff and measurement
 * instrumentation are untouched — the reconciliation reads two already-
 * public date strings and is rendered by page.tsx OUTSIDE the JourneyChoice
 * component.
 */

const NOW_ISO = '2026-08-25';
const routePageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');
const fareSignalSrc = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');
const bookBySrc = readFileSync(join(process.cwd(), 'components/route/book-by-countdown.tsx'), 'utf8');
const journeyChoiceLibSrc = readFileSync(join(process.cwd(), 'lib/journey-choice.ts'), 'utf8');
const journeyChoiceComponentSrc = readFileSync(join(process.cwd(), 'components/route/journey-choice.tsx'), 'utf8');

/** Exactly what app/routes/[slug]/page.tsx computes, for every route. */
function reconciliationFor(routeSlug: string) {
  const fareSignal = getFareSignalForRoute(routeSlug, NOW_ISO);
  const journeyChoice = getJourneyChoiceForRoute(routeSlug, NOW_ISO);
  return {
    fareSignal,
    journeyChoice,
    reconciliation: deriveFareWindowReconciliation(
      fareSignal.observation,
      journeyChoice ? journeyChoice.lowerFare : null
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// (a) The reconciliation sentence renders ONLY when two rendered fare blocks
//     carry differing travel-date windows — never otherwise.
// ─────────────────────────────────────────────────────────────────────────

describe('reconciliation derivation fails closed', () => {
  it('returns null when either window is missing — silence, never a guess', () => {
    const window = { departureDate: '2026-10-06', returnDate: '2026-10-20' };
    expect(deriveFareWindowReconciliation(null, window)).toBeNull();
    expect(deriveFareWindowReconciliation(window, null)).toBeNull();
    expect(deriveFareWindowReconciliation(undefined, undefined)).toBeNull();
    expect(deriveFareWindowReconciliation({ departureDate: '', returnDate: '' }, window)).toBeNull();
  });

  it('returns null when the two windows are identical — the same trip needs no reconciling', () => {
    const window = { departureDate: '2026-10-06', returnDate: '2026-10-20' };
    expect(deriveFareWindowReconciliation(window, { ...window })).toBeNull();
  });

  it('fires when only the departure date differs, and when only the return date differs', () => {
    const base = { departureDate: '2026-10-06', returnDate: '2026-10-20' };
    expect(deriveFareWindowReconciliation(base, { ...base, departureDate: '2026-10-13' })).not.toBeNull();
    expect(deriveFareWindowReconciliation(base, { ...base, returnDate: '2026-10-27' })).not.toBeNull();
  });

  it('names both windows in the same date format Journey Choice itself renders', () => {
    const result = deriveFareWindowReconciliation(
      { departureDate: '2026-10-13', returnDate: '2026-10-27' },
      { departureDate: '2026-10-06', returnDate: '2026-10-20' }
    )!;
    expect(result.firstWindowLabel).toBe('13 October 2026 to 27 October 2026');
    expect(result.secondWindowLabel).toBe('6 October 2026 to 20 October 2026');
    expect(result.sentence).toContain('13 October 2026 to 27 October 2026');
    expect(result.sentence).toContain('6 October 2026 to 20 October 2026');
  });

  it('never claims one fare is better, cheaper, fresher or more correct than the other', () => {
    const result = deriveFareWindowReconciliation(
      { departureDate: '2026-10-13', returnDate: '2026-10-27' },
      { departureDate: '2026-10-06', returnDate: '2026-10-20' }
    )!;
    expect(result.sentence).not.toMatch(/cheap|cheaper|cheapest|better|best|deal|save|lower price|out of date|wrong/i);
    expect(result.sentence).not.toMatch(/£/);
  });
});

describe('across the full route catalogue, the sentence renders only where two fare blocks disagree on dates', () => {
  it('renders on manchester-islamabad — the audit P0 — and correctly names both real windows', () => {
    const { fareSignal, journeyChoice, reconciliation } = reconciliationFor('manchester-islamabad');
    expect(fareSignal.observation).not.toBeNull();
    expect(journeyChoice).not.toBeNull();
    expect(reconciliation).not.toBeNull();
    expect(reconciliation!.firstWindowLabel).not.toBe(reconciliation!.secondWindowLabel);
    // The two windows are exactly the ones the two blocks themselves print.
    expect(reconciliation!.firstWindowLabel).toContain('October');
    expect(reconciliation!.secondWindowLabel).toContain('October');
  });

  it('never renders on any route without a second fare block — i.e. every non-pilot route', () => {
    for (const route of routes) {
      if (JOURNEY_CHOICE_PILOT_ROUTE_SLUGS.includes(route.slug)) continue;
      const { journeyChoice, reconciliation } = reconciliationFor(route.slug);
      expect(journeyChoice, route.slug).toBeNull();
      expect(reconciliation, route.slug).toBeNull();
    }
  });

  it('representative Core / Reference / Truth-Watch shapes all stay silent', () => {
    for (const slug of [
      'manchester-lahore',
      'manchester-dubai',
      'london-heathrow-jeddah',
      'manchester-karachi',
      'birmingham-amritsar',
      'manchester-antalya',
      'manchester-marrakech',
      'manchester-barcelona',
      'london-gatwick-ahmedabad',
      'manchester-sylhet',
    ]) {
      expect(reconciliationFor(slug).reconciliation, slug).toBeNull();
    }
  });

  it('whenever it does render, the two windows genuinely differ in the underlying data', () => {
    for (const route of routes) {
      const { fareSignal, journeyChoice, reconciliation } = reconciliationFor(route.slug);
      if (!reconciliation) continue;
      const first = fareSignal.observation!;
      const second = journeyChoice!.lowerFare;
      expect(
        first.departureDate !== second.departureDate || first.returnDate !== second.returnDate,
        route.slug
      ).toBe(true);
    }
  });
});

describe('the rendered note is orientation, not a new commercial surface', () => {
  it('renders the sentence with no link, no CTA and no affiliate disclosure', () => {
    const reconciliation = deriveFareWindowReconciliation(
      { departureDate: '2026-10-13', returnDate: '2026-10-27' },
      { departureDate: '2026-10-06', returnDate: '2026-10-20' }
    )!;
    const html = renderToStaticMarkup(FareWindowReconciliationNote({ reconciliation })).replace(/\s+/g, ' ');
    expect(html).toContain('These are two different trips.');
    expect(html).not.toContain('<a');
    expect(html).not.toContain('Trip.com');
    expect(html).not.toContain('Affiliate');
  });

  it('page.tsx gates it on BOTH blocks rendering, and renders it outside the JourneyChoice component', () => {
    expect(routePageSrc).toContain('deriveFareWindowReconciliation(');
    // MAN→ISB Flagship Verdict pilot, Phase 1 (September 2026): the note now
    // sits inside its own `{journeyChoice && (<section>...)}` wrapper
    // (moved up alongside the relocated <JourneyChoice>, see
    // tests/route-verdict.test.ts), so the combined condition is now two
    // nested checks — `{journeyChoice && (` outside, `{fareWindowReconciliation && (`
    // inside — rather than one single `&&` chain. The invariant this test
    // exists to protect is unchanged: the note still renders only when BOTH
    // journeyChoice AND fareWindowReconciliation are truthy (nesting one
    // inside the other is exactly that), and still outside JourneyChoice.
    expect(routePageSrc).toContain('{journeyChoice && (');
    expect(routePageSrc).toContain('{fareWindowReconciliation && (');
    expect(routePageSrc).toContain('<FareWindowReconciliationNote reconciliation={fareWindowReconciliation} />');
    // The note is never rendered from inside the frozen pilot component.
    expect(journeyChoiceComponentSrc).not.toContain('FareWindowReconciliationNote');
    expect(journeyChoiceComponentSrc).not.toContain('deriveFareWindowReconciliation');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// (b) One fail-closed sentence, identical across Fare Signal and Book-By.
// ─────────────────────────────────────────────────────────────────────────

describe('the two divergent fail-closed sentences are now one shared constant', () => {
  it('is the exact Fare Signal wording, kept verbatim', () => {
    expect(NO_VERIFIED_PARTNER_LINK_NOTE).toBe(
      'Exact partner booking link is not currently verified for this route.'
    );
  });

  it('Fare Signal and Book-By Countdown both render it from the constant, neither from a literal', () => {
    expect(fareSignalSrc).toContain('NO_VERIFIED_PARTNER_LINK_NOTE');
    expect(bookBySrc).toContain('NO_VERIFIED_PARTNER_LINK_NOTE');
    // The old Book-By wording survives only inside its explanatory comment,
    // never as rendered JSX.
    expect(bookBySrc).not.toMatch(
      /<p className="text-sm text-ink-400">Direct flight comparison is not available for this airport yet\.<\/p>/
    );
  });

  it('the fail-closed DECISION is untouched — the same routes still have no partner link', () => {
    let withUrl = 0;
    let withoutUrl = 0;
    for (const route of routes) {
      const airport = getRouteAirport(route);
      const dest = getRouteDestination(route);
      if (!airport || !dest) continue;
      if (getTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug)) withUrl += 1;
      else withoutUrl += 1;
    }
    // Same 63 / 25 split guarded by tests/route-hero-scanability.test.ts —
    // this PR adds no CTA and removes none.
    expect(withUrl).toBe(63);
    expect(withoutUrl).toBe(25);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// (c) No route loses a Trip.com CTA it previously had — the one invariant
//     every phase of the larger plan is told to protect.
// ─────────────────────────────────────────────────────────────────────────

describe('Journey Choice remains functionally frozen', () => {
  it('the pilot allowlist is still manchester-islamabad only', () => {
    expect([...JOURNEY_CHOICE_PILOT_ROUTE_SLUGS]).toEqual(['manchester-islamabad']);
  });

  it('the decision sentence is still derived, and its shape unchanged', () => {
    const journeyChoice = getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO)!;
    expect(journeyChoice.decision.sentence).toMatch(/^£[\d,]+ more saves .+ of journey time\.$/);
    expect(journeyChoice.decision.priceDifference).toBeGreaterThan(0);
    expect(journeyChoice.decision.timeDifferenceMinutes).toBeGreaterThan(0);
  });

  it('this PR added nothing to lib/journey-choice.ts', () => {
    expect(journeyChoiceLibSrc).not.toContain('reconciliation');
    expect(journeyChoiceLibSrc).not.toContain('Reconciliation');
  });

  it('Journey Choice still renders its own dated Trip.com CTA and evidence drawer', () => {
    expect(journeyChoiceComponentSrc).toContain('journey_choice_cta_click');
    expect(journeyChoiceComponentSrc).toContain('JOURNEY_CHOICE_DATED_HANDOFF_NOTE');
    expect(journeyChoiceComponentSrc).toContain('JourneyChoiceEvidenceDisclosure');
    expect(journeyChoiceComponentSrc).toContain('JourneyChoiceImpressionSection');
  });
});
