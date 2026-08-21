'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { track } from '@/lib/analytics';

export interface JourneyCheckOption {
  slug: string;
  label: string;
}

export interface JourneyCheckData {
  origins: JourneyCheckOption[];
  destinations: JourneyCheckOption[];
  /** "airportSlug|destinationSlug" -> route slug, for every tracked route. */
  routeIndex: Record<string, string>;
}

const selectClass =
  'mt-1.5 h-11 w-full appearance-none rounded-sm border border-white/15 bg-white/[0.04] pl-3 pr-9 text-sm text-sand-50 focus-visible:border-brass/60';

/**
 * The fast path for a visitor who already knows their route — the Atlas
 * above is a browse/discovery surface; this is its "I already know what I
 * want" companion. Every combination it can reach resolves to a real page:
 * a tracked pairing (data/routes.ts) goes straight to its route check,
 * anything else still opens the genuine destination guide rather than a
 * dead end. Deliberately has no coupling to the retired pull-brief/
 * flagship-status machinery — this is just the handover, standing alone.
 */
export function JourneyCheckForm({ origins, destinations, routeIndex }: JourneyCheckData) {
  const router = useRouter();
  const [fromSlug, setFromSlug] = useState(origins[0]?.slug ?? '');
  const [toSlug, setToSlug] = useState(destinations[0]?.slug ?? '');
  // Fires 'started' once per mount on the first genuine change to either
  // select — never on initial render, never repeated. Same guarded-ref
  // pattern as travel-ready-check.tsx's own markStarted().
  const startedRef = useRef(false);
  // Participant 1 defect follow-up (21 Aug 2026): this <form> has no
  // action/method attribute (verified in the raw server-rendered HTML), so
  // it relies entirely on this component's onSubmit handler calling
  // e.preventDefault() to work. A submit that reaches the browser before
  // hydration attaches that handler falls through to the native default —
  // a plain GET reload of the current page (no action = itself; the
  // selects carry no `name`, so no data survives either) — which looks
  // exactly like "Check my journey did nothing" to whoever clicked it. Only
  // a real risk on a fast click during hydration (a heavier bundle sits
  // above this on the page — see AtlasFeelTest in journey-desk-home.tsx),
  // never after mount, so this guard is a pure safety net, not a behaviour
  // change for the overwhelming majority of visitors who click post-hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const routeSlug = routeIndex[`${fromSlug}|${toSlug}`];
  const fromLabel = origins.find((o) => o.slug === fromSlug)?.label ?? fromSlug;
  const toLabel = destinations.find((d) => d.slug === toSlug)?.label ?? toSlug;
  const toCity = toLabel.split(',')[0];

  function markStarted() {
    if (startedRef.current) return;
    startedRef.current = true;
    track('journey_check_started');
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Every combination resolves to a real page (see the component doc
    // comment above), so a submit is always a valid, successful result —
    // only the safe category differs, never the full destination text.
    const resultCategory = routeSlug ? 'route' : 'destination_guide';
    // Composite route slug rather than separate origin/destination fields —
    // two custom properties is the Vercel Pro ceiling (see lib/analytics.ts).
    // Built from the two slugs directly, not routeSlug, so the pair is still
    // recorded when the combination has no route guide (destination_guide).
    track('journey_check_completed', { route: `${fromSlug}-${toSlug}`, resultCategory });
    // A route guide is specifically the tracked-route outcome — the
    // destination-guide fallback is a different page, not "a route guide".
    if (routeSlug) track('journey_check_route_opened', { route: routeSlug });
    router.push(routeSlug ? `/routes/${routeSlug}` : `/destinations/${toSlug}`);
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="jc-from" className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
            Flying from
          </label>
          <select
            id="jc-from"
            value={fromSlug}
            onChange={(e) => {
              markStarted();
              setFromSlug(e.target.value);
            }}
            className={selectClass}
          >
            {origins.map((o) => (
              <option key={o.slug} value={o.slug} className="bg-ink-900 text-sand-50">
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="jc-to" className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
            Going to
          </label>
          <select
            id="jc-to"
            value={toSlug}
            onChange={(e) => {
              markStarted();
              setToSlug(e.target.value);
            }}
            className={selectClass}
          >
            {destinations.map((d) => (
              <option key={d.slug} value={d.slug} className="bg-ink-900 text-sand-50">
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!mounted}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-brass px-5 text-sm font-semibold text-ink-900 shadow-[0_1px_8px_-4px_rgba(200,147,46,0.25)] transition-[transform,background-color,box-shadow] duration-150 hover:bg-brass-400 hover:shadow-brass-glow active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Check my journey
          <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </form>
      <p aria-live="polite" className="mt-3 min-h-[1.5rem] text-[13px] leading-relaxed text-ink-300">
        {routeSlug ? (
          <>
            We track {fromLabel} → {toCity}. Press Check to open the route guide.
          </>
        ) : (
          <>
            We&apos;re still building the full check for {fromLabel} → {toCity} — Check will open the {toCity} destination guide instead.
          </>
        )}
      </p>
    </div>
  );
}
