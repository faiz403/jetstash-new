import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { airports } from '@/data/airports';
import { routes } from '@/data/routes';
import { getDestinationBySlug } from '@/data/destinations';
import { AtlasFeelTest } from '@/components/founder/atlas-feel-test';
import { buildAtlasAirports } from '@/lib/atlas-network-data';
import { JourneyCheckForm, type JourneyCheckData } from '@/components/homepage-v2/journey-check-form';
import { HomepageOpeningHero } from '@/components/homepage-v2/homepage-opening-hero';
import { WhyJetStash, RouteWatchInvite, ClosingBand, CommercialPaths } from '@/components/homepage-v2/homepage-sections';

/**
 * The public homepage's flagship experience: the Route Atlas, for browsing
 * the whole network. JourneyCheckForm below it is the fast path for a
 * visitor who already knows their route — computed here, server-side, from
 * the same tracked-route data as before the Atlas replaced the old hero, so
 * the client bundle never imports the full data files.
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
      <HomepageOpeningHero />

      {/* Founder final order (August 2026): Your Journey — the primary
          "Check a journey" task — now renders directly beneath the hero, so
          the natural scroll path matches the CTA hierarchy (primary task
          first, secondary Route Atlas exploration second) even for a
          visitor who scrolls past the hero without clicking either button.
          Composition/order only — the section's own content, styling and
          the Atlas below are unchanged.
          id="your-journey" restores ClosingBand's "Check my trip" anchor, which previously
          pointed nowhere live (the only element that ever had this id was in the retired,
          unused pull-brief-hero.tsx) — now also the opening hero's primary CTA target, and
          the Atlas's own "Already know where you're going? Check a journey" line (see
          atlas-feel-test.tsx's header) jumps back up here. No per-element scroll-margin
          needed: app/globals.css already sets a global scroll-padding-top: 6rem tuned to the
          80px sticky header (see its own comment there) — adding scroll-mt-24 here as well
          stacked both offsets and overshot to ~192px instead of the intended small gap below
          the header. */}
      <section id="your-journey" className="border-t border-white/10 bg-ink-950 px-5 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-content">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brass-200">Before you book</p>
              <h2 className="mt-2 font-display text-2xl leading-tight text-sand-50 sm:text-3xl">See what is actually known about your journey.</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-300 sm:text-[15px]">
                Open a route guide for the evidence, timing guidance and practical checks behind a specific international journey from the UK.
              </p>
            </div>
          </div>

          <div className="mt-7 max-w-2xl border-t border-white/10 pt-6">
            <JourneyCheckForm origins={journeyCheck.origins} destinations={journeyCheck.destinations} routeIndex={journeyCheck.routeIndex} />
          </div>

          <Link
            href="/routes"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brass-200 transition-colors hover:text-brass-100"
          >
            Or browse every route guide
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
          </Link>
        </div>
      </section>

      <AtlasFeelTest airports={buildAtlasAirports()} defaultAirportSlug="manchester" />

      {/* Density + hierarchy fix (August 2026): WhyJetStash carries the
          merged "why JetStash / what we check" story (see its own doc
          comment in homepage-sections.tsx) — after the primary Your Journey
          task and the secondary Atlas exploration, then the specialist
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
