import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ArriveByShell } from '@/components/arrive-by-shell';
import { getShellAirportLookup } from '@/lib/arrive-by-shared/airport-capability';
import { getArrivalAirportOptions, getDepartureAirportOptions } from '@/lib/arrive-by-journey/airport-options';
import { getPublicJourneyRoutePairs } from '@/lib/arrive-by-journey/public-route-pairs';
import { siteConfig } from '@/lib/site-config';

/**
 * The canonical Arrive By planner — one product, airport-driven
 * configuration (see lib/arrive-by-shared/airport-registry.ts), rather
 * than a separate page per country. Public since the 3 November 2026 CEO
 * launch directive (see DECISIONS.md): indexable, in app/sitemap.ts and in
 * the main navigation and footer. Every `?airport=`, `?departure=` or
 * `?arrival=` variant canonicalises to this one URL. The in-page "Beta"
 * label stays: there is still no external-user validation.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Arrive By: when to leave for your flight and onward journey',
  description: "Find out when you'll actually reach where you're going after you land — a live traffic-aware journey estimate, with public transport where supported.",
  alternates: { canonical: `${siteConfig.url}/arrive-by` },
};

/**
 * Server component: resolves the worldwide-catalogue / capability facts for
 * the requested `?airport=` code here, so the ~350 KB catalogue never ships
 * to the browser -- the client shell receives only a tiny AirportLookup.
 */
export default async function ArriveByPage({ searchParams }: { searchParams: Promise<{ airport?: string | string[]; departure?: string | string[]; arrival?: string | string[] }> }) {
  const { airport, departure, arrival } = await searchParams;
  const lookup = getShellAirportLookup(Array.isArray(airport) ? airport[0] : airport);
  const departureAirports = getDepartureAirportOptions();
  const arrivalAirports = getArrivalAirportOptions('public');
  const requestedDeparture = (Array.isArray(departure) ? departure[0] : departure)?.trim().toUpperCase();
  const requestedArrival = (Array.isArray(arrival) ? arrival[0] : arrival)?.trim().toUpperCase();
  const hasPairRequest = Boolean(requestedDeparture || requestedArrival);
  const hasValidPair = Boolean(requestedDeparture && requestedArrival
    && departureAirports.some((option) => option.code === requestedDeparture)
    && arrivalAirports.some((option) => option.code === requestedArrival));

  return <Suspense fallback={null}>
    <ArriveByShell
      lookup={lookup}
      departureAirports={departureAirports}
      arrivalAirports={arrivalAirports}
      initialAirportPair={hasValidPair ? { departureAirport: requestedDeparture!, arrivalAirport: requestedArrival! } : undefined}
      prefillNotice={hasPairRequest && !hasValidPair ? 'That airport pair is not available in Arrive By yet. Choose from the supported airports below.' : undefined}
      routePairs={getPublicJourneyRoutePairs()}
    />
  </Suspense>;
}
