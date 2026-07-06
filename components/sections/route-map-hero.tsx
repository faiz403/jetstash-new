'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { getRouteByAirportAndDestination } from '@/data/routes';
import geo from '@/lib/route-map-geo.json';

const ORIGIN_AIRPORT_SLUG = 'manchester';

type RegionKey = 'pakistan' | 'india' | 'gulf' | 'turkey-morocco';
type LabelAnchor = 'start' | 'middle' | 'end';

interface CityMeta {
  region: RegionKey;
  /** Label placement relative to the marker — tuned to the projected layout so the crowded eastern cluster stays legible. */
  dx: number;
  dy: number;
  anchor: LabelAnchor;
  /** Cities with no destination page of their own (e.g. Abu Dhabi) link to the region hub instead of a dead URL. */
  hrefOverride?: string;
}

// Display config keyed by slug. Coordinates and names come from the generated
// lib/route-map-geo.json (real Natural Earth geography); this only carries the
// app-level concerns: region grouping for the mobile list, label placement,
// and href overrides.
const CITY_META: Record<string, CityMeta> = {
  islamabad: { region: 'pakistan', dx: -12, dy: 0, anchor: 'end' },
  lahore: { region: 'pakistan', dx: -12, dy: 5, anchor: 'end' },
  karachi: { region: 'pakistan', dx: -12, dy: 4, anchor: 'end' },
  delhi: { region: 'india', dx: 12, dy: 4, anchor: 'start' },
  amritsar: { region: 'india', dx: 12, dy: 9, anchor: 'start' },
  ahmedabad: { region: 'india', dx: 12, dy: 4, anchor: 'start' },
  mumbai: { region: 'india', dx: 12, dy: 4, anchor: 'start' },
  dubai: { region: 'gulf', dx: 12, dy: 4, anchor: 'start' },
  'abu-dhabi': { region: 'gulf', dx: 0, dy: 22, anchor: 'middle', hrefOverride: '/gulf' },
  doha: { region: 'gulf', dx: -12, dy: 4, anchor: 'end' },
  jeddah: { region: 'gulf', dx: 12, dy: 4, anchor: 'start' },
  istanbul: { region: 'turkey-morocco', dx: 12, dy: 4, anchor: 'start' },
  marrakech: { region: 'turkey-morocco', dx: 12, dy: 4, anchor: 'start' },
};

const REGIONS: { key: RegionKey; label: string }[] = [
  { key: 'pakistan', label: 'Pakistan' },
  { key: 'india', label: 'India' },
  { key: 'gulf', label: 'Gulf' },
  { key: 'turkey-morocco', label: 'Turkey & Morocco' },
];

interface City {
  slug: string;
  name: string;
  x: number;
  y: number;
  meta: CityMeta;
}

// Merge generated coordinates with display config once, preserving the generated
// order (roughly north-west to south-east) for a natural reveal sequence.
const CITIES: City[] = geo.cities
  .filter((c) => CITY_META[c.slug])
  .map((c) => ({ ...c, meta: CITY_META[c.slug] }));

const ORIGIN = geo.origin;

function destinationHref(slug: string, override?: string): string {
  if (override) return override;
  const guide = getRouteByAirportAndDestination(ORIGIN_AIRPORT_SLUG, slug);
  return guide ? `/routes/${guide.slug}` : `/destinations/${slug}`;
}

// Elegant single-bow arc from Manchester to a city: a quadratic whose control
// point lifts perpendicular-ish (upward) from the chord midpoint, scaled by
// distance, so every route sweeps the same graceful direction.
function arcPath(city: City): string {
  const dx = city.x - ORIGIN.x;
  const dy = city.y - ORIGIN.y;
  const dist = Math.hypot(dx, dy);
  const mx = (ORIGIN.x + city.x) / 2;
  const my = (ORIGIN.y + city.y) / 2;
  const lift = dist * 0.16;
  return `M ${ORIGIN.x} ${ORIGIN.y} Q ${mx.toFixed(1)} ${(my - lift).toFixed(1)} ${city.x} ${city.y}`;
}

export function RouteMapHero() {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const activeCity = CITIES.find((c) => c.slug === active) ?? null;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sectionRef}>
      <div className="max-w-xl">
        <span className="text-xs font-semibold uppercase tracking-wide text-brass-300">Where we fly</span>
        <h2 className="mt-2 font-display text-3xl leading-tight text-sand-50 sm:text-4xl">
          Manchester to the destinations that matter
        </h2>
        <p className="mt-3 text-ink-300">
          Every destination we cover from Manchester, mapped in one view. Select a city to trace its route and
          explore the guide.
        </p>
      </div>

      {/* Below sm the map's labels are unreadable, so small screens get a direct
          editorial index grouped the same way. */}
      <div className="mt-10 flex flex-col gap-8 sm:hidden">
        {REGIONS.map((region) => (
          <div key={region.key}>
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{region.label}</span>
            <ul className="mt-3 flex flex-col divide-y divide-white/10 border-t border-white/10">
              {CITIES.filter((c) => c.meta.region === region.key).map((city) => (
                <li key={city.slug}>
                  <Link
                    href={destinationHref(city.slug, city.meta.hrefOverride)}
                    className="flex items-center justify-between py-3.5 text-sand-50 transition-colors hover:text-brass-300"
                  >
                    <span className="font-display text-xl">{city.name}</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={2} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8 hidden sm:block">
        <div className="mx-auto max-w-[1100px]">
          <svg
            viewBox={geo.viewBox}
            className="h-auto w-full"
            role="img"
            aria-label="Map of flight routes from Manchester to Pakistan, India, the Gulf, Turkey and Morocco, drawn on real geography"
          >
            <defs>
              <filter id="rmGlow" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur stdDeviation="4" />
              </filter>
            </defs>

            {/* Real Natural Earth landmass + faint borders — the subtle canvas. */}
            <path d={geo.land} fill="#0E1521" stroke="#C8932E" strokeOpacity="0.13" strokeWidth="0.6" strokeLinejoin="round" />
            <path d={geo.borders} fill="none" stroke="#C8932E" strokeOpacity="0.07" strokeWidth="0.5" />

            {/* Routes — thin gold arcs, drawn in on reveal, brightening on hover. */}
            <g fill="none" strokeLinecap="round">
              {CITIES.map((city, i) => {
                const isActive = city.slug === active;
                return (
                  <path
                    key={city.slug}
                    d={arcPath(city)}
                    stroke={isActive ? '#E7BE6A' : '#C8932E'}
                    strokeOpacity={isActive ? 0.95 : 0.2}
                    strokeWidth={isActive ? 1.8 : 1}
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={revealed ? 0 : 1}
                    style={{
                      transition: 'stroke-dashoffset 1.1s ease, stroke-opacity 0.35s ease, stroke 0.35s ease, stroke-width 0.35s ease',
                      transitionDelay: revealed ? `${i * 55}ms` : '0ms',
                    }}
                  />
                );
              })}
            </g>

            {/* Markers + labels sit above the routes. Each is a link-role group. */}
            <g
              style={{
                opacity: revealed ? 1 : 0,
                transition: 'opacity 0.6s ease',
                transitionDelay: '0.5s',
              }}
            >
              {CITIES.map((city) => {
                const isActive = city.slug === active;
                const href = destinationHref(city.slug, city.meta.hrefOverride);
                return (
                  <g
                    key={city.slug}
                    role="link"
                    tabIndex={0}
                    aria-label={`Manchester to ${city.name}. Explore destination.`}
                    className="cursor-pointer focus:outline-none"
                    onMouseEnter={() => setActive(city.slug)}
                    onFocus={() => setActive(city.slug)}
                    onMouseLeave={() => setActive((c) => (c === city.slug ? null : c))}
                    onBlur={() => setActive((c) => (c === city.slug ? null : c))}
                    onClick={() => router.push(href)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(href);
                      }
                    }}
                  >
                    {/* Generous invisible hit area over the marker. */}
                    <circle cx={city.x} cy={city.y} r="18" fill="transparent" />
                    {isActive && (
                      <circle cx={city.x} cy={city.y} r="9" fill="#E7BE6A" opacity="0.5" filter="url(#rmGlow)" />
                    )}
                    <circle
                      cx={city.x}
                      cy={city.y}
                      r={isActive ? 4 : 2.6}
                      fill={isActive ? '#F1D28C' : '#C8932E'}
                      fillOpacity={isActive ? 1 : 0.75}
                      className="transition-all duration-300"
                    />
                    <text
                      x={city.x + city.meta.dx}
                      y={city.y + city.meta.dy}
                      textAnchor={city.meta.anchor}
                      className="select-none font-display transition-all duration-300"
                      fontSize={isActive ? 15 : 13}
                      fill={isActive ? '#F7F2E9' : '#9CA3B0'}
                      style={{ paintOrder: 'stroke', stroke: 'transparent', strokeWidth: 10 }}
                    >
                      {city.name}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Manchester origin. */}
            <g
              style={{
                opacity: revealed ? 1 : 0,
                transition: 'opacity 0.6s ease',
                transitionDelay: '0.3s',
              }}
            >
              <circle cx={ORIGIN.x} cy={ORIGIN.y} r="10" fill="#F7F2E9" opacity="0.12" filter="url(#rmGlow)" />
              <circle cx={ORIGIN.x} cy={ORIGIN.y} r="3.6" fill="#F7F2E9" />
              <text
                x={ORIGIN.x}
                y={ORIGIN.y - 15}
                textAnchor="middle"
                className="select-none font-sans"
                fontSize="12"
                fontWeight={700}
                letterSpacing="0.08em"
                fill="#F7F2E9"
              >
                MANCHESTER
              </text>
            </g>
          </svg>

          {/* Route card — swaps between an idle prompt and the active route. No prices, no stats. */}
          <div aria-live="polite" className="mt-4 flex min-h-[4.5rem] items-center justify-center border-t border-white/10 pt-6">
            {activeCity ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="font-display text-2xl text-sand-50">Manchester → {activeCity.name}</p>
                <Link
                  href={destinationHref(activeCity.slug, activeCity.meta.hrefOverride)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brass-300 transition-colors hover:text-brass-200"
                >
                  Explore destination
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                </Link>
              </div>
            ) : (
              <p className="text-sm text-ink-400">Hover a destination to trace its route from Manchester.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
