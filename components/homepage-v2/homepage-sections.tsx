import Link from 'next/link';
import { ArrowUpRight, ArrowRight, Plane, Crown, Compass, BellRing, CalendarClock, ShieldCheck, FileCheck2, Receipt, SearchCheck, Clock3, Route } from 'lucide-react';
import { ROUTE_WATCH_INITIAL_COPY } from '@/lib/route-watch-config';

/**
 * Homepage v2 — server-rendered sections below the signature hero (protected
 * prototype). Every claim here is either verified route data or an honest
 * "not yet" — no invented fare, airline, frequency, popularity or connecting
 * alternative. No affiliate link fires from this page; the current-fare
 * hand-off lives inside the route guides these link to.
 *
 * Public-trust fix (A1/A9, August 2026): the Economy card used to link to
 * /founder/journey-brief/manchester-mumbai — a founder-only surface (see its
 * own doc comment in components/journey-brief/journey-brief-manchester-mumbai.tsx)
 * that a public visitor could never actually reach, and its copy claimed
 * JetStash itself "hands you a live-fare check", which could be read as
 * JetStash supplying live fares rather than pointing to Trip.com's own
 * current search. Both fixed: the link now goes to the real public route
 * guide for this exact featured journey (/routes/manchester-mumbai, the
 * homepage's own flagship thread — see journey-desk-home.tsx), and the copy
 * now names Trip.com's search as the current/live part.
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
          One checked route underneath all three — the difference is how you want to fly it, not how much we checked.
        </p>
        <div className="mt-9 grid gap-5 lg:grid-cols-3">
          {/* Economy — intelligence first, then the route guide's own Trip.com hand-off */}
          <article className="flex flex-col rounded-lg border border-ink-100 bg-white p-6 shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-terracotta-50 text-terracotta-600">
              <Plane className="h-5 w-5" strokeWidth={2} />
            </span>
            <h3 className="mt-4 font-display text-xl text-ink-900">Economy</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
              See the route status, service change and booking timing first. When you&apos;re ready, we hand you to a
              current Trip.com partner search — never a stale or half-built price.
            </p>
            <Link href="/routes/manchester-mumbai" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-terracotta-600">
              See the Manchester–Mumbai route guide <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
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

/* ── Why JetStash exists — the short story behind the product ── */
const DIFFERENCE_POINTS = [
  {
    icon: SearchCheck,
    title: 'Route first',
    body: 'We check whether the service, airline and route details are actually supported before a fare gets your attention.',
  },
  {
    icon: Clock3,
    title: 'Timing with context',
    body: 'Booking windows, dated fare checks and document lead times sit beside the route—not hidden behind a cheap-looking price.',
  },
  {
    icon: Route,
    title: 'Booking last',
    body: 'When the picture is clear, we point you to the next sensible step. Travel intelligence first. Booking second.',
  },
] as const;

export function WhyJetStash() {
  return (
    <section className="bg-sand-50 py-16 sm:py-24">
      <div className="mx-auto grid max-w-content gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center lg:gap-16">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-terracotta-600">The JetStash difference</span>
          <h2 className="mt-3 max-w-xl font-display text-3xl leading-[1.08] text-ink-900 sm:text-4xl">
            A fare is not the whole journey.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-600 sm:text-lg">
            A booking journey often starts with a price. JetStash starts with what you need to know before that price can make sense:
            what is running, what has changed, and what the journey actually involves.
          </p>
          <Link
            href="/routes"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 underline decoration-brass-400 decoration-2 underline-offset-4 transition-colors hover:text-terracotta-600"
          >
            See the intelligence behind a route
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
          </Link>
        </div>

        <div className="rounded-lg border border-ink-200 bg-white p-6 shadow-card sm:p-8">
          <div className="grid gap-6 sm:grid-cols-3 sm:gap-5">
            {DIFFERENCE_POINTS.map(({ icon: Icon, title, body }, index) => (
              <div key={title} className="relative">
                {index > 0 && <span className="absolute -left-2.5 top-0 hidden h-full w-px bg-ink-100 sm:block" aria-hidden="true" />}
                <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-ink-900 text-brass-300">
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-display text-xl text-ink-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-7 border-t border-ink-100 pt-5 text-sm font-semibold text-ink-900">
            Checked, dated and honest about what is not known yet.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Concise "What JetStash checks" ── */
const CHECKS: { icon: typeof Plane; title: string; body: string; href?: string; linkLabel?: string }[] = [
  { icon: Plane, title: 'Route status & airline', body: 'Whether a route runs direct, on which airline, verified from that carrier’s own source.' },
  { icon: CalendarClock, title: 'Announced service changes', body: 'Route pauses and withdrawals surfaced honestly, with the date and where we read it.' },
  { icon: ShieldCheck, title: 'Booking-window timing', body: 'When to book, traced to a real festival, fare or booking-window record. Never fake urgency.' },
  {
    icon: FileCheck2,
    title: 'Travel-ready documents',
    body: 'Passport validity and visa guidance for your trip, sourced from official government pages.',
    href: '/travel-ready-check',
    linkLabel: 'Check your travel readiness',
  },
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
                {c.href && (
                  <Link
                    href={c.href}
                    className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-brass-300 hover:text-brass-200"
                  >
                    {c.linkLabel}
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </Link>
                )}
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
