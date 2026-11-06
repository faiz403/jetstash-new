/**
 * Route-page first-screen wording helpers (route-page PR C, November 2026, CEO-approved).
 *
 * The 6 November mobile audit found two labelling problems on the route hero:
 *   1. The badge said only "Direct", so a visitor could read it as a statement about the fare shown just below it, when it
 *      describes the route's listed service. It now says "Direct service" (see `getRouteHeroBadgeLabel`).
 *   2. The line "Typical flight time: <value>" often carried service-status prose instead of a duration (for example "Direct; check
 *      PIA for the scheduled duration" or "Connecting; stops and journey time vary by itinerary"), so the label and its value
 *      disagreed. `getFlightTimeDisplay` keeps every value that states a duration and replaces only status-first values that contain
 *      none, using the three approved sentences below. Status itself stays in the badge and the status headline.
 *
 * Presentation only: the record's `flightTime` string is never edited, nothing here reads or changes fares, route status or
 * verification, and every other consumer of `presentation.flightTime` is untouched.
 */

/** Direct service whose duration JetStash has not verified. The airline may have published a schedule JetStash has not verified, so this never says "not published". */
export const FLIGHT_TIME_NOT_VERIFIED_DIRECT = "Typical flight time not verified. Check the airline's current schedule.";
/** Connecting service whose duration JetStash has not verified. */
export const JOURNEY_TIME_VARIES_CONNECTING = 'Journey time varies by itinerary and connection.';
/** Service JetStash has not independently confirmed. */
export const JOURNEY_TIME_NOT_CONFIRMED = 'Journey time not yet confirmed.';

/**
 * An explicit duration figure: "4h", "4h 05m", "7h 45m", "7-8h", "7–8 hours", "7 to 8 hours", "About 7–8h direct". A bare word such
 * as "duration" or "journey time" is not a figure, so "Duration not confirmed" is not matched.
 */
const DURATION_FIGURE = /\b\d+(?:\.\d+)?\s?(?:h|hr|hrs|hours?)\b|\b\d+\s?(?:–|-|to)\s?\d+\s?(?:h|hr|hrs|hours?)\b/i;

export interface FlightTimeDisplay {
  /** The whole hero line: "Typical flight time: <value>" for a duration or neutral statement, or an approved sentence on its own. */
  heroLine: string;
  /** The value for a labelled "Flight time" row: the original value, or the approved sentence when it was replaced. */
  rowValue: string;
  /** True only when a status-first value without a duration figure was replaced. */
  replaced: boolean;
}

export function getFlightTimeDisplay(flightTime: string): FlightTimeDisplay {
  const value = flightTime.trim();
  const keep: FlightTimeDisplay = { heroLine: `Typical flight time: ${flightTime}`, rowValue: flightTime, replaced: false };
  if (DURATION_FIGURE.test(value)) return keep;
  let sentence: string | null = null;
  if (/^unverified\b/i.test(value)) sentence = JOURNEY_TIME_NOT_CONFIRMED;
  else if (/^connecting\b/i.test(value)) sentence = JOURNEY_TIME_VARIES_CONNECTING;
  else if (/^direct\b/i.test(value)) sentence = FLIGHT_TIME_NOT_VERIFIED_DIRECT;
  if (!sentence) return keep;
  return { heroLine: sentence, rowValue: sentence, replaced: true };
}

/**
 * The route hero badge. `presentation.statusLabel` stays the one canonical label everywhere else (catalogue, hubs, cards, links);
 * only a verified direct route's "Direct" is reworded on the route page, where the fare sits directly below. Any other status or
 * label passes through untouched, so a future status can never silently fall through to the wrong badge.
 */
export function getRouteHeroBadgeLabel(status: string, statusLabel: string): string {
  return status === 'direct' && statusLabel === 'Direct' ? 'Direct service' : statusLabel;
}
