'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  MapPinned,
  Plane,
  ShieldCheck,
} from 'lucide-react';
import type { BookBySnapshot } from '@/lib/booking-intelligence';
import { RouteMapHero } from '@/components/sections/route-map-hero';
import { getAirportImage, getDestinationImage } from '@/lib/brand-images';
import {
  BOOK_BY_UNAVAILABLE_COPY,
  BUSINESS_CLASS_COPY,
  ECONOMY_COPY,
  EVIDENCE_BUNDLE,
  FLIGHT_CONSIDERATIONS,
  WITHDRAWAL_BOUNDARY_DATE,
} from '@/lib/journey-brief-manchester-mumbai';

/**
 * Homepage v2 — the signature Journey Brief hero (protected prototype).
 *
 * The flagship interaction: the visitor asks only "from / to", and on
 * "Check my trip" the hero itself transforms rather than revealing a panel
 * below. Photography crossfades from Manchester (departure) to Mumbai
 * (arrival), the headline and form collapse into a compact journey bar, the
 * Journey Map becomes the full-width centrepiece with the selected arc
 * drawing in from origin to destination, and the Journey Brief modules
 * stagger in around it — every one in its honest, evidence-backed state
 * from lib/journey-brief-manchester-mumbai.ts. Nothing is fabricated; any
 * non-flagship selection gets a truthful fallback, not an invented brief.
 *
 * No dates/cabin/passport asked in the first step. No affiliate handoff
 * before value. Reduced motion collapses every animation via globals.css.
 */

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Curated origins/destinations that map to a real Manchester route page. Only Mumbai carries the full Journey Brief. */
const ORIGINS = [{ slug: 'manchester', label: 'Manchester' }];
const DESTINATIONS = [
  { slug: 'mumbai', label: 'Mumbai, India', routeSlug: 'manchester-mumbai' },
  { slug: 'lahore', label: 'Lahore, Pakistan', routeSlug: 'manchester-lahore' },
  { slug: 'islamabad', label: 'Islamabad, Pakistan', routeSlug: 'manchester-islamabad' },
  { slug: 'dubai', label: 'Dubai, UAE', routeSlug: 'manchester-dubai' },
];

/** One line per Journey Brief module, in the honest state this route is actually in today. */
const BRIEF_MODULES: { key: string; label: string; state: 'ready' | 'flag' | 'pending'; detail: string }[] = [
  { key: 'route', label: 'Route status', state: 'ready', detail: 'Direct service on record, operated by IndiGo.' },
  { key: 'change', label: 'Service change', state: 'flag', detail: `Announced to pause from ${formatDate(WITHDRAWAL_BOUNDARY_DATE)}.` },
  { key: 'bookby', label: 'Book By timing', state: 'pending', detail: BOOK_BY_UNAVAILABLE_COPY.headline },
  { key: 'ready', label: 'Travel Ready', state: 'pending', detail: 'Add your dates and passport to check entry readiness.' },
  { key: 'economy', label: 'Economy', state: 'pending', detail: ECONOMY_COPY.headline },
  { key: 'business', label: 'Business Class', state: 'pending', detail: BUSINESS_CLASS_COPY.headline },
  { key: 'baggage', label: 'Baggage', state: 'pending', detail: 'Allowance not verified for this fare yet — confirm with IndiGo.' },
  { key: 'evidence', label: 'Evidence', state: 'ready', detail: `Last checked ${formatDate(EVIDENCE_BUNDLE.primarySource.accessedDate)} · next review ${formatDate(EVIDENCE_BUNDLE.nextReviewDate)}.` },
];

function ModuleIcon({ state }: { state: 'ready' | 'flag' | 'pending' }) {
  if (state === 'ready') return <CheckCircle2 className="h-4 w-4 shrink-0 text-brass-400" strokeWidth={2} aria-hidden="true" />;
  if (state === 'flag') return <CalendarClock className="h-4 w-4 shrink-0 text-terracotta-400" strokeWidth={2} aria-hidden="true" />;
  return <Circle className="h-4 w-4 shrink-0 text-ink-500" strokeWidth={2} aria-hidden="true" />;
}

function Wordmark() {
  return (
    <span className="font-display text-xl tracking-tight text-sand-50">
      Jet<span className="relative text-brass-300">Stash<span aria-hidden="true" className="absolute -bottom-1 left-0 h-px w-full bg-brass-400/70" /></span>
    </span>
  );
}

export function JourneyBriefHero({ bookBySnapshots }: { bookBySnapshots: BookBySnapshot[] }) {
  const [originSlug, setOriginSlug] = useState('manchester');
  const [destinationSlug, setDestinationSlug] = useState('mumbai');
  const [checked, setChecked] = useState(false);
  const [mapMessage, setMapMessage] = useState<string | null>(null);

  const selected = DESTINATIONS.find((d) => d.slug === destinationSlug) ?? DESTINATIONS[0];
  const isFlagship = originSlug === 'manchester' && destinationSlug === 'mumbai';
  const transformed = checked && isFlagship;

  const manchesterImg = getAirportImage('manchester');
  const mumbaiImg = getDestinationImage('mumbai');

  function handleCheck(e: FormEvent) {
    e.preventDefault();
    setChecked(true);
    if (typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        document.getElementById('journey-response')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  return (
    <section className="relative overflow-hidden bg-ink-950">
      {/* ── Cinematic photography, crossfading with the journey ──────────
          Idle: Manchester at dusk (where you are). Checked: Mumbai (where
          you're going). Both layers stay mounted; only opacity moves, so the
          transition is one smooth dissolve. Decorative — alt="" on both. */}
      <div aria-hidden="true" className="absolute inset-0">
        {manchesterImg && (
          <Image
            src={manchesterImg.src}
            alt=""
            fill
            priority
            sizes="100vw"
            className={`object-cover transition-opacity duration-1000 ease-out ${transformed ? 'opacity-0' : 'opacity-100'}`}
          />
        )}
        {mumbaiImg && (
          <Image
            src={mumbaiImg.src}
            alt=""
            fill
            sizes="100vw"
            className={`object-cover transition-opacity duration-1000 ease-out ${transformed ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/70 via-ink-950/80 to-ink-950" />
      </div>

      <div className="relative mx-auto max-w-content px-5 pb-14 pt-10 sm:px-8 sm:pb-16 sm:pt-14">
        {/* Typography-led JetStash wordmark — no circular mark. The brass hairline
            under "Stash" reads as a route/underscore: the stored, checked part. */}
        <div className="flex items-center gap-3">
          <Wordmark />
          <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-300">Journey Brief</span>
        </div>

        {/* ── Idle: headline + minimal entry ─────────────────────────────── */}
        {!transformed && (
          <>
            <div className="mt-10 max-w-2xl sm:mt-14">
              <h1 className="font-display text-[2.4rem] leading-[1.04] tracking-tight text-sand-50 sm:text-6xl">
                Everything that matters before you book.
              </h1>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-200">
                Turn your trip into one clear Journey Brief.
              </p>
            </div>

            <form onSubmit={handleCheck} className="mt-8 max-w-2xl rounded-lg border border-white/10 bg-ink-900/70 p-4 backdrop-blur-md sm:p-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div>
                  <label htmlFor="hv2-from" className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">Flying from</label>
                  <select
                    id="hv2-from"
                    value={originSlug}
                    onChange={(e) => { setOriginSlug(e.target.value); setChecked(false); }}
                    className="mt-1.5 h-12 w-full rounded-sm border border-white/15 bg-white/5 px-3 text-sm text-sand-50 focus-visible:border-brass"
                  >
                    {ORIGINS.map((o) => (
                      <option key={o.slug} value={o.slug} className="bg-ink-900 text-sand-50">{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="hv2-to" className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">Going to</label>
                  <select
                    id="hv2-to"
                    value={destinationSlug}
                    onChange={(e) => { setDestinationSlug(e.target.value); setChecked(false); }}
                    className="mt-1.5 h-12 w-full rounded-sm border border-white/15 bg-white/5 px-3 text-sm text-sand-50 focus-visible:border-brass"
                  >
                    {DESTINATIONS.map((d) => (
                      <option key={d.slug} value={d.slug} className="bg-ink-900 text-sand-50">{d.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-brass px-6 text-sm font-semibold text-ink-900 transition-all hover:bg-brass-400 hover:shadow-brass-glow active:scale-[0.985]"
                >
                  Check my trip
                  <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <a
                  href="#journey-map"
                  onClick={() => setChecked(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brass-300 underline decoration-brass-300/40 underline-offset-4 hover:text-brass-200"
                >
                  Explore the Journey Map
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                </a>
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-brass-300" strokeWidth={2} aria-hidden="true" />
                  Route intelligence for this journey last checked {formatDate(EVIDENCE_BUNDLE.primarySource.accessedDate)}
                </span>
              </div>

              {/* Live intelligence ribbon — before any click, JetStash already knows
                  something real and dated about the selected journey. Only rendered
                  where genuine evidence exists (the flagship); never invented. */}
              {isFlagship && !checked && (
                <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/10 pt-3.5 text-[13px] leading-relaxed text-ink-200">
                  <span className="font-semibold text-sand-50">Manchester → Mumbai</span>
                  <span aria-hidden="true" className="text-brass-400/70">·</span>
                  <span>{EVIDENCE_BUNDLE.route.airline} direct, on record</span>
                  <span aria-hidden="true" className="text-brass-400/70">·</span>
                  <span className="text-terracotta-200">announced to pause from {formatDate(WITHDRAWAL_BOUNDARY_DATE)}</span>
                  <span aria-hidden="true" className="text-brass-400/70">·</span>
                  <span className="text-ink-300">checked {formatDate(EVIDENCE_BUNDLE.primarySource.accessedDate)}</span>
                </p>
              )}
            </form>
          </>
        )}

        {/* ── Transformed: the page reorganises itself around the journey ── */}
        {transformed && (
          <div id="journey-response">
            {/* Keep the page's h1 for structure while the visual hero becomes the Brief */}
            <h1 className="sr-only">Everything that matters before you book.</h1>

            {/* Compact journey bar — the form, collapsed into what it became */}
            <div className="stagger-in stagger-1 mt-8 flex animate-fade-up flex-wrap items-center gap-x-4 gap-y-3">
              <span className="inline-flex items-center gap-2.5 rounded-full border border-brass/30 bg-ink-900/70 py-2 pl-4 pr-3 backdrop-blur-md">
                <span className="font-display text-lg leading-none text-sand-50">Manchester → Mumbai</span>
                <span aria-hidden="true" className="h-4 w-px bg-white/15" />
                <button
                  type="button"
                  onClick={() => { setChecked(false); setMapMessage(null); }}
                  className="text-[13px] font-semibold text-brass-300 underline decoration-brass-300/40 underline-offset-4 hover:text-brass-200"
                >
                  Change journey
                </button>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brass/30 bg-brass/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-brass-200">
                <Plane className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Direct service on record
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-terracotta-400/30 bg-terracotta-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-terracotta-200">
                Time-bound
              </span>
            </div>

            {/* Verdict strip — one understanding, dated, with evidence behind a disclosure */}
            <div className="stagger-in stagger-2 mt-6 max-w-3xl animate-fade-up">
              <h2 className="font-display text-[1.7rem] leading-tight text-sand-50 sm:text-4xl">
                Manchester to Mumbai, understood before you book.
              </h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-200">
                {EVIDENCE_BUNDLE.route.airline} operates this route direct. It is announced to pause from{' '}
                {formatDate(WITHDRAWAL_BOUNDARY_DATE)} — {EVIDENCE_BUNDLE.characterisation}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-ink-300">
                <span>Last checked <span className="text-ink-100">{formatDate(EVIDENCE_BUNDLE.primarySource.accessedDate)}</span></span>
                <span>Next review <span className="text-ink-100">{formatDate(EVIDENCE_BUNDLE.nextReviewDate)}</span></span>
                <details className="group inline-block">
                  <summary className="cursor-pointer text-xs font-semibold text-brass-300 hover:text-brass-200">How we checked this</summary>
                  <div className="mt-2 max-w-2xl space-y-2 rounded-md border border-white/10 bg-ink-900/70 p-4 text-[13px] leading-relaxed text-ink-300 backdrop-blur-md">
                    <p>
                      {EVIDENCE_BUNDLE.primarySource.organisation} — “{EVIDENCE_BUNDLE.primarySource.title}”
                      (published {formatDate(EVIDENCE_BUNDLE.primarySource.publicationDate)}), corroborated by{' '}
                      {EVIDENCE_BUNDLE.corroboratingSource.organisation}.
                    </p>
                    <p>{FLIGHT_CONSIDERATIONS.note}</p>
                  </div>
                </details>
              </div>
            </div>

            {/* The Journey Map — the centrepiece the page reorganises around */}
            <div id="journey-map" className="stagger-in stagger-3 mt-8 animate-fade-up">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-300">
                <MapPinned className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Your journey, made dominant
              </div>
              <RouteMapHero
                bookBySnapshots={bookBySnapshots}
                initialActiveSlug="mumbai"
                lockedSlug="mumbai"
                animateActiveRoute
                onDestinationActivate={(slug) =>
                  setMapMessage(slug === 'mumbai' ? null : 'This homepage preview is focused on Manchester → Mumbai. Open the Journey Map to explore every route.')
                }
              />
              {mapMessage && (
                <p role="status" aria-live="polite" className="mt-3 text-[13px] leading-relaxed text-brass-200">{mapMessage}</p>
              )}
            </div>

            {/* Journey Brief modules — appearing around the map, each honest */}
            <div className="mt-8">
              <p className="stagger-in stagger-3 animate-fade-up text-[11px] font-semibold uppercase tracking-[0.2em] text-brass-200">
                Your Journey Brief, forming
              </p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {BRIEF_MODULES.map((m, i) => (
                  <li
                    key={m.key}
                    className="stagger-in animate-fade-up rounded-md border border-white/10 bg-ink-900/60 p-4 backdrop-blur-sm"
                    style={{ animationDelay: `${0.35 + i * 0.08}s` }}
                  >
                    <span className="flex items-center gap-2">
                      <ModuleIcon state={m.state} />
                      <span className="text-sm font-semibold text-sand-100">{m.label}</span>
                    </span>
                    <span className="mt-1.5 block text-[13px] leading-snug text-ink-300">{m.detail}</span>
                  </li>
                ))}
              </ul>
              <div className="stagger-in stagger-4 mt-6 flex animate-fade-up flex-wrap items-center gap-x-5 gap-y-3">
                <Link
                  href="/founder/journey-brief/manchester-mumbai"
                  className="inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-brass px-6 text-sm font-semibold text-ink-900 transition-all hover:bg-brass-400 hover:shadow-brass-glow active:scale-[0.985]"
                >
                  Open the full Journey Brief
                  <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
                </Link>
                <span className="text-[13px] text-ink-300">Add dates, passport and cabin to complete it.</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Honest fallback — no invented brief for routes without evidence ── */}
        {checked && !isFlagship && (
          <div id="journey-response" className="mt-10 max-w-2xl border-t border-white/10 pt-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-200">
              Journey Brief in progress
            </span>
            <h2 className="mt-4 font-display text-2xl leading-tight text-sand-50">
              A full Journey Brief for Manchester → {selected.label.split(',')[0]} isn&apos;t ready yet.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-200">
              The flagship Journey Brief is live for Manchester → Mumbai today. For this route, the checked-and-dated
              route guide is the best place to start.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/routes/${selected.routeSlug}`}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-brass px-5 text-sm font-semibold text-ink-900 transition-all hover:bg-brass-400"
              >
                Open the route guide
                <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
              </Link>
              <button
                type="button"
                onClick={() => { setDestinationSlug('mumbai'); setChecked(true); }}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-white/15 px-5 text-sm font-semibold text-sand-50 hover:bg-white/5"
              >
                See the Mumbai Journey Brief
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
