'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { DESTINATIONS } from '@/components/sections/route-map-hero';
import { getAirportImage } from '@/lib/brand-images';
import { PullBrief } from './pull-brief';

/**
 * Homepage v2 hero — the Desk (Product Vision v1.0, Phase 1 shell).
 *
 * Phase 1 scope only: masthead, headline, type-to-aim, and the Pull a Brief
 * gesture stage. No search results page exists — typing *aims* the gesture
 * (a flagship match arms the thread; Enter pulls it). Non-flagship matches
 * get an honest one-line answer with the real route/destination link, never
 * an invented brief. Wider Desk choreography (Standing Brief line, all
 * threads pullable, marks/seams) is Phase 2 by specification.
 */

const FLAGSHIP_SLUG = 'mumbai';

function Wordmark() {
  return (
    <span className="font-display text-xl tracking-tight text-sand-50">
      Jet<span className="relative text-brass-300">Stash<span aria-hidden="true" className="absolute -bottom-1 left-0 h-px w-full bg-brass-400/70" /></span>
    </span>
  );
}

export function PullBriefHero() {
  const [query, setQuery] = useState('');

  const match = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    return (
      DESTINATIONS.find((d) => d.label.toLowerCase().startsWith(q)) ??
      DESTINATIONS.find((d) => d.label.toLowerCase().includes(q) || d.country.toLowerCase().startsWith(q)) ??
      null
    );
  }, [query]);

  const aimedFlagship = match?.slug === FLAGSHIP_SLUG;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (aimedFlagship) {
      window.dispatchEvent(new Event('jetstash:pull-flagship'));
    }
  }

  const manchesterImg = getAirportImage('manchester');

  return (
    <section className="relative overflow-hidden bg-ink-950">
      {/* Dusk-room photography, heavily recessed — the map is the subject. */}
      {manchesterImg && (
        <div aria-hidden="true" className="absolute inset-0">
          <Image src={manchesterImg.src} alt="" fill priority sizes="100vw" className="object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-950/80 via-ink-950/88 to-ink-950" />
        </div>
      )}

      <div className="relative mx-auto max-w-content px-5 pb-16 pt-5 sm:px-8 sm:pb-16 sm:pt-6">
        <div className="flex items-center gap-3">
          <Wordmark />
          {/* Featured-route label — frames the route as one featured example, not
              the whole product. The route itself (Manchester → Mumbai) is shown on
              the map below, so it isn't repeated here. "Journey Brief" is
              deliberately absent: it's the name of what opens on the pull, earned
              at the reveal, not a term to decode on arrival. */}
          <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-300">Featured route</span>
        </div>

        {/* Framing line — small, so it introduces the interaction rather than
            competing with it. The route below is the subject. */}
        <div className="mt-5 max-w-xl">
          <h1 className="font-display text-xl leading-tight tracking-tight text-sand-50 sm:text-[1.7rem]">
            Everything that matters before you book.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-300">
            We check flights from the UK to Pakistan, India, the Gulf and Umrah — the route, the timing and the paperwork, before you book.
          </p>
        </div>

        {/* Secondary affordance — the map opens Manchester → Mumbai; this is an
            honest way to reach any other route's guide, not a promise that
            every destination can be pulled. */}
        <form onSubmit={onSubmit} className="mt-3 max-w-[15rem]">
          <label htmlFor="hv2-aim" className="block text-[11px] font-medium text-ink-400">
            Looking for another route?
          </label>
          <input
            id="hv2-aim"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a destination…"
            autoComplete="off"
            className="mt-1.5 h-9 w-full rounded-sm border border-white/10 bg-white/[0.04] px-3 text-[13px] text-sand-50 placeholder:text-ink-500 focus-visible:border-brass/60"
          />
          <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-[13px] leading-relaxed text-ink-300">
            {aimedFlagship && (
              <>
                <span className="text-brass-200">Manchester → Mumbai is ready on the map</span> — press Enter to pull its Brief.
              </>
            )}
            {match && !aimedFlagship && (
              <>
                We&apos;re still building the full check for Manchester → {match.label.split(',')[0]}.{' '}
                <Link href={match.href} className="font-semibold text-brass-300 underline underline-offset-2 hover:text-brass-200">
                  Open the route guide
                  <ArrowUpRight className="ml-0.5 inline h-3.5 w-3.5" strokeWidth={2.25} />
                </Link>
              </>
            )}
          </p>
        </form>

        {/* The Desk — Pull a Brief gesture stage. The subject of the screen. */}
        <div className="mt-2 sm:mt-3">
          <PullBrief aimedSlug={match?.slug ?? null} />
        </div>
      </div>
    </section>
  );
}
