import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getRouteBySlug, getRouteStatus } from '@/data/routes';
import { airports } from '@/data/airports';
import { getEffectiveRoutePresentation, getRouteStatusCopy } from '@/lib/route-status-copy';
import { buildFlagshipStatusCopy } from '@/lib/flagship-status-copy';
import { routeStatusEvents, type RouteStatusEvent, type SourceRef } from '@/data/route-status-events';

/**
 * Route Status V1 final audit round 2 §2/§5 — the route prose fields
 * (frequency, intro/summary, bookingWindowNote) must never duplicate the
 * ledger's own current-change claim, so a cancellation or reschedule
 * recorded in the ledger can never leave stale wording stranded in route
 * presentation, homepage copy, or India/airport supporting copy. The Route
 * Status evidence layer (getRouteStatusCopy) is the ONLY place a
 * reschedule's new date may appear.
 */

const FIXED_TODAY = '2026-07-23';
const OLD_DATE = '2026-08-31'; // the real IndiGo announcement's effective date
const SOURCE: SourceRef = { publisher: 'IndiGo', url: 'https://example.com/fixture', accessedAt: FIXED_TODAY };

const STALE_PATTERNS = [OLD_DATE, '31 August 2026', '31 Aug 2026', /\bannounced\b/i, /\bwithdraw(al|n)?\b/i];

function assertNoStaleWording(...values: string[]) {
  for (const value of values) {
    for (const pattern of STALE_PATTERNS) {
      if (typeof pattern === 'string') expect(value).not.toContain(pattern);
      else expect(value).not.toMatch(pattern);
    }
  }
}

function withTemporaryEvents(events: RouteStatusEvent[], run: () => void) {
  for (const e of events) (routeStatusEvents as RouteStatusEvent[]).push(e);
  try {
    run();
  } finally {
    for (const e of events) {
      const idx = (routeStatusEvents as RouteStatusEvent[]).indexOf(e);
      if (idx !== -1) (routeStatusEvents as RouteStatusEvent[]).splice(idx, 1);
    }
  }
}

describe.each(['manchester-mumbai', 'manchester-delhi'])('final audit round 2 §5 — %s: cancellation leaves no old date/withdrawal wording anywhere', (slug) => {
  it('frequency and bookingWindowNote are static and already clean, regardless of ledger state', () => {
    const route = getRouteBySlug(slug)!;
    assertNoStaleWording(route.frequency, route.bookingWindowNote, route.intro);
  });

  it('after a cancellation, the effective presentation summary/frequency and the homepage flagship copy contain no old date or active-withdrawal assertion', () => {
    const realEvent = routeStatusEvents.find((e) => e.routeSlug === slug)!;
    const cancellation: RouteStatusEvent = {
      id: `fixture-cancel-${slug}`,
      routeSlug: slug,
      serviceId: realEvent.serviceId,
      scope: realEvent.scope,
      type: 'withdrawal-cancelled',
      announcedAt: '2026-07-20',
      relatedEventId: realEvent.id,
      currentClaimValidBefore: '2027-01-01',
      headline: 'Fixture cancellation',
      explanation: 'Fixture: the announced withdrawal was cancelled.',
      sources: [SOURCE],
      verifiedAt: FIXED_TODAY,
    };

    withTemporaryEvents([cancellation], () => {
      const route = getRouteBySlug(slug)!;
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, FIXED_TODAY);
      expect(presentation.status).toBe('direct'); // back to a plain, uncontested direct route
      assertNoStaleWording(presentation.summary, presentation.metadataDescription, presentation.shareText, presentation.statusLabel);
      if (presentation.status !== 'unverified' && presentation.status !== 'service-ended') {
        assertNoStaleWording(presentation.frequency!);
      }

      const flagshipCopy = buildFlagshipStatusCopy(slug, routeStatusEvents, FIXED_TODAY);
      expect(flagshipCopy.changeDetail).toBe('No active service-change notice for this route.');
      assertNoStaleWording(flagshipCopy.routeDetail, flagshipCopy.changeDetail, flagshipCopy.verdictLine);
    });
  });

  it('a reschedule shows the NEW date only in the Route Status evidence layer — route prose never embeds either the old or the new date', () => {
    const realEvent = routeStatusEvents.find((e) => e.routeSlug === slug)!;
    const NEW_DATE = '2026-11-15';
    const reschedule: RouteStatusEvent = {
      id: `fixture-reschedule-${slug}`,
      routeSlug: slug,
      serviceId: realEvent.serviceId,
      scope: realEvent.scope,
      type: 'withdrawal-rescheduled',
      announcedAt: '2026-07-20',
      newEffectiveFrom: NEW_DATE,
      relatedEventId: realEvent.id,
      currentClaimValidBefore: NEW_DATE,
      headline: 'Fixture reschedule',
      explanation: `Fixture: the withdrawal was rescheduled to ${NEW_DATE}.`,
      sources: [SOURCE],
      verifiedAt: FIXED_TODAY,
    };

    withTemporaryEvents([reschedule], () => {
      const route = getRouteBySlug(slug)!;

      // The evidence layer DOES carry the new date — this is the one and only place it may appear.
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, FIXED_TODAY);
      expect(presentation.status).toBe('direct'); // still pre-boundary relative to the new date, fresh evidence

      const result = getRouteStatus(route, routeStatusEvents, FIXED_TODAY)!;
      expect(result.status).toBe('withdrawal-announced');
      if (result.status === 'withdrawal-announced') {
        expect(result.effectiveFrom).toBe(NEW_DATE);
        expect(result.drivingEventId).toBe(reschedule.id); // the reschedule's own id, not the original announcement's
      }
      const viewModel = getRouteStatusCopy(route, result, routeStatusEvents, FIXED_TODAY);
      expect(viewModel.kind).toBe('withdrawal-announced');
      if (viewModel.kind === 'withdrawal-announced') expect(viewModel.effectiveFrom).toBe(NEW_DATE);

      // Route prose (static) never embeds any date at all, old or new.
      expect(route.frequency).not.toContain(NEW_DATE);
      expect(route.frequency).not.toContain(OLD_DATE);
      expect(route.intro).not.toContain(NEW_DATE);
      expect(route.intro).not.toContain(OLD_DATE);
      expect(route.bookingWindowNote).not.toContain(NEW_DATE);
      expect(route.bookingWindowNote).not.toContain(OLD_DATE);
    });
  });
});

describe('final audit round 2 §2 — India hub and Manchester airport supporting copy stay evergreen', () => {
  it('data/airports.ts\'s Manchester entry mentions the historical service without asserting an active announcement', () => {
    const manchester = airports.find((a) => a.slug === 'manchester')!;
    assertNoStaleWording(manchester.whyThisAirport);
    expect(manchester.whyThisAirport).toContain('Delhi');
    expect(manchester.whyThisAirport).toContain('Mumbai');
  });

  it('app/india/page.tsx\'s static practical-note copy carries no stale date or active-withdrawal assertion (source-level check — the note is an inline JSX literal, not exported data)', () => {
    const source = readFileSync(join(process.cwd(), 'app', 'india', 'page.tsx'), 'utf-8');
    expect(source).not.toContain(OLD_DATE);
    expect(source).not.toContain('31 August 2026');
    expect(source.toLowerCase()).not.toContain('indigo has announced');
  });
});
