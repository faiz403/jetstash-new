import { track as vercelTrack } from '@vercel/analytics';

/**
 * The one place JetStash sends an analytics event from — a thin wrapper
 * around Vercel Web Analytics (`<Analytics />`, mounted in app/layout.tsx),
 * chosen because it's platform-native (no new vendor relationship beyond
 * existing Vercel hosting), cookieless, and near-zero bundle cost. If the
 * vendor ever changes, this is the only file that needs to.
 *
 * Every event name below matches what's already on the site as
 * `data-analytics="..."` markup — those attributes double as human-readable
 * documentation of what fires where; this function is what actually sends
 * it. Never pass anything that identifies a person or a document (no email,
 * no passport/visa detail, no name) — route/destination/state context only.
 */
export function track(event: string, properties?: Record<string, string | number | boolean>): void {
  try {
    vercelTrack(event, properties);
  } catch {
    // Analytics must never break the page it's measuring.
  }
}
