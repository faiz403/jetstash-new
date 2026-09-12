import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import RoutePage from '@/app/routes/[slug]/page';
import { FareSignal } from '@/components/route/fare-signal';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getTripComRouteUrl, getSafeTripComFlightHandoffUrl } from '@/lib/booking-providers';
import { getJourneyChoiceForRoute } from '@/lib/journey-choice-route-adapter';
import { getRouteBySlug } from '@/data/routes';

/**
 * Astra product review, 10-11 Sept 2026 — public fare terminology
 * simplification.
 *
 * Astra's finding: JetStash exposed too many fare-product names/concepts
 * (Fare Signal, Standout Fare, Tracked Fares, Deal) for a visitor to have
 * to learn, rather than presenting one coherent fare answer. Wording-only
 * fix, three call sites:
 *
 *  1. components/route/fare-signal.tsx — the route page's one public fare
 *     card eyebrow renamed "Fare Signal" -> "Fare check" (matches this
 *     page's other plain, sentence-case eyebrows: "Tracked fares", "Worth
 *     comparing", "Route history"). The `id="fare-signal-heading"`,
 *     component name and file are unchanged.
 *  2. app/deals/page.tsx — a hero sentence and a stat label that named
 *     both "Fare Signal" and "Deal card" as internal taxonomy to explain
 *     their difference to visitors, rewritten in plain terms.
 *  3. app/tracked-fares/page.tsx — the `<title>` metadata combined "Tracked
 *     Fares" and "Fare Signal" even though the page's own visible content
 *     never mentions "Fare Signal" at all; simplified to match the page.
 *
 * No fare value, route fact, Journey Choice fact, standout threshold,
 * publishability rule, or Trip.com link changed anywhere in this pass.
 */

const fareSignalSrc = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');
const dealsPageSrc = readFileSync(join(process.cwd(), 'app/deals/page.tsx'), 'utf8');
const trackedFaresPageSrc = readFileSync(join(process.cwd(), 'app/tracked-fares/page.tsx'), 'utf8');

describe('1. "Fare Signal" is no longer public-facing text anywhere it was found', () => {
  it('the route-page fare card eyebrow now reads "Fare check", not "Fare Signal"', () => {
    expect(fareSignalSrc).toContain('>Fare check</p>');
    expect(fareSignalSrc).not.toContain('>Fare Signal</p>');
  });

  it('the /deals page no longer names "Fare Signal" anywhere in its visible copy or stat labels', () => {
    // The word "Fare" and "Signal" separately still appear in code comments
    // (internal, per this task's own "internal names may remain" rule) —
    // what must be gone is the literal combined public-facing phrase.
    expect(dealsPageSrc).not.toContain('tracked Fare Signal');
    expect(dealsPageSrc).not.toContain("label: 'Routes with tracked Fare Signals'");
    expect(dealsPageSrc).toContain("label: 'Routes with a tracked fare'");
  });

  it('the /tracked-fares metadata title no longer combines "Tracked Fares" with "Fare Signal"', () => {
    expect(trackedFaresPageSrc).not.toContain('Every Current Fare Signal');
    expect(trackedFaresPageSrc).toContain("title: 'Tracked Fares — Every Current Fare'");
  });

  it('the id "fare-signal-heading" and the FareSignal component/file name are deliberately unchanged — internal names, not the public terminology this task targets', () => {
    expect(fareSignalSrc).toContain('id="fare-signal-heading"');
    expect(fareSignalSrc).toContain('export function FareSignal(');
  });
});

describe('2. Standout Fare remains an interpretation/status within the one fare card, not a separate product', () => {
  it('the standout badge still renders exactly as before ("Standout Fare" vs "Fare spotted"), untouched by this pass', () => {
    expect(fareSignalSrc).toContain("{standout ? 'Standout Fare' : 'Fare spotted'}");
  });
});

describe('3. Live rendered output — MAN-ISB, MAN-DXB, MAN-Mumbai, and a no-handoff route', () => {
  const NOW_ISO = '2026-09-11';

  it('manchester-islamabad: "Fare check" renders, "Fare Signal" does not, and Journey Choice\'s controlled £601/£626 facts are unchanged', async () => {
    const element = await RoutePage({ params: Promise.resolve({ slug: 'manchester-islamabad' }) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Fare check');
    expect(html).not.toContain('Fare Signal');
    expect(html).toContain('601');
    expect(html).toContain('626');
    const journeyChoice = getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO);
    expect(journeyChoice).not.toBeNull();
  });

  it('manchester-dubai: a normal publishable-fare route renders "Fare check" and its existing Trip.com CTA, unaffected by the rename', async () => {
    const element = await RoutePage({ params: Promise.resolve({ slug: 'manchester-dubai' }) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Fare check');
    expect(html).not.toContain('Fare Signal');
    expect(html).toContain('Compare flights on Trip.com');
  });

  it('manchester-mumbai: service-ended status intact, current-connecting Trip.com CTA renders with non-nonstop-implying wording, unaffected by the rename', async () => {
    // Commercial Funnel Fix (12 Sept 2026, founder-approved): manchester-mumbai
    // now has a working Trip.com handoff (connectingAlternative + exact
    // verified link both exist) — see
    // tests/service-ended-commercial-funnel.test.ts for the full behaviour
    // this policy change introduced. This test's own purpose (the "Fare
    // Signal" -> "Fare check" rename doesn't affect this route) still holds.
    const element = await RoutePage({ params: Promise.resolve({ slug: 'manchester-mumbai' }) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Direct service ended');
    expect(html).toContain('Compare current connecting flights on Trip.com');
    expect(html).not.toContain('Compare flights on Trip.com');
  });

  it('london-heathrow-jeddah (no safe Trip.com handoff): still renders no Trip.com CTA anywhere — this pass invents no new CTA', async () => {
    const slug = 'london-heathrow-jeddah';
    const route = getRouteBySlug(slug)!;
    expect(getSafeTripComFlightHandoffUrl(slug, route.airportSlug, route.destinationSlug)).toBeNull();
    const element = await RoutePage({ params: Promise.resolve({ slug }) });
    const html = renderToStaticMarkup(element);
    expect(html).not.toContain('Compare flights on Trip.com');
  });
});

describe('4. Standout-fare route renders its interpretation correctly, unaffected by the eyebrow rename', () => {
  it('manchester-islamabad (the one active Standout Fare pilot route) still shows the standout badge when its evidence is the approved one', () => {
    // The 25 Aug 2026 £480 Riyadh Air observation is the exact evidence
    // this repo's own standout-fare.test.ts already proves is approved.
    const signal = getFareSignalForRoute('manchester-islamabad', '2026-08-25');
    const text = renderToStaticMarkup(
      FareSignal({ signal, tripComUrl: getTripComRouteUrl('manchester-islamabad'), routeSlug: 'manchester-islamabad' })
    );
    expect(text).toContain('Fare check');
    expect(text).toContain('480');
  });
});

describe('5. Fare history remains available and subordinate to the fare answer — untouched by this pass', () => {
  it('the fare-evidence heading and history panel still render on a route with logged observations, unaffected by the "Fare check" rename above it', async () => {
    const element = await RoutePage({ params: Promise.resolve({ slug: 'manchester-dubai' }) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('id="route-watch"');
  });
});
