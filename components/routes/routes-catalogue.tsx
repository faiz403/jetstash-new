'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown, MapPin, Plane, Search, X } from 'lucide-react';
import type { CountryGroup, RouteCardData } from '@/lib/route-country-groups';

/**
 * `/routes` usability fix — the page previously rendered every route as one
 * long, always-open list grouped by the broad RegionGroup ("The Gulf &
 * Umrah" spanning UAE/Qatar/Saudi Arabia together), with no way to search.
 * On mobile this meant scrolling past every card to find one destination,
 * a problem that only grows as more routes are added.
 *
 * Grouped by `Destination.country` instead — see lib/route-country-groups.ts
 * for the grouping/ordering rules; app/routes/page.tsx (the server
 * component) does all data derivation exactly as before and passes fully
 * computed, serializable `CountryGroup[]` in. This component owns ONLY the
 * search text and expand/collapse UI state — no route fact, status, image
 * or link is touched here. `matchesRouteQuery`/`filterCountryGroups`/
 * `toggleCountryInSet` are exported as plain functions, decoupled from
 * React, specifically so tests can exercise the exact search-matching and
 * accordion-toggle logic without needing a DOM-rendering test harness this
 * repo doesn't otherwise depend on.
 */

export type { CountryGroup, RouteCardData };

// Tailwind's own `sm:` breakpoint — already the point this page's card grid
// (sm:grid-cols-2 lg:grid-cols-3) and every other responsive class treats as
// "no longer a single-column phone layout", so behavioural mobile/desktop
// split reuses the same line rather than inventing a new one.
const DESKTOP_MEDIA_QUERY = '(min-width: 640px)';

/** Case-insensitive, whitespace-trimmed substring match against a route's pre-built searchIndex (country + destination city + origin airport/city + route title). */
export function matchesRouteQuery(route: RouteCardData, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return true;
  return route.searchIndex.includes(normalized);
}

/** Filters every group's routes by the query, dropping any country group left with zero matches — never an empty header shown for a non-matching country. */
export function filterCountryGroups(countryGroups: CountryGroup[], query: string): CountryGroup[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return countryGroups;
  return countryGroups
    .map((g) => ({ country: g.country, routes: g.routes.filter((r) => matchesRouteQuery(r, normalized)) }))
    .filter((g) => g.routes.length > 0);
}

/**
 * Pure accordion-toggle reducer. `isDesktop === false` (mobile) closes every
 * other country the moment one opens — a real single-open accordion.
 * `isDesktop === true` leaves every other country's own state untouched, so
 * multiple groups may stay open side by side.
 */
export function toggleCountryInSet(expanded: Set<string>, country: string, isDesktop: boolean): Set<string> {
  const next = new Set(expanded);
  if (next.has(country)) {
    next.delete(country);
  } else {
    if (!isDesktop) next.clear();
    next.add(country);
  }
  return next;
}

/** While actively searching, every group filterCountryGroups kept must render open — a visitor should never have to manually expand a country that already matches their search. */
export function isCountryVisible(country: string, expanded: Set<string>, isSearching: boolean): boolean {
  return isSearching || expanded.has(country);
}

export function RoutesCatalogue({ countryGroups }: { countryGroups: CountryGroup[] }) {
  const allCountries = useMemo(() => countryGroups.map((g) => g.country), [countryGroups]);

  const [query, setQuery] = useState('');
  // Default: every country expanded — matches server render exactly (no
  // window access in either initializer), so first client paint matches SSR
  // with zero hydration mismatch. The mobile-only "start collapsed" default
  // is applied after mount, below, once matchMedia is available.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(allCountries));
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    // Runs once at mount to set the correct starting point for the current
    // viewport — on mobile this is the one and only place sections get
    // collapsed by default. Later viewport changes (e.g. rotating a tablet)
    // only update isDesktop for future clicks; they deliberately never
    // re-collapse or re-expand sections a visitor has already toggled.
    setIsDesktop(mql.matches);
    if (!mql.matches) setExpanded(new Set());

    const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSearching = query.trim().length > 0;
  const visibleGroups = useMemo(() => filterCountryGroups(countryGroups, query), [countryGroups, query]);

  function toggleCountry(country: string) {
    setExpanded((prev) => toggleCountryInSet(prev, country, isDesktop));
  }

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-content px-5 pb-2 pt-10 sm:px-8 sm:pt-14">
        <SearchField value={query} onChange={setQuery} />
      </div>

      <div aria-live="polite">
        {isSearching && visibleGroups.length === 0 ? (
          <div className="mx-auto max-w-content px-5 py-14 sm:px-8">
            <p className="text-sm text-ink-500">
              No routes match &ldquo;{query.trim()}&rdquo;. Try a different city, country or airport, or clear the search to browse
              every route.
            </p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-3 text-sm font-semibold text-brass-600 underline-offset-4 hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          visibleGroups.map((group, i) => (
            <CountrySection
              key={group.country}
              group={group}
              isOpen={isCountryVisible(group.country, expanded, isSearching)}
              onToggle={() => toggleCountry(group.country)}
              isLast={i === visibleGroups.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputId = useId();
  return (
    <div>
      <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wide text-ink-400">
        Search routes
      </label>
      <div className="relative mt-1.5 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" strokeWidth={2} aria-hidden="true" />
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search destination or route"
          autoComplete="off"
          className="h-11 w-full rounded-sm border border-ink-200 bg-white pl-9 pr-9 text-sm text-ink-900 focus-visible:border-brass"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )}
      </div>
    </div>
  );
}

function CountrySection({
  group,
  isOpen,
  onToggle,
  isLast,
}: {
  group: CountryGroup;
  isOpen: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  const panelId = useId();
  const count = group.routes.length;
  return (
    <section className={`border-ink-100 py-8 sm:py-10 ${isLast ? 'border-0' : 'border-b'}`}>
      <div className="mx-auto max-w-content px-5 sm:px-8">
        {/* WAI-ARIA accordion pattern: the heading wraps the toggle button,
            rather than a heading living inside it — <button>'s content
            model is phrasing content only, which a heading element isn't. */}
        <h2>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-controls={panelId}
            className="flex w-full items-center justify-between gap-3 py-1 text-left font-display text-2xl text-ink-900 transition-colors hover:text-brass-600 sm:text-3xl"
          >
            <span className="flex items-baseline gap-3">
              <span>{group.country}</span>
              <span className="font-sans text-sm font-normal normal-case tracking-normal text-ink-400">
                {count} {count === 1 ? 'route' : 'routes'}
              </span>
            </span>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-ink-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              strokeWidth={2.25}
              aria-hidden="true"
            />
          </button>
        </h2>

        {isOpen && (
          <div id={panelId} className="mt-8 grid animate-fade-up gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {group.routes.map((route) => (
              <RouteCard key={route.slug} route={route} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RouteCard({ route }: { route: RouteCardData }) {
  return (
    <Link
      href={route.href}
      className="group relative flex flex-col overflow-hidden rounded-md border border-ink-100 shadow-card transition-all hover:-translate-y-1 hover:border-brass-200 hover:shadow-card-hover"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-ink-950">
        {route.airportImage ? (
          <Image
            src={route.airportImage.src}
            alt={route.airportImage.alt}
            fill
            sizes="(min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-5xl text-sand-50/20" aria-hidden="true">
            {route.airportCode}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/75 via-ink-950/10 to-transparent" aria-hidden="true" />
        <span className="absolute bottom-3 left-4 text-xs font-semibold uppercase tracking-[0.14em] text-sand-50">{route.airportName}</span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <MapPin className="h-3.5 w-3.5" strokeWidth={2.25} />
            {route.destCountry}
          </span>
          <span
            className={
              route.isDirectStatus
                ? 'inline-flex items-center gap-1.5 rounded-full bg-brass-50 px-2.5 py-0.5 text-xs font-semibold text-brass-700'
                : 'inline-flex items-center rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-semibold text-ink-500'
            }
          >
            {route.isDirectStatus && <Plane className="h-3 w-3" strokeWidth={2.5} />}
            {route.statusLabel}
          </span>
        </div>
        <h3 className="mt-3 font-display text-xl text-ink-900">
          {route.airportCity}{' '}
          <span className="inline-block text-brass-500 transition-transform duration-300 group-hover:translate-x-0.5">→</span> {route.destCity}
        </h3>
        <p className="mt-1.5 text-sm text-ink-500">{route.subLine}</p>
        <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900 transition-colors group-hover:text-terracotta-600">
          View route guide
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.25} />
        </span>
      </div>
    </Link>
  );
}
