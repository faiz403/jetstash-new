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

import { getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';

export const PROVIDER_NAME = 'Trip.com';

/**
 * Trip.com's Affiliate Link tool accepts these market settings on a custom
 * flight link and preserves the affiliate identifiers. They request the UK
 * English / GBP presentation without changing route or search parameters.
 */
export const TRIPCOM_UK_LOCALE = 'en-XX';
export const TRIPCOM_UK_CURRENCY = 'GBP';

/** rel attribute for every Trip.com outbound <a> — matches Google's guidance for paid/affiliate links. */
export const PROVIDER_REL = 'nofollow sponsored noopener noreferrer';

/**
 * Fresh-search clarification (Trip.com handoff trust fix, August 2026).
 *
 * Every URL above is confirmed structurally dateless (see the file header —
 * Trip.com's Flights page tool has no date field at all). That means a
 * customer who has just read a specific dated Fare Signal (price, airline,
 * departure/return dates, stops) and then clicks through lands on a fresh
 * Trip.com route search that does not carry any of those dates or that
 * itinerary across — Trip.com decides its own default dates and will not
 * necessarily show the same airline, price or routing. This is the one
 * shared sentence for every surface where a dated Fare Signal observation
 * sits directly above a Trip.com CTA, so the distinction is never implied
 * away and never worded slightly differently in two places. Only render it
 * next to a CTA that follows a dated observation — a surface with no
 * observed itinerary above the CTA has nothing to clarify.
 */
export const TRIPCOM_FRESH_SEARCH_NOTE =
  'Trip.com opens a new route search. Re-enter the dates and itinerary shown above to compare like for like.';

/**
 * The one fail-closed sentence for "this route has no dashboard-verified
 * partner link" (Route Page Simplification Phase 1, 25 Aug 2026).
 *
 * The Route Page Decision-First & Density audit found two DIFFERENT
 * sentences firing for this one underlying state on the same route page,
 * roughly 1.2 screens apart on london-heathrow-jeddah:
 *   - Fare Signal: "Exact partner booking link is not currently verified
 *     for this route."
 *   - Book-By Countdown: "Direct flight comparison is not available for
 *     this airport yet."
 * The second was also arguably inaccurate — the limitation is Trip.com's
 * own airport-specific link tooling (see the file header on the nine
 * London-origin routes), not an absence of direct flights, on a route
 * whose hero badge says DIRECT.
 *
 * Fare Signal's wording is kept verbatim as the canonical one because it
 * names the real cause (partner link, not flights) and is already the
 * sentence asserted across the full 88-route sweep in
 * tests/route-hero-scanability.ts. Nothing about the fail-closed DECISION
 * changes here — getTripComFlightHandoffUrl() still returns null for
 * exactly the same routes, and every caller still renders no CTA. This
 * constant only ensures the one state is described in one way.
 *
 * Deliberately NOT applied (out of scope for Phase 1) to the four other
 * surfaces that still carry the older "Direct flight comparison…" wording
 * — components/ui/deal-card.tsx, components/ui/no-fare-fallback.tsx,
 * components/travel-ready/travel-ready-check.tsx and
 * components/sections/tracked-fares-explorer.tsx. Those are separate
 * surfaces with their own regression tests; unifying them is a later,
 * separately-reviewed change.
 */
export const NO_VERIFIED_PARTNER_LINK_NOTE =
  'Exact partner booking link is not currently verified for this route.';

/**
 * Route-slug-keyed, exact dashboard-generated Trip.com Flights-page affiliate
 * links — see file header for provenance. 45 of JetStash's current 80 routes are
 * covered; the other 35 remain intentionally absent where Trip.com's tooling
 * does not provide a safe exact handoff (including the known London-origin limits).
 */
const TRIPCOM_ROUTE_URLS: Readonly<Record<string, string>> = {
  'manchester-lahore':
    'https://www.trip.com/flights/Manchester-to-Lahore/tickets-MAN-LHE?flighttype=S&dcity=MAN&acity=LHE&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082226',
  'manchester-islamabad':
    'https://www.trip.com/flights/Manchester-to-Islamabad/tickets-MAN-ISB?flighttype=S&dcity=MAN&acity=ISB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082296',
  'manchester-istanbul':
    'https://www.trip.com/flights/Manchester-to-Istanbul/tickets-MAN-IST?flighttype=S&dcity=MAN&acity=IST&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206133',
  'manchester-dalaman':
    'https://www.trip.com/flights/Manchester-to-Dalaman/tickets-MAN-DLM?flighttype=S&dcity=MAN&acity=DLM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206147',
  'manchester-bodrum':
    'https://www.trip.com/flights/Manchester-to-Bodrum/tickets-MAN-BJV?flighttype=S&dcity=MAN&acity=BJV&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206196',
  'manchester-antalya':
    'https://www.trip.com/flights/Manchester-to-Antalya/tickets-MAN-AYT?flighttype=S&dcity=MAN&acity=AYT&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19205349',
  'manchester-izmir':
    'https://www.trip.com/flights/Manchester-to-Izmir/tickets-MAN-IZM?flighttype=S&dcity=MAN&acity=IZM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206224',
  'manchester-marrakech':
    'https://www.trip.com/flights/Manchester-to-Marrakech/tickets-MAN-RAK?flighttype=S&dcity=MAN&acity=RAK&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'bristol-marrakech':
    'https://www.trip.com/flights/Bristol-to-Marrakech/tickets-BRS-RAK?flighttype=S&dcity=BRS&acity=RAK&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'manchester-agadir':
    'https://www.trip.com/flights/Manchester-to-Agadir/tickets-MAN-AGA?flighttype=S&dcity=MAN&acity=AGA&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'birmingham-agadir':
    'https://www.trip.com/flights/Birmingham-to-Agadir/tickets-BHX-AGA?flighttype=S&dcity=BHX&acity=AGA&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
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
  'birmingham-istanbul':
    'https://www.trip.com/flights/Birmingham-to-Istanbul/tickets-BHX-IST?flighttype=S&dcity=BHX&acity=IST&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206133',
  'birmingham-dalaman':
    'https://www.trip.com/flights/Birmingham-to-Dalaman/tickets-BHX-DLM?flighttype=S&dcity=BHX&acity=DLM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206154',
  'birmingham-bodrum':
    'https://www.trip.com/flights/Birmingham-to-Bodrum/tickets-BHX-BJV?flighttype=S&dcity=BHX&acity=BJV&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206210',
  'birmingham-antalya':
    'https://www.trip.com/flights/Birmingham-to-Antalya/tickets-BHX-AYT?flighttype=S&dcity=BHX&acity=AYT&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19205349',
  'leeds-bradford-antalya':
    'https://www.trip.com/flights/Leeds-to-Antalya/tickets-LBA-AYT?flighttype=S&dcity=LBA&acity=AYT&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19205349',
  'leeds-bradford-dalaman':
    'https://www.trip.com/flights/Leeds-to-Dalaman/tickets-LBA-DLM?flighttype=S&dcity=LBA&acity=DLM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206161',
  'leeds-bradford-bodrum':
    'https://www.trip.com/flights/Leeds-to-Bodrum/tickets-LBA-BJV?flighttype=S&dcity=LBA&acity=BJV&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206245',
  'glasgow-antalya':
    'https://www.trip.com/flights/Glasgow-to-Antalya/tickets-GLA-AYT?flighttype=S&dcity=GLA&acity=AYT&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19205349',
  'glasgow-dalaman':
    'https://www.trip.com/flights/Glasgow-to-Dalaman/tickets-GLA-DLM?flighttype=S&dcity=GLA&acity=DLM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206182',
  'glasgow-bodrum':
    'https://www.trip.com/flights/Glasgow-to-Bodrum/tickets-GLA-BJV?flighttype=S&dcity=GLA&acity=BJV&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206217',
  'bristol-antalya':
    'https://www.trip.com/flights/Bristol-to-Antalya/tickets-BRS-AYT?flighttype=S&dcity=BRS&acity=AYT&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19205349',
  'bristol-dalaman':
    'https://www.trip.com/flights/Bristol-to-Dalaman/tickets-BRS-DLM?flighttype=S&dcity=BRS&acity=DLM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206175',
  'newcastle-dalaman':
    'https://www.trip.com/flights/Newcastle%20upon%20Tyne-to-Dalaman/tickets-NCL-DLM?flighttype=S&dcity=NCL&acity=DLM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206189',
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

/** Exact dateless destination handoffs generated by Trip.com's Flights page tool. */
const TRIPCOM_DESTINATION_URLS: Readonly<Record<string, string>> = {
  'manchester-istanbul':
    'https://www.trip.com/flights/Manchester-to-Istanbul/tickets-MAN-IST?flighttype=S&dcity=MAN&acity=IST&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206238',
  'birmingham-istanbul':
    'https://www.trip.com/flights/Birmingham-to-Istanbul/tickets-BHX-IST?flighttype=S&dcity=BHX&acity=IST&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206133',
  'leeds-bradford-istanbul':
    'https://www.trip.com/flights/Leeds-to-Istanbul/tickets-LBA-IST?flighttype=S&dcity=LBA&acity=IST&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206140',
  'manchester-dalaman':
    'https://www.trip.com/flights/Manchester-to-Dalaman/tickets-MAN-DLM?flighttype=S&dcity=MAN&acity=DLM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206147',
  'birmingham-dalaman':
    'https://www.trip.com/flights/Birmingham-to-Dalaman/tickets-BHX-DLM?flighttype=S&dcity=BHX&acity=DLM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206154',
  'leeds-bradford-dalaman':
    'https://www.trip.com/flights/Leeds-to-Dalaman/tickets-LBA-DLM?flighttype=S&dcity=LBA&acity=DLM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206161',
  'bristol-dalaman':
    'https://www.trip.com/flights/Bristol-to-Dalaman/tickets-BRS-DLM?flighttype=S&dcity=BRS&acity=DLM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206175',
  'glasgow-dalaman':
    'https://www.trip.com/flights/Glasgow-to-Dalaman/tickets-GLA-DLM?flighttype=S&dcity=GLA&acity=DLM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206182',
  'newcastle-dalaman':
    'https://www.trip.com/flights/Newcastle%20upon%20Tyne-to-Dalaman/tickets-NCL-DLM?flighttype=S&dcity=NCL&acity=DLM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206189',
  'manchester-bodrum':
    'https://www.trip.com/flights/Manchester-to-Bodrum/tickets-MAN-BJV?flighttype=S&dcity=MAN&acity=BJV&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206196',
  'birmingham-bodrum':
    'https://www.trip.com/flights/Birmingham-to-Bodrum/tickets-BHX-BJV?flighttype=S&dcity=BHX&acity=BJV&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206210',
  'leeds-bradford-bodrum':
    'https://www.trip.com/flights/Leeds-to-Bodrum/tickets-LBA-BJV?flighttype=S&dcity=LBA&acity=BJV&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206245',
  'glasgow-bodrum':
    'https://www.trip.com/flights/Glasgow-to-Bodrum/tickets-GLA-BJV?flighttype=S&dcity=GLA&acity=BJV&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206217',
  'manchester-izmir':
    'https://www.trip.com/flights/Manchester-to-Izmir/tickets-MAN-IZM?flighttype=S&dcity=MAN&acity=IZM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206224',
  'manchester-marrakech':
    'https://www.trip.com/flights/Manchester-to-Marrakech/tickets-MAN-RAK?flighttype=S&dcity=MAN&acity=RAK&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'bristol-marrakech':
    'https://www.trip.com/flights/Bristol-to-Marrakech/tickets-BRS-RAK?flighttype=S&dcity=BRS&acity=RAK&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'manchester-agadir':
    'https://www.trip.com/flights/Manchester-to-Agadir/tickets-MAN-AGA?flighttype=S&dcity=MAN&acity=AGA&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'birmingham-agadir':
    'https://www.trip.com/flights/Birmingham-to-Agadir/tickets-BHX-AGA?flighttype=S&dcity=BHX&acity=AGA&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'manchester-barcelona':
    'https://www.trip.com/flights/Manchester-to-Barcelona/tickets-MAN-BCN?flighttype=S&dcity=MAN&acity=BCN&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'birmingham-barcelona':
    'https://www.trip.com/flights/Birmingham-to-Barcelona/tickets-BHX-BCN?flighttype=S&dcity=BHX&acity=BCN&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'bristol-barcelona':
    'https://www.trip.com/flights/Bristol-to-Barcelona/tickets-BRS-BCN?flighttype=S&dcity=BRS&acity=BCN&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'leeds-bradford-barcelona':
    'https://www.trip.com/flights/Leeds-to-Barcelona/tickets-LBA-BCN?flighttype=S&dcity=LBA&acity=BCN&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'bristol-faro':
    'https://www.trip.com/flights/Bristol-to-Faro/tickets-BRS-FAO?flighttype=S&dcity=BRS&acity=FAO&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'manchester-faro':
    'https://www.trip.com/flights/Manchester-to-Faro/tickets-MAN-FAO?flighttype=S&dcity=MAN&acity=FAO&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'birmingham-faro':
    'https://www.trip.com/flights/Birmingham-to-Faro/tickets-BHX-FAO?flighttype=S&dcity=BHX&acity=FAO&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'leeds-bradford-faro':
    'https://www.trip.com/flights/Leeds-to-Faro/tickets-LBA-FAO?flighttype=S&dcity=LBA&acity=FAO&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'manchester-athens':
    'https://www.trip.com/flights/Manchester-to-Athens/tickets-MAN-ATH?flighttype=S&dcity=MAN&acity=ATH&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'birmingham-athens':
    'https://www.trip.com/flights/Birmingham-to-Athens/tickets-BHX-ATH?flighttype=S&dcity=BHX&acity=ATH&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'glasgow-athens':
    'https://www.trip.com/flights/Glasgow-to-Athens/tickets-GLA-ATH?flighttype=S&dcity=GLA&acity=ATH&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'manchester-rome':
    'https://www.trip.com/flights/Manchester-to-Rome/tickets-MAN-ROM?flighttype=S&dcity=MAN&acity=ROM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'birmingham-rome':
    'https://www.trip.com/flights/Birmingham-to-Rome/tickets-BHX-ROM?flighttype=S&dcity=BHX&acity=ROM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'bristol-rome':
    'https://www.trip.com/flights/Bristol-to-Rome/tickets-BRS-ROM?flighttype=S&dcity=BRS&acity=ROM&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'birmingham-delhi':
    'https://www.trip.com/flights/Birmingham-to-New%20Delhi/tickets-BHX-DEL?flighttype=S&dcity=BHX&acity=DEL&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'birmingham-ahmedabad':
    'https://www.trip.com/flights/Birmingham-to-Ahmedabad/tickets-BHX-AMD?flighttype=S&dcity=BHX&acity=AMD&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'birmingham-dubai':
    'https://www.trip.com/flights/Birmingham-to-Dubai/tickets-BHX-DXB?flighttype=S&dcity=BHX&acity=DXB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'birmingham-doha':
    'https://www.trip.com/flights/Birmingham-to-Doha/tickets-BHX-DOH?flighttype=S&dcity=BHX&acity=DOH&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'birmingham-jeddah':
    'https://www.trip.com/flights/Birmingham-to-Jeddah/tickets-BHX-JED?flighttype=S&dcity=BHX&acity=JED&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19206602',
  'manchester-antalya':
    'https://www.trip.com/flights/Manchester-to-Antalya/tickets-MAN-AYT?flighttype=S&dcity=MAN&acity=AYT&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19205349',
  'birmingham-antalya':
    'https://www.trip.com/flights/Birmingham-to-Antalya/tickets-BHX-AYT?flighttype=S&dcity=BHX&acity=AYT&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19205349',
  'leeds-bradford-antalya':
    'https://www.trip.com/flights/Leeds-to-Antalya/tickets-LBA-AYT?flighttype=S&dcity=LBA&acity=AYT&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19205349',
  'glasgow-antalya':
    'https://www.trip.com/flights/Glasgow-to-Antalya/tickets-GLA-AYT?flighttype=S&dcity=GLA&acity=AYT&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19205349',
  'bristol-antalya':
    'https://www.trip.com/flights/Bristol-to-Antalya/tickets-BRS-AYT?flighttype=S&dcity=BRS&acity=AYT&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19205349',
};

/**
 * The one lookup every booking CTA in the app goes through. Returns the
 * exact dashboard-generated Trip.com URL for a supported route, or `null`
 * for any route not in TRIPCOM_ROUTE_URLS (or, for a route page, its exact
 * verified airport-pair entry in TRIPCOM_DESTINATION_URLS). The destination
 * fallback is deliberately pair-specific; it never broadens Heathrow or
 * Gatwick to an aggregate London search.
 * verification process).
 *
 * Callers MUST fail closed on `null`: render no booking CTA at all, never a
 * generic Trip.com homepage/search link, and never fall back to any other
 * provider. See the file header for why — this is a deliberate business
 * rule, not a gap to silently paper over.
 */
export function getTripComRouteUrl(routeSlug: string): string | null {
  return TRIPCOM_ROUTE_URLS[routeSlug] ?? null;
}

/**
 * Public flight handoff URL. The underlying route URL remains the exact
 * dashboard-generated value above; this applies the same locale/currency
 * fields visible in Trip.com's own generated custom-link output so a UK
 * visitor is explicitly sent a GBP search while route and attribution fields
 * remain unchanged.
 */
export type TripComFlightHandoffKind = 'exact-route' | 'destination-fallback' | 'service-ended-connecting';

export interface TripComFlightHandoff {
  url: string;
  kind: TripComFlightHandoffKind;
}

/**
 * Commercial funnel fix (12 Sept 2026, founder-approved, following the 12
 * Sept read-only dead-end audit). Shared copy for a service-ended route's
 * CTA — used wherever `kind === 'service-ended-connecting'` — deliberately
 * never says "direct", "nonstop", or "book this flight": it is a current
 * origin-destination SEARCH action, not a claim the old direct service
 * still operates. See the file's own header comment on
 * getTripComFlightHandoff() below for the exact evidence gate this requires.
 */
export const SERVICE_ENDED_CTA_LABEL = 'Compare current connecting flights on Trip.com';

/**
 * Resolves the one public flight handoff for a published route.
 *
 * A dashboard-generated link proves that Trip.com can receive the airport
 * pair; it does not override JetStash's route-status ledger. `unverified`
 * remains eligible: it is a warning about JetStash's direct-service claim,
 * not evidence that Trip.com cannot search the airport pair.
 *
 * Commercial funnel fix (12 Sept 2026, founder-approved): a route whose
 * effective public state is `service-ended` no longer fails closed
 * unconditionally. The dead-end audit (12 Sept 2026) found the prior
 * blanket suppression left a genuinely working, exact, dashboard-verified
 * search link unused on Manchester-Delhi/Mumbai, alongside canonical
 * `connectingAlternative` evidence proving a connecting journey exists — and
 * the page's own "Exact partner booking link is not currently verified for
 * this route" copy was, for those two routes specifically, false: the link
 * IS verified; only the route's own former direct-service claim is stale.
 *
 * The link is now allowed for a service-ended route ONLY when BOTH hold:
 *   1. `route.connectingAlternative` is genuinely present on the record —
 *      i.e. JetStash has independently evidenced that a connecting journey
 *      exists, never inferred or defaulted; and
 *   2. an EXACT route entry exists in TRIPCOM_ROUTE_URLS — never the
 *      broader destination fallback, which says less about this specific
 *      airport pair to begin with; stacking two lowered evidence bars is
 *      not the fix.
 * Failing either condition still fails closed exactly as before. The
 * returned `kind` is `'service-ended-connecting'` in this case specifically
 * so callers can render `SERVICE_ENDED_CTA_LABEL` (or equivalent wording
 * that cannot imply a nonstop is operating) instead of their normal CTA
 * copy.
 */
export function getTripComFlightHandoff(
  routeSlug: string,
  originSlug?: string,
  destinationSlug?: string,
  nowIso = new Date().toISOString().slice(0, 10),
): TripComFlightHandoff | null {
  const route = getRouteBySlug(routeSlug);
  const isServiceEnded = Boolean(route) && getEffectiveRoutePresentation(route!, routeStatusEvents, nowIso).status === 'service-ended';

  if (isServiceEnded) {
    if (!route?.connectingAlternative) return null;
    const exactUrl = getTripComRouteUrl(routeSlug);
    if (!exactUrl) return null;
    const url = exactUrl.includes('locale=') || exactUrl.includes('curr=') ? exactUrl : exactUrl.replace(
      '&Allianceid=',
      `&locale=${TRIPCOM_UK_LOCALE}&curr=${TRIPCOM_UK_CURRENCY}&Allianceid=`,
    );
    return { url, kind: 'service-ended-connecting' };
  }

  const routeUrl = getTripComRouteUrl(routeSlug)
    ?? (originSlug && destinationSlug ? TRIPCOM_DESTINATION_URLS[`${originSlug}-${destinationSlug}`] : null);
  if (!routeUrl) return null;
  const url = routeUrl.includes('locale=') || routeUrl.includes('curr=') ? routeUrl : routeUrl.replace(
    '&Allianceid=',
    `&locale=${TRIPCOM_UK_LOCALE}&curr=${TRIPCOM_UK_CURRENCY}&Allianceid=`,
  );
  return {
    url,
    kind: getTripComRouteUrl(routeSlug) ? 'exact-route' : 'destination-fallback',
  };
}

/**
 * Applies the public-route trust gate to a handoff. Use this on public route,
 * deal and tracked-fare surfaces; it protects those CTAs from a route status
 * that has since become service-ended without rewriting stored affiliate
 * provenance.
 */
export function getSafeTripComFlightHandoffUrl(
  routeSlug: string,
  originSlug?: string,
  destinationSlug?: string,
  nowIso?: string,
): string | null {
  return getTripComFlightHandoff(routeSlug, originSlug, destinationSlug, nowIso)?.url ?? null;
}

/**
 * Raw dashboard-generated route/destination handoff. This preserves the
 * existing contract for frozen, evidence-only products that deliberately
 * show a historical route search rather than a public booking CTA. Public
 * commercial CTAs must call getSafeTripComFlightHandoffUrl() instead.
 */
export function getTripComFlightHandoffUrl(
  routeSlug: string,
  originSlug?: string,
  destinationSlug?: string,
): string | null {
  const routeUrl = getTripComRouteUrl(routeSlug)
    ?? (originSlug && destinationSlug ? TRIPCOM_DESTINATION_URLS[`${originSlug}-${destinationSlug}`] : null);
  if (!routeUrl) return null;
  if (routeUrl.includes('locale=') || routeUrl.includes('curr=')) return routeUrl;
  return routeUrl.replace(
    '&Allianceid=',
    `&locale=${TRIPCOM_UK_LOCALE}&curr=${TRIPCOM_UK_CURRENCY}&Allianceid=`,
  );
}

/** Exact destination handoff for a verified airport pair, or null when Trip.com's tool could not produce one. */
export function getTripComDestinationHandoffUrl(originSlug: string, destinationSlug: string): string | null {
  const routeUrl = TRIPCOM_DESTINATION_URLS[`${originSlug}-${destinationSlug}`];
  if (!routeUrl) return null;
  return routeUrl.replace(
    '&Allianceid=',
    `&locale=${TRIPCOM_UK_LOCALE}&curr=${TRIPCOM_UK_CURRENCY}&Allianceid=`,
  );
}

/** Whether a route has a real, dashboard-verified Trip.com link — the fail-closed gate every CTA checks before rendering. */
export function hasTripComRoute(routeSlug: string): boolean {
  return routeSlug in TRIPCOM_ROUTE_URLS;
}
