'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

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

  const routeSlug = routeIndex[`${fromSlug}|${toSlug}`];
  const fromLabel = origins.find((o) => o.slug === fromSlug)?.label ?? fromSlug;
  const toLabel = destinations.find((d) => d.slug === toSlug)?.label ?? toSlug;
  const toCity = toLabel.split(',')[0];

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    router.push(routeSlug ? `/routes/${routeSlug}` : `/destinations/${toSlug}`);
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-sand-50">Already know your journey?</h3>
      <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="jc-from" className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
            Flying from
          </label>
          <select id="jc-from" value={fromSlug} onChange={(e) => setFromSlug(e.target.value)} className={selectClass}>
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
          <select id="jc-to" value={toSlug} onChange={(e) => setToSlug(e.target.value)} className={selectClass}>
            {destinations.map((d) => (
              <option key={d.slug} value={d.slug} className="bg-ink-900 text-sand-50">
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-brass px-5 text-sm font-semibold text-ink-900 shadow-[0_1px_8px_-4px_rgba(200,147,46,0.25)] transition-[transform,background-color,box-shadow] duration-150 hover:bg-brass-400 hover:shadow-brass-glow active:scale-[0.985]"
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
