import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArriveByJourney } from '@/components/founder/arrive-by-journey';
import { getArrivalAirportOptions, getDepartureAirportOptions } from '@/lib/arrive-by-journey/airport-options';

/**
 * Arrive By full journey -- INTERNAL preview (start -> departure airport ->
 * flight -> arrival airport -> destination). Same access model as every
 * other /founder page: 404s in production unless FOUNDER_DASHBOARD_ENABLED=true
 * is explicitly set, available on localhost during development. /founder is
 * disallowed in app/robots.ts as a path prefix, and this route is not in
 * app/sitemap.ts or any navigation. The API it calls additionally needs a
 * server-side token in production (see the route's comment).
 *
 * The airport lists are computed here, on the server, from the same evidence
 * tables the API enforces, and passed down as small props: the worldwide
 * catalogue never reaches the client bundle.
 */

export const dynamic = 'force-dynamic';

function dashboardEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true';
}

export async function generateMetadata(): Promise<Metadata> {
  if (!dashboardEnabled()) return { robots: { index: false, follow: false } };
  return {
    title: 'Arrive By full journey (Internal)',
    robots: { index: false, follow: false },
  };
}

export default function ArriveByJourneyFounderPage() {
  if (!dashboardEnabled()) {
    notFound();
  }
  return <ArriveByJourney departureAirports={getDepartureAirportOptions()} arrivalAirports={getArrivalAirportOptions()} />;
}
