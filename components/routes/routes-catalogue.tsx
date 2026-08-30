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

/**
 * Real-user validation, Stage A (30 Aug 2026) — a genuine tester typed
 * "Manchester Mumbai" and got "No routes match", even though both cities
 * individually matched. Root cause: the search was one contiguous substring
 * check against a fixed-order index, so only the literal phrasing baked
 * into that index (or a lucky reversal) could ever match — never the most
 * natural two-city phrasing. See docs/project-control (Stage A report,
 * Issue 2) for the full diagnostic.
 *
 * Connector words a real sentence carries but no route record ever will —
 * stripping these is what lets "flights from Manchester to Mumbai" match on
 * exactly the same two tokens as "Manchester Mumbai", instead of requiring
 * those filler words to somehow appear in the index too.
 */
const SEARCH_FILLER_WORDS = new Set(['flight', 'flights', 'from', 'to']);

/**
 * Lowercases, strips punctuation (keeping letters/digits), collapses
 * whitespace, and drops harmless filler words — leaving only the terms that
 * actually carry meaning ("manchester", "mumbai", "man", "bom", ...).
 * Deliberately no fuzzy/typo matching and no external dependency — see the
 * doc comment above.
 */
export function tokenizeSearchQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !SEARCH_FILLER_WORDS.has(t));
}

/**
 * Real-user validation, Stage A search-precision follow-up (30 Aug 2026):
 * plain substring-per-token matching let "MAN LHE" also list
 * Manchester-Sylhet, because "lhe" (Lahore's real IATA code) is a literal
 * substring of "Sylhet". Fix: a query token that is itself a *real* IATA
 * code somewhere in the current route list is matched EXACTLY against a
 * route's own two codes, never as a text substring — so "lhe" can only ever
 * mean the actual airport/destination coded LHE, regardless of what other
 * city names happen to contain those three letters. A token that ISN'T a
 * recognised code (most searches — "lon", "dha", "mumbai", ...) keeps the
 * original substring behaviour, so incremental typing of a city name is
 * completely unaffected. Recognising a code requires it to be a genuine
 * code drawn from the live route list — never a bare "exactly 3 letters"
 * heuristic, which would misfire on a real 3-letter city-name prefix that
 * doesn't happen to equal that place's own code (e.g. "Dha" for Dhaka,
 * whose actual code is DAC, not DHA).
 */
function buildKnownIataCodes(routes: RouteCardData[]): Set<string> {
  const codes = new Set<string>();
  for (const route of routes) {
    codes.add(route.airportCode.toLowerCase());
    codes.add(route.destIataCode.toLowerCase());
  }
  return codes;
}

/**
 * A route matches when every meaningful token in the query is satisfied
 * (AND across tokens) — never one contiguous phrase. A token recognised as
 * a real IATA code (see buildKnownIataCodes) must exactly equal this
 * route's own origin or destination code; every other token keeps the
 * original substring-against-searchIndex behaviour. This is what lets
 * "Manchester Mumbai", "Mumbai Manchester", "MAN BOM" and "flights from
 * Manchester to Mumbai" all resolve to the same route (different orderings/
 * phrasings of the same two terms), while "MAN LHE" resolves to exactly
 * Manchester-Lahore, never Manchester-Sylhet. A query with no meaningful
 * tokens left after filtering (empty, or filler-words-only) matches every
 * route — the same "no filter yet" behaviour an empty search box always had.
 *
 * `knownIataCodes` is optional so this stays callable with just a single
 * route (existing tests, and any future standalone use) — omitted, it
 * falls back to recognising only that one route's own two codes, which is
 * enough to answer "does this route match" correctly for that route in
 * isolation. The real search box always calls this via filterCountryGroups
 * below, which builds the true, whole-catalogue set of known codes.
 */
export function matchesRouteQuery(route: RouteCardData, query: string, knownIataCodes?: Set<string>): boolean {
  const tokens = tokenizeSearchQuery(query);
  const codes = knownIataCodes ?? buildKnownIataCodes([route]);
  const routeCodes = [route.airportCode.toLowerCase(), route.destIataCode.toLowerCase()];
  return tokens.every((token) => (codes.has(token) ? routeCodes.includes(token) : route.searchIndex.includes(token)));
}

/** Filters every group's routes by the query, dropping any country group left with zero matches — never an empty header shown for a non-matching country. */
export function filterCountryGroups(countryGroups: CountryGroup[], query: string): CountryGroup[] {
  if (tokenizeSearchQuery(query).length === 0) return countryGroups;
  // Built once from the whole catalogue passed in, not per-route — this is
  // what lets a code recognised anywhere in the list (e.g. Lahore's LHE)
  // correctly rule out a route that merely contains those letters as text
  // (Sylhet), even though that other route itself never uses the code.
  const knownIataCodes = buildKnownIataCodes(countryGroups.flatMap((g) => g.routes));
  return countryGroups
    .map((g) => ({
      country: g.country,
      image: g.image,
      routes: g.routes.filter((r) => matchesRouteQuery(r, query, knownIataCodes)),
    }))
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
            <span className="flex min-w-0 items-center gap-3 sm:gap-4">
              {/* Country header images (routes-country-header-images): a
                  compact thumbnail using the same real, hand-written
                  destination alt text every other Signature Collection photo
                  on the site uses (lib/brand-images.ts) — genuinely
                  descriptive of the photo itself (e.g. a named landmark),
                  not a bare repeat of the country name already sitting
                  immediately adjacent as real text, so nothing is announced
                  twice to a screen reader. Never its own clickable element,
                  so the accordion button keeps exactly one interactive
                  target (no nested controls). Fixed size, not the
                  aspect-[16/9] the route cards use below — a compact header
                  thumbnail, never a hero. */}
              {group.image && (
                <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md bg-ink-100 sm:h-12 sm:w-16">
                  <Image src={group.image.src} alt={group.image.alt} fill sizes="64px" className="object-cover" />
                </span>
              )}
              <span className="flex min-w-0 items-baseline gap-3">
                <span className="truncate">{group.country}</span>
                <span className="shrink-0 font-sans text-sm font-normal normal-case tracking-normal text-ink-400">
                  {count} {count === 1 ? 'route' : 'routes'}
                </span>
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
        {/* Route Intelligence Completion (August 2026, phase 2): a quiet
            dot + label, deliberately not a second pill next to the
            direct/connecting badge above — that badge is Route Status
            (is this route direct?), this is the separate, genuinely
            different Route Intelligence fact (how much has JetStash
            researched it?). Matches the Atlas's own compact "destination
            dot" convention rather than inventing a new visual language. */}
        <span className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-400">
          <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${route.intelligence.dotClassName}`} aria-hidden="true" />
          {route.intelligence.label}
        </span>
        <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900 transition-colors group-hover:text-terracotta-600">
          View route guide
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.25} />
        </span>
      </div>
    </Link>
  );
}
