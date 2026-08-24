'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown, Search, X } from 'lucide-react';
import { formatChecked } from '@/data/deals';
import { PROVIDER_REL, TRIPCOM_FRESH_SEARCH_NOTE } from '@/lib/booking-providers';
import { TrackedOutboundLink } from '@/components/ui/tracked-outbound-link';
import { AffiliateLinkDisclosure } from '@/components/ui/affiliate-link-disclosure';
import type { TrackedFareAirportGroup, TrackedFareEntry } from '@/lib/tracked-fare-groups';

/**
 * Exhaustive Tracked Fares (PR #140) — search/accordion mechanics
 * deliberately copied from components/routes/routes-catalogue.tsx rather
 * than reinvented: same search-field idiom, same single-open-on-mobile /
 * multi-open-on-desktop accordion behaviour, same "no advanced filters"
 * scope. This component owns ONLY search text and expand/collapse UI
 * state — every fare fact was already resolved server-side in
 * lib/tracked-fare-groups.ts. matchesTrackedFareQuery/filterAirportGroups/
 * toggleAirportInSet are exported as plain functions for the same reason
 * routes-catalogue.tsx's equivalents are: tests exercise the exact
 * search-matching and accordion-toggle logic without a DOM harness.
 */

const DESKTOP_MEDIA_QUERY = '(min-width: 640px)';

export function matchesTrackedFareQuery(entry: TrackedFareEntry, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return true;
  return entry.searchIndex.includes(normalized);
}

export function filterAirportGroups(groups: TrackedFareAirportGroup[], query: string): TrackedFareAirportGroup[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return groups;
  return groups
    .map((g) => ({ ...g, entries: g.entries.filter((e) => matchesTrackedFareQuery(e, normalized)) }))
    .filter((g) => g.entries.length > 0);
}

export function toggleAirportInSet(expanded: Set<string>, airportSlug: string, isDesktop: boolean): Set<string> {
  const next = new Set(expanded);
  if (next.has(airportSlug)) {
    next.delete(airportSlug);
  } else {
    if (!isDesktop) next.clear();
    next.add(airportSlug);
  }
  return next;
}

export function isAirportVisible(airportSlug: string, expanded: Set<string>, isSearching: boolean): boolean {
  return isSearching || expanded.has(airportSlug);
}

export function TrackedFaresExplorer({ airportGroups }: { airportGroups: TrackedFareAirportGroup[] }) {
  const allAirports = useMemo(() => airportGroups.map((g) => g.airportSlug), [airportGroups]);

  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(allAirports));
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    setIsDesktop(mql.matches);
    if (!mql.matches) setExpanded(new Set());

    const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSearching = query.trim().length > 0;
  const visibleGroups = useMemo(() => filterAirportGroups(airportGroups, query), [airportGroups, query]);

  function toggleAirport(airportSlug: string) {
    setExpanded((prev) => toggleAirportInSet(prev, airportSlug, isDesktop));
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
              No tracked fares match &ldquo;{query.trim()}&rdquo;. Try a different city, country or airport, or clear the
              search to browse every current fare.
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
            <AirportSection
              key={group.airportSlug}
              group={group}
              isOpen={isAirportVisible(group.airportSlug, expanded, isSearching)}
              onToggle={() => toggleAirport(group.airportSlug)}
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
        Search tracked fares
      </label>
      <div className="relative mt-1.5 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" strokeWidth={2} aria-hidden="true" />
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search destination or airport"
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

function AirportSection({
  group,
  isOpen,
  onToggle,
  isLast,
}: {
  group: TrackedFareAirportGroup;
  isOpen: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  const panelId = useId();
  const count = group.entries.length;
  return (
    <section className={`border-ink-100 py-8 sm:py-10 ${isLast ? 'border-0' : 'border-b'}`}>
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <h2>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-controls={panelId}
            className="flex w-full items-center justify-between gap-3 py-1 text-left font-display text-2xl text-ink-900 transition-colors hover:text-brass-600 sm:text-3xl"
          >
            <span className="flex min-w-0 items-baseline gap-3">
              <span className="truncate">{group.airportName}</span>
              <span className="shrink-0 font-sans text-sm font-normal normal-case tracking-normal text-ink-400">
                {count} tracked {count === 1 ? 'fare' : 'fares'}
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
            {group.entries.map((entry) => (
              <TrackedFareCard key={entry.routeSlug} airportCity={group.airportCity} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function directnessLabel(entry: TrackedFareEntry): string | null {
  const { observation } = entry;
  if (observation.directness === 'direct') return 'Direct';
  if (observation.directness === 'connecting') {
    const stops = observation.outboundStops !== null && observation.returnStops !== null
      ? `${observation.outboundStops} stop${observation.outboundStops === 1 ? '' : 's'} each way`
      : null;
    return stops ? `Connecting · ${stops}` : 'Connecting';
  }
  return null;
}

function TrackedFareCard({ airportCity, entry }: { airportCity: string; entry: TrackedFareEntry }) {
  const { observation, tripComUrl } = entry;
  const directness = directnessLabel(entry);

  return (
    <article className="flex flex-col rounded-md border border-ink-100 bg-white p-5 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg text-ink-900">
          {airportCity} <span className="text-brass-500">→</span> {entry.destCity}
        </h3>
        <span className="shrink-0 text-xs font-medium text-ink-500">{observation.cabin}</span>
      </div>
      <p className="mt-0.5 text-xs text-ink-400">{entry.destCountry}</p>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-2xl tracking-tight text-ink-900">£{observation.price.toLocaleString('en-GB')}</span>
        <span className="text-xs text-ink-400">return</span>
      </div>
      <p className="mt-1 text-xs text-ink-500">{observation.airline}{directness ? ` · ${directness}` : ''}</p>
      <p className="mt-2 text-xs text-ink-400">
        {formatChecked(observation.departureDate)} – {formatChecked(observation.returnDate)}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-400">
        <span className="h-1.5 w-1.5 rounded-full bg-brass-400" aria-hidden="true" />
        Checked {formatChecked(observation.observedDate)}
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {tripComUrl ? (
          <>
            <TrackedOutboundLink
              event="tripcom_click"
              properties={{ route: entry.routeSlug, source: 'tracked-fares-card' }}
              href={tripComUrl}
              target="_blank"
              rel={PROVIDER_REL}
              className="inline-flex items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-4 py-2.5 text-sm font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985]"
            >
              Compare flights on Trip.com
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </TrackedOutboundLink>
            <AffiliateLinkDisclosure providerName="Trip.com" className="text-ink-400" />
            <p className="text-[11px] leading-snug text-ink-400">{TRIPCOM_FRESH_SEARCH_NOTE}</p>
          </>
        ) : (
          <p className="text-xs text-ink-400">Direct flight comparison is not available for this airport yet.</p>
        )}
        <Link href={entry.routeHref} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-700 hover:text-terracotta-600">
          Route guide <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        </Link>
      </div>
    </article>
  );
}
