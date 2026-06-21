'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

interface Route {
  id: string;
  fromLabel: string;
  fromX: number;
  fromY: number;
  toLabel: string;
  toCountry: string;
  toX: number;
  toY: number;
  price: number;
  href: string;
}

// Coordinates are positioned on a stylised 1000x520 world strip — UK to South Asia / Gulf.
const routes: Route[] = [
  { id: 'man-lhe', fromLabel: 'Manchester', fromX: 165, fromY: 120, toLabel: 'Lahore', toCountry: 'Pakistan', toX: 760, toY: 195, price: 489, href: '/pakistan' },
  { id: 'lhr-isb', fromLabel: 'London', fromX: 195, fromY: 175, toLabel: 'Islamabad', toCountry: 'Pakistan', toX: 745, toY: 175, price: 512, href: '/pakistan' },
  { id: 'lhr-del', fromLabel: 'London', fromX: 195, fromY: 175, toLabel: 'Delhi', toCountry: 'India', toX: 800, toY: 210, price: 467, href: '/india' },
  { id: 'bhx-atq', fromLabel: 'Birmingham', fromX: 178, fromY: 150, toLabel: 'Amritsar', toCountry: 'India', toX: 770, toY: 190, price: 521, href: '/india' },
  { id: 'man-dxb', fromLabel: 'Manchester', fromX: 165, fromY: 120, toLabel: 'Dubai', toCountry: 'UAE', toX: 680, toY: 250, price: 349, href: '/gulf' },
  { id: 'lhr-doh', fromLabel: 'London', fromX: 195, fromY: 175, toLabel: 'Doha', toCountry: 'Qatar', toX: 665, toY: 245, price: 398, href: '/gulf' },
  { id: 'lhr-jed', fromLabel: 'London', fromX: 195, fromY: 175, toLabel: 'Jeddah', toCountry: 'Saudi Arabia', toX: 590, toY: 270, price: 412, href: '/umrah' },
];

export function RouteMapHero() {
  const [active, setActive] = useState<string>(routes[0].id);
  const activeRoute = routes.find((r) => r.id === active) ?? routes[0];

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 1000 380"
        className="h-auto w-full"
        role="img"
        aria-label="Map of flight routes from UK airports to South Asia and the Gulf"
      >
        {/* base dotted world strip */}
        <defs>
          <radialGradient id="dotglow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#C8932E" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#C8932E" stopOpacity="0" />
          </radialGradient>
        </defs>

        {routes.map((route) => {
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

        {routes.map((route) => {
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
                className="cursor-pointer transition-all duration-300"
                onMouseEnter={() => setActive(route.id)}
                onClick={() => setActive(route.id)}
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
        {[...new Set(routes.map((r) => r.fromLabel))].map((label) => {
          const r = routes.find((x) => x.fromLabel === label)!;
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

      {/* Active route readout */}
      <div className="mt-2 flex flex-col items-start gap-4 rounded-md border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            {activeRoute.fromLabel} → {activeRoute.toLabel}, {activeRoute.toCountry}
          </p>
          <p className="mt-1 font-display text-2xl text-sand-50">
            from £{activeRoute.price}
            <span className="ml-2 text-sm font-sans font-normal text-ink-300">return, indicative</span>
          </p>
        </div>
        <Link
          href={activeRoute.href}
          className="inline-flex items-center gap-1.5 rounded-sm bg-brass px-5 py-3 text-sm font-semibold text-ink-900 transition-colors hover:bg-brass-400"
        >
          Explore this route
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
        </Link>
      </div>
      <p className="mt-3 text-center text-xs text-ink-400 sm:text-left">
        Click any city on the map to see live routes. Prices are indicative and checked regularly — always confirm the final price before booking.
      </p>
    </div>
  );
}
