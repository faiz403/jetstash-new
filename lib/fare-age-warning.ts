import { daysBetweenIso } from '@/lib/freshness-thresholds';

/** Presentation-only cue; this must not affect Fare Signal eligibility or selection. */
export const FARE_AGE_WARNING_AFTER_DAYS = 30;

export function getFareAgeWarningText(observedDate: string, nowIso: string): string | null {
  const ageDays = daysBetweenIso(observedDate, nowIso);
  if (ageDays <= FARE_AGE_WARNING_AFTER_DAYS) return null;

  return `Checked ${ageDays} days ago. Price or availability may have changed.`;
}
