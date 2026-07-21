import { airports } from '@/data/airports';
import { routes } from '@/data/routes';
import { getDestinationBySlug } from '@/data/destinations';
import { PullBriefHero, type HandoverData } from '@/components/homepage-v2/pull-brief-hero';
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

  return (
    <>
      <PullBriefHero handover={handover} />
      <WhatWeCheck />
      <RouteWatchInvite />
      <ClosingBand />
    </>
  );
}
