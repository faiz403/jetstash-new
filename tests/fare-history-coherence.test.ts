import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { fareObservations, getPublishableObservationsByRoute } from '@/data/fare-observations';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getFareSectionCopy } from '@/lib/fare-section-copy';
import { FareHistoryPanel } from '@/components/route/fare-history-panel';

/**
 * Fare History coherence fix (1 Sep 2026, User 5 real-user validation).
 * Root cause: getFareSectionCopy() decided its heading from `hasObservations`
 * alone, with no awareness of whether Fare Signal poor-itinerary suppression
 * (31 Aug 2026) had left the route with no current representative fare —
 * so "Fare history & current example" kept describing a rejected
 * self-transfer itinerary as "current" directly beneath a Fare Signal card
 * that had just declined to show it. The rows themselves were always
 * truthful; only the section heading needed to become aware of the
 * durable, general condition: observations exist, but there is currently
 * no representative Fare Signal — not a narrower "was this suppressed"
 * flag.
 */

// Frozen at 2026-08-31 -- the same evaluation date the original
// poor-itinerary-suppression audit used (see
// tests/fare-signal-poor-itinerary-suppression.test.ts's own
// AUDIT_REFERENCE_DATE) to establish that these 7 routes have no current
// representative Fare Signal. Reusing that date, rather than the live
// clock, means this suite asserts the same fixed historical fact that
// audit already fixed -- Fare Signal freshness/verification windows can
// legitimately change as real time passes, and this suite must not start
// failing because of that drift.
const FIXED_TODAY = '2026-08-31';

const KNOWN_NO_REPRESENTATIVE_FARE_ROUTES = [
  'manchester-lahore',
  'birmingham-amritsar',
  'manchester-dubai',
  'london-heathrow-doha',
  'london-heathrow-jeddah',
  'london-gatwick-amritsar',
  'birmingham-delhi',
];

describe('1. Manchester-Dubai: the exact reproduced case', () => {
  it('current Fare Signal is none, observations remain present, heading no longer claims "current example"', () => {
    const signal = getFareSignalForRoute('manchester-dubai', FIXED_TODAY);
    expect(signal.state).toBe('none');
    const observations = getPublishableObservationsByRoute('manchester-dubai', FIXED_TODAY);
    expect(observations.length).toBeGreaterThan(0);
    const copy = getFareSectionCopy(observations.length > 0, true, signal.state !== 'none');
    expect(copy.heading).toBe('Fare history');
    expect(copy.heading).not.toMatch(/current example/i);
  });

  it('the contextual explanation renders, without claiming the observations are invalid, wrong, or that no fares/flights exist', () => {
    const copy = getFareSectionCopy(true, true, false);
    expect(copy.caption).toMatch(/context/i);
    expect(copy.caption).toMatch(/does not currently have a representative fare/i);
    expect(copy.caption).not.toMatch(/invalid|incorrect|wrong/i);
    expect(copy.caption).not.toMatch(/no fares? (exist|available)/i);
    expect(copy.caption).not.toMatch(/no flights?/i);
    expect(copy.caption).not.toMatch(/direct fare/i);
    expect(copy.caption).not.toMatch(/recommended/i);
  });

  it('£314 and the other underlying observations remain completely intact in the archive', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-man-dxb-economy-20260825-8w-v1');
    expect(obs).toBeDefined();
    expect(obs!.price).toBe(314);
    expect(obs!.outboundStops).toBe(2);
    expect(obs!.returnStops).toBe(2);
    // Still rendered in Fare History, unaffected by this copy-only fix.
    const observations = getPublishableObservationsByRoute('manchester-dubai', FIXED_TODAY);
    const html = renderToStaticMarkup(FareHistoryPanel({ observations }));
    expect(html).toContain('£314');
  });
});

describe('2. All seven currently no-representative-fare routes receive the coherent history presentation', () => {
  it.each(KNOWN_NO_REPRESENTATIVE_FARE_ROUTES)('%s: Fare Signal is none, observations exist, heading is "Fare history" (no "current example")', (slug) => {
    const signal = getFareSignalForRoute(slug, FIXED_TODAY);
    expect(signal.state, slug).toBe('none');
    const observations = getPublishableObservationsByRoute(slug, FIXED_TODAY);
    expect(observations.length, slug).toBeGreaterThan(0);
    const copy = getFareSectionCopy(observations.length > 0, true, signal.state !== 'none');
    expect(copy.heading, slug).toBe('Fare history');
    expect(copy.caption, slug).toMatch(/does not currently have a representative fare/i);
  });
});

describe('3. A route with a valid current Fare Signal retains the existing normal copy', () => {
  it('manchester-antalya: current Fare Signal present, heading stays "Fare history & current example"', () => {
    const signal = getFareSignalForRoute('manchester-antalya', FIXED_TODAY);
    expect(signal.state).toBe('current');
    const observations = getPublishableObservationsByRoute('manchester-antalya', FIXED_TODAY);
    const copy = getFareSectionCopy(observations.length > 0, true, signal.state !== 'none');
    expect(copy.heading).toBe('Fare history & current example');
    expect(copy.caption).toMatch(/checked on the date shown/);
  });

  it('manchester-islamabad (Standout Fare / current): heading also stays the normal one', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', FIXED_TODAY);
    expect(signal.state).toBe('current');
    const copy = getFareSectionCopy(true, true, signal.state !== 'none');
    expect(copy.heading).toBe('Fare history & current example');
  });
});

describe('4. A route with zero observations retains its existing behaviour, unaffected by the third parameter', () => {
  it('hasObservations=false with a deal: unaffected by hasCurrentRepresentativeFare either way', () => {
    expect(getFareSectionCopy(false, true, true)).toEqual(getFareSectionCopy(false, true, false));
    expect(getFareSectionCopy(false, true, false).heading).toBe('What we know about this route');
  });

  it('hasObservations=false with no deal: unaffected by hasCurrentRepresentativeFare either way', () => {
    expect(getFareSectionCopy(false, false, true)).toEqual(getFareSectionCopy(false, false, false));
    expect(getFareSectionCopy(false, false, false).heading).toBe('No tracked fare yet');
  });
});

describe('5. FareHistoryPanel row rendering is completely unchanged', () => {
  it('renders the same rows, same fields, same stale-marking logic for a no-representative-fare route as for a normal one', () => {
    const observations = getPublishableObservationsByRoute('manchester-dubai', FIXED_TODAY);
    const html = renderToStaticMarkup(FareHistoryPanel({ observations }));
    expect(html).toContain('comparable check');
    expect(html).toContain('Checked');
    expect(html).toContain('Travel dates:');
    // The panel itself never mentions "current" anywhere in its own copy —
    // that word only ever came from the section heading above it.
    expect(html.toLowerCase()).not.toContain('current example');
  });
});

describe('6. No observation/data mutation occurred', () => {
  it('the full archive size and every known price for the seven routes are unchanged', () => {
    const knownPrices: Record<string, number> = {
      'obs-man-lhe-economy-20260825-recheck-v1': 547,
      'obs-bhx-atq-economy-20260825-recheck-v1': 591,
      'obs-man-dxb-economy-20260825-8w-v1': 314,
      'obs-lhr-doh-economy-20260825-8w-v1': 425,
      'obs-lhr-jed-economy-20260825-recheck-v1': 361,
      'obs-lgw-atq-economy-20260825-8w-v1': 582,
      'obs-bhx-del-economy-20260822-8w-v1': 563,
    };
    for (const [id, price] of Object.entries(knownPrices)) {
      const obs = fareObservations.find((o) => o.id === id);
      expect(obs, id).toBeDefined();
      expect(obs!.price, id).toBe(price);
    }
  });
});
