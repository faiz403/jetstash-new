import { getTripComRouteUrl, TRIPCOM_UK_LOCALE, TRIPCOM_UK_CURRENCY } from '@/lib/booking-providers';
import type { JourneyChoice } from '@/lib/journey-choice';

/**
 * Journey Choice dated Trip.com handoff (24 Aug 2026, founder-approved,
 * manchester-islamabad pilot only).
 *
 * Trip.com's own consumer search UI generates round-trip search URLs on a
 * different path/param scheme than JetStash's stored SEO-style affiliate
 * links (`/flights/<Origin>-to-<Dest>/tickets-<CODE>-<CODE>`): the
 * `/flights/showfarefirst` format, with `ddate`/`rdate` query params that
 * genuinely prefill Trip.com's own search with specific dates. Two
 * commercial questions had to be answered before this could ever be
 * built, both now closed:
 *   1. Does JetStash's real affiliate identity (Allianceid/SID/trip_sub3)
 *      survive on this format? Confirmed 22 Aug 2026: a genuine <a href>
 *      click through this exact format landed with every param intact.
 *   2. Does Trip.com's own reporting actually attribute a click made
 *      through it? Confirmed 24 Aug 2026: Ad ID D19082751, isolated to
 *      22 Aug only on the Partner dashboard's "Top Performing by
 *      Dimension" widget, shows exactly 1 click — the single controlled
 *      test click, with reporting fully covering that date.
 * Neither of those proves a booking or any revenue; only that the format
 * itself preserves attribution when reached through a real click. See the
 * founder's own "JETSTASH — JOURNEY CHOICE DATED TRIP.COM HANDOFF PILOT"
 * approval message for the full evidence record.
 *
 * D19082751 (the test click's own Ad ID, Birmingham-Amritsar) is never
 * touched or reused here — this pilot is manchester-islamabad only, and
 * every route keeps its own existing, already-verified `trip_sub3`.
 *
 * Scope: deliberately manchester-islamabad only, not network-wide — see
 * TRIPCOM_DATED_HANDOFF_PILOT_ROUTE_SLUGS below. A second, independent
 * gate from Journey Choice's own JOURNEY_CHOICE_PILOT_ROUTE_SLUGS
 * (lib/journey-choice-route-adapter.ts), deliberately not reused directly
 * — the two pilots are approved separately and could diverge (Journey
 * Choice could earn a second route before the dated handoff does, or vice
 * versa) even though they happen to be identical today.
 */
export const TRIPCOM_DATED_HANDOFF_PILOT_ROUTE_SLUGS: readonly string[] = ['manchester-islamabad'];

/**
 * The one disclosure sentence for a dated handoff — never implies the
 * exact observed fare (£601/£626/etc.) is still bookable, never says
 * "book this fare". Deliberately different from TRIPCOM_FRESH_SEARCH_NOTE
 * (booking-providers.ts), which stays accurate for every other, dateless
 * CTA on the site: this one is only true when the URL genuinely carries
 * the dates, so it must never be shown alongside a fallback URL.
 */
export const JOURNEY_CHOICE_DATED_HANDOFF_NOTE =
  'Trip.com opens a fresh search for the route and dates shown above. Prices may have changed since JetStash checked.';

export interface JourneyChoiceTripComHandoff {
  url: string;
  /**
   * True only when the URL genuinely carries Journey Choice's own
   * departure/return dates and Trip.com is confirmed to accept them for
   * this route. False for the safe generic fallback, in which case
   * Trip.com opens a dateless search and the customer must re-enter dates
   * themselves — the CTA disclosure must say the right thing for each
   * case, never the same sentence for both.
   */
  datesPreserved: boolean;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * This exact format has only ever been proven for a single-adult Economy
 * round-trip search (class=y, quantity=1) — matching every current
 * manchester-islamabad comparable observation. There is no structured
 * passenger-count field on FareObservation to derive "1 adult" from
 * (profileId is deliberately never parsed for this or anything else — see
 * lib/journey-choice.ts's own doc comment), so quantity=1 and class=y are
 * fixed constants of this pilot's supported profile, not values read from
 * per-observation data. If JetStash ever logs a non-Economy or
 * multi-passenger Journey Choice observation, this function must be
 * revisited before it could safely cover that case — cabin is checked
 * below and fails closed for anything other than Economy.
 */
function buildDatedShowFareFirstUrl(routeUrl: string, departureDate: string, returnDate: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(routeUrl);
  } catch {
    return null;
  }
  const dcity = parsed.searchParams.get('dcity');
  const acity = parsed.searchParams.get('acity');
  const allianceId = parsed.searchParams.get('Allianceid');
  const sid = parsed.searchParams.get('SID');
  const tripSub3 = parsed.searchParams.get('trip_sub3');
  // trip_sub1 is stored empty on every current route URL — read it
  // rather than assume, but never require it non-empty.
  const tripSub1 = parsed.searchParams.get('trip_sub1') ?? '';
  if (!dcity || !acity || !allianceId || !sid || !tripSub3) return null;

  const params = new URLSearchParams({
    dcity: dcity.toLowerCase(),
    acity: acity.toLowerCase(),
    ddate: departureDate,
    rdate: returnDate,
    triptype: 'rt',
    class: 'y',
    lowpricesource: 'searchform',
    quantity: '1',
    searchboxarg: 't',
    nonstoponly: 'off',
    locale: TRIPCOM_UK_LOCALE,
    curr: TRIPCOM_UK_CURRENCY,
    Allianceid: allianceId,
    SID: sid,
    trip_sub1: tripSub1,
    trip_sub3: tripSub3,
  });
  return `https://www.trip.com/flights/showfarefirst?${params.toString()}`;
}

/**
 * The one entry point Journey Choice's presentation layer calls. Never
 * fabricates a dated URL from incomplete evidence — fails closed to the
 * caller's own already-verified generic handoff (`genericTripComUrl`,
 * from getTripComFlightHandoffUrl()) whenever the pilot doesn't apply, the
 * route context can't be resolved, or Journey Choice's own structured
 * dates/cabin don't support it. Returns null only when there is no CTA at
 * all to fall back to (matches the existing NoCtaFallback path).
 */
export function getJourneyChoiceTripComHandoff(
  routeSlug: string,
  journeyChoice: JourneyChoice,
  genericTripComUrl: string | null
): JourneyChoiceTripComHandoff | null {
  if (!genericTripComUrl) return null;
  if (!TRIPCOM_DATED_HANDOFF_PILOT_ROUTE_SLUGS.includes(routeSlug)) {
    return { url: genericTripComUrl, datesPreserved: false };
  }

  const { departureDate, returnDate, cabin, currency } = journeyChoice.lowerFare;
  const fallback: JourneyChoiceTripComHandoff = { url: genericTripComUrl, datesPreserved: false };

  if (cabin !== 'Economy' || currency !== 'GBP') return fallback;
  if (!ISO_DATE_RE.test(departureDate) || !ISO_DATE_RE.test(returnDate)) return fallback;
  // Journey Choice's own exact-match comparison contract (PR #171) already
  // guarantees every option shares identical dates — this is a defensive
  // re-check, not an assumption, matching this codebase's established
  // defence-in-depth style.
  if (journeyChoice.fasterJourney.departureDate !== departureDate || journeyChoice.fasterJourney.returnDate !== returnDate) {
    return fallback;
  }

  const routeUrl = getTripComRouteUrl(routeSlug);
  if (!routeUrl) return fallback;

  const datedUrl = buildDatedShowFareFirstUrl(routeUrl, departureDate, returnDate);
  if (!datedUrl) return fallback;

  return { url: datedUrl, datesPreserved: true };
}
