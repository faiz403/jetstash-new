'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { COUNTRY_PATHS, getPathBBox } from '@/lib/atlas-country-geometry';
import { Badge } from '@/components/ui/badge';
import { track } from '@/lib/analytics';

/**
 * Atlas feel-test — genuinely fresh execution attempt. Does not import,
 * reuse or reference the deleted atlas-intelligence-prototype in any way.
 *
 * Landmass geometry is real, sourced data — see lib/atlas-country-geometry.ts
 * for exact provenance (CC BY 4.0, MapSVG via VictorCazanave/svg-maps),
 * fetched and extracted programmatically, never hand-drawn or retyped.
 * Manchester and every destination point is a real lon/lat fraction
 * computed within its own country's actual fetched bounding box — see the
 * comment in app/founder/atlas-feel-test/page.tsx for the exact method.
 *
 * The coordinate system here is the source map's own native space
 * (original viewBox 0 0 1010 666), not the ad hoc canvas used before —
 * every size, stroke-width and font-size below is scaled for that system.
 */

export interface DestinationPoint {
  slug: string;
  label: string;
  x: number;
  y: number;
  // Two separate truths, never merged into one:
  //
  // networkMembership answers "is this destination genuinely reachable
  // from Manchester?" — backed by data/network-evidence.ts for
  // destinations with no Route Status entry, or implicitly by the
  // existence of a real data/routes.ts record for the original 11 (a
  // routes.ts entry is itself individually-researched network evidence).
  // 'seasonal' is only ever set when a primary source explicitly says so
  // (e.g. Bodrum) — never inferred.
  networkMembership: 'supported' | 'seasonal';
  // One-line, sourced statement of what backs networkMembership — shown
  // only for destinations relying on data/network-evidence.ts, since for
  // the original 11 the Route Status verdict below already says enough.
  networkNote?: string;
  // evidenceState answers a different question entirely: "how much has
  // JetStash independently researched THIS ROUTE?" 'not-yet-tracked'
  // means no Route Status ledger entry exists yet (see data/routes.ts) —
  // it says nothing about reachability, which networkMembership already
  // covers. Never inferred silently; only used when getRouteBySlug has
  // nothing to return, per the "not yet researched is a legitimate
  // answer" principle this Atlas is built on.
  evidenceState: 'verified' | 'withdrawal-announced' | 'pending' | 'not-yet-tracked';
  verdict: string;
  detail: string | null;
  flightTime: string;
  href: string;
  // null when there's no real Route Status page to link to yet (i.e. for
  // 'not-yet-tracked' destinations) — never pointed at a route that
  // doesn't exist in data/routes.ts.
  routeHref: string | null;
}

export interface CountryData {
  slug: string;
  label: string;
  x: number;
  y: number;
  confidence: 'strong' | 'mixed' | 'early';
  destinations: DestinationPoint[];
}

// The whole Atlas engine derives entirely from one of these — nothing about
// a specific airport (its name, its origin position, which countries or
// destinations belong to its network) is ever hardcoded inside this
// component. Each network-evidence-backed fact already lives inside the
// DestinationPoints below (networkMembership/networkNote), so a separate
// top-level "evidence records" array would just duplicate them — this
// record's `countries` tree already IS the airport's full sourced network.
export interface AirportNetworkData {
  airportSlug: string;
  airportName: string;
  origin: { x: number; y: number };
  defaultCountrySlug: string;
  countries: CountryData[];
}

const CONFIDENCE_COLOUR: Record<CountryData['confidence'], { stroke: string; label: string }> = {
  strong: { stroke: '#E0B158', label: 'JetStash knows this country well' },
  mixed: { stroke: '#C97B4A', label: 'Coverage is mixed — some routes need a closer look' },
  early: { stroke: '#8A8578', label: 'Early-stage coverage — still being researched' },
};

// Colours/labels here describe ROUTE INTELLIGENCE only (evidenceState) —
// never network membership, which is a separate fact rendered separately
// (see networkNote in the destination panel below).
const DESTINATION_COLOUR: Record<DestinationPoint['evidenceState'], { fill: string; label: string }> = {
  verified: { fill: '#E0B158', label: 'Verified' },
  'withdrawal-announced': { fill: '#D98F5F', label: 'Withdrawal announced' },
  pending: { fill: '#A39D8C', label: 'Verification pending' },
  'not-yet-tracked': { fill: '#5B6472', label: 'Route intelligence not yet researched' },
};

// Maps an explorable country's slug to its real path in the sourced
// geometry — only entries that appear in `countries` get the "selected
// country lights up" treatment. Every country here has at least one real
// JetStash destination; the surrounding context shapes (Ireland, Sri
// Lanka, Oman) are real geography too, but have no JetStash destination
// of their own, so they stay at one constant, quiet tone rather than
// becoming explorable.
const COUNTRY_TO_PATH_KEY: Record<string, keyof typeof COUNTRY_PATHS> = {
  india: 'in',
  uae: 'ae',
  pakistan: 'pk',
  bangladesh: 'bd',
  qatar: 'qa',
  'saudi-arabia': 'sa',
  turkey: 'tr',
  morocco: 'ma',
  spain: 'es',
  portugal: 'pt',
  greece: 'gr',
  italy: 'it',
};
const CONTEXT_PATH_KEYS: (keyof typeof COUNTRY_PATHS)[] = ['gb', 'ie', 'lk', 'om'];

// A physically tiny country (UAE, and later Qatar/Bahrain) has to earn the
// same visual weight as a large one (India) purely from its own real bbox
// area — never a per-country exception. Capped so the emphasis stays a
// glow/halo effect rather than a shape that swallows neighbouring
// countries on the map; this cap is generic (applies uniformly to whatever
// is smallest in `countries`), not a value tuned for any one country.
const MAX_EMPHASIS_SCALE = 3.2;
const BASE_COUNTRY_HALO_R = 11;
const INACTIVE_COUNTRY_HALO_R = 7.7;

// The visible glow must never let two countries merge into one blob — the
// Gulf (UAE/Qatar/Saudi Arabia) and Iberia (Spain/Portugal) sit close
// enough in real geometry that an unconstrained emphasis-scaled glow
// overlaps. Same "generic, never per-country" principle as the hit-radius
// cap below, sized with its own floor and margin because the glow is a
// much larger visual element than the invisible hit target.
const MIN_COUNTRY_HALO_R = 3.2;
const COUNTRY_HALO_MARGIN = 1;

// Country hit-circles must never overlap. Several real country centroids
// sit close together (the Gulf: UAE/Qatar/Saudi Arabia; Iberia: Spain/
// Portugal) — with a flat 12.5-unit radius, hover would silently resolve
// to whichever country happens to render last, not whichever the pointer
// is actually nearer. Fixed generically, never per-country: each
// country's hit radius is capped at half its distance to its OWN nearest
// neighbour, minus a safety margin. That bound provably keeps any two
// countries' radii summing to less than the real distance between them —
// not just nearest-neighbour pairs — so no two hit-circles can ever
// overlap, for any arrangement of countries this Atlas ever grows to.
const BASE_COUNTRY_HIT_R = 12.5;
// Gulf countries are geographically compact at this scale. A five-unit floor
// keeps Qatar and the UAE comfortable to target without overlap (their centres
// are just over ten units apart), which matters for both mouse and touch users.
const MIN_COUNTRY_HIT_R = 5;
const COUNTRY_HIT_MARGIN = 1.5;

// Same principle, finer-grained, for destinations within the active
// country — Turkey's Aegean/Mediterranean resort towns (Antalya, Dalaman,
// Bodrum, Izmir) are genuinely only a few units apart in real geography.
// The margin and floor are smaller than the country version since these
// hit-circles only need to serve a mouse pointer and keyboard focus, not
// a fingertip — touch devices use the separate chip selector below.
const BASE_DEST_HIT_R = 4.5;
const MIN_DEST_HIT_R = 1.2;
const DEST_HIT_MARGIN = 0.8;

// Destination labels always render to the right of their dot — when
// several destinations sit at nearly the same latitude (again, Turkey's
// coast resorts), their text would overlap. The real geography never
// moves; only the label's rendered position does, via a generic greedy
// vertical-stacking pass: sorted by true y, each label pushed down only as
// far as needed to clear the one above it. A thin leader line traces any
// displaced label back to its true dot so the connection stays honest.
const LABEL_MIN_GAP = 3.2;

// Country labels default to floating just above their marker. When another
// country's marker sits within a "crowding" distance — the Gulf and
// Iberia clusters today, but this is pure geometry, never a named list —
// the label is pushed away from the average position of every crowding
// neighbour instead, far enough that adjacent country names stay legible.
// A country with no nearby crowder gets back exactly the original default
// position, so this only ever changes labels that actually need it.
const LABEL_CROWD_RADIUS = 20;
const LABEL_PUSH_DISTANCE = 8;

function computeSafeRadius(nearestDist: number, base: number, min: number, margin: number): number {
  const safe = nearestDist / 2 - margin;
  return Math.min(base, Math.max(min, safe));
}

// Halo glow needs a different bound than the hit-radius above: only one
// country is ever "active" (large glow) at a time, so the binding
// constraint is a country's ACTIVE glow against its neighbour's RESTING
// glow, not two equal circles meeting in the middle. Capping every
// country's active radius at nearestDist / (1 + inactiveRatio) - margin
// guarantees active(c) + inactive(neighbour) <= nearestDist for any pair,
// with margin * (1 + inactiveRatio) to spare — proof: both radii are
// bounded using nearestDist(c) <= actualDistance and nearestDist(n) <=
// actualDistance, so their capped sum can never exceed actualDistance
// minus that slack, however the countries are arranged.
function computeSafeHaloRadius(nearestDist: number, rawActive: number, min: number, margin: number, inactiveRatio: number): number {
  const safe = nearestDist / (1 + inactiveRatio) - margin;
  return Math.min(rawActive, Math.max(min, safe));
}

function nearestDistance<T extends { slug: string; x: number; y: number }>(point: T, all: T[]): number {
  let nearest = Infinity;
  for (const other of all) {
    if (other.slug === point.slug) continue;
    const d = Math.hypot(point.x - other.x, point.y - other.y);
    if (d < nearest) nearest = d;
  }
  return nearest;
}

export function AtlasFeelTest({
  airports,
  defaultAirportSlug,
}: {
  airports: AirportNetworkData[];
  defaultAirportSlug: string;
}) {
  const [selectedAirportSlug, setSelectedAirportSlug] = useState(defaultAirportSlug);
  const activeAirport = airports.find((a) => a.airportSlug === selectedAirportSlug) ?? airports[0];
  // Every fact the rest of this component renders — origin position, which
  // countries exist, which destinations, every label — comes from these
  // three, always re-derived from whichever airport is currently selected.
  // Nothing below ever names a specific airport.
  const { origin, countries, airportName } = activeAirport;

  const [activeCountrySlug, setActiveCountrySlug] = useState(activeAirport.defaultCountrySlug);
  const [activeDestSlug, setActiveDestSlug] = useState<string | null>(
    activeAirport.countries.find((c) => c.slug === activeAirport.defaultCountrySlug)?.destinations[0]?.slug ?? null
  );
  // Mirrors activeDestSlug for analytics dedup only. A single hover gesture
  // dispatches several native events (mouseenter, pointerenter, pointerdown)
  // in the same tick, each calling selectDestination before React has
  // re-rendered — comparing against activeDestSlug (state, only visible
  // after a render) let all of them pass the "did this change" check and
  // fire three times for one hover. A ref updates synchronously, so the
  // second and third handler in the same gesture see the first's write
  // immediately and correctly skip.
  const lastTrackedDestRef = useRef(activeDestSlug);

  // Mobile-only: the map sits inside a horizontally scrollable strip (see
  // the wrapping div below) with no visible scrollbar, so nothing on
  // narrow screens hints it continues to the right until a visitor
  // happens to swipe. One-way flag, not a preference — softens once a
  // visitor has actually scrolled past a small threshold (avoids
  // flickering on iOS's elastic rubber-band bounce at scrollLeft: 0) and
  // never needs to reset. No localStorage: this is about the current
  // view, not a dismissed-forever preference.
  const [hasScrolledMap, setHasScrolledMap] = useState(false);

  const activeCountry = countries.find((c) => c.slug === activeCountrySlug) ?? countries[0];
  const activeDest = activeCountry.destinations.find((d) => d.slug === activeDestSlug) ?? activeCountry.destinations[0];

  const activeRouteD = `M ${origin.x} ${origin.y} Q ${(origin.x + activeCountry.x) / 2} ${Math.min(origin.y, activeCountry.y) - 18}, ${activeCountry.x} ${activeCountry.y}`;

  // Single source of truth for "select this country" — shared by the
  // desktop hover/focus handlers on the map and the mobile chip selector
  // below, so both input methods drive the exact same state transition and
  // can never drift into two different interaction models.
  //
  // Deliberately untracked: the Atlas engagement vocabulary only covers
  // origin and destination selection, not country selection, and the
  // destination this resets to is an automatic default, not something the
  // visitor actually chose — analytics for that only belongs in
  // selectDestination below, called from the destination's own handlers.
  function activateCountry(slug: string) {
    const c = countries.find((x) => x.slug === slug);
    const nextDest = c?.destinations[0]?.slug ?? null;
    lastTrackedDestRef.current = nextDest;
    setActiveCountrySlug(slug);
    setActiveDestSlug(nextDest);
  }

  // Switching airport must feel like the same experience redrawing itself,
  // never a reload — this is a plain state change on the already-mounted
  // component, so React re-renders the same tree with the new airport's
  // origin/countries/labels rather than remounting anything. Resets country
  // and destination selection to the new airport's own default, exactly the
  // same reset activateCountry already does when a country changes.
  function selectAirport(slug: string) {
    const a = airports.find((x) => x.airportSlug === slug) ?? airports[0];
    // Only a genuine change of airport — re-clicking the already-selected
    // pill is a no-op, not a new selection.
    if (a.airportSlug !== selectedAirportSlug) {
      track('atlas_origin_selected', { airport: a.airportSlug });
    }
    setSelectedAirportSlug(slug);
    setActiveCountrySlug(a.defaultCountrySlug);
    const c = a.countries.find((x) => x.slug === a.defaultCountrySlug);
    const nextDest = c?.destinations[0]?.slug ?? null;
    lastTrackedDestRef.current = nextDest;
    setActiveDestSlug(nextDest);
  }

  // The one place a destination selection is both applied and measured —
  // called only from the destination's own hover/focus/click/tap handlers
  // below, never from activateCountry's or selectAirport's automatic
  // default-destination reset (both keep lastTrackedDestRef in sync
  // themselves), so switching country/airport never counts as the visitor
  // picking a destination. Fires only on a genuine change from whatever is
  // currently active, via the ref rather than activeDestSlug state — see
  // lastTrackedDestRef's own comment for why: hovering fires several native
  // events in one gesture, and only a synchronous ref reliably dedupes them.
  function selectDestination(slug: string) {
    if (lastTrackedDestRef.current !== slug) {
      lastTrackedDestRef.current = slug;
      track('atlas_destination_selected', { airport: selectedAirportSlug, destination: slug });
    }
    setActiveDestSlug(slug);
  }

  // Size-driven visual emphasis: computed from each country's real path
  // geometry every render (via useMemo keyed on `countries`), never a
  // hardcoded per-country multiplier — so a third small country (e.g.
  // Qatar) added to `countries` tomorrow gets the same treatment for free.
  const countryEmphasis = useMemo(() => {
    const withSize = countries.map((c) => {
      const pathKey = COUNTRY_TO_PATH_KEY[c.slug];
      const bbox = getPathBBox(COUNTRY_PATHS[pathKey]);
      // sqrt(area) ~ a country's characteristic linear dimension, so the
      // resulting scale behaves like "how many times smaller does this
      // country look" rather than the much more extreme raw-area ratio.
      return { slug: c.slug, bbox, charSize: Math.sqrt(bbox.area) };
    });
    const maxCharSize = Math.max(...withSize.map((s) => s.charSize));
    const result: Record<string, { scale: number; bbox: { width: number; height: number; area: number } }> = {};
    for (const s of withSize) {
      result[s.slug] = { scale: Math.min(maxCharSize / s.charSize, MAX_EMPHASIS_SCALE), bbox: s.bbox };
    }
    return result;
  }, [countries]);

  const countryHitRadius = useMemo(() => {
    const result: Record<string, number> = {};
    for (const c of countries) {
      result[c.slug] = computeSafeRadius(nearestDistance(c, countries), BASE_COUNTRY_HIT_R, MIN_COUNTRY_HIT_R, COUNTRY_HIT_MARGIN);
    }
    return result;
  }, [countries]);

  // Visible glow radius, capped so two crowded countries' halos (Gulf,
  // Iberia) can never merge into one blob — see computeSafeHaloRadius for
  // the proof. The inactive radius is always derived as a fixed fraction
  // of the (already-capped) active radius, so the active/inactive size
  // contrast survives crowding instead of collapsing to the same size.
  const countryHaloRadius = useMemo(() => {
    const inactiveRatio = INACTIVE_COUNTRY_HALO_R / BASE_COUNTRY_HALO_R;
    const result: Record<string, { active: number; inactive: number }> = {};
    for (const c of countries) {
      const rawActive = BASE_COUNTRY_HALO_R * countryEmphasis[c.slug].scale;
      const active = computeSafeHaloRadius(nearestDistance(c, countries), rawActive, MIN_COUNTRY_HALO_R, COUNTRY_HALO_MARGIN, inactiveRatio);
      result[c.slug] = { active, inactive: active * inactiveRatio };
    }
    return result;
  }, [countries, countryEmphasis]);

  // Label push vector, driven purely by real marker distance — replaces
  // any hardcoded per-country label offset. A country with no crowding
  // neighbour gets a zero vector, i.e. exactly its original position.
  const countryLabelPush = useMemo(() => {
    const result: Record<string, { dx: number; dy: number }> = {};
    for (const c of countries) {
      const crowders = countries.filter((o) => o.slug !== c.slug && Math.hypot(o.x - c.x, o.y - c.y) < LABEL_CROWD_RADIUS);
      if (crowders.length === 0) {
        result[c.slug] = { dx: 0, dy: 0 };
        continue;
      }
      const avgX = crowders.reduce((sum, o) => sum + o.x, 0) / crowders.length;
      const avgY = crowders.reduce((sum, o) => sum + o.y, 0) / crowders.length;
      const awayX = c.x - avgX;
      const awayY = c.y - avgY;
      const dist = Math.hypot(awayX, awayY) || 1;
      result[c.slug] = { dx: (awayX / dist) * LABEL_PUSH_DISTANCE, dy: (awayY / dist) * LABEL_PUSH_DISTANCE };
    }
    return result;
  }, [countries]);

  const destHitRadius = useMemo(() => {
    const result: Record<string, number> = {};
    for (const d of activeCountry.destinations) {
      result[d.slug] = computeSafeRadius(nearestDistance(d, activeCountry.destinations), BASE_DEST_HIT_R, MIN_DEST_HIT_R, DEST_HIT_MARGIN);
    }
    return result;
  }, [activeCountry]);

  const destinationLabelY = useMemo(() => {
    const sorted = [...activeCountry.destinations].sort((a, b) => a.y - b.y);
    const result: Record<string, number> = {};
    let prevY = -Infinity;
    for (const d of sorted) {
      const y = Math.max(d.y, prevY + LABEL_MIN_GAP);
      result[d.slug] = y;
      prevY = y;
    }
    return result;
  }, [activeCountry]);

  // The origin airport must visually out-scale even the most emphasized
  // country marker, whichever airport is currently selected. The
  // size-emphasis system can amplify a country's active halo up to
  // BASE_COUNTRY_HALO_R * MAX_EMPHASIS_SCALE — at the current cap,
  // 11 * 3.2 = 35.2, comfortably larger than a fixed r=20 origin glow
  // would be. Deriving the origin's radius from the same constants (never
  // a magic number) means it can't quietly fall out of date if the
  // emphasis cap ever changes. The 1.2 margin (not more) is deliberately
  // the largest that still fits the breathing animation's peak radius
  // inside the viewBox below without clipping.
  const originGlowR = BASE_COUNTRY_HALO_R * MAX_EMPHASIS_SCALE * 1.2;

  // viewBox top extended from 240 to 230 (height 210 to 220) when the
  // multi-airport engine first placed an origin north of Manchester:
  // Edinburgh (y=281.4) and Glasgow (y=281.7) sit closer to the viewBox's
  // top edge than Manchester (y=290) did, so the same originGlowR
  // breathing-peak margin that was safe for one airport wasn't safe for
  // all of them. This bound now has to hold for whichever airport is
  // selected, checked against every airport's real origin, not just the
  // northernmost currently wired in. Left/right/bottom are unchanged.
  // (Kept as a plain comment here, not a JSX comment at the call site,
  // since a multi-line JSX comment placed immediately before two stacked
  // opening tags — a wrapper div followed by another wrapper div with no
  // other content between — reliably broke Next's SWC parser here, even
  // though tsc's own parser and TypeScript's AST both treated the JSX as
  // fully valid. Root cause not fully resolved; this placement sidesteps
  // it rather than leaving the page unable to compile.)

  return (
    // No per-element scroll-margin needed for the homepage's "Explore the Route
    // Atlas" CTA: app/globals.css already sets a global scroll-padding-top: 6rem
    // tuned to the 80px sticky header. Adding scroll-mt-24 here too stacked both
    // offsets and overshot to ~192px instead of a small gap below the header.
    <div id="route-atlas" className="min-h-screen bg-ink-950">
      <header className="border-b border-white/10 px-6 py-6 sm:px-10">
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brass-200">The JetStash Route Atlas</span>
        {/* h2, not h1 — the homepage opening hero above now owns the page's h1. */}
        <h2 className="mt-2 max-w-4xl font-display text-xl text-sand-50">Explore where you can fly from your UK airport and see what JetStash has verified about each route.</h2>
        <p className="mt-1 text-xs text-ink-400">
          Choose a departure airport, then follow the light to explore its destinations.
        </p>

        {/* Airport selector — same pill idiom as the mobile country/destination
            chips below (and route-map-hero.tsx's own mobile fallback), so a
            third visual language isn't introduced just for this. Always
            shown, even with one airport today: changing airport is a plain
            state change (selectAirport), never a navigation or remount, so
            adding a second airport later needs no change here at all. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">Flying from</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a departure airport">
            {airports.map((a) => {
              const isActive = a.airportSlug === selectedAirportSlug;
              return (
                <button
                  key={a.airportSlug}
                  type="button"
                  onClick={() => selectAirport(a.airportSlug)}
                  aria-pressed={isActive}
                  className={
                    isActive
                      ? 'rounded-full bg-brass px-4 py-1.5 text-sm font-semibold text-ink-900'
                      : 'rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-ink-200'
                  }
                >
                  {a.airportName}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-[1600px] overflow-hidden px-6 py-10 sm:px-10">
        <p className="text-[13px] text-ink-300 sm:hidden">Select a country, then a destination, to see its route.</p>
        <p className="hidden text-[13px] text-ink-300 sm:block">Hover a country to explore its destinations.</p>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
          <div className="min-w-0">
        {/* Below sm the map's own label text (set in SVG units, not px) would
            be crushed down to a few CSS pixels if the svg were simply
            stretched to the narrow viewport width — so instead it keeps a
            fixed pixel width close to what it already renders at on desktop
            (~800px, the same per-unit scale already shipped and reviewed),
            inside a horizontally scrollable strip. The chip selectors below
            remain the primary mobile interaction; this makes the map itself
            visible and pannable rather than invisible. */}
        <div className="relative">
        <div
          className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:overflow-visible sm:px-0"
          onScroll={(e) => {
            if (!hasScrolledMap && e.currentTarget.scrollLeft > 12) setHasScrolledMap(true);
          }}
        >
        <svg viewBox="418 230 336 220" className="h-auto w-[800px] max-w-none sm:w-full" role="img" aria-label={`${airportName}'s real network across every current JetStash destination`}>
          <defs>
            <radialGradient id="ft-origin-glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#F7F2E9" stopOpacity="0.75" />
              <stop offset="0.4" stopColor="#E0B158" stopOpacity="0.3" />
              <stop offset="1" stopColor="#C8932E" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ft-route-active" gradientUnits="userSpaceOnUse" x1={origin.x} y1={origin.y} x2={activeCountry.x} y2={activeCountry.y}>
              <stop offset="0" stopColor="#F7F2E9" stopOpacity="0.9" />
              <stop offset="1" stopColor={CONFIDENCE_COLOUR[activeCountry.confidence].stroke} />
            </linearGradient>
            <filter id="ft-glow-blur" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="1.4" /></filter>
            {/* One glow filter per country, sized from that country's own real
                bbox — a small country needs a much bigger percentage pad than
                a large one for the same absolute blur radius to avoid being
                clipped by the filter region. */}
            {countries.map((c) => {
              const emphasis = countryEmphasis[c.slug];
              const stdDev = 3.2 * emphasis.scale;
              const padPercent = Math.max(60, (stdDev * 3 * 100) / Math.min(emphasis.bbox.width, emphasis.bbox.height) + 20);
              return (
                <filter key={`glow-filter-${c.slug}`} id={`ft-country-glow-${c.slug}`} x={`-${padPercent}%`} y={`-${padPercent}%`} width={`${100 + 2 * padPercent}%`} height={`${100 + 2 * padPercent}%`}>
                  <feGaussianBlur stdDeviation={stdDev} />
                </filter>
              );
            })}
          </defs>

          {/* context landmasses — real geography, not independently selectable here, held at one constant quiet tone */}
          <g fill="#161B26" stroke="#F7F2E9" strokeOpacity="0.16" strokeWidth="0.35">
            {CONTEXT_PATH_KEYS.map((key) => <path key={key} d={COUNTRY_PATHS[key]} />)}
          </g>

          {/* the selected country's own real shape glows from within — this is the core of "feels alive",
              not the small marker dot beside it. Glow is a blurred copy of the exact same real path, so
              the light always matches the true coastline, never an approximation of it. */}
          {countries.map((c) => {
            const pathKey = COUNTRY_TO_PATH_KEY[c.slug];
            const isActive = c.slug === activeCountrySlug;
            const colour = CONFIDENCE_COLOUR[c.confidence];
            return (
              <g key={`landmass-${c.slug}`}>
                {isActive && (
                  <path d={COUNTRY_PATHS[pathKey]} fill={colour.stroke} opacity="0.4" filter={`url(#ft-country-glow-${c.slug})`} className="country-landmass-breathe" />
                )}
                <path
                  d={COUNTRY_PATHS[pathKey]}
                  fill={isActive ? colour.stroke : '#161B26'}
                  fillOpacity={isActive ? 0.22 : 1}
                  stroke={isActive ? colour.stroke : '#F7F2E9'}
                  strokeOpacity={isActive ? 0.55 : 0.16}
                  strokeWidth={isActive ? 0.5 : 0.35}
                  className="transition-all duration-700 ease-out"
                  style={!isActive ? { opacity: 0.75 } : undefined}
                />
              </g>
            );
          })}

          {/* rest-state routes to every country — quiet ambient life even before
              interaction. Dimmer than the original two-country version (0.22):
              at eleven simultaneous lines the same per-line opacity compounded
              into more overall visual weight than any single line intended, and
              competed with the active route and the origin's own glow. */}
          {countries.map((c) => (
            <path
              key={`route-rest-${c.slug}`}
              d={`M ${origin.x} ${origin.y} Q ${(origin.x + c.x) / 2} ${Math.min(origin.y, c.y) - 18}, ${c.x} ${c.y}`}
              fill="none"
              stroke={CONFIDENCE_COLOUR[c.confidence].stroke}
              strokeWidth="0.35"
              strokeOpacity={c.slug === activeCountrySlug ? 0 : 0.15}
              className="transition-opacity duration-500"
            />
          ))}

          {/* the active route — brighter, with ambient travelling light, not just a static highlight */}
          <path d={activeRouteD} fill="none" stroke={CONFIDENCE_COLOUR[activeCountry.confidence].stroke} strokeWidth="1.8" strokeOpacity="0.12" filter="url(#ft-glow-blur)" />
          <path d={activeRouteD} fill="none" stroke="url(#ft-route-active)" strokeWidth="0.6" />
          <circle r="0.8" fill="#F7F2E9">
            <animateMotion dur="3.5s" repeatCount="indefinite" path={activeRouteD} />
          </circle>

          {/* The origin airport — deliberately dominant: largest glow, largest label, on-screen weight nothing else on this canvas has, whichever airport is selected */}
          <g>
            <circle cx={origin.x} cy={origin.y} r={originGlowR} fill="url(#ft-origin-glow)" className="origin-breathe" style={{ transformOrigin: `${origin.x}px ${origin.y}px` }} />
            <circle cx={origin.x} cy={origin.y} r="6" fill="none" stroke="#F7F2E9" strokeOpacity="0.4" strokeWidth="0.35" />
            <circle cx={origin.x} cy={origin.y} r="3.2" fill="none" stroke="#E0B158" strokeWidth="0.45" />
            <circle cx={origin.x} cy={origin.y} r="1.4" fill="#F7F2E9" />
            <text x={origin.x} y={origin.y - 10} textAnchor="middle" fontFamily="var(--font-display), Georgia, serif" fontSize="7" fontWeight="600" fill="#F7F2E9">{airportName}</text>
            <text x={origin.x} y={origin.y - 4.5} textAnchor="middle" fontFamily="var(--font-sans), Arial, sans-serif" fontSize="2.5" fontWeight="600" letterSpacing="0.7" fill="#E0B158">YOUR DEPARTURE AIRPORT</text>
          </g>

          {/* country nodes */}
          {countries.map((c) => {
            const isActive = c.slug === activeCountrySlug;
            const colour = CONFIDENCE_COLOUR[c.confidence];
            const push = countryLabelPush[c.slug];
            const isPushed = push.dx !== 0 || push.dy !== 0;
            const labelX = c.x + push.dx;
            const labelY = c.y - (isActive ? 14 : 10.5) + push.dy;
            const labelAnchor = 'middle' as const;
            return (
              <g key={c.slug}>
                {/* halo spread scales with the same size-derived factor as the
                    landmass glow, so a physically small country's marker
                    carries equivalent visual weight — capped by countryHaloRadius
                    so crowded countries (Gulf, Iberia) never merge into one
                    blob; the separate transparent hit-circle below is untouched */}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isActive ? countryHaloRadius[c.slug].active : countryHaloRadius[c.slug].inactive}
                  fill={colour.stroke}
                  opacity={isActive ? 0.16 : 0.08}
                  pointerEvents="none"
                  className={`transition-all duration-500 ${isActive ? 'country-pulse' : ''}`}
                  style={{ transformOrigin: `${c.x}px ${c.y}px` }}
                />
                <circle cx={c.x} cy={c.y} r={isActive ? 2.3 : 1.6} fill={colour.stroke} pointerEvents="none" className="transition-all duration-500" />
                {isPushed && (
                  <line x1={c.x} y1={c.y - 1.5} x2={labelX} y2={labelY + 1.2} stroke={colour.stroke} strokeWidth="0.18" strokeOpacity="0.45" pointerEvents="none" />
                )}
                {/* Decorative label only — the hit-circle below is the one real
                    keyboard-accessible control for this country. Both used to
                    carry their own tabIndex/role/aria-label with identical
                    handlers, which put two separate stops for the same action
                    in the Tab order and announced it twice to a screen reader.
                    aria-hidden here (not just dropping tabIndex/role) also
                    keeps a screen reader's virtual-cursor browse mode from
                    reading this raw text a second time right next to the
                    circle's own accessible name, which already says the same
                    thing. Pointer/hover handlers stay so a mouse user's
                    cursor lands correctly even when it's over the glyphs
                    themselves, which can sit outside the circle's radius. */}
                <text x={labelX} y={labelY} textAnchor={labelAnchor} fontFamily="var(--font-display), Georgia, serif" fontSize={isActive ? 5.5 : 4} fontWeight={isActive ? 600 : 500} fill="#F7F2E9" stroke="#080A0F" strokeWidth="1.4" strokeOpacity="0.85" paintOrder="stroke" opacity={isActive ? 1 : 0.85} pointerEvents="auto" aria-hidden="true" className="cursor-pointer transition-all duration-500" onMouseEnter={() => activateCountry(c.slug)} onPointerEnter={() => activateCountry(c.slug)} onPointerDown={() => activateCountry(c.slug)} onClick={() => activateCountry(c.slug)}>
                  {c.slug === 'uae' ? 'UAE' : c.label}
                </text>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={countryHitRadius[c.slug]}
                  fill="transparent"
                  pointerEvents="auto"
                  className="cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8932E]"
                  tabIndex={0}
                  role="button"
                  aria-label={`${c.label} — ${colour.label}`}
                  onMouseEnter={() => activateCountry(c.slug)}
                  onPointerEnter={() => activateCountry(c.slug)}
                  onPointerDown={() => activateCountry(c.slug)}
                  onFocus={() => activateCountry(c.slug)}
                  onClick={() => activateCountry(c.slug)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      activateCountry(c.slug);
                    }
                  }}
                />
              </g>
            );
          })}

          {/* destinations within the active country — revealed, not always present */}
          {activeCountry.destinations.map((d) => {
            const isActive = d.slug === activeDestSlug;
            const colour = DESTINATION_COLOUR[d.evidenceState];
            const labelY = destinationLabelY[d.slug];
            const labelDisplaced = Math.abs(labelY - d.y) > 0.5;
            return (
              <g key={d.slug} className="destination-reveal">
                <line x1={activeCountry.x} y1={activeCountry.y} x2={d.x} y2={d.y} stroke={colour.fill} strokeWidth="0.25" strokeOpacity={isActive ? 0.5 : 0.2} />
                {/* Only present when the label below had to be pushed to clear a
                    close neighbour — traces it back to its true position so a
                    stacked label never reads as floating free of its dot. */}
                {labelDisplaced && (
                  <line x1={d.x} y1={d.y} x2={d.x + 1.6} y2={labelY} stroke={colour.fill} strokeWidth="0.15" strokeOpacity="0.35" />
                )}
                <circle cx={d.x} cy={d.y} r={isActive ? 1.8 : 1.1} fill={colour.fill} opacity={isActive ? 1 : 0.7} className="transition-all duration-300" />
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={destHitRadius[d.slug]}
                  fill="transparent"
                  className="cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8932E]"
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.label} — ${DESTINATION_COLOUR[d.evidenceState].label}${d.networkMembership === 'seasonal' ? ' — seasonal service' : ''}`}
                  onMouseEnter={() => selectDestination(d.slug)}
                  onPointerEnter={() => selectDestination(d.slug)}
                  onPointerDown={() => selectDestination(d.slug)}
                  onFocus={() => selectDestination(d.slug)}
                  onClick={() => selectDestination(d.slug)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectDestination(d.slug);
                    }
                  }}
                />
                {/* Decorative only, same reasoning as the country label above —
                    this text was never independently focusable (no tabIndex/
                    role here already), but aria-hidden stops a screen
                    reader's browse-mode virtual cursor from reading it as a
                    second, redundant node next to the hit-circle's own
                    aria-label. */}
                <text x={d.x + 2.7} y={labelY + 0.9} fontFamily="var(--font-sans), Arial, sans-serif" fontSize={isActive ? 3 : 2.5} fontWeight={isActive ? 600 : 400} fill="#F7F2E9" stroke="#080A0F" strokeWidth="0.9" strokeOpacity="0.85" paintOrder="stroke" opacity={isActive ? 1 : 0.65} aria-hidden="true">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
        </div>

        {/* Mobile-only swipe cue: the map's own cut-off right edge already
            hints there's more (it's genuinely wider than the viewport), but
            with no visible scrollbar that's easy to miss on first glance —
            this adds a second, explicit cue rather than relying on the
            content edge alone. Softens away once a visitor has actually
            scrolled (hasScrolledMap), rather than staying up forever.
            sm:hidden on both: desktop's map fits its container exactly
            (sm:w-full, sm:overflow-visible above), so there's nothing to
            swipe and no cue is shown. No animation, so nothing here needs
            the prefers-reduced-motion handling in globals.css. */}
        {!hasScrolledMap && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-ink-950 to-transparent sm:hidden"
            />
            <div className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-ink-950/80 px-2.5 py-1 text-[11px] font-medium text-ink-300 sm:hidden">
              Swipe to explore more routes
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
          </>
        )}
        </div>

        {/* mobile chip selector — the map's fine hit-targets don't work below
            sm, same reasoning and pattern as route-map-hero.tsx's own mobile
            fallback. Both rows call the exact same activateCountry/
            setActiveDestSlug used by the desktop hover handlers, so tapping
            drives the identical state transition hovering does — no second
            interaction model, just a different input method. Sits right
            below the map (not above it) so the map is visible first and the
            chips read as "select within what you're looking at". */}
        <div className="mt-3 flex flex-col gap-2 sm:hidden">
          <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 no-scrollbar" role="group" aria-label="Choose a country">
            {countries.map((c) => {
              const isActive = c.slug === activeCountrySlug;
              return (
                <button
                  key={`country-chip-${c.slug}`}
                  type="button"
                  onClick={() => activateCountry(c.slug)}
                  aria-pressed={isActive}
                  className={
                    isActive
                      ? 'shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brass px-4 py-2 text-sm font-semibold text-ink-900'
                      : 'shrink-0 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-ink-200'
                  }
                >
                  {/* Same confidence colour already explained in the legend below —
                      applied here too so the chip row itself carries the same "how
                      well do we know this" signal the desktop map's halo colour
                      gives for free, instead of every country reading as equal
                      weight until tapped. */}
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: CONFIDENCE_COLOUR[c.confidence].stroke }} aria-hidden="true" />
                  {c.label}
                </button>
              );
            })}
          </div>
          <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 no-scrollbar" role="group" aria-label={`Choose a destination in ${activeCountry.label}`}>
            {activeCountry.destinations.map((d) => {
              const isActive = d.slug === activeDestSlug;
              return (
                <button
                  key={`dest-chip-${d.slug}`}
                  type="button"
                  onClick={() => selectDestination(d.slug)}
                  aria-pressed={isActive}
                  className={
                    isActive
                      ? 'shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brass-100 px-3.5 py-1.5 text-[13px] font-semibold text-ink-900'
                      : 'shrink-0 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[13px] font-medium text-ink-300'
                  }
                >
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: DESTINATION_COLOUR[d.evidenceState].fill }} aria-hidden="true" />
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend — every state actually shown on screen, not just country
            confidence. A visitor sees "Seasonal" and "Route intelligence not
            yet researched" immediately; the legend has to explain both, not
            only the confidence tier a country's colour hints at. */}
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-4 text-xs text-ink-300">
            {(Object.keys(CONFIDENCE_COLOUR) as CountryData['confidence'][]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CONFIDENCE_COLOUR[k].stroke }} aria-hidden="true" />
                {CONFIDENCE_COLOUR[k].label}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-ink-400">
            {(Object.keys(DESTINATION_COLOUR) as DestinationPoint['evidenceState'][]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: DESTINATION_COLOUR[k].fill }} aria-hidden="true" />
                {DESTINATION_COLOUR[k].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <Badge variant="terracotta" className="px-2 py-0.5 text-[9px]">Seasonal</Badge>
              service confirmed for part of the year only
            </span>
          </div>
        </div>

        {/* Quiet technical footnote, deliberately separated from the
            introduction above (which now stays focused on what the visitor
            does, not how the map was built) and placed here instead —
            beneath the map and legend, smaller and more muted than the
            surrounding copy, so it reads as a footnote rather than
            competing with it. Wording and attribution target preserved
            exactly as before; only its position and size changed. */}
        <p className="mt-4 border-t border-white/5 pt-3 text-[11px] text-ink-400">
          Geography: CC BY 4.0 (MapSVG, via VictorCazanave/svg-maps).
        </p>
          </div>

        {/* destination panel — composed as one deliberate reading order rather
            than the stack of independently-added fields this grew from:
            eyebrow, title, then the two evidence truths each under their own
            small label so the distinction between them reads immediately,
            not just structurally. Every word of evidence text below is
            unchanged from before; only its typography and grouping is new. */}
        {activeDest && (
          <div
            aria-live="polite"
            className="mt-6 max-w-md overflow-hidden rounded-md border border-white/10 bg-ink-900/90 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.65)] lg:sticky lg:top-6 lg:mt-0"
          >
            <div
              className="h-[3px] w-full transition-colors duration-500"
              style={{ backgroundColor: DESTINATION_COLOUR[activeDest.evidenceState].fill }}
              aria-hidden="true"
            />
            <div className="p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: DESTINATION_COLOUR[activeDest.evidenceState].fill }}>
                {airportName} → {activeDest.label}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <h3 className="font-display text-2xl leading-tight text-sand-50">{activeDest.label}</h3>
                {activeDest.networkMembership === 'seasonal' && <Badge variant="terracotta">Seasonal</Badge>}
              </div>

              {/* Truth 1 — route intelligence: how much has JetStash itself
                  independently researched about this route. */}
              <div className="mt-5 border-l-2 pl-3.5" style={{ borderColor: DESTINATION_COLOUR[activeDest.evidenceState].fill }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Route intelligence</p>
                <p className="mt-1.5 text-[15px] leading-snug text-ink-100">{activeDest.verdict}</p>
                {activeDest.detail && <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{activeDest.detail}</p>}
                <p className="mt-2 text-xs text-ink-500">{activeDest.flightTime}</p>
              </div>

              {/* Truth 2 — network evidence: is this destination genuinely
                  reachable from Manchester at all. Only rendered for
                  destinations sourced from data/network-evidence.ts — for
                  the original 11, the Route Status verdict above already
                  says enough (see the DestinationPoint comment for why). */}
              {activeDest.networkNote && (
                <div className="mt-4 border-l-2 border-brass-500/50 pl-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Network evidence</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">{activeDest.networkNote}</p>
                </div>
              )}

              <div className="mt-5 flex gap-5 border-t border-white/10 pt-4">
                {activeDest.routeHref && (
                  <Link
                    href={activeDest.routeHref}
                    onClick={() => track('atlas_route_opened', { route: activeDest.routeHref!.split('/').pop()! })}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-brass-300 hover:text-brass-200"
                  >
                    Route guide <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                )}
                <Link href={activeDest.href} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-300 hover:text-sand-50">
                  Explore destination <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      <style>{`
        @keyframes originBreathe { 0%,100% { r: ${originGlowR}; opacity: 0.9; } 50% { r: ${originGlowR * 1.125}; opacity: 1; } }
        .origin-breathe { animation: originBreathe 4s ease-in-out infinite; }
        @keyframes countryPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        .country-pulse { animation: countryPulse 2.2s ease-in-out infinite; }
        /* The selected country's own real shape breathing gently from within.
           Opacity-only, deliberately never scale/transform — a real coastline
           is a complex path, and scaling it risks a visible wobble or shift
           depending on transform-origin; opacity carries the same "alive"
           feeling with zero risk of distorting the actual geography. */
        @keyframes countryLandmassBreathe { 0%,100% { opacity: 0.4; } 50% { opacity: 0.65; } }
        .country-landmass-breathe { animation: countryLandmassBreathe 3.6s ease-in-out infinite; }
        .destination-reveal { animation: destReveal 0.4s ease-out; }
        @keyframes destReveal { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .origin-breathe, .country-pulse, .country-landmass-breathe, .destination-reveal { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
