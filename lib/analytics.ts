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

/**
 * The complete, typed event vocabulary — every name a call site is allowed
 * to pass. A typo here is a compile error, not a silently-dropped event.
 * Grouped by when each group was added; existing entries are unchanged
 * strings pulled from their current call sites, never renamed.
 */
export type AnalyticsEvent =
  // Book-By Countdown
  | 'bookby_panel_view'
  | 'bookby_cta_click'
  | 'bookby_watch_click'
  // WhatsApp share
  | 'whatsapp_share_click'
  // Travel Ready Check
  | 'travel_ready_check_started'
  | 'travel_ready_check_completed'
  | 'travel_ready_check_verdict'
  | 'ready_check_source_click'
  | 'ready_check_book_cta_click'
  | 'ready_check_watch_click'
  // Route Watch
  | 'route_watch_signup'
  // Journey Brief (Manchester-Mumbai flagship)
  | 'journey_brief_started'
  | 'journey_brief_live_price_click'
  // Outbound affiliate link
  | 'tripcom_click'
  // Lead-capture conversions (Contact, Quote Request, Newsletter)
  | 'contact_submit_success'
  | 'quote_request_submit_success'
  | 'newsletter_subscribe_success'
  // Route Atlas engagement
  | 'atlas_origin_selected'
  | 'atlas_destination_selected'
  | 'atlas_route_opened'
  // Journey Check engagement
  | 'journey_check_started'
  | 'journey_check_completed'
  | 'journey_check_route_opened';

export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean>): void {
  try {
    vercelTrack(event, properties);
  } catch {
    // Analytics must never break the page it's measuring.
  }
}
