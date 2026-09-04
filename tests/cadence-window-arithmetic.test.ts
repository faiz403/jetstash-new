import { describe, expect, it } from 'vitest';
import { routes } from '@/data/routes';

/**
 * Cadence window arithmetic guard (4 September 2026 follow-up).
 *
 * A read-only audit found seven STABLE routes whose verification.note
 * stated "90-day window" but whose reviewDueDate was actually 91 calendar
 * days after verifiedDate (2026-09-04 -> 2026-12-04, not 2026-12-03) --
 * "same day, three months later" was used instead of literal calendar-day
 * addition. This is a dataset-wide invariant, not a per-route fact, so it
 * is guarded here once rather than as seven separate hardcoded assertions:
 * whenever a route's own note states its intended review window in days,
 * reviewDueDate must be verifiedDate plus exactly that many calendar days.
 * This catches the exact class of mistake that caused the original bug,
 * for any route, present or future -- not just the seven already fixed.
 */
describe('Every stated cadence window is exactly the number of days it claims', () => {
  const dayMs = 86_400_000;

  const withStatedWindow = routes
    .map((route) => {
      const note = route.verification?.note;
      const match = note?.match(/(\d+)-day window/);
      if (!match || !route.verification) return null;
      return {
        slug: route.slug,
        statedDays: Number(match[1]),
        verifiedDate: route.verification.verifiedDate,
        reviewDueDate: route.verification.reviewDueDate,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  it('found at least one route to check (the test itself is not vacuous)', () => {
    expect(withStatedWindow.length).toBeGreaterThan(0);
  });

  it.each(withStatedWindow)(
    '$slug: reviewDueDate is exactly $statedDays days after verifiedDate',
    ({ statedDays, verifiedDate, reviewDueDate }) => {
      const actualDays = Math.round(
        (new Date(`${reviewDueDate}T00:00:00Z`).getTime() - new Date(`${verifiedDate}T00:00:00Z`).getTime()) / dayMs
      );
      expect(actualDays).toBe(statedDays);
    }
  );
});
