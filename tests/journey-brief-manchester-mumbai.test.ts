import { describe, it, expect } from 'vitest';
import {
  BOOK_BY_UNAVAILABLE_COPY,
  BOUNDARY_STATE_COPY,
  BUSINESS_CLASS_COPY,
  ECONOMY_COPY,
  WITHDRAWAL_BOUNDARY_DATE,
  getDateBoundaryState,
  getDominantAction,
} from '@/lib/journey-brief-manchester-mumbai';
import { BOOK_BY_PRIORITY_ROUTE_SLUGS, computeBookBySnapshot } from '@/lib/booking-intelligence';
import { getFareRangeSummary } from '@/data/fare-observations';
import { getObservationsByRoute } from '@/data/fare-observations';

/**
 * Gate 2 prototype tests — Manchester → Mumbai Journey Brief.
 *
 * Covers exactly what the Gate 2 brief required verified: the three
 * date-boundary states, Book-By staying unavailable for this route, no
 * price ever being fabricated, and no unsupported airline/cabin claim
 * appearing in the static copy this prototype renders.
 */

describe('getDateBoundaryState — the three-state boundary model', () => {
  it('classifies a date before the withdrawal boundary as "before"', () => {
    expect(getDateBoundaryState('2026-08-10')).toBe('before');
    expect(getDateBoundaryState('2026-08-30')).toBe('before');
  });

  it('classifies the boundary date itself as "boundary", not before or after', () => {
    expect(getDateBoundaryState(WITHDRAWAL_BOUNDARY_DATE)).toBe('boundary');
    expect(getDateBoundaryState('2026-08-31')).toBe('boundary');
  });

  it('classifies any date after the boundary as "after"', () => {
    expect(getDateBoundaryState('2026-09-01')).toBe('after');
    expect(getDateBoundaryState('2026-09-15')).toBe('after');
    expect(getDateBoundaryState('2026-12-20')).toBe('after');
  });
});

describe('BOUNDARY_STATE_COPY — matches the founder-approved wording exactly', () => {
  it('the "before" state uses the exact founder-approved sentence, verbatim', () => {
    expect(BOUNDARY_STATE_COPY.before.body).toBe(
      "Your travel date falls before IndiGo's announced 31 August 2026 change. A direct service is on record, but JetStash has not confirmed operation on your exact date. Check directly with IndiGo before booking."
    );
  });

  it('never presents the direct service as confirmed for the "before" state', () => {
    expect(BOUNDARY_STATE_COPY.before.body).toContain('has not confirmed operation on your exact date');
  });

  it('the "before" headline never claims the service is confirmed/on record "for this date" — only the body may state the general route is on record', () => {
    // Regression: the headline previously read "A direct service is on
    // record for this date," which reads as exact-date confirmation that
    // was never verified. The headline must carry the same caveat as the
    // body, never a stronger claim.
    const headline = BOUNDARY_STATE_COPY.before.headline.toLowerCase();
    expect(headline).not.toMatch(/on record for this date/);
    expect(headline).not.toMatch(/confirmed for this date/);
    expect(headline).not.toMatch(/service is available/);
  });

  it('no boundary-state copy (headline or body, any state) ever asserts date-specific confirmation', () => {
    for (const state of Object.values(BOUNDARY_STATE_COPY)) {
      const combined = `${state.headline} ${state.body}`.toLowerCase();
      expect(combined).not.toMatch(/on record for this date/);
      expect(combined).not.toMatch(/confirmed for this date/);
      expect(combined).not.toMatch(/is confirmed to operate/);
    }
  });

  it('never resolves the boundary date either way', () => {
    expect(BOUNDARY_STATE_COPY.boundary.body).toContain('cannot confirm whether this specific date operates');
  });

  it('never presents the former direct service as available after the boundary', () => {
    expect(BOUNDARY_STATE_COPY.after.body).toContain('has not yet verified the best alternative');
    expect(BOUNDARY_STATE_COPY.after.body.toLowerCase()).not.toContain('gulf');
    expect(BOUNDARY_STATE_COPY.after.body.toLowerCase()).not.toContain('emirates');
    expect(BOUNDARY_STATE_COPY.after.body.toLowerCase()).not.toContain('qatar airways');
  });
});

describe('getDominantAction — worst-true-signal-wins, scoped locally to this prototype', () => {
  it('recommends entering travel dates when none is given yet', () => {
    const result = getDominantAction({ boundaryState: null });
    expect(result.action).toBe('enter-travel-dates');
  });

  it('recommends checking current options for a post-boundary date', () => {
    const result = getDominantAction({ boundaryState: 'after' });
    expect(result.action).toBe('check-alternative');
  });

  it('recommends checking with IndiGo directly on the boundary date', () => {
    const result = getDominantAction({ boundaryState: 'boundary' });
    expect(result.action).toBe('wait-boundary-uncertain');
  });

  it('a critical Travel Ready signal overrides a calm pre-boundary date', () => {
    const result = getDominantAction({
      boundaryState: 'before',
      travelReadySignal: { severity: 'critical', label: 'Passport expiry issue', detail: 'Your passport does not meet the 6-month rule.' },
    });
    expect(result.action).toBe('check-travel-ready');
    expect(result.reason).toContain('passport');
  });

  it('a caution-level Travel Ready signal does NOT override timing (worst-signal-wins, not any-signal-wins)', () => {
    const result = getDominantAction({
      boundaryState: 'before',
      travelReadySignal: { severity: 'caution', label: 'Minor note', detail: 'Something worth reading.' },
    });
    expect(result.action).toBe('check-live-fare-and-confirm');
  });
});

describe('Book By must remain unavailable for Manchester–Mumbai (Gate 1 audit result)', () => {
  it('manchester-mumbai is not in the priority route list', () => {
    expect(BOOK_BY_PRIORITY_ROUTE_SLUGS).not.toContain('manchester-mumbai');
  });

  it('computeBookBySnapshot returns null for this route, confirming the honest-unavailable copy is required, not decorative', () => {
    expect(computeBookBySnapshot('manchester-mumbai', new Date('2026-07-14T12:00:00Z'))).toBeNull();
  });

  it('the unavailable-state copy never manufactures a booking recommendation', () => {
    expect(BOOK_BY_UNAVAILABLE_COPY.headline).toContain('not available yet');
    expect(BOOK_BY_UNAVAILABLE_COPY.actions.length).toBeGreaterThan(0);
  });
});

describe('No fabricated fare ever appears for this route', () => {
  it('zero fare observations exist for manchester-mumbai', () => {
    expect(getObservationsByRoute('manchester-mumbai')).toHaveLength(0);
  });

  it('getFareRangeSummary returns nothing to render as a price', () => {
    expect(getFareRangeSummary('manchester-mumbai', 'Economy', '2026-07-23')).toBeNull();
  });

  it('the Economy prototype copy contains no currency figure', () => {
    expect(ECONOMY_COPY.headline).not.toMatch(/£\d/);
    expect(ECONOMY_COPY.body).not.toMatch(/£\d/);
  });
});

describe('No unsupported Business Class / cabin claim appears', () => {
  it('the Business Class copy states availability is unverified, not confirmed', () => {
    expect(BUSINESS_CLASS_COPY.headline.toLowerCase()).toContain("hasn't been verified");
    // "has not confirmed" is an honest negation, not a claim — only a bare
    // affirmative ("is confirmed"/"we confirm") would be unsafe here.
    expect(BUSINESS_CLASS_COPY.body.toLowerCase()).not.toMatch(/\b(is|we) confirm/);
    expect(BUSINESS_CLASS_COPY.body.toLowerCase()).not.toContain('guaranteed');
  });

  it('the Business Class copy does not offer a quote or concierge service', () => {
    expect(BUSINESS_CLASS_COPY.body.toLowerCase()).toContain('no quote or concierge service');
  });
});
