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
  /**
   * The hero line: "Typical flight time: <value>" for a duration or neutral statement. Null when the value was replaced by an approved
   * "not verified" sentence (route-page PR D): the hero then carries no flight-time line at all, because the same sentence is already
   * the "Flight time" row in the route facts and a hero line that only says nothing is known pushed the fare card down the phone screen.
   */
  heroLine: string | null;
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
  return { heroLine: null, rowValue: sentence, replaced: true };
}

/**
 * Ended-service hero (route-page PR C, CEO ruling of 6 November 2026). A service-ended route's hero used to say "Former direct service
 * ended · connecting flights available" and "Usually 1 stop · 12 to 15h total": an availability claim and typical stop and duration
 * figures that are editorial and undated. It now states only what is evidenced (the nonstop service has ended) and says that
 * connecting alternatives MAY be available and must be checked for the traveller's own dates. The record's `connectingAlternative`
 * data, the canonical `service-ended` status and its evidence are untouched; only this page's wording differs.
 */
export const ENDED_SERVICE_HERO_HEADING = 'Direct service ended';
export const ENDED_SERVICE_HERO_SUPPORTING =
  'The former nonstop service has ended. Connecting alternatives may be available. Check current flights, stops and total journey times for your dates before booking.';
/** A service-ended route with no evidenced connecting alternative promises nothing about alternatives. */
export const ENDED_SERVICE_HERO_SUPPORTING_NO_ALTERNATIVE =
  'The former nonstop service has ended. Check current options directly with airlines before booking.';

export function getEndedServiceHeroCopy(canShowConnectingAlternative: boolean): { heading: string; supporting: string } {
  return {
    heading: ENDED_SERVICE_HERO_HEADING,
    supporting: canShowConnectingAlternative ? ENDED_SERVICE_HERO_SUPPORTING : ENDED_SERVICE_HERO_SUPPORTING_NO_ALTERNATIVE,
  };
}

/**
 * The "More route information" summary. The canonical service-ended summary for a route with connecting-alternative data ends "See below
 * for the current connecting journey and how to check today's price", which reads as if a current connecting journey has been
 * confirmed. On the route page it now points at the evidence instead. The canonical `presentation.summary` is unchanged and still feeds
 * Arrive By and the Manchester-Mumbai journey brief; every other status and every route without connecting-alternative data keeps it.
 */
export function getRouteSummaryForPage(
  presentation: { status: string; canShowConnectingAlternative: boolean; summary: string },
  pair: string
): string {
  if (presentation.status === 'service-ended' && presentation.canShowConnectingAlternative) {
    return `There's no current nonstop service on ${pair}: the previously-verified direct service has ended. The route status below sets out the evidence.`;
  }
  return presentation.summary;
}

/**
 * The connecting-alternative section for a service-ended route. It no longer says the journey "is still possible with a connection"
 * (an availability claim); it says alternatives may be available, that JetStash has not checked them live, and that the pattern below
 * is a general overview.
 */
export const ENDED_SERVICE_ALTERNATIVES_HEADING = 'Connecting alternatives';
export const ENDED_SERVICE_ALTERNATIVES_INTRO =
  'The direct service on this route has ended. Connecting alternatives may be available, but JetStash has not checked them live. The general pattern below is an overview, not a live check: confirm current flights, stops and total journey times for your dates before booking.';

/**
 * The route hero badge. `presentation.statusLabel` stays the one canonical label everywhere else (catalogue, hubs, cards, links);
 * only a verified direct route's "Direct" is reworded on the route page, where the fare sits directly below. Any other status or
 * label passes through untouched, so a future status can never silently fall through to the wrong badge.
 */
export function getRouteHeroBadgeLabel(status: string, statusLabel: string): string {
  return status === 'direct' && statusLabel === 'Direct' ? 'Direct service' : statusLabel;
}

/**
 * Route-page PR D (CEO-approved scope: remove redundant status statements). A service-ended hero already opens with the bold status
 * line "Direct service ended" directly under the title, which is word for word the canonical badge label, so the badge above the title
 * only repeated it. Every other status keeps its badge: there the badge is the only place the status is named at that level.
 */
export function shouldShowRouteHeroBadge(status: string): boolean {
  return status !== 'service-ended';
}

/**
 * The first sentence of the ended-service fare card. The hero directly above already says the former nonstop service has ended, and the
 * note under the Google Flights button explains what the results may show, so the card's own lead no longer states the ending a third
 * time; it says only what the card adds: JetStash has not checked connecting availability live.
 */
export const ENDED_SERVICE_FARE_CARD_LEAD = 'JetStash has not checked live availability for connecting flights.';
