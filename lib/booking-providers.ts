/**
 * Central outbound booking-provider configuration.
 *
 * Trip.com is JetStash's sole active public flight-comparison provider,
 * replacing TravelUp (removed entirely — TravelUp's generic-search CTA
 * frequently reset the traveller's intended departure airport, e.g.
 * Manchester silently becoming London, which was judged an unacceptable
 * user experience). Skyscanner remains declined pre-launch (see README) and
 * has no configuration here — nothing currently reads a second provider.
 *
 * Every URL in TRIPCOM_ROUTE_URLS below is the exact, unedited output of
 * Trip.com's own Affiliate Link → Flights page dashboard tool for that
 * specific origin airport → destination pair:
 *   - Genuinely dateless — the Flights page tool has no date field at all,
 *     confirmed structurally, not just by omission.
 *   - Carries JetStash's real, stable affiliate identifiers, constant across
 *     every entry: Allianceid=9804124, SID=327450313.
 *   - `trip_sub3` is Trip.com's own internal Ad ID (confirmed against the
 *     dashboard's "Previous links" history table), not a date or a guess.
 *
 * A route is deliberately ABSENT from this map — never filled with a
 * guessed or hand-edited URL — when Trip.com's own tools cannot produce a
 * genuine, airport-specific, dateless link for it. The nine London-origin
 * routes (seven Heathrow, two Gatwick) are the current example: Trip.com's
 * Flights page tool has no Heathrow- or Gatwick-specific entry, only a
 * generic "London" resolving to the aggregate LON code, and while Trip.com's
 * normal consumer search interface *can* select LHR/LGW specifically, doing
 * so always requires a fixed date (confirmed live: a real LHR→Delhi search
 * produced `ddate=...&rdate=...` even for a one-way trip), and dates cannot
 * be stripped from an already-tracked Custom Link without hand-editing it.
 * JetStash's standing rule: an exact airport-specific Trip.com link, or no
 * provider CTA at all — never a broadened generic redirect. See
 * getTripComRouteUrl()'s doc comment for how callers must honour that.
 *
 * Nothing outside this file should construct or edit a Trip.com URL by
 * hand — every booking CTA in the app reads its outbound URL from here.
 */

export const PROVIDER_NAME = 'Trip.com';

/** rel attribute for every Trip.com outbound <a> — matches Google's guidance for paid/affiliate links. */
export const PROVIDER_REL = 'nofollow sponsored noopener noreferrer';

/**
 * Route-slug-keyed, exact dashboard-generated Trip.com Flights-page affiliate
 * links — see file header for provenance. 23 of JetStash's 32 routes are
 * covered; the other 9 (all London-origin) are intentionally absent.
 */
const TRIPCOM_ROUTE_URLS: Readonly<Record<string, string>> = {
  'manchester-lahore':
    'https://www.trip.com/flights/Manchester-to-Lahore/tickets-MAN-LHE?flighttype=S&dcity=MAN&acity=LHE&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082226',
  'manchester-islamabad':
    'https://www.trip.com/flights/Manchester-to-Islamabad/tickets-MAN-ISB?flighttype=S&dcity=MAN&acity=ISB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082296',
  'manchester-dubai':
    'https://www.trip.com/flights/Manchester-to-Dubai/tickets-MAN-DXB?flighttype=S&dcity=MAN&acity=DXB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082331',
  'manchester-karachi':
    'https://www.trip.com/flights/Manchester-to-Karachi/tickets-MAN-KHI?flighttype=S&dcity=MAN&acity=KHI&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082597',
  'manchester-dhaka':
    'https://www.trip.com/flights/Manchester-to-Dhaka/tickets-MAN-DAC?flighttype=S&dcity=MAN&acity=DAC&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082380',
  'manchester-sylhet':
    'https://www.trip.com/flights/Manchester-to-Sylhet/tickets-MAN-ZYL?flighttype=S&dcity=MAN&acity=ZYL&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082611',
  'manchester-doha':
    'https://www.trip.com/flights/Manchester-to-Doha/tickets-MAN-DOH?flighttype=S&dcity=MAN&acity=DOH&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082646',
  'manchester-jeddah':
    'https://www.trip.com/flights/Manchester-to-Jeddah/tickets-MAN-JED?flighttype=S&dcity=MAN&acity=JED&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082653',
  'manchester-delhi':
    'https://www.trip.com/flights/Manchester-to-New%20Delhi/tickets-MAN-DEL?flighttype=S&dcity=MAN&acity=DEL&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082373',
  'manchester-mumbai':
    'https://www.trip.com/flights/Manchester-to-Mumbai/tickets-MAN-BOM?flighttype=S&dcity=MAN&acity=BOM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082688',
  'manchester-amritsar':
    'https://www.trip.com/flights/Manchester-to-Amritsar/tickets-MAN-ATQ?flighttype=S&dcity=MAN&acity=ATQ&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082695',
  'manchester-ahmedabad':
    'https://www.trip.com/flights/Manchester-to-Ahmedabad/tickets-MAN-AMD?flighttype=S&dcity=MAN&acity=AMD&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082702',
  'manchester-madinah':
    'https://www.trip.com/flights/Manchester-to-Medina/tickets-MAN-MED?flighttype=S&dcity=MAN&acity=MED&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082737',
  'birmingham-amritsar':
    'https://www.trip.com/flights/Birmingham-to-Amritsar/tickets-BHX-ATQ?flighttype=S&dcity=BHX&acity=ATQ&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082751',
  'birmingham-lahore':
    'https://www.trip.com/flights/Birmingham-to-Lahore/tickets-BHX-LHE?flighttype=S&dcity=BHX&acity=LHE&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082786',
  'birmingham-islamabad':
    'https://www.trip.com/flights/Birmingham-to-Islamabad/tickets-BHX-ISB?flighttype=S&dcity=BHX&acity=ISB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082800',
  'birmingham-madinah':
    'https://www.trip.com/flights/Birmingham-to-Medina/tickets-BHX-MED?flighttype=S&dcity=BHX&acity=MED&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082807',
  'birmingham-mumbai':
    'https://www.trip.com/flights/Birmingham-to-Mumbai/tickets-BHX-BOM?flighttype=S&dcity=BHX&acity=BOM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082814',
  'leeds-bradford-amritsar':
    'https://www.trip.com/flights/Leeds-to-Amritsar/tickets-LBA-ATQ?flighttype=S&dcity=LBA&acity=ATQ&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082870',
  'leeds-bradford-islamabad':
    'https://www.trip.com/flights/Leeds-to-Islamabad/tickets-LBA-ISB?flighttype=S&dcity=LBA&acity=ISB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082884',
  'glasgow-dubai':
    'https://www.trip.com/flights/Glasgow-to-Dubai/tickets-GLA-DXB?flighttype=S&dcity=GLA&acity=DXB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082912',
  'edinburgh-dubai':
    'https://www.trip.com/flights/Edinburgh-to-Dubai/tickets-EDI-DXB?flighttype=S&dcity=EDI&acity=DXB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082919',
  'newcastle-dubai':
    'https://www.trip.com/flights/Newcastle%20upon%20Tyne-to-Dubai/tickets-NCL-DXB?flighttype=S&dcity=NCL&acity=DXB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082933',
};

/**
 * The one lookup every booking CTA in the app goes through. Returns the
 * exact dashboard-generated Trip.com URL for a supported route, or `null`
 * for any route not in TRIPCOM_ROUTE_URLS (the 9 London-origin routes today,
 * and any future route that hasn't been through the same manual dashboard
 * verification).
 *
 * Callers MUST fail closed on `null`: render no booking CTA at all, never a
 * generic Trip.com homepage/search link, and never fall back to any other
 * provider. See the file header for why — this is a deliberate business
 * rule, not a gap to silently paper over.
 */
export function getTripComRouteUrl(routeSlug: string): string | null {
  return TRIPCOM_ROUTE_URLS[routeSlug] ?? null;
}

/** Whether a route has a real, dashboard-verified Trip.com link — the fail-closed gate every CTA checks before rendering. */
export function hasTripComRoute(routeSlug: string): boolean {
  return routeSlug in TRIPCOM_ROUTE_URLS;
}
