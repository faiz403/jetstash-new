/**
 * Pure, dependency-free expiry check for the homepage evidence card, kept apart
 * from lib/homepage-evidence.ts so the client guard never pulls the route and
 * fare data modules into the browser bundle.
 *
 * True once the visitor's current UK calendar date has reached the expiry date.
 * A null expiry (no example was selected) is never "expired".
 */
export function isHomepageEvidenceExpired(expiresOnIso: string | null, now: Date): boolean {
  if (!expiresOnIso) return false;
  return now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' }) >= expiresOnIso;
}
