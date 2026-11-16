/**
 * Controlled pause for Arrive By's live (Google-backed) road-time lookups.
 *
 * The Google Cloud free trial behind Arrive By ends on 24 December 2026 and no billing upgrade is authorised (CEO, 16 Nov 2026).
 * If no continuation is approved, every Google request fails after that date. Two layers keep travellers safe:
 *   1. automatic: when every lookup in a journey fails at the service level, the answer says live checks are unavailable
 *      (GoogleCallLedger.liveLookupUnavailable), never "your start location needs confirming";
 *   2. deliberate: setting ARRIVE_BY_LIVE_LOOKUPS=off (Vercel env; a change needs a redeploy and the founder's approval) pauses live
 *      lookups outright: no budget reservation and no Google request, and the Arrive By page says so.
 * Either way nothing else changes: the form, the entered flight times and the rest of JetStash keep working, and no road time is
 * ever guessed. There is deliberately NO date-based automatic switch: a continuation decision, not a calendar, should decide.
 */

export const LIVE_LOOKUP_PAUSED_DETAIL =
  "Arrive By's live road-time checks are paused, so it can't confirm road journey times right now. Nothing you entered is wrong, and we won't guess the drive.";

/** True only when ARRIVE_BY_LIVE_LOOKUPS is explicitly 'off' (case-insensitive). Unset or any other value means live. */
export function isLiveLookupPaused(env: Record<string, string | undefined> = process.env): boolean {
  return env.ARRIVE_BY_LIVE_LOOKUPS?.trim().toLowerCase() === 'off';
}