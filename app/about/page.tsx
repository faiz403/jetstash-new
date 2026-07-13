import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarCheck, ShieldCheck, Route, Scale, Ban, Mail } from 'lucide-react';
import { LinkButton } from '@/components/ui/button';
import { PageHero } from '@/components/sections/page-hero';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'About JetStash: How We Work',
  description:
    'JetStash is a UK travel platform for routes to Pakistan, India, the Gulf and Umrah. Read the editorial standards behind every fare and route claim on the site.',
  alternates: { canonical: `${siteConfig.url}/about` },
};

const standards = [
  {
    icon: CalendarCheck,
    title: 'Every fare is dated, and checked by a person',
    body: 'When you see a price on JetStash, it comes from a real fare check a member of our team logged by hand, on the date shown — never presented as a live quote. Where we\'ve checked a route more than once, we show the range we\'ve actually observed rather than a single number. Where no one\'s checked a route yet, we show real flight-time and booking-window facts instead of a price, with a link to check live prices yourself.',
  },
  {
    icon: Route,
    title: 'A route only says "Direct" once we\'ve checked, and we say when we haven\'t yet',
    body: 'A route page only claims direct service once that\'s been checked against a real airline schedule, with a source and date on record — never assumed from marketing material. Where we haven\'t completed that check yet, the page says "verification pending" rather than presenting an unconfirmed claim as settled. Where sources conflict, we model the route the conservative way and say so. When an airline withdraws a direct service, the route page says that too, with the date.',
  },
  {
    icon: ShieldCheck,
    title: 'No invented urgency, statistics or reviews',
    body: 'You will not find countdown timers, "2 seats left at this price", fabricated testimonials or made-up savings percentages anywhere on JetStash. If we can\'t trace a claim to something real, it doesn\'t ship.',
  },
  {
    icon: Ban,
    title: 'We\'d rather be incomplete than wrong',
    body: 'Some verticals you might expect, hotels, car hire, airport lounges, parking, aren\'t on the site yet. That\'s deliberate: we would rather not cover something than cover it with thin, generic placeholder content. They\'ll arrive when we can do them to the same standard as the routes.',
  },
  {
    icon: Scale,
    title: 'How we make money, plainly',
    body: 'JetStash earns a commission on some bookings made through partner links. This never changes the price you pay, and it never changes which routes we cover or what we say about them. The full detail is on our affiliate disclosure page.',
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        heroKey="about"
        eyebrow="About JetStash"
        title="The routes that matter most deserve more than a footnote."
        description="Most UK travel sites treat flights to Pakistan, India, the Gulf and Saudi Arabia as an edge case, a few pages bolted onto a site built around Spain. JetStash starts from the opposite assumption: for millions of people in the UK, these are the trips that actually matter."
      />

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Editorial standards</span>
          <h2 className="mt-2 max-w-2xl font-display text-3xl text-ink-900 sm:text-4xl">
            Honesty is the product
          </h2>
          <p className="mt-3 max-w-xl text-ink-500">
            Travel pricing is full of manufactured urgency and unverifiable claims. Our bet is the opposite:
            that being conservative and traceable, every time, is worth more to you than looking impressive.
            These are the rules the site is built on.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {standards.map((s) => (
              <div key={s.title} className="rounded-md border border-ink-100 bg-sand-50 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-white text-brass-600 shadow-card">
                  <s.icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <h3 className="mt-4 font-display text-lg leading-snug text-ink-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{s.body}</p>
              </div>
            ))}
            <div className="flex flex-col justify-between rounded-md border border-ink-100 bg-ink-900 p-6">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-white/10 text-brass-300">
                  <Mail className="h-5 w-5" strokeWidth={2} />
                </div>
                <h3 className="mt-4 font-display text-lg leading-snug text-sand-50">Spotted something wrong?</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">
                  If a fare, schedule or claim on this site doesn&apos;t hold up, we want to know. Corrections make
                  the site better for everyone.
                </p>
              </div>
              <LinkButton href="/contact" size="sm" className="mt-5 self-start">
                Tell us
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-sand-50 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">How the site is organised</h2>
              <div className="mt-5 flex flex-col gap-4 text-ink-600">
                <p className="leading-relaxed">
                  JetStash is organised around how people actually travel on these routes, family visits, Umrah,
                  business trips, holidays, rather than generic destination pages. Every airport-to-destination
                  pairing gets its own guide, with booking windows, peak-period warnings and fare history specific
                  to that route.
                </p>
                <p className="leading-relaxed">
                  The longer we track a route, the more useful its guide becomes. That&apos;s the whole model: depth
                  over breadth, on the routes generic comparison sites treat as an afterthought.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton href="/routes" variant="dark" size="md">Browse all routes</LinkButton>
                <LinkButton href="/travel-club" variant="ghost" size="md">Join Travel Club</LinkButton>
              </div>
            </div>
            <div className="rounded-md border border-ink-100 bg-white p-7">
              <h3 className="font-display text-xl text-ink-900">The small print, up front</h3>
              <ul className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
                <li>
                  Prices are indicative examples, never live quotes. Always confirm the final price with the
                  airline or operator before booking.
                </li>
                <li>
                  Visa and entry guidance is a starting point, not advice. Always confirm with the relevant
                  embassy or high commission.
                </li>
                <li>
                  Travel Club emails are curated by a person, segmented by your nearest airport and the region you
                  track, not automated price alerts.
                </li>
              </ul>
              <p className="mt-5 text-xs text-ink-400">
                Full details:{' '}
                <Link href="/affiliate-disclosure" className="underline hover:text-terracotta-600">
                  affiliate disclosure
                </Link>{' '}
                ·{' '}
                <Link href="/privacy-policy" className="underline hover:text-terracotta-600">
                  privacy policy
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
