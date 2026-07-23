/**
 * Shared Route Watch config — the single source for the watched-route limit
 * and the customer-facing copy, so the UI, the API route, and tests can't
 * drift apart. Route Watch today only stores a subscriber's route
 * preferences in Brevo for a person to review and email about later — no
 * automated detection of booking timing, documents, fares, or route changes
 * exists yet, so copy here must not claim otherwise.
 */
export const MAX_WATCHED_ROUTES = 3;

export const ROUTE_WATCH_INITIAL_COPY =
  "Watch this route for meaningful, human-reviewed updates. This is not an automatic price-drop alert. Track up to 3 routes with one sign-up.";

export const ROUTE_WATCH_SUCCESS_COPY =
  "You're watching this route. If we find a meaningful update after review, we'll email you.";
