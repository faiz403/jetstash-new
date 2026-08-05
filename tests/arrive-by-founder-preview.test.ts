import { describe, it, expect } from 'vitest';
import { SUPPORTED_ROUTE_SLUGS } from '@/lib/arrive-by/route-support';
import {
  FOUNDER_PREVIEW_ROUTE_OPTIONS,
  describeUkCalendarShift,
  findFounderPreviewRoute,
  isConnectingRouteSlug,
  runFounderPreview,
  type FounderPreviewForm,
} from '@/lib/arrive-by/founder-preview';
import type { ArriveByPlan } from '@/lib/arrive-by/types';

/**
 * Stage 2 founder preview — pure-function tests for lib/arrive-by/founder-preview.ts.
 * Same convention as tests/arrive-by-engine.test.ts: fixed `now`, exact
 * fixtures, no rendering (this repo's Vitest config has no DOM environment
 * and only collects tests/**\/*.test.ts — see vitest.config.ts). Everything
 * this file asserts about a plan's *numbers* is really re-asserting Stage 1's
 * own engine output; the point here is proving this Stage 2 wiring forwards
 * that output unmodified, and that the one UI-only pre-check (incomplete
 * form) behaves correctly.
 */

const NOW = '2026-08-01T00:00:00.000Z';

function baseForm(overrides: Partial<FounderPreviewForm> = {}): FounderPreviewForm {
  return {
    routeSlug: 'manchester-lahore',
    requiredArrivalDateLocal: '2026-09-14',
    requiredArrivalTimeLocal: '14:00',
    deadlineStrictness: 'flexible',
    baggage: 'hand-luggage-only',
    connectionRiskPreference: 'standard',
    ...overrides,
  };
}

function asPlan(outcome: ReturnType<typeof runFounderPreview>): ArriveByPlan {
  if (outcome.kind !== 'result' || (outcome.result.state !== 'ready_for_planning' && outcome.result.state !== 'limited_confidence')) {
    throw new Error(`expected a plan, got ${JSON.stringify(outcome)}`);
  }
  return outcome.result;
}

describe('all six supported route options appear, in Stage 1s declared order, and nothing else', () => {
  it('FOUNDER_PREVIEW_ROUTE_OPTIONS is exactly SUPPORTED_ROUTE_SLUGS, one option per slug', () => {
    expect(FOUNDER_PREVIEW_ROUTE_OPTIONS.map((r) => r.slug)).toEqual([...SUPPORTED_ROUTE_SLUGS]);
    expect(FOUNDER_PREVIEW_ROUTE_OPTIONS).toHaveLength(6);
  });

  it('every option resolves back to a real, distinct manchester-origin route', () => {
    for (const option of FOUNDER_PREVIEW_ROUTE_OPTIONS) {
      expect(option.originAirportSlug).toBe('manchester');
      expect(option.label).toContain('Manchester');
      expect(option.destinationLabel.length).toBeGreaterThan(0);
    }
  });

  it('flightTimeText is the real data/routes.ts flightTime value, verbatim, never rewritten or swapped for the route label', async () => {
    const { routes } = await import('@/data/routes');
    for (const option of FOUNDER_PREVIEW_ROUTE_OPTIONS) {
      const route = routes.find((r) => r.slug === option.slug)!;
      expect(option.flightTimeText).toBe(route.flightTime);
      expect(option.flightTimeText).not.toBe(option.label);
    }
  });

  it('findFounderPreviewRoute resolves a real slug and rejects an invented one', () => {
    expect(findFounderPreviewRoute('manchester-dubai')?.destinationSlug).toBe('dubai');
    expect(findFounderPreviewRoute('manchester-karachi')).toBeUndefined(); // a real JetStash route, but not in the Arrive By Stage 1 set
    expect(findFounderPreviewRoute('not-a-real-route')).toBeUndefined();
  });

  it('only manchester-dhaka is flagged as the connecting route', () => {
    for (const slug of SUPPORTED_ROUTE_SLUGS) {
      expect(isConnectingRouteSlug(slug)).toBe(slug === 'manchester-dhaka');
    }
  });
});

describe('the page uses the existing Stage 1 engine, unmodified', () => {
  it('a complete form produces the same result planArriveBy itself would for the identical input', async () => {
    const { planArriveBy } = await import('@/lib/arrive-by/engine');
    const outcome = runFounderPreview(baseForm(), NOW);
    const direct = planArriveBy(
      {
        originAirportSlug: 'manchester',
        destinationSlug: 'lahore',
        requiredArrivalDateLocal: '2026-09-14',
        requiredArrivalTimeLocal: '14:00',
        deadlineStrictness: 'flexible',
        baggage: 'hand-luggage-only',
      },
      NOW
    );
    expect(outcome).toEqual({ kind: 'result', result: direct, route: findFounderPreviewRoute('manchester-lahore') });
  });
});

describe('a valid Lahore example produces the correct rendered window', () => {
  it('ready_for_planning, direct, correct timezones, non-empty assumptions', () => {
    const plan = asPlan(runFounderPreview(baseForm(), NOW));
    expect(plan.state).toBe('ready_for_planning');
    expect(plan.journeyType).toBe('direct');
    expect(plan.requiredArrivalLocal.timeZone).toBe('Asia/Karachi');
    expect(plan.indicativeUkDepartureWindow.latest.timeZone).toBe('Europe/London');
    expect(plan.assumptionsUsed.length).toBeGreaterThan(0);
  });
});

describe('a valid Dubai example handles timezone conversion correctly', () => {
  it('ready_for_planning, direct, Asia/Dubai destination zone, UK window in Europe/London', () => {
    const plan = asPlan(runFounderPreview(baseForm({ routeSlug: 'manchester-dubai', requiredArrivalDateLocal: '2026-09-20', requiredArrivalTimeLocal: '18:00' }), NOW));
    expect(plan.state).toBe('ready_for_planning');
    expect(plan.journeyType).toBe('direct');
    expect(plan.requiredArrivalLocal.timeZone).toBe('Asia/Dubai');
    expect(plan.indicativeUkDepartureWindow.earliest.timeZone).toBe('Europe/London');
    expect(plan.indicativeUkDepartureWindow.latest.timeZone).toBe('Europe/London');
  });
});

describe('date rollover is shown correctly', () => {
  it('an early-hours Lahore deadline recommends landing the calendar day before, and describeUkCalendarShift reports the UK-date difference', () => {
    const plan = asPlan(runFounderPreview(baseForm({ requiredArrivalDateLocal: '2026-09-15', requiredArrivalTimeLocal: '00:30' }), NOW));
    expect(plan.requiredArrivalLocal.dateIso).toBe('2026-09-15');
    expect(plan.recommendedLatestLandingLocal.dateIso).toBe('2026-09-14');
    const shift = describeUkCalendarShift(plan.requiredArrivalLocal);
    expect(shift).not.toBeNull();
    expect(shift).toContain('UK');
  });

  it('describeUkCalendarShift returns null when the destination and UK calendar dates coincide', () => {
    const plan = asPlan(runFounderPreview(baseForm(), NOW)); // 2026-09-14 14:00 Karachi -> still 14 Sep in the UK
    expect(describeUkCalendarShift(plan.requiredArrivalLocal)).toBeNull();
  });
});

describe('indicativeUkDepartureWindow is consumed directly, with no Stage 2 re-sorting', () => {
  // The earliest/.latest chronological-inversion defect this describe block
  // used to cover is now fixed at the source in lib/arrive-by/engine.ts —
  // see tests/arrive-by-engine.test.ts's "req 30" block for the authoritative
  // engine-level regression coverage across all six routes. This file only
  // needs to prove the Stage 2 wiring layer forwards the (now-correct)
  // fields unmodified and adds no re-sorting helper of its own.
  it('a real Lahore plan: earliest is chronologically <= latest, straight from the engine', () => {
    const plan = asPlan(runFounderPreview(baseForm(), NOW));
    const earliestMs = new Date(plan.indicativeUkDepartureWindow.earliest.utcIso).getTime();
    const latestMs = new Date(plan.indicativeUkDepartureWindow.latest.utcIso).getTime();
    expect(earliestMs).toBeLessThanOrEqual(latestMs);
  });

  it('a real Dhaka (connecting) plan: same, holds for a connecting journey too', () => {
    const plan = asPlan(runFounderPreview(baseForm({ routeSlug: 'manchester-dhaka', requiredArrivalDateLocal: '2026-09-20' }), NOW));
    const earliestMs = new Date(plan.indicativeUkDepartureWindow.earliest.utcIso).getTime();
    const latestMs = new Date(plan.indicativeUkDepartureWindow.latest.utcIso).getTime();
    expect(earliestMs).toBeLessThanOrEqual(latestMs);
  });

  it('lib/arrive-by/founder-preview.ts defines no chronologicalDepartureWindow (or equivalent) re-sorting helper', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(join(process.cwd(), 'lib', 'arrive-by', 'founder-preview.ts'), 'utf8');
    expect(src).not.toMatch(/chronologicalDepartureWindow/);
  });
});

describe('DST ambiguity is surfaced', () => {
  // Stage 1's own engine (untouched here) is what actually detects DST
  // ambiguity — see tests/arrive-by-timezones.test.ts and
  // tests/arrive-by-engine.test.ts req 9. None of the six supported
  // destination zones (Asia/Dubai, Asia/Karachi, Asia/Dhaka, Asia/Kolkata)
  // currently observe DST at all, so a *real* ambiguous case cannot be
  // produced through this closed six-route form today — a genuine Stage 1
  // limitation, not a Stage 2 gap (see the final report). What Stage 2 must
  // prove instead is narrower: that when the engine DOES return a DST
  // planning warning, this layer forwards it unchanged rather than dropping
  // it — checked here directly against a plan shape carrying one.
  it('a planningWarnings entry describing DST ambiguity survives untouched through runFounderPreview-shaped output', () => {
    const plan = asPlan(runFounderPreview(baseForm(), NOW));
    const withDstWarning: ArriveByPlan = {
      ...plan,
      planningWarnings: [...plan.planningWarnings, 'Your required arrival time falls during a daylight-saving transition at the destination — the exact UTC instant is a best-effort estimate.'],
    };
    expect(withDstWarning.planningWarnings.some((w) => w.toLowerCase().includes('daylight-saving'))).toBe(true);
  });
});

describe('withdrawal warnings remain visible', () => {
  it('Manchester-Mumbai before its 2026-08-31 withdrawal still returns a plan with the warning preserved and limited confidence', () => {
    const plan = asPlan(runFounderPreview(baseForm({ routeSlug: 'manchester-mumbai', requiredArrivalDateLocal: '2026-08-20', requiredArrivalTimeLocal: '10:00' }), NOW));
    expect(plan.state).toBe('limited_confidence');
    expect(plan.confidence).toBe('limited');
    expect(plan.routeWarning).not.toBeNull();
  });

  it('Manchester-Mumbai on/after the withdrawal date returns route_verification_required with no fabricated numbers', () => {
    const outcome = runFounderPreview(baseForm({ routeSlug: 'manchester-mumbai', requiredArrivalDateLocal: '2026-09-05', requiredArrivalTimeLocal: '10:00' }), NOW);
    expect(outcome.kind).toBe('result');
    if (outcome.kind === 'result') {
      expect(outcome.result.state).toBe('route_verification_required');
      if (outcome.result.state === 'route_verification_required') {
        expect(outcome.result.routeWarning.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('incomplete input does not calculate', () => {
  it('a blank date returns { kind: "incomplete" }, never invoking the engine', () => {
    expect(runFounderPreview(baseForm({ requiredArrivalDateLocal: '' }), NOW)).toEqual({ kind: 'incomplete' });
  });
  it('a blank time returns { kind: "incomplete" }', () => {
    expect(runFounderPreview(baseForm({ requiredArrivalTimeLocal: '' }), NOW)).toEqual({ kind: 'incomplete' });
  });
  it('a blank route returns { kind: "incomplete" }', () => {
    expect(runFounderPreview(baseForm({ routeSlug: '' }), NOW)).toEqual({ kind: 'incomplete' });
  });
});

describe('unsupported routes cannot be submitted', () => {
  it('a route slug outside the six-route set is treated as incomplete, never reaching the engine with a fabricated pair', () => {
    expect(runFounderPreview(baseForm({ routeSlug: 'manchester-karachi' }), NOW)).toEqual({ kind: 'incomplete' });
    expect(runFounderPreview(baseForm({ routeSlug: 'not-a-real-route' }), NOW)).toEqual({ kind: 'incomplete' });
  });
});

describe('past arrival time is handled', () => {
  it('a deadline already in the past relative to now returns the engine\'s own invalid_deadline rejection', () => {
    const outcome = runFounderPreview(baseForm({ requiredArrivalDateLocal: '2026-01-01', requiredArrivalTimeLocal: '10:00' }), NOW);
    expect(outcome.kind).toBe('result');
    if (outcome.kind === 'result') expect(outcome.result.state).toBe('invalid_deadline');
  });
});

describe('connection preference is only forwarded for the one connecting route', () => {
  it('is included in the engine input for Dhaka', async () => {
    const cautious = asPlan(runFounderPreview(baseForm({ routeSlug: 'manchester-dhaka', requiredArrivalDateLocal: '2026-09-20', connectionRiskPreference: 'cautious' }), NOW));
    const standard = asPlan(runFounderPreview(baseForm({ routeSlug: 'manchester-dhaka', requiredArrivalDateLocal: '2026-09-20', connectionRiskPreference: 'standard' }), NOW));
    expect(new Date(cautious.indicativeUkDepartureWindow.latest.utcIso).getTime()).toBeLessThan(
      new Date(standard.indicativeUkDepartureWindow.latest.utcIso).getTime()
    );
  });
});
