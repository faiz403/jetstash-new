import { PullBriefHero } from '@/components/homepage-v2/pull-brief-hero';
import {
  CommercialPaths,
  FlagshipJourneys,
  WhatWeCheck,
  RouteWatchInvite,
  ClosingBand,
} from '@/components/homepage-v2/homepage-sections';

/**
 * The approved Journey Desk / "Pull Your Brief" homepage composition.
 *
 * Single source of truth for the experience so the public homepage
 * (app/page.tsx) and the founder preview route (app/founder/homepage-v2)
 * render the identical composition without duplicating the section list.
 * Purely presentational — no props, no data loading; every section is
 * self-contained and renders only verified route intelligence or an honest
 * "not yet".
 */
export function JourneyDeskHome() {
  return (
    <>
      <PullBriefHero />
      <CommercialPaths />
      <FlagshipJourneys />
      <WhatWeCheck />
      <RouteWatchInvite />
      <ClosingBand />
    </>
  );
}
