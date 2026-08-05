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
 * Never pass a URL, query string or affiliate identifier either: the page a
 * click happened on is already carried by the pageview's own path.
 *
 * **Hard limit: at most TWO properties per event.** Standard Vercel Pro Web
 * Analytics stores two custom properties per event; anything beyond that is
 * silently dropped, so a third property is worse than none — it looks logged
 * but never arrives. The Web Analytics Plus add-on would raise this to eight
 * and is a deliberate non-purchase (August 2026), so treat two as permanent.
 * When a route-shaped event needs origin AND destination, send the composite
 * route slug (`manchester-lahore`) rather than two fields: both halves are
 * recoverable from it, so one property carries what two used to. Prefer
 * `route` + `source` for anything route-related, and never send a property
 * whose value is already encoded in the route slug.
 * tests/analytics-property-limit.test.ts enforces this across every call site.
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
