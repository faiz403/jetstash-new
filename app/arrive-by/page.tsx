import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ArriveByShell } from '@/components/arrive-by-shell';
import { getShellAirportLookup } from '@/lib/arrive-by-shared/airport-capability';
import { getArrivalAirportOptions, getDepartureAirportOptions } from '@/lib/arrive-by-journey/airport-options';

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
export default async function ArriveByPage({ searchParams }: { searchParams: Promise<{ airport?: string | string[] }> }) {
  const { airport } = await searchParams;
  const lookup = getShellAirportLookup(Array.isArray(airport) ? airport[0] : airport);
  return <Suspense fallback={null}>
    <ArriveByShell lookup={lookup} departureAirports={getDepartureAirportOptions()} arrivalAirports={getArrivalAirportOptions('public')} />
  </Suspense>;
}
