import { describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getRouteBySlug, getRouteAirport, getRouteDestination, routes } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getAirlinesBySlugs } from '@/data/airlines';
import { getJourneyChoiceForRoute, JOURNEY_CHOICE_PILOT_ROUTE_SLUGS } from '@/lib/journey-choice-route-adapter';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';
import { getJourneyChoiceTripComHandoff } from '@/lib/tripcom-dated-handoff';
import { RouteVerdict } from '@/components/route/route-verdict';

/**
 * MAN→ISB Flagship Verdict pilot, Phase 1 (September 2026, founder-approved
 * narrow scope). This suite exists specifically to protect the founder's
 * CRITICAL EVIDENCE RULE correction: Journey Choice and Fare Signal are two
 * different, independently-dated observation sets, and the Verdict must
 * never blend them into one implied current-market comparison
 * ("COMPARABLE OR NOT SHOWN"). See components/route/route-verdict.tsx's own
 * doc comment for the full rule this file enforces.
 */

const routePageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');
const fareSignalSrc = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');
const journeyChoiceSrc = readFileSync(join(process.cwd(), 'components/route/journey-choice.tsx'), 'utf8');
const NOW_ISO = '2026-09-03';

function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'number') { out.push(String(node)); return out; }
  if (typeof node === 'string') { out.push(node); return out; }
  if (Array.isArray(node)) { node.forEach((child) => collectStrings(child, out)); return out; }
  if (isValidElement(node)) {
    const children = (node.props as { children?: unknown } | null)?.children;
    if (children !== undefined) collectStrings(children, out);
  }
  return out;
}

/** Exactly what app/routes/[slug]/page.tsx computes for RouteVerdict's props. */
function buildVerdictProps(routeSlug: string) {
  const route = getRouteBySlug(routeSlug)!;
  const airport = getRouteAirport(route)!;
  const dest = getRouteDestination(route)!;
  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
  const presentationAirlines = getAirlinesBySlugs(presentation.airlineSlugs);
  const journeyChoice = getJourneyChoiceForRoute(route.slug, NOW_ISO);
  const fareSignal = getFareSignalForRoute(route.slug, NOW_ISO);
  const tripComUrl = getTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug);
  const tripComHandoff = journeyChoice ? getJourneyChoiceTripComHandoff(route.slug, journeyChoice, tripComUrl) : null;
  return {
    journeyChoice,
    props: journeyChoice && {
      routeLabel: `${airport.city} to ${dest.city}`,
      routeSlug: route.slug,
      routeStatus: presentation.status,
      flightTime: presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.flightTime : null,
      routeDirectness: (presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.status : null) as 'direct' | 'connecting' | null,
      routeStatusLabel: presentation.status === 'direct' || presentation.status === 'connecting' ? presentation.statusLabel : null,
      routeAirlineLabel: presentationAirlines.length > 0 ? presentationAirlines.map((a) => a.name).join(', ') : null,
      journeyChoice,
      tripComHandoff,
      fareSignal,
    },
  };
}

describe('RouteVerdict renders only for evidenced routes', () => {
  it('the pilot allowlist is still manchester-islamabad only — Phase 1 must not have generalised Journey Choice', () => {
    expect([...JOURNEY_CHOICE_PILOT_ROUTE_SLUGS]).toEqual(['manchester-islamabad']);
  });

  it('every non-pilot route has no journeyChoice, so RouteVerdict never renders for it', () => {
    for (const route of routes) {
      if (JOURNEY_CHOICE_PILOT_ROUTE_SLUGS.includes(route.slug)) continue;
      const { journeyChoice } = buildVerdictProps(route.slug);
      expect(journeyChoice, route.slug).toBeNull();
    }
  });

  it('page.tsx gates the Verdict section on journeyChoice, the same gate Journey Choice itself uses', () => {
    expect(routePageSrc).toContain('{journeyChoice && (');
    expect(routePageSrc).toContain('<RouteVerdict');
  });
});

describe('CRITICAL EVIDENCE RULE: Journey Choice and Fare Signal never blend into one implied current comparison', () => {
  const { props } = buildVerdictProps('manchester-islamabad');
  const html = renderToStaticMarkup(RouteVerdict(props!)).replace(/\s+/g, ' ').replace(/&#x27;/g, "'");

  it('renders three separately labelled blocks — Route reality, Journey Choice, Recent fare checks', () => {
    expect(html).toContain('Route reality');
    expect(html).toContain('Journey Choice');
    expect(html).toContain('Recent fare checks');
  });

  it('surfaces Journey Choice\'s own decision sentence verbatim, never a recomputed one', () => {
    expect(html).toContain(props!.journeyChoice.decision.sentence);
    expect(html).toMatch(/£[\d,]+ more saves .+ of journey time\./);
  });

  it('names Journey Choice\'s own checked and travel dates explicitly', () => {
    expect(html).toContain('Checked');
    expect(html).toContain('for travel');
    expect(html).toContain('Not a live price feed.');
  });

  it('the Verdict\'s entire rendered copy never uses an em dash or en dash — JetStash public copy avoids dash separators', () => {
    // checkedDateRange()'s own multi-date case used to render an en dash
    // between two dates (e.g. "10 August 2026 – 11 August 2026") — fixed at
    // that shared source (components/route/journey-choice.tsx) to use "to"
    // instead, so this check no longer needs to carve out an exception for
    // it: every date range anywhere in the Verdict now reads the same way
    // travelDatesLabel already did before this fix.
    const visibleText = collectStrings(RouteVerdict(props!)).join(' ');
    expect(visibleText).not.toMatch(/[—–]/);
  });

  it('the checked-date range reads naturally with "to", the exact founder-approved wording', () => {
    expect(html).toContain('Checked 10 August 2026 to 11 August 2026 for travel 6 October 2026 to 20 October 2026. Not a live price feed.');
  });

  it('never claims the Verdict\'s figures are "current", "now" or "the cheapest" — no unsupported urgency/best language', () => {
    expect(html.toLowerCase()).not.toMatch(/\bcheapest fares? right now\b/);
    expect(html.toLowerCase()).not.toMatch(/\bbest\b/);
    expect(html.toLowerCase()).not.toMatch(/\brecommended\b/);
    // "now" alone is over-broad (routeSlug strings, etc. never contain it
    // here, but guard narrowly against the exact phrase the founder flagged).
    expect(html.toLowerCase()).not.toContain('right now');
  });

  it('never aggregates historic fare-history observations into a top-level "N checks, from £X" claim', () => {
    expect(html).not.toMatch(/\d+\s+checks?\s+since/i);
    expect(html).not.toMatch(/from\s+£\d/i);
  });

  it('preserves the PIA-direct vs connecting-Journey-Choice-fares distinction using Journey Choice\'s own derived note, not a re-derived one', () => {
    expect(html).toContain('PIA · Direct');
    // Context-neutral wording (finishing pass, September 2026) — the
    // original "the fares above are different" was spatially correct only
    // inside Journey Choice's own layout; the Verdict has no fare cards
    // above it, so routeServiceNote() now names Journey Choice explicitly
    // instead. Same shared derivation either way, never re-derived here.
    expect(html).toContain('Journey Choice compares different, connecting journeys.');
  });

  it('never joins the route-service value and note with a dash — public JetStash copy avoids dash separators', () => {
    expect(html).not.toMatch(/PIA · Direct[\s]*[—–]/);
  });

  it('the "See the full comparison" same-page anchor carries no external-link icon', () => {
    // ArrowUpRight (used for the genuine external Trip.com CTA lower down)
    // must not also decorate this in-page jump to #journey-choice-heading.
    const anchorBlock = html.slice(html.indexOf('See the full comparison') - 200, html.indexOf('See the full comparison') + 50);
    expect(anchorBlock).not.toContain('lucide-arrow-up-right');
  });

  it('the Recent Fare Checks block states its own state honestly and is never phrased as continuing the Journey Choice figures', () => {
    // manchester-islamabad's Fare Signal is currently suppressed
    // (poor-itinerary) — verified against the live derivation, not assumed.
    expect(props!.fareSignal.state).toBe('none');
    expect(props!.fareSignal.noneReason).toBe('poor-itinerary-suppressed');
    expect(html).toContain("The latest options involved extra stops or self-transfers, so JetStash isn't showing them as a representative fare.");
  });
});

describe('the suppressed/none fare-check sentences are copied verbatim from Fare Signal, never reworded independently', () => {
  it('the poor-itinerary-suppressed sentence matches fare-signal.tsx byte-for-byte', () => {
    expect(fareSignalSrc).toContain(
      "The latest options involved extra stops or self-transfers, so JetStash isn&apos;t showing them as a representative fare."
    );
    const verdictSrc = readFileSync(join(process.cwd(), 'components/route/route-verdict.tsx'), 'utf8');
    expect(verdictSrc).toContain(
      "The latest options involved extra stops or self-transfers, so JetStash isn't showing them as a representative fare."
    );
  });

  it('the plain none-state sentence matches fare-signal.tsx byte-for-byte', () => {
    expect(fareSignalSrc).toContain('No current fare tracked.');
    const verdictSrc = readFileSync(join(process.cwd(), 'components/route/route-verdict.tsx'), 'utf8');
    expect(verdictSrc).toContain("'No current fare tracked.'");
  });
});

describe('zero new derivation: RouteVerdict reuses Journey Choice\'s own exported helpers', () => {
  it('journey-choice.tsx exports formatDate, checkedDateRange and routeServiceNote for reuse', () => {
    expect(journeyChoiceSrc).toContain('export function formatDate(');
    expect(journeyChoiceSrc).toContain('export function checkedDateRange(');
    expect(journeyChoiceSrc).toContain('export function routeServiceNote(');
  });

  it('route-verdict.tsx imports them rather than re-implementing date/service-note logic', () => {
    const verdictSrc = readFileSync(join(process.cwd(), 'components/route/route-verdict.tsx'), 'utf8');
    expect(verdictSrc).toContain("import { formatDate, checkedDateRange, routeServiceNote } from '@/components/route/journey-choice';");
    // No second Intl.DateTimeFormat construction — dates come only from the
    // imported formatDate, never a locally re-implemented formatter.
    expect(verdictSrc).not.toContain('Intl.DateTimeFormat');
  });

  it('does not recompute Journey Choice\'s decision — no deriveJourneyChoice import here', () => {
    const verdictSrc = readFileSync(join(process.cwd(), 'components/route/route-verdict.tsx'), 'utf8');
    expect(verdictSrc).not.toContain('deriveJourneyChoice');
  });
});

describe('page structure: Journey Choice moved dramatically higher, Fare Signal still renders before it', () => {
  it('Fare Signal still renders before Journey Choice (the reconciliation sentence in lib/fare-window-reconciliation.ts assumes this exact order)', () => {
    const signalIndex = routePageSrc.indexOf('<FareSignal');
    const journeyChoiceIndex = routePageSrc.indexOf('<JourneyChoice');
    expect(signalIndex).toBeGreaterThan(-1);
    expect(journeyChoiceIndex).toBeGreaterThan(-1);
    expect(signalIndex).toBeLessThan(journeyChoiceIndex);
  });

  it('Journey Choice now renders before the fare-section heading, not after it', () => {
    const journeyChoiceIndex = routePageSrc.indexOf('<JourneyChoice');
    const fareSectionIndex = routePageSrc.indexOf('{fareSectionCopy.heading}');
    expect(journeyChoiceIndex).toBeLessThan(fareSectionIndex);
  });

  it('the reconciliation note stays gated exactly as before, wherever it renders', () => {
    expect(routePageSrc).toContain('deriveFareWindowReconciliation(');
    expect(routePageSrc).toContain('{fareWindowReconciliation && (');
    expect(routePageSrc).toContain('<FareWindowReconciliationNote reconciliation={fareWindowReconciliation} />');
  });

  it('Journey Choice appears exactly once in the whole file — moved, not duplicated', () => {
    expect((routePageSrc.match(/<JourneyChoice\b/g) ?? []).length).toBe(1);
  });

  it('the collected rendered text of the Verdict is a strict superset check: it does not duplicate Journey Choice\'s own two full option cards', () => {
    const { props } = buildVerdictProps('manchester-islamabad');
    const text = collectStrings(RouteVerdict(props!)).join(' ');
    // The Verdict names the airline/fare pair only inside its one decision
    // sentence and route-service note — it must not render a second
    // "Lower fare" / "Faster journey" labelled card pair (that's Journey
    // Choice's own job, immediately below).
    expect(text).not.toContain('Lower fare');
    expect(text).not.toContain('Faster journey');
  });
});
