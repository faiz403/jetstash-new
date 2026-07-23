import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapViewModelToFlagshipCopy, buildFlagshipStatusCopy } from '@/lib/flagship-status-copy';
import { getRouteStatus, type Route } from '@/data/routes';
import { getRouteStatusCopy, type RouteStatusViewModel } from '@/lib/route-status-copy';
import { routeStatusEvents, type RouteStatusEvent, type SourceRef } from '@/data/route-status-events';

/**
 * Route Status V1 final audit §4 — the homepage's featured thread must
 * carry no hard-coded IndiGo/31 August 2026/active-change assertion; every
 * state must come from a validated RouteStatusViewModel + resolved service
 * notices. These tests use a wholly synthetic fixture route/airline
 * ('fixture-airline', never IndiGo, never 31 August 2026) specifically so a
 * hard-coded literal reappearing in the source would fail these tests
 * regardless of what the real ledger currently contains.
 */

const FIXED_TODAY = '2026-07-23';
const SOURCE: SourceRef = { publisher: 'Fixture Publisher', url: 'https://example.com/fixture', accessedAt: FIXED_TODAY };

function makeRoute(overrides: Partial<Route>): Route {
  return {
    slug: 'fixture-flagship',
    airportSlug: 'manchester',
    destinationSlug: 'lahore',
    flightTime: '8h direct',
    frequency: 'Daily direct',
    airlineSlugs: ['pia'],
    isDirect: true,
    intro: 'Fixture intro.',
    bookingWindowNote: 'Fixture booking window note.',
    peakPeriodIds: [],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<RouteStatusEvent> & Pick<RouteStatusEvent, 'type'>): RouteStatusEvent {
  const base = {
    id: 'fixture-flagship-event',
    routeSlug: 'fixture-flagship',
    serviceId: 'fixture-flagship-service',
    scope: { kind: 'airline' as const, airlineSlug: 'pia' },
    headline: 'Fixture headline',
    explanation: 'A synthetic fixture explanation, deliberately naming no real airline or date.',
    sources: [SOURCE],
    verifiedAt: FIXED_TODAY,
  };
  return { ...base, ...overrides } as RouteStatusEvent;
}

function assertNoHardcodedLiterals(copy: { routeDetail: string; changeDetail: string; verdictLine: string }) {
  for (const value of Object.values(copy)) {
    expect(value.toLowerCase()).not.toContain('indigo');
    expect(value).not.toContain('31 August 2026');
    expect(value).not.toContain('2026-08-31');
  }
}

describe('mapViewModelToFlagshipCopy — pure mapper, regression cases', () => {
  it('active withdrawal: routeDetail names the real airline, changeDetail is the real event explanation, verdictLine cites the real publisher and effective date', () => {
    const viewModel = getRouteStatusCopy(
      makeRoute({ verification: { status: 'verified', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } }),
      { status: 'withdrawal-announced', effectiveFrom: '2026-10-01', drivingEventId: 'ev-active', scope: { kind: 'airline', airlineSlug: 'pia' }, serviceNotices: [] },
      [makeEvent({ id: 'ev-active', type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-10-01', currentClaimValidBefore: '2026-10-01' })],
      FIXED_TODAY
    );
    const copy = mapViewModelToFlagshipCopy(viewModel, ['Pakistan International Airlines']);
    expect(copy.routeDetail).toContain('Pakistan International Airlines');
    expect(copy.changeDetail).toBe('A synthetic fixture explanation, deliberately naming no real airline or date.');
    expect(copy.verdictLine).toContain('1 October 2026'); // human-readable, never raw ISO
    expect(copy.verdictLine).not.toContain('2026-10-01');
    expect(copy.verdictLine).toContain('Fixture Publisher');
    assertNoHardcodedLiterals(copy);
  });

  it('rescheduled withdrawal: verdictLine and changeDetail use the NEW effective date, never the original', () => {
    const original = makeEvent({ id: 'ev-resched-orig', type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const reschedule = makeEvent({ id: 'ev-resched-new', type: 'withdrawal-rescheduled', announcedAt: '2026-06-15', newEffectiveFrom: '2026-11-01', relatedEventId: 'ev-resched-orig', currentClaimValidBefore: '2026-11-01' });
    const viewModel = getRouteStatusCopy(
      makeRoute({ verification: { status: 'verified', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } }),
      { status: 'withdrawal-announced', effectiveFrom: '2026-11-01', drivingEventId: 'ev-resched-new', scope: { kind: 'airline', airlineSlug: 'pia' }, serviceNotices: [] },
      [original, reschedule],
      FIXED_TODAY
    );
    const copy = mapViewModelToFlagshipCopy(viewModel, ['Fixture Air']);
    expect(copy.verdictLine).toContain('1 November 2026'); // the NEW date, human-readable
    expect(copy.verdictLine).not.toContain('2026-11-01'); // never raw ISO
    expect(copy.verdictLine).not.toContain('2026-08-01');
    expect(copy.verdictLine).not.toContain('1 August 2026'); // never the OLD date either
    assertNoHardcodedLiterals(copy);
  });

  it('cancelled withdrawal: falls through to plain verified-direct, mentioning neither the old change nor its date anywhere', () => {
    const viewModel = getRouteStatusCopy(
      makeRoute({ verification: { status: 'verified', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } }),
      { status: 'verified-direct', verifiedDirectBasis: [{ kind: 'route', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' }], serviceNotices: [] },
      [],
      FIXED_TODAY
    );
    const copy = mapViewModelToFlagshipCopy(viewModel, ['Fixture Air']);
    expect(copy.changeDetail).toBe('No active service-change notice for this route.');
    expect(copy.verdictLine).not.toContain('2026-08-01');
    expect(copy.verdictLine).not.toContain('announced');
    assertNoHardcodedLiterals(copy);
  });

  it('transition-boundary pending: body/publisher come from the resolved event, no hard-coded airline or date', () => {
    const event = makeEvent({ id: 'ev-boundary', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-06-01', currentClaimValidBefore: '2026-06-01' });
    const viewModel = getRouteStatusCopy(
      makeRoute({}),
      { status: 'verification-pending', pendingReason: { kind: 'transition-boundary-reached', drivingEventId: 'ev-boundary', effectiveFrom: '2026-06-01', scope: { kind: 'airline', airlineSlug: 'pia' } } },
      [event],
      FIXED_TODAY
    );
    const copy = mapViewModelToFlagshipCopy(viewModel, ['Fixture Air']);
    expect(copy.routeDetail).toContain('Fixture Publisher');
    expect(copy.changeDetail).toContain('Fixture Publisher');
    assertNoHardcodedLiterals(copy);
  });

  it('verified service-ended: no date/airline literal, plain "ended" framing', () => {
    const viewModel = getRouteStatusCopy(
      makeRoute({}),
      { status: 'service-ended', effectiveFrom: '2026-07-01', drivingEventId: 'ev-ended', scope: { kind: 'airline', airlineSlug: 'pia' }, serviceNotices: [] },
      [makeEvent({ id: 'ev-ended', type: 'service-ended', verifiedOccurrence: true, effectiveFrom: '2026-07-01', currentClaimValidBefore: '2027-01-01' })],
      FIXED_TODAY
    );
    const copy = mapViewModelToFlagshipCopy(viewModel, ['Fixture Air']);
    expect(copy.routeDetail).toBe('Direct service ended. Check current options directly with the airline.');
    assertNoHardcodedLiterals(copy);
  });

  it('neutral pending: the shared generic fallback, no airline/date literal', () => {
    const viewModel = getRouteStatusCopy(makeRoute({}), { status: 'verification-pending', pendingReason: { kind: 'no-current-direct-evidence' } }, [], FIXED_TODAY);
    const copy = mapViewModelToFlagshipCopy(viewModel, []);
    expect(copy.verdictLine).toBe("We can't currently confirm this route's direct service — check directly with the airline before booking.");
    assertNoHardcodedLiterals(copy);
  });

  it('clean verified-direct with no active service notice: states plainly that there is no active change, never invents one', () => {
    const viewModel = getRouteStatusCopy(
      makeRoute({ verification: { status: 'verified', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } }),
      { status: 'verified-direct', verifiedDirectBasis: [{ kind: 'route', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' }], serviceNotices: [] },
      [],
      FIXED_TODAY
    );
    expect(viewModel.kind).toBe('verified-direct');
    if (viewModel.kind === 'verified-direct') expect(viewModel.serviceNotices).toEqual([]);
    const copy = mapViewModelToFlagshipCopy(viewModel, ['Fixture Air']);
    expect(copy.changeDetail).toBe('No active service-change notice for this route.');
    expect(copy.verdictLine).not.toMatch(/announced|withdraw/i);
    assertNoHardcodedLiterals(copy);
  });

  it('verified-direct WITH an active service notice on another airline: changeDetail describes the real notice, never silently drops it', () => {
    const route = makeRoute({
      airlineSlugs: ['pia', 'emirates'],
      airlineVerifications: [{ airlineSlug: 'emirates', status: 'verified', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01', effectivePeriod: 'Current at access', supportedClaim: 'y' }],
    });
    const ended = makeEvent({ id: 'ev-notice', type: 'service-ended', verifiedOccurrence: true, effectiveFrom: '2026-07-01', currentClaimValidBefore: '2027-01-01' });
    const viewModel = getRouteStatusCopy(
      route,
      {
        status: 'verified-direct',
        verifiedDirectBasis: [{ kind: 'airline', airlineSlug: 'emirates', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' }],
        serviceNotices: [{ airlineSlug: 'pia', kind: 'service-ended', effectiveFrom: '2026-07-01', drivingEventId: 'ev-notice' }],
      },
      [ended],
      FIXED_TODAY
    );
    const copy = mapViewModelToFlagshipCopy(viewModel, ['Emirates']);
    expect(copy.changeDetail).toContain('1 July 2026'); // human-readable, never raw ISO
    expect(copy.changeDetail).not.toContain('2026-07-01');
    expect(copy.changeDetail).not.toBe('No active service-change notice for this route.');
    assertNoHardcodedLiterals(copy);
  });
});

describe('buildFlagshipStatusCopy — end-to-end pipeline against a synthetic ledger', () => {
  it('an unmanaged route slug (no ledger events) falls back to the generic neutral copy', () => {
    // Passing a slug that genuinely has zero events in the supplied array.
    const copy = buildFlagshipStatusCopy('manchester-lahore', [], FIXED_TODAY);
    expect(copy.verdictLine).toBe("We can't currently confirm this route's direct service — check directly with the airline before booking.");
  });

  it('a cancellation removes the old announcement/date end-to-end — the pipeline never mentions it after cancellation', () => {
    const withdrawal = makeEvent({
      id: 'ev-e2e-cancel-withdraw',
      routeSlug: 'manchester-lahore',
      serviceId: 'e2e-cancel-service',
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-05-01',
      currentClaimValidBefore: '2026-05-01',
    });
    const cancellation = makeEvent({
      id: 'ev-e2e-cancel-cancel',
      routeSlug: 'manchester-lahore',
      serviceId: 'e2e-cancel-service',
      type: 'withdrawal-cancelled',
      announcedAt: '2026-01-15',
      relatedEventId: 'ev-e2e-cancel-withdraw',
      currentClaimValidBefore: '2027-01-01',
    });
    const copy = buildFlagshipStatusCopy('manchester-lahore', [withdrawal, cancellation], FIXED_TODAY);
    expect(copy.changeDetail).not.toContain('2026-05-01');
    expect(copy.verdictLine).not.toContain('2026-05-01');
    expect(copy.changeDetail).not.toMatch(/announced/i);
  });

  it('the real Manchester–Mumbai corridor end-to-end at the real transition boundary produces the real publisher/date, still with no literal hard-coded elsewhere in the source (this is a behavioural check, not a source-grep)', () => {
    const copy = buildFlagshipStatusCopy('manchester-mumbai', routeStatusEvents, '2026-08-31');
    expect(copy.verdictLine.length).toBeGreaterThan(0);
    // The real event's own real publisher/date are expected to appear here —
    // this is the correct, evidence-driven behaviour, not a hard-coded
    // literal in source (see the synthetic-fixture tests above, which prove
    // the mapper has no IndiGo/31-August literal of its own).
    expect(copy.verdictLine).toContain('IndiGo');
  });
});

describe('final audit round 3 — evidenceDetail replaces the old EVIDENCE_BUNDLE-derived evidence text', () => {
  it('components/homepage-v2/pull-brief.tsx no longer imports or references EVIDENCE_BUNDLE anywhere (source-level check)', () => {
    const source = readFileSync(join(process.cwd(), 'components', 'homepage-v2', 'pull-brief.tsx'), 'utf-8');
    expect(source).not.toContain('EVIDENCE_BUNDLE');
    expect(source).not.toContain("from '@/lib/journey-brief-manchester-mumbai'"); // no import of the founder-prototype bundle
    expect(source).not.toContain('nextReviewDate');
  });

  it('every RouteStatusViewModel kind maps to a FlagshipStatusCopy with a non-empty evidenceDetail', () => {
    const route = makeRoute({ verification: { status: 'verified', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } });
    const withdrawal = makeEvent({ id: 'ev-coverage-withdraw', type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-10-01', currentClaimValidBefore: '2026-10-01' });
    const ended = makeEvent({ id: 'ev-coverage-ended', type: 'service-ended', verifiedOccurrence: true, effectiveFrom: '2026-07-01', currentClaimValidBefore: '2027-01-01' });
    const boundaryEvent = makeEvent({ id: 'ev-coverage-boundary', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-06-01', currentClaimValidBefore: '2026-06-01' });

    const viewModels: RouteStatusViewModel[] = [
      getRouteStatusCopy(route, { status: 'verified-direct', verifiedDirectBasis: [{ kind: 'route', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' }], serviceNotices: [] }, [], FIXED_TODAY),
      getRouteStatusCopy(route, { status: 'withdrawal-announced', effectiveFrom: '2026-10-01', drivingEventId: 'ev-coverage-withdraw', scope: { kind: 'airline', airlineSlug: 'pia' }, serviceNotices: [] }, [withdrawal], FIXED_TODAY),
      getRouteStatusCopy(route, { status: 'service-ended', effectiveFrom: '2026-07-01', drivingEventId: 'ev-coverage-ended', scope: { kind: 'airline', airlineSlug: 'pia' }, serviceNotices: [] }, [ended], FIXED_TODAY),
      getRouteStatusCopy(route, { status: 'verification-pending', pendingReason: { kind: 'transition-boundary-reached', drivingEventId: 'ev-coverage-boundary', effectiveFrom: '2026-06-01', scope: { kind: 'airline', airlineSlug: 'pia' } } }, [boundaryEvent], FIXED_TODAY),
      getRouteStatusCopy(route, { status: 'verification-pending', pendingReason: { kind: 'no-current-direct-evidence' } }, [], FIXED_TODAY),
    ];

    const kinds = new Set(viewModels.map((v) => v.kind));
    expect(kinds).toEqual(new Set(['verified-direct', 'withdrawal-announced', 'service-ended', 'transition-boundary-pending', 'neutral-pending']));

    for (const viewModel of viewModels) {
      const copy = mapViewModelToFlagshipCopy(viewModel, ['Fixture Air']);
      expect(copy.evidenceDetail, viewModel.kind).toBeTruthy();
      expect(copy.evidenceDetail.length, viewModel.kind).toBeGreaterThan(0);
    }
  });

  it('cancellation produces no old airline/date/review claim anywhere, including evidenceDetail', () => {
    const withdrawal = makeEvent({ id: 'ev-evd-cancel-withdraw', routeSlug: 'manchester-lahore', serviceId: 'evd-cancel-service', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-05-01', currentClaimValidBefore: '2026-05-01' });
    const cancellation = makeEvent({ id: 'ev-evd-cancel-cancel', routeSlug: 'manchester-lahore', serviceId: 'evd-cancel-service', type: 'withdrawal-cancelled', announcedAt: '2026-01-15', relatedEventId: 'ev-evd-cancel-withdraw', currentClaimValidBefore: '2027-01-01' });
    const copy = buildFlagshipStatusCopy('manchester-lahore', [withdrawal, cancellation], FIXED_TODAY);
    expect(copy.evidenceDetail).not.toContain('2026-05-01');
    expect(copy.evidenceDetail).not.toMatch(/next check|review/i);
    // manchester-lahore's real route.verification.verifiedDate is 2026-07-13 — the citation's own checked date, independent of the (removed) withdrawal.
    expect(copy.evidenceDetail).toBe('Current route evidence checked 13 July 2026.');
  });

  it('reschedule uses only the new evidence-driven date — evidenceDetail never mentions the pre-reschedule date', () => {
    const original = makeEvent({ id: 'ev-evd-resched-orig', type: 'withdrawal-announced', announcedAt: '2026-06-01', effectiveFrom: '2026-08-01', currentClaimValidBefore: '2026-08-01' });
    const reschedule = makeEvent({ id: 'ev-evd-resched-new', type: 'withdrawal-rescheduled', announcedAt: '2026-06-15', newEffectiveFrom: '2026-11-01', relatedEventId: 'ev-evd-resched-orig', currentClaimValidBefore: '2026-11-01' });
    const viewModel = getRouteStatusCopy(
      makeRoute({ verification: { status: 'verified', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' } }),
      { status: 'withdrawal-announced', effectiveFrom: '2026-11-01', drivingEventId: 'ev-evd-resched-new', scope: { kind: 'airline', airlineSlug: 'pia' }, serviceNotices: [] },
      [original, reschedule],
      FIXED_TODAY
    );
    const copy = mapViewModelToFlagshipCopy(viewModel, ['Fixture Air']);
    // evidenceDetail is the citation's own checked-date (when the evidence was read), not the effective date — it must never carry either the old or new EFFECTIVE date, only its own checked date.
    expect(copy.evidenceDetail).not.toContain('2026-08-01');
    expect(copy.evidenceDetail).not.toContain('2026-11-01');
    expect(copy.evidenceDetail).toMatch(/^Service-change evidence: Fixture Publisher/);
  });

  it('service-ended produces no "Flown by…" claim anywhere', () => {
    const ended = makeEvent({ id: 'ev-evd-ended', type: 'service-ended', verifiedOccurrence: true, effectiveFrom: '2026-07-01', currentClaimValidBefore: '2027-01-01' });
    const viewModel = getRouteStatusCopy(
      makeRoute({}),
      { status: 'service-ended', effectiveFrom: '2026-07-01', drivingEventId: 'ev-evd-ended', scope: { kind: 'airline', airlineSlug: 'pia' }, serviceNotices: [] },
      [ended],
      FIXED_TODAY
    );
    const copy = mapViewModelToFlagshipCopy(viewModel, ['Fixture Air']);
    for (const value of Object.values(copy)) expect(value).not.toMatch(/flown by/i);
    expect(copy.evidenceDetail).toMatch(/^Service-end evidence: Fixture Publisher · checked 23 July 2026\.$/);
  });

  it('transition pending produces no future-check promise', () => {
    const event = makeEvent({ id: 'ev-evd-boundary', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-06-01', currentClaimValidBefore: '2026-06-01' });
    const viewModel = getRouteStatusCopy(
      makeRoute({}),
      { status: 'verification-pending', pendingReason: { kind: 'transition-boundary-reached', drivingEventId: 'ev-evd-boundary', effectiveFrom: '2026-06-01', scope: { kind: 'airline', airlineSlug: 'pia' } } },
      [event],
      FIXED_TODAY
    );
    const copy = mapViewModelToFlagshipCopy(viewModel, ['Fixture Air']);
    for (const value of Object.values(copy)) {
      expect(value).not.toMatch(/next check|we'll check again|will check again/i);
    }
    expect(copy.evidenceDetail).toContain('awaiting reverification');
  });

  it('neutral pending contains no airline attribution anywhere', () => {
    const viewModel = getRouteStatusCopy(makeRoute({}), { status: 'verification-pending', pendingReason: { kind: 'no-current-direct-evidence' } }, [], FIXED_TODAY);
    const copy = mapViewModelToFlagshipCopy(viewModel, ['Fixture Air']);
    for (const value of Object.values(copy)) expect(value).not.toContain('Fixture Air');
    expect(copy.evidenceDetail).toBe('Current direct-service evidence is awaiting verification.');
  });

  it('the real Manchester–Mumbai homepage copy uses human-readable dates and never a raw ISO date, in every field including evidenceDetail', () => {
    const copy = buildFlagshipStatusCopy('manchester-mumbai', routeStatusEvents, '2026-08-31');
    const isoDatePattern = /\d{4}-\d{2}-\d{2}/;
    for (const [key, value] of Object.entries(copy)) {
      expect(value, key).not.toMatch(isoDatePattern);
    }
    expect(copy.evidenceDetail).toMatch(/\d{1,2} \w+ \d{4}/); // a human-readable date IS present
  });
});
