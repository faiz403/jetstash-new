import Link from 'next/link';
import { ArrowUpRight, ArrowRight, Plane, Crown, Compass, BellRing, CalendarClock, ShieldCheck, FileCheck2, Receipt } from 'lucide-react';
import { ROUTE_WATCH_INITIAL_COPY } from '@/lib/route-watch-config';

/**
 * Homepage v2 — server-rendered sections below the signature hero (protected
 * prototype). Every claim here is either verified route data or an honest
 * "not yet" — no invented fare, airline, frequency, popularity or connecting
 * alternative. No affiliate link fires from this page; the safe live-fare
 * path lives inside the route guides / Journey Brief these link to.
 */

/* ── Contextual commercial paths — journey paths, not three sales cards ── */
export function CommercialPaths() {
  return (
    <section className="bg-sand-50 py-16 sm:py-24">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-terracotta-600">However you travel</span>
        <h2 className="mt-2 max-w-2xl font-display text-3xl leading-tight text-ink-900 sm:text-4xl">
          The same checked journey, three ways to fly it
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-500">
          One Journey Brief underneath all three — the difference is how you want to fly it, not how much we checked.
        </p>
        <div className="mt-9 grid gap-5 lg:grid-cols-3">
          {/* Economy — intelligence first, then the safe live-fare path */}
          <article className="flex flex-col rounded-lg border border-ink-100 bg-white p-6 shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-terracotta-50 text-terracotta-600">
              <Plane className="h-5 w-5" strokeWidth={2} />
            </span>
            <h3 className="mt-4 font-display text-xl text-ink-900">Economy</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
              See the route status, service change and booking timing first. When you&apos;re ready, JetStash hands you a
              live-fare check — never a stale or half-built price.
            </p>
            <Link href="/founder/journey-brief/manchester-mumbai" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-terracotta-600">
              Start with the Journey Brief <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </article>

          {/* Business Class — premium planning path, no deal card, no fake quote */}
          <article className="flex flex-col rounded-lg border border-ink-100 bg-ink-900 p-6 shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-white/5 text-brass-300">
              <Crown className="h-5 w-5" strokeWidth={2} />
            </span>
            <h3 className="mt-4 font-display text-xl text-sand-50">Business Class</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-300">
              A planning path, not a deal feed. Long-haul premium fares move on their own patterns — we track the routes
              UK travellers actually fly and flag when a fare is genuinely worth it.
            </p>
            <Link href="/business-class" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brass-300 hover:text-brass-200">
              Explore Business Class <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </article>

          {/* Umrah — discoverable, operationally supported wording */}
          <article className="flex flex-col rounded-lg border border-ink-100 bg-white p-6 shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-terracotta-50 text-terracotta-600">
              <Compass className="h-5 w-5" strokeWidth={2} />
            </span>
            <h3 className="mt-4 font-display text-xl text-ink-900">Umrah</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
              What a package really includes, how Makkah hotel distance affects price, and the Nusuk visa route. Tell us
              your dates and group and a person comes back with real pricing.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
              <Link href="/umrah" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-terracotta-600">
                Umrah hub <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
              </Link>
              <Link href="/quote-request?tripType=umrah&region=gulf" className="inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta-600 hover:text-terracotta-500">
                Request a quote
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ── Concise "What JetStash checks" ── */
const CHECKS = [
  { icon: Plane, title: 'Route status & airline', body: 'Whether a route runs direct, on which airline, verified from that carrier’s own source.' },
  { icon: CalendarClock, title: 'Announced service changes', body: 'Route pauses and withdrawals surfaced honestly, with the date and where we read it.' },
  { icon: ShieldCheck, title: 'Booking-window timing', body: 'When to book, traced to a real festival, fare or booking-window record. Never fake urgency.' },
  { icon: FileCheck2, title: 'Travel-ready documents', body: 'Passport validity and visa guidance for your trip, sourced from official government pages.' },
  { icon: Receipt, title: 'Fares, dated by a person', body: 'Every fare shows the date a person actually checked it. Never a live-price claim, never a half-built price.' },
];

export function WhatWeCheck() {
  return (
    <section className="bg-ink-900 py-14 sm:py-20">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-300">What we check before you book</span>
        <h2 className="mt-2 max-w-2xl font-display text-3xl leading-tight text-sand-50 sm:text-4xl">
          Everything below is checked, dated and sourced
        </h2>
        <div className="mt-9 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {CHECKS.map((c) => (
            <div key={c.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-brass/30 text-brass-300">
                <c.icon className="h-4.5 w-4.5" strokeWidth={2} />
              </span>
              <div>
                <p className="text-sm font-semibold text-sand-50">{c.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-300">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Route Watch invitation — copy shared with the form via lib/route-watch-config.ts ── */
export function RouteWatchInvite() {
  return (
    <section className="bg-sand-50 py-14 sm:py-20">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <div className="flex flex-col gap-6 rounded-lg border border-ink-100 bg-white p-7 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-9">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-terracotta-600">
              <BellRing className="h-4 w-4" strokeWidth={2} /> Route Watch
            </span>
            <h2 className="mt-2 font-display text-2xl leading-tight text-ink-900">
              Not ready to book? Keep the route on your radar.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{ROUTE_WATCH_INITIAL_COPY}</p>
          </div>
          <Link
            href="/routes/manchester-mumbai#route-watch"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-6 text-sm font-semibold text-sand-50 transition-colors hover:bg-brass-600"
          >
            Watch a route
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Compact closing band (the global footer renders below this) ── */
export function ClosingBand() {
  return (
    <section className="border-t border-white/5 bg-ink-950 py-12">
      <div className="mx-auto flex max-w-content flex-col items-start justify-between gap-6 px-5 sm:flex-row sm:items-center sm:px-8">
        <div>
          <span className="font-display text-xl tracking-tight text-sand-50">
            Jet<span className="relative text-brass-300">Stash<span aria-hidden="true" className="absolute -bottom-1 left-0 h-px w-full bg-brass-400/70" /></span>
          </span>
          <p className="mt-2 max-w-md text-sm text-ink-300">
            The first place to check before you book. One clear Journey Brief, checked and dated.
          </p>
        </div>
        {/* Back to the hero's handover — never the founder-gated prototype,
            which 404s in production. */}
        <Link
          href="#your-journey"
          className="inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-brass px-6 text-sm font-semibold text-ink-900 transition-all hover:bg-brass-400"
        >
          Check my trip
          <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
        </Link>
      </div>
    </section>
  );
}
