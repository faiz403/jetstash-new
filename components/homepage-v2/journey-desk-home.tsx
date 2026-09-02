import { airports } from '@/data/airports';
import { routes } from '@/data/routes';
import { getDestinationBySlug } from '@/data/destinations';
import { AtlasFeelTest } from '@/components/founder/atlas-feel-test';
import { buildAtlasAirports } from '@/lib/atlas-network-data';
import type { JourneyCheckData } from '@/components/homepage-v2/journey-check-form';
import { HomepageOpeningHero } from '@/components/homepage-v2/homepage-opening-hero';
import { WhyJetStash, RouteWatchInvite, ClosingBand, CommercialPaths } from '@/components/homepage-v2/homepage-sections';

/**
 * The public homepage's flagship experience: the Route Atlas, for browsing
 * the whole network. Computed here, server-side, from the same tracked-route
 * data as before the Atlas replaced the old hero, so the client bundle never
 * imports the full data files — passed down into HomepageOpeningHero, which
 * renders the actual JourneyCheckForm control inside the hero itself (see
 * that file's own doc comment for why).
 *
 * The atlas is intentionally built from the same route/status/evidence data
 * as its founder preview. The public page changes the presentation, not the
 * truth boundary: every destination, airport and route panel still comes from
 * the audited network packs and the live Route Status ledger.
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

  const journeyCheck: JourneyCheckData = { origins, destinations, routeIndex };

  return (
    <>
      {/* Homepage hero integration (September 2026): the real Flying from /
          Going to journey finder now renders inside the hero itself — a
          visitor can use JetStash within seconds of landing, rather than
          reading a hero, clicking a CTA, and only then reaching the actual
          control in a separate section below. journeyCheck is computed here
          (server-side, same tracked-route data as always) and passed down;
          HomepageOpeningHero is the one place that renders JourneyCheckForm
          now — the standalone "Before you book / See what is actually known
          about your journey" section that used to duplicate this exact
          interaction directly beneath the hero has been removed. */}
      <HomepageOpeningHero journeyCheck={journeyCheck} />

      <AtlasFeelTest airports={buildAtlasAirports()} defaultAirportSlug="manchester" />

      {/* Density + hierarchy fix (August 2026): WhyJetStash carries the
          merged "why JetStash / what we check" story (see its own doc
          comment in homepage-sections.tsx) — after the hero's primary task
          and the secondary Atlas exploration, then the specialist
          Commercial Paths. CommercialPaths itself is unchanged, only its
          position moved (previously between Your Journey and the old
          WhatWeCheck). */}
      <WhyJetStash />

      <CommercialPaths />

      <RouteWatchInvite />
      <ClosingBand />
    </>
  );
}
