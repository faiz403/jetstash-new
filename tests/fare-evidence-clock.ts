import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Fare evidence evaluation date (3 November 2026). All but one of the fares published before this fix
 * depart on 17 November 2026, so the 15-day departure guard (lib/freshness-thresholds.ts) stopped
 * promoting them on 3 November. Tests that describe that dataset ("this route has a current fare")
 * read today's date, so they failed overnight although nothing was broken.
 *
 * They now evaluate the dataset on 2 November 2026, the last day that evidence was eligible.
 * tests/fare-departure-expiry-2026-11.test.ts proves the same evidence is suppressed from 3 November.
 * Observations logged after this date are not publishable at this date (isObservationCausallyAvailable),
 * so later fare data cannot change what these suites' Fare Signals and pages show. Assertions that read
 * the raw archive directly (for example route-completion-batch-1's list of Dubai observations) can still
 * need updating when data is appended. Production time and fare logic are untouched.
 */
export const FARE_EVIDENCE_DATE = '2026-11-02';

/** Pins Date (only) to FARE_EVIDENCE_DATE for each test in the calling file, so pages rendered in tests read the same day. */
export function pinClockToFareEvidenceDate(): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${FARE_EVIDENCE_DATE}T12:00:00.000Z`));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}
