import { describe, expect, it } from 'vitest';
import { getRouteBySlug } from '@/data/routes';

/**
 * Batch 3 BHX cadence correction (4 September 2026 follow-up).
 *
 * Batch 3 downgraded birmingham-faro, birmingham-rome and birmingham-agadir
 * from STABLE to RECENT/CHANGING, relying materially on Birmingham
 * Airport's generic "Seasons: High = ...; Low = ..." destination-page
 * field. That field was later proven to be generic tourism/best-time-to-
 * visit content, not flight-schedule evidence -- the identical field
 * appears on Birmingham's own Istanbul page, a route independently
 * confirmed STABLE via Turkish Airlines' own explicit year-round
 * statement. This corrects the three affected cadence decisions.
 */

describe('birmingham-faro: restored to STABLE', () => {
  const route = getRouteBySlug('birmingham-faro')!;

  it('is STABLE (90-day window), verifiedDate unchanged', () => {
    expect(route.verification?.status).toBe('verified');
    expect(route.verification?.verifiedDate).toBe('2026-09-04');
    expect(route.verification?.reviewDueDate).toBe('2026-12-03');
  });

  it('reviewDueDate is exactly 90 days after verifiedDate', () => {
    const verified = new Date(`${route.verification!.verifiedDate}T00:00:00Z`);
    const due = new Date(`${route.verification!.reviewDueDate}T00:00:00Z`);
    expect(Math.round((due.getTime() - verified.getTime()) / 86_400_000)).toBe(90);
  });

  it('no longer cites the generic tourism-season field as its cadence basis', () => {
    const note = route.verification!.note!;
    expect(note.toLowerCase()).not.toMatch(/does not affirmatively rule out seasonal instability/);
  });
});

describe('birmingham-rome: restored to STABLE', () => {
  const route = getRouteBySlug('birmingham-rome')!;

  it('is STABLE (90-day window), verifiedDate unchanged', () => {
    expect(route.verification?.status).toBe('verified');
    expect(route.verification?.verifiedDate).toBe('2026-09-04');
    expect(route.verification?.reviewDueDate).toBe('2026-12-03');
  });

  it('reviewDueDate is exactly 90 days after verifiedDate', () => {
    const verified = new Date(`${route.verification!.verifiedDate}T00:00:00Z`);
    const due = new Date(`${route.verification!.reviewDueDate}T00:00:00Z`);
    expect(Math.round((due.getTime() - verified.getTime()) / 86_400_000)).toBe(90);
  });

  it('no longer relies on "no source rules out seasonality" reasoning', () => {
    const note = route.verification!.note!;
    expect(note.toLowerCase()).not.toMatch(/no primary source affirmatively rules out seasonal instability/);
  });
});

describe('birmingham-agadir: stays RECENT/CHANGING, corrected basis', () => {
  const route = getRouteBySlug('birmingham-agadir')!;

  it('keeps its genuine 30-day window and unchanged dates -- no administrative date movement', () => {
    expect(route.verification?.status).toBe('verified');
    expect(route.verification?.verifiedDate).toBe('2026-09-04');
    expect(route.verification?.reviewDueDate).toBe('2026-10-04');
  });

  it('reviewDueDate is exactly 30 days after verifiedDate', () => {
    const verified = new Date(`${route.verification!.verifiedDate}T00:00:00Z`);
    const due = new Date(`${route.verification!.reviewDueDate}T00:00:00Z`);
    expect(Math.round((due.getTime() - verified.getTime()) / 86_400_000)).toBe(30);
  });

  it('explicitly withdraws the invalid tourism-season wording and the unsourced "mixed travel pattern" generalisation, rather than restating them as live reasoning', () => {
    const note = route.verification!.note!.toLowerCase();
    // The old phrasing is still quoted for the audit trail, but only inside
    // an explicit withdrawal -- the live decision must not restate it as
    // the reason for the classification.
    expect(note).not.toMatch(/does not affirmatively rule out seasonal instability/);
    expect(note).toMatch(/withdrawn|never independently sourced|rejected/);
  });

  it('relies instead on the genuine easyJet winter-2026 launch as its cadence basis', () => {
    const note = route.verification!.note!.toLowerCase();
    expect(note).toMatch(/easyjet.{0,40}winter-2026.{0,40}launch|winter-2026 service launch/);
  });
});
