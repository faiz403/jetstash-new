'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { getDestinationImage, getHeroImage } from '@/lib/brand-images';
import type { FlagshipStatusCopy } from '@/lib/flagship-status-copy';
import { PullBrief } from './pull-brief';

/**
 * Homepage hero — the pre-booking second opinion, in three beats.
 *
 * 1. The quiet promise: "Before you book, get a second opinion." Minimal
 *    copy; the featured route below is the subject, not a wall of text.
 * 2. The featured proof: the Manchester → Mumbai thread with the pull
 *    gesture. Pulling reveals the single most important verified fact for
 *    that journey (see pull-brief.tsx) — the product taught by interaction.
 * 3. The handover: "Now check your journey." From/To across the real
 *    tracked-route data (passed in from the server component so the client
 *    bundle never imports the full data files). Three honest states:
 *    the featured pairing arms the pull; a tracked route links to its real
 *    route check; anything else says plainly that the full check is still
 *    being built and links to the genuine destination guide instead.
 */

/** Compact, server-prepared lookup — see journey-desk-home.tsx. */
export interface HandoverOption {
  slug: string;
  label: string;
}
export interface HandoverData {
  origins: HandoverOption[];
  destinations: HandoverOption[];
  /** "airportSlug|destinationSlug" → route slug, for every tracked route. */
  routeIndex: Record<string, string>;
}

const FEATURED = { from: 'manchester', to: 'mumbai' };

function Wordmark() {
  return (
    <span className="font-display text-xl tracking-tight text-sand-50">
      Jet<span className="relative text-brass-300">Stash<span aria-hidden="true" className="absolute -bottom-1 left-0 h-px w-full bg-brass-400/70" /></span>
    </span>
  );
}

const selectClass =
  'pb-select mt-1.5 h-11 w-full appearance-none rounded-sm border border-white/15 bg-white/[0.04] pl-3 pr-9 text-sm text-sand-50 focus-visible:border-brass/60';

export function PullBriefHero({ handover, flagshipStatusCopy }: { handover: HandoverData; flagshipStatusCopy: FlagshipStatusCopy }) {
  const router = useRouter();
  const [fromSlug, setFromSlug] = useState(FEATURED.from);
  const [toSlug, setToSlug] = useState(FEATURED.to);

  const fromLabel = handover.origins.find((o) => o.slug === fromSlug)?.label ?? fromSlug;
  const toLabel = handover.destinations.find((d) => d.slug === toSlug)?.label ?? toSlug;
  const toCity = toLabel.split(',')[0];

  const isFeatured = fromSlug === FEATURED.from && toSlug === FEATURED.to;
  const routeSlug = handover.routeIndex[`${fromSlug}|${toSlug}`];

  const originImg = getHeroImage('manchester-mumbai-journey');
  const journeyImg = getHeroImage('manchester-mumbai-journey');
  const destinationImg = getDestinationImage('mumbai');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (isFeatured) {
      // The featured journey is the stage above — open it rather than leaving the page.
      window.dispatchEvent(new Event('jetstash:pull-flagship'));
      document.getElementById('featured-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    router.push(routeSlug ? `/routes/${routeSlug}` : `/destinations/${toSlug}`);
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-ink-950 via-ink-950 to-[#141225]">
      <div className="relative mx-auto max-w-content px-5 pb-14 pt-5 sm:px-8 sm:pb-16 sm:pt-6">
        <div className="flex items-center gap-3">
          <Wordmark />
          {/* Featured-route label — frames the route as one featured example, not
              the whole product. The route itself (Manchester → Mumbai) is shown on
              the map below, so it isn't repeated here. "Journey Brief" is
              deliberately absent: it's the name of what opens on the pull, earned
              at the reveal, not a term to decode on arrival. */}
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-300">Featured route</span>
        </div>

        {/* ── The promise. Very little copy — the interaction teaches the rest. ── */}
        <div className="mt-6 max-w-xl sm:mt-8">
          <h1 className="font-display text-[1.7rem] leading-[1.1] tracking-tight text-sand-50 sm:text-4xl">
            Before you book, get a second opinion.
          </h1>
          <p className="mt-2.5 max-w-lg text-sm leading-relaxed text-ink-300 sm:text-[15px]">
            We check the route, the timing and the paperwork for international journeys from UK airports. Our
            deepest current coverage is South Asia and the Gulf — then we tell you what actually matters.
          </p>
        </div>

        {/* ── The featured proof — pull to reveal what matters most. ─────────── */}
        <div id="featured-stage" className="mt-4 scroll-mt-24 sm:mt-5">
          <PullBrief
            aimedSlug={isFeatured ? 'mumbai' : null}
            statusCopy={flagshipStatusCopy}
            originImage={originImg}
            journeyImage={journeyImg}
            destinationImage={destinationImg}
          />
        </div>

        {/* ── The handover — after the proof, the visitor's own journey. ─────── */}
        <div id="your-journey" className="mt-10 max-w-2xl scroll-mt-24 border-t border-white/10 pt-7 sm:mt-8">
          <h2 className="font-display text-lg leading-tight text-sand-50 sm:text-xl">Now check your journey.</h2>
          <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label htmlFor="hv3-from" className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
                Flying from
              </label>
              <select id="hv3-from" value={fromSlug} onChange={(e) => setFromSlug(e.target.value)} className={selectClass}>
                {handover.origins.map((o) => (
                  <option key={o.slug} value={o.slug} className="bg-ink-900 text-sand-50">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="hv3-to" className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
                Going to
              </label>
              <select id="hv3-to" value={toSlug} onChange={(e) => setToSlug(e.target.value)} className={selectClass}>
                {handover.destinations.map((d) => (
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

          {/* Honest state for the current selection — updates as they choose. */}
          <p aria-live="polite" className="mt-3 min-h-[1.5rem] text-[13px] leading-relaxed text-ink-300">
            {isFeatured && (
              <>
                <span className="text-brass-200">This is the featured route above.</span> Press Check to open this
                route check.
              </>
            )}
            {!isFeatured && routeSlug && (
              <>
                We track {fromLabel} → {toCity}.{' '}
                <Link
                  href={`/routes/${routeSlug}`}
                  className="font-semibold text-brass-300 underline decoration-brass-300/40 underline-offset-4 transition-colors duration-150 hover:text-brass-200"
                >
                  Open the route check
                  <ArrowUpRight className="ml-0.5 inline h-3.5 w-3.5" strokeWidth={2.25} />
                </Link>{' '}
                for what&apos;s confirmed, timing guidance and what to confirm before you book.
              </>
            )}
            {!isFeatured && !routeSlug && (
              <>
                We&apos;re still building the full check for {fromLabel} → {toCity}.{' '}
                <Link
                  href={`/destinations/${toSlug}`}
                  className="font-semibold text-brass-300 underline decoration-brass-300/40 underline-offset-4 transition-colors duration-150 hover:text-brass-200"
                >
                  See the {toCity} guide
                  <ArrowUpRight className="ml-0.5 inline h-3.5 w-3.5" strokeWidth={2.25} />
                </Link>{' '}
                for what we can confirm today.
              </>
            )}
          </p>

          <p className="mt-2 text-xs text-ink-400">
            Somewhere else?{' '}
            <Link href="/destinations" className="font-medium text-ink-300 underline decoration-brass-300/40 underline-offset-4 transition-colors duration-150 hover:text-brass-300">
              Browse every destination we cover
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
