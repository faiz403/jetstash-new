'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { deals, formatChecked, type Deal } from '@/data/deals';
import { getRouteByAirportAndDestination } from '@/data/routes';

interface MapRoute {
  id: string;
  fromLabel: string;
  fromX: number;
  fromY: number;
  toLabel: string;
  toCountry: string;
  toX: number;
  toY: number;
  airportSlug: string;
  destinationSlug: string;
}

// Coordinates are positioned on a stylised 1000x380 world strip — UK to South Asia / Gulf.
// Prices are NOT stored here: every figure shown is looked up from data/deals.ts so the
// hero can never drift out of sync with the single source of truth.
const mapRoutes: MapRoute[] = [
  { id: 'man-lhe', fromLabel: 'Manchester', fromX: 165, fromY: 120, toLabel: 'Lahore', toCountry: 'Pakistan', toX: 760, toY: 195, airportSlug: 'manchester', destinationSlug: 'lahore' },
  { id: 'lhr-isb', fromLabel: 'London', fromX: 195, fromY: 175, toLabel: 'Islamabad', toCountry: 'Pakistan', toX: 745, toY: 175, airportSlug: 'london-heathrow', destinationSlug: 'islamabad' },
  { id: 'man-khi', fromLabel: 'Manchester', fromX: 165, fromY: 120, toLabel: 'Karachi', toCountry: 'Pakistan', toX: 740, toY: 235, airportSlug: 'manchester', destinationSlug: 'karachi' },
  { id: 'lhr-del', fromLabel: 'London', fromX: 195, fromY: 175, toLabel: 'Delhi', toCountry: 'India', toX: 800, toY: 210, airportSlug: 'london-heathrow', destinationSlug: 'delhi' },
  { id: 'lhr-bom', fromLabel: 'London', fromX: 195, fromY: 175, toLabel: 'Mumbai', toCountry: 'India', toX: 790, toY: 260, airportSlug: 'london-heathrow', destinationSlug: 'mumbai' },
  { id: 'bhx-atq', fromLabel: 'Birmingham', fromX: 178, fromY: 150, toLabel: 'Amritsar', toCountry: 'India', toX: 770, toY: 190, airportSlug: 'birmingham', destinationSlug: 'amritsar' },
  { id: 'man-dxb', fromLabel: 'Manchester', fromX: 165, fromY: 120, toLabel: 'Dubai', toCountry: 'UAE', toX: 680, toY: 250, airportSlug: 'manchester', destinationSlug: 'dubai' },
  { id: 'lhr-doh', fromLabel: 'London', fromX: 195, fromY: 175, toLabel: 'Doha', toCountry: 'Qatar', toX: 665, toY: 245, airportSlug: 'london-heathrow', destinationSlug: 'doha' },
  { id: 'lhr-jed', fromLabel: 'London', fromX: 195, fromY: 175, toLabel: 'Jeddah', toCountry: 'Saudi Arabia', toX: 590, toY: 270, airportSlug: 'london-heathrow', destinationSlug: 'jeddah' },
];

/** Cheapest economy flight fare recorded for this pair, if any. */
function findFlightDeal(route: MapRoute): Deal | undefined {
  return deals
    .filter(
      (d) =>
        d.category === 'flight' &&
        d.cabin === 'Economy' &&
        d.fromAirportSlug === route.airportSlug &&
        d.toDestinationSlug === route.destinationSlug
    )
    .sort((a, b) => a.indicativePrice - b.indicativePrice)[0];
}

function routeHref(route: MapRoute): string {
  const guide = getRouteByAirportAndDestination(route.airportSlug, route.destinationSlug);
  return guide ? `/routes/${guide.slug}` : `/destinations/${route.destinationSlug}`;
}

export function RouteMapHero() {
  const [active, setActive] = useState<string>(mapRoutes[0].id);
  const activeRoute = mapRoutes.find((r) => r.id === active) ?? mapRoutes[0];
  const activeDeal = findFlightDeal(activeRoute);

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 1000 380"
        className="h-auto w-full"
        role="img"
        aria-label="Map of flight routes from UK airports to South Asia and the Gulf"
      >
        <defs>
          <radialGradient id="dotglow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#C8932E" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#C8932E" stopOpacity="0" />
          </radialGradient>
        </defs>

        {mapRoutes.map((route) => {
          const isActive = route.id === active;
          const midX = (route.fromX + route.toX) / 2;
          const midY = Math.min(route.fromY, route.toY) - 60;
          const path = `M ${route.fromX} ${route.fromY} Q ${midX} ${midY} ${route.toX} ${route.toY}`;
          return (
            <g key={route.id}>
              <path
                d={path}
                fill="none"
                stroke={isActive ? '#C8932E' : '#1E222B'}
                strokeWidth={isActive ? 1.75 : 1}
                strokeDasharray={isActive ? 'none' : '3 5'}
                className="transition-all duration-500"
              />
            </g>
          );
        })}

        {mapRoutes.map((route) => {
          const isActive = route.id === active;
          return (
            <g key={`pt-${route.id}`}>
              <circle cx={route.toX} cy={route.toY} r={isActive ? 22 : 0} fill="url(#dotglow)" className="transition-all duration-500" />
              <circle
                cx={route.toX}
                cy={route.toY}
                r={isActive ? 6 : 4}
                fill={isActive ? '#C8932E' : '#454B57'}
                stroke="#0B0E14"
                strokeWidth="2"
                className="cursor-pointer transition-all duration-300 focus:outline-none"
                tabIndex={0}
                role="button"
                aria-label={`Show ${route.fromLabel} to ${route.toLabel} route`}
                onMouseEnter={() => setActive(route.id)}
                onFocus={() => setActive(route.id)}
                onClick={() => setActive(route.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setActive(route.id);
                }}
              />
              <text
                x={route.toX}
                y={route.toY - 14}
                textAnchor="middle"
                className="pointer-events-none select-none font-sans"
                fontSize={isActive ? 13 : 11}
                fontWeight={isActive ? 700 : 500}
                fill={isActive ? '#F7F2E9' : '#6B7280'}
              >
                {route.toLabel}
              </text>
            </g>
          );
        })}

        {/* origin markers — UK airports */}
        {[...new Set(mapRoutes.map((r) => r.fromLabel))].map((label) => {
          const r = mapRoutes.find((x) => x.fromLabel === label)!;
          return (
            <g key={label}>
              <circle cx={r.fromX} cy={r.fromY} r="5" fill="#F7F2E9" stroke="#0B0E14" strokeWidth="2" />
              <text x={r.fromX} y={r.fromY - 13} textAnchor="middle" fontSize="11" fontWeight={600} fill="#F7F2E9" className="select-none">
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Active route readout — every figure comes from data/deals.ts */}
      <div className="mt-2 flex flex-col items-start gap-4 rounded-md border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            {activeRoute.fromLabel} → {activeRoute.toLabel}, {activeRoute.toCountry}
          </p>
          {activeDeal ? (
            <>
              <p className="mt-1 font-display text-2xl text-sand-50">
                from £{activeDeal.indicativePrice.toLocaleString('en-GB')}
                <span className="ml-2 font-sans text-sm font-normal text-ink-300">return, example fare</span>
              </p>
              <p className="mt-0.5 text-xs text-ink-400">
                {activeDeal.airline} · checked {formatChecked(activeDeal.lastChecked)}
              </p>
            </>
          ) : (
            <p className="mt-1 font-display text-xl text-sand-50">
              Full route guide
              <span className="ml-2 font-sans text-sm font-normal text-ink-300">booking windows & fare history</span>
            </p>
          )}
        </div>
        <Link
          href={routeHref(activeRoute)}
          className="inline-flex items-center gap-1.5 rounded-sm bg-brass px-5 py-3 text-sm font-semibold text-ink-900 transition-colors hover:bg-brass-400"
        >
          View route guide
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
        </Link>
      </div>
      <p className="mt-3 text-center text-xs text-ink-400 sm:text-left">
        Select any city to preview its route. Fares are examples checked manually on the date shown — not live
        prices. Always confirm the final price before booking.
      </p>
    </div>
  );
}
