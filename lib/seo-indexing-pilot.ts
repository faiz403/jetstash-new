import { getRouteBySlug, getRouteAirport, getRouteDestination, isVerificationCurrent, type Route } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';

/**
 * SEO indexing pilot (founder-approved 21 October 2026, 28-day experiment —
 * see docs/project-control/SEO_INDEXING_PILOT_2026-10-21.md and the matching
 * DECISIONS.md exception). The 21 October diagnosis found 62 of 89 route
 * pages never crawled by Google ("Discovered – currently not indexed",
 * last crawl N/A) despite clean technical signals, and almost no
 * server-rendered links to route guides from the pages Google does recrawl
 * (the homepage Atlas and journey finder are client-side). This module is
 * the one place that decides which route guides those pages may point at,
 * and what the three pilot pages' Quick answers may say.
 *
 * Deliberately NOT a ranking of demand and NOT a publication decision: it
 * only reads the existing Route Status gate and the route-level
 * verification record. A route is linked only while BOTH hold —
 *   1. getEffectiveRoutePresentation() reads 'direct' or 'connecting' (never
 *      'Verification pending', 'unspecified' or 'service-ended'), and
 *   2. its route-level verification is itself current. This second check
 *      matters for connecting routes: getDisplayDirectness() keeps a
 *      recorded connecting shape after its review date passes, but a route
 *      whose review has lapsed must not be promoted.
 * Pages using it are ISR (revalidate = 21600), so a lapsed target drops out
 * at the next successful regeneration after its review date — normally
 * within the six-hour revalidation interval, not instantly.
 */

/** The three pages whose content the pilot improves (Quick answers block). */
export const SEO_PILOT_PAGE_SLUGS = ['manchester-islamabad', 'manchester-dubai', 'birmingham-delhi'] as const;

/**
 * Candidate link targets, in display order: the three pilot pages first, then
 * the not-yet-indexed South Asia and Gulf guides whose verification ran
 * beyond the experiment window when chosen (21 Oct 2026). Every entry still
 * passes through isRouteEligibleForSeoLink() at render time.
 */
export const SEO_PRIORITY_LINK_TARGET_SLUGS = [
  'manchester-islamabad',
  'manchester-dubai',
  'birmingham-delhi',
  'london-heathrow-bengaluru',
  'birmingham-mumbai',
  'birmingham-dubai',
  'birmingham-doha',
  'birmingham-jeddah',
] as const;

export function isSeoPilotPage(slug: string): boolean {
  return (SEO_PILOT_PAGE_SLUGS as readonly string[]).includes(slug);
}

export function isRouteEligibleForSeoLink(route: Route, nowIso: string): boolean {
  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
  if (presentation.status !== 'direct' && presentation.status !== 'connecting') return false;
  return isVerificationCurrent(route.verification, nowIso);
}

export interface SeoRouteLink {
  slug: string;
  href: string;
  label: string;
  /** IATA pair, e.g. "MAN → ISB" — the codes searchers type ("man to dxb") and that route pages otherwise never print. */
  codes: string;
  statusLabel: string;
}

export function getSeoRouteLinks(nowIso: string, excludeSlug?: string): SeoRouteLink[] {
  return SEO_PRIORITY_LINK_TARGET_SLUGS.flatMap((slug) => {
    if (slug === excludeSlug) return [];
    const route = getRouteBySlug(slug);
    if (!route || !isRouteEligibleForSeoLink(route, nowIso)) return [];
    const airport = getRouteAirport(route);
    const dest = getRouteDestination(route);
    if (!airport || !dest) return [];
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
    return [{
      slug,
      href: `/routes/${slug}`,
      label: `${airport.city} to ${dest.city}`,
      codes: `${airport.code} → ${dest.iataCode}`,
      statusLabel: presentation.statusLabel,
    }];
  });
}

/**
 * Quick answers for the three pilot pages, written against one specific
 * verification check each (Codex review, 21 Oct 2026: an answer may state
 * only what its cited primary source supports). Each entry is bound to the
 * route-level `verification.verifiedDate` it was reviewed against, and to the
 * Route Status it assumes. If the route record is re-verified, re-dated or
 * changes status, the entry no longer matches and the block is withdrawn
 * until these answers are reviewed again — it can never silently pair old
 * wording with new evidence. Omitted questions are deliberate: they are the
 * ones the cited source does not answer.
 */
export interface QuickAnswersContent {
  /** route.verification.verifiedDate these answers were reviewed against. */
  evidenceVerifiedDate: string;
  expectedStatus: 'direct' | 'connecting';
  /** Plain-language scope of what the cited source supports, shown in the footer. */
  sourceSupports: string;
  isDirect: string;
  journeyTime?: string;
  frequency: string;
  selfTransfer: string;
}

const QUICK_ANSWERS: Record<(typeof SEO_PILOT_PAGE_SLUGS)[number], QuickAnswersContent> = {
  // Manchester Airport's PIA operator page (checked 17 Oct 2026) supports the
  // operator and the nonstop service only — not duration, days or frequency.
  'manchester-islamabad': {
    evidenceVerifiedDate: '2026-10-17',
    expectedStatus: 'direct',
    sourceSupports: 'PIA as the operator and the nonstop service',
    isDirect: 'Yes. Manchester Airport’s own PIA page says PIA flies direct to Islamabad, a nonstop service that returned in 2025 after a five-year break.',
    frequency: 'Manchester Airport’s page does not list operating days or a weekly frequency. Any typical days shown elsewhere on this page come from recent flight-tracking history, not from the airport or PIA, and the northern winter schedule season starts on 25 October 2026, when days and times may change. Check PIA for your exact date.',
    selfTransfer: 'PIA’s nonstop is one flight on one ticket, so there is no connection to miss. Search results may also show connecting itineraries; if one is marked “self-transfer” or “separate tickets”, it is several separate bookings, and the next airline does not have to rebook you if you miss a connection.',
  },
  // Emirates' own Manchester–Dubai route page (checked 21 Oct 2026) states
  // 21 flights a week and lists each flight's timing and aircraft.
  'manchester-dubai': {
    evidenceVerifiedDate: '2026-10-21',
    expectedStatus: 'direct',
    sourceSupports: 'the operator, the nonstop flights, their scheduled durations and the weekly frequency',
    isDirect: 'Yes. Emirates’ own route page lists three nonstop Airbus A380 flights a day each way: EK22, EK18 and EK20 to Dubai, and EK21, EK17 and EK19 back to Manchester.',
    journeyTime: 'Emirates’ timetable shows about 7 to 8 hours to Dubai (7h 05m to 7h 50m, depending on the flight and season) and 7h 45m to 8h 10m back to Manchester.',
    frequency: 'Emirates states 21 flights per week between Manchester and Dubai, and says this may vary between seasons.',
    selfTransfer: 'Every Emirates flight on this route is nonstop on one ticket. A result marked “self-transfer” or “separate tickets” is a different, connecting itinerary made of separate bookings: if you miss a connection, the next airline does not have to rebook you.',
  },
  // Air India's own Birmingham–Delhi page (re-read 19 Oct 2026): "No direct
  // flights available" and "AI 118 departs ... (via ATQ)". Birmingham
  // Airport's page still calls the service direct (one flight number).
  'birmingham-delhi': {
    evidenceVerifiedDate: '2026-10-19',
    expectedStatus: 'connecting',
    sourceSupports: 'the stop in Amritsar and the absence of a nonstop flight',
    isDirect: 'Not nonstop. Air India’s own Birmingham–Delhi page says there are no direct flights and that its AI118 service flies via Amritsar (ATQ). Birmingham Airport’s page calls the same service “direct” because it keeps one flight number, but it still stops in Amritsar.',
    journeyTime: 'Air India’s page does not give a single journey time for the via-Amritsar service, so check the full itinerary, including the Amritsar stop, for your date.',
    frequency: 'Not confirmed for the current schedule. Check Air India for the days AI118 operates on your dates.',
    selfTransfer: 'The Amritsar stop is part of one Air India flight number (AI118), not a self-transfer. A result marked “self-transfer” or “separate tickets” is a different itinerary made of separate bookings, and the next airline does not have to rebook you if you miss a connection.',
  },
};

/**
 * The Quick answers to render for a route, or null. Null unless the route is
 * a pilot page, passes the link gate (current verification, Direct or
 * Connecting), shows the status the answers assume, and still carries the
 * exact verification check they were reviewed against.
 */
export function getQuickAnswersContent(route: Route, nowIso: string): QuickAnswersContent | null {
  if (!isSeoPilotPage(route.slug) || !isRouteEligibleForSeoLink(route, nowIso)) return null;
  const content = QUICK_ANSWERS[route.slug as (typeof SEO_PILOT_PAGE_SLUGS)[number]];
  const status = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso).status;
  if (status !== content.expectedStatus) return null;
  if (route.verification?.verifiedDate !== content.evidenceVerifiedDate) return null;
  return content;
}
