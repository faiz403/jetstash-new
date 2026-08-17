import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PageHero } from '@/components/sections/page-hero';
import { TrackedFaresExplorer } from '@/components/sections/tracked-fares-explorer';
import { buildTrackedFareAirportGroups } from '@/lib/tracked-fare-groups';
import { routes } from '@/data/routes';
import { siteConfig } from '@/lib/site-config';

/**
 * Exhaustive Tracked Fares (PR #140) — the public, browsable answer to
 * "which routes does JetStash currently have a checked fare for?", the
 * question the Tracked Fares discoverability audit (16 August 2026) found
 * a visitor genuinely could not answer anywhere on the site. Deliberately
 * NOT derived from data/deals.ts: every entry here comes from a current,
 * publicly-safe Fare Signal (lib/tracked-fare-groups.ts), independent of
 * whether a curated Deal card exists for the same route. /deals remains
 * the separate, smaller, hand-curated selection — this page cross-links to
 * it once, restrained, rather than duplicating it or absorbing it.
 *
 * Pure ISR, matching /deals and /routes — every entry here must regenerate
 * without a deploy once a fare observation or route status changes.
 */
export const revalidate = 21600;

export const metadata: Metadata = {
  title: 'Tracked Fares — Every Current Fare Signal',
  description:
    'Every route JetStash currently has a checked, dated fare for — grouped by UK departure airport. Independent of the curated Deals selection. Never a live price feed.',
  alternates: { canonical: `${siteConfig.url}/tracked-fares` },
};

export default function TrackedFaresPage() {
  const nowIso = new Date().toISOString().slice(0, 10);
  const airportGroups = buildTrackedFareAirportGroups(routes, undefined, nowIso);
  const trackedRouteCount = airportGroups.reduce((sum, g) => sum + g.entries.length, 0);
  const airportCount = airportGroups.length;

  return (
    <>
      <PageHero
        heroKey="deals"
        eyebrow="Tracked fares"
        title="Every route with a current tracked fare"
        description={
          <>
            {trackedRouteCount} of our {routes.length} routes currently have a checked, dated fare — every one shown
            below, grouped by UK departure airport. This is the exhaustive list, independent of{' '}
            <Link href="/deals" className="font-medium text-brass-300 underline underline-offset-2 hover:text-brass-200">
              our curated Deal selection
            </Link>
            . Never a live price feed — always confirm the final price before booking.
          </>
        }
        stats={[
          { value: `${trackedRouteCount} of ${routes.length}`, label: 'Routes with a current tracked fare' },
          { value: String(airportCount), label: 'UK airports represented' },
        ]}
      />

      <TrackedFaresExplorer airportGroups={airportGroups} />

      <section className="border-t border-ink-100 bg-sand-50 py-10 sm:py-12">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <p className="text-sm text-ink-600">
            Looking for a smaller, hand-picked selection instead?{' '}
            <Link href="/deals" className="font-semibold text-ink-900 underline decoration-brass-400 decoration-2 underline-offset-4 hover:text-terracotta-600">
              See curated fare highlights
              <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" strokeWidth={2.25} />
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
