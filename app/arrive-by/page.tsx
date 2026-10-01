import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ArriveByShell } from '@/components/arrive-by-shell';
import { getShellAirportLookup } from '@/lib/arrive-by-shared/airport-capability';
import { getArrivalAirportOptions, getDepartureAirportOptions } from '@/lib/arrive-by-journey/airport-options';
import { getPublicJourneyRoutePairs } from '@/lib/arrive-by-journey/public-route-pairs';

/**
 * The canonical Arrive By public beta — one product, airport-driven
 * configuration (see lib/arrive-by-shared/airport-registry.ts), rather
 * than a separate page per country. Deliberately noindex, follow and
 * absent from app/sitemap.ts for this beta stage, and not linked from
 * main navigation — we validate the unified experience first.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Arrive By (Beta)',
  description: "Find out when you'll actually reach where you're going after you land — a live traffic-aware and public-transport journey estimate.",
  robots: { index: false, follow: true },
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
