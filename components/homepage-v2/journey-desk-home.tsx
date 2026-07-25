import { airports, getAirportBySlug } from '@/data/airports';
import { routes } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { buildFlagshipStatusPresentation } from '@/lib/flagship-status-copy';
import { HOMEPAGE_FLAGSHIP } from '@/lib/homepage-flagship';
import { getDestinationBySlug } from '@/data/destinations';
import { PullBriefHero, type HandoverData, type HomepageFlagshipData, type RelatedVerifiedRoute } from '@/components/homepage-v2/pull-brief-hero';
import { WhatWeCheck, RouteWatchInvite, ClosingBand } from '@/components/homepage-v2/homepage-sections';

/**
 * The public homepage: JetStash as the pre-booking second opinion.
 *
 * Single source of truth for the composition so the public homepage
 * (app/page.tsx) and the founder preview route (app/founder/homepage-v2)
 * render identically. The sequence is deliberate and minimal:
 *
 *   1. Quiet promise + the featured Manchester → Mumbai proof (pull to
 *      reveal what matters most) + the "now check your journey" handover.
 *   2. What we check before you book (the method, compact).
 *   3. Route Watch (ongoing protection for people not booking yet).
 *   4. A restrained closing band.
 *
 * Deliberately absent from the homepage (the pages themselves still exist):
 * deal feeds, destination inspiration, route catalogues and cabin upsell
 * paths — none of them change a sensible person's booking decision on
 * arrival, which is the bar every homepage section has to clear.
 *
 * The handover model below is computed server-side so the client hero never
 * imports the full data files: only airports with at least one tracked
 * route are offered as origins, and only destinations with a real page are
 * offered at all — every state the form can reach links to a page that
 * genuinely exists.
 */
export function JourneyDeskHome() {
  const originSlugs = [...new Set(routes.map((r) => r.airportSlug))];
  const origins = airports
    .filter((a) => originSlugs.includes(a.slug))
    .map((a) => ({ slug: a.slug, label: a.name.replace(/ Airport$/, '') }));

  const destinationSlugs = [...new Set(routes.map((r) => r.destinationSlug))];
  const destinations = destinationSlugs
    .map((slug) => {
      const d = getDestinationBySlug(slug);
      return d ? { slug, label: `${d.city}, ${d.country}` } : null;
    })
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .sort((a, b) => a.label.localeCompare(b.label));

  const routeIndex: Record<string, string> = {};
  for (const r of routes) routeIndex[`${r.airportSlug}|${r.destinationSlug}`] = r.slug;

  const handover: HandoverData = { origins, destinations, routeIndex };
  const flagshipRoute = routes.find((route) => route.slug === HOMEPAGE_FLAGSHIP.routeSlug);
  if (!flagshipRoute) throw new Error(`Homepage flagship route not found: ${HOMEPAGE_FLAGSHIP.routeSlug}`);
  const flagshipAirport = getAirportBySlug(flagshipRoute.airportSlug);
  const flagshipDestination = getDestinationBySlug(flagshipRoute.destinationSlug);
  if (!flagshipAirport || !flagshipDestination) throw new Error(`Homepage flagship route has incomplete place data: ${flagshipRoute.slug}`);

  const flagship: HomepageFlagshipData = {
    routeSlug: flagshipRoute.slug,
    airportSlug: flagshipRoute.airportSlug,
    destinationSlug: flagshipRoute.destinationSlug,
    originLabel: flagshipAirport.city,
    destinationLabel: flagshipDestination.city,
    destinationHref: `/destinations/${flagshipDestination.slug}`,
    journeyImageKey: HOMEPAGE_FLAGSHIP.journeyImageKey,
  };
  const nowIso = new Date().toISOString().slice(0, 10);
  const flagshipStatusPresentation = buildFlagshipStatusPresentation(flagship.routeSlug, routeStatusEvents, nowIso);
  const relatedVerifiedRoutes: RelatedVerifiedRoute[] = routes
    .filter((route) => route.destinationSlug === flagship.destinationSlug && route.slug !== flagship.routeSlug)
    .flatMap((route) => {
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
      const airport = getAirportBySlug(route.airportSlug);
      return presentation.status === 'direct' && airport
        ? [{ slug: route.slug, label: `${airport.city} → ${flagship.destinationLabel}`, originLabel: airport.city }]
        : [];
    });

  return (
    <>
      <PullBriefHero
        handover={handover}
        flagship={flagship}
        flagshipStatusPresentation={flagshipStatusPresentation}
        relatedVerifiedRoutes={relatedVerifiedRoutes}
      />
      <WhatWeCheck />
      <RouteWatchInvite />
      <ClosingBand />
    </>
  );
}
