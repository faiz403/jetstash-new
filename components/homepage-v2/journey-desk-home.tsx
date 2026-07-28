import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { AtlasFeelTest } from '@/components/founder/atlas-feel-test';
import { buildAtlasAirports } from '@/lib/atlas-network-data';
import { WhatWeCheck, RouteWatchInvite, ClosingBand } from '@/components/homepage-v2/homepage-sections';

/**
 * The public homepage's flagship experience: the Route Atlas.
 *
 * The atlas is intentionally built from the same route/status/evidence data
 * as its founder preview. The public page changes the presentation, not the
 * truth boundary: every destination, airport and route panel still comes from
 * the audited network packs and the live Route Status ledger.
 */
export function JourneyDeskHome() {
  return (
    <>
      <AtlasFeelTest airports={buildAtlasAirports()} defaultAirportSlug="manchester" />

      <section className="border-t border-white/10 bg-ink-950 px-5 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto flex max-w-content flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brass-200">Before you book</p>
            <h2 className="mt-2 font-display text-2xl leading-tight text-sand-50 sm:text-3xl">See what is actually known about your journey.</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-300 sm:text-[15px]">
              Open a route guide for the evidence, timing guidance and practical checks behind a specific international journey from the UK.
            </p>
          </div>
          <Link
            href="/routes"
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-sm border border-brass/50 px-4 py-2.5 text-sm font-semibold text-brass-200 transition-colors hover:border-brass hover:text-brass-100 sm:self-auto"
          >
            Explore route guides
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
          </Link>
        </div>
      </section>

      <WhatWeCheck />
      <RouteWatchInvite />
      <ClosingBand />
    </>
  );
}
