import Link from 'next/link';
import { AlertTriangle, ArrowRight, Plane } from 'lucide-react';
import { formatChecked } from '@/data/deals';
import { formatRouting } from '@/components/route/fare-signal';
import { SELF_TRANSFER_LABEL } from '@/lib/fare-self-transfer';
import type { HomepageEvidenceExample } from '@/lib/homepage-evidence';

/**
 * One compact, genuinely evidenced example of what a JetStash check shows
 * (Stage 2, 23 Oct 2026). Selection and eligibility live in
 * lib/homepage-evidence.ts; this component only renders what it is given and
 * invents nothing: the fare, airline, dates, routing, self-transfer flag and
 * journey consequences are the Fare Signal's own fields, and the route finding
 * is the canonical Route Status headline.
 *
 * Always states that a fare is a dated observation, never today's price, and
 * keeps the "connecting fare, not nonstop" distinction beside the price when
 * the route itself is direct. Placed beside the journey console on wide
 * screens and below it on smaller ones; the console stays the primary action.
 */
export function HomepageEvidenceCard({ example }: { example: HomepageEvidenceExample }) {
  const { route } = example;
  const fare = example.kind === 'fare' ? example.fare : null;
  const routing = fare ? formatRouting(fare) : null;

  return (
    <aside
      aria-label="An example of what a JetStash check shows"
      className="mt-6 rounded-lg border border-white/10 bg-ink-900/70 p-5 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.65)] backdrop-blur-md sm:p-6 xl:absolute xl:bottom-0 xl:right-0 xl:mt-0 xl:w-[24rem]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brass-200">An example check</p>
      <p className="mt-2 font-display text-xl text-sand-50">
        {route.originName} → {route.destinationCity}
      </p>
      <p className="mt-1 text-sm text-ink-200">
        {route.routeStatusHeadline}
        {route.routeIsDirect && route.verifiedDate ? ` · service checked ${formatChecked(route.verifiedDate)}` : ''}
      </p>

      {example.kind === 'fare' ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">Last fare we saw</p>
          <p className="mt-1 font-display text-3xl text-brass-300">£{example.fare.price.toLocaleString('en-GB')} return</p>
          {example.connectingFareOnDirectRoute ? (
            <p className="mt-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-terracotta-300/50 bg-terracotta-900/40 px-2.5 py-1 text-xs font-semibold text-terracotta-100">
                <Plane className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                Connecting fare, not nonstop
              </span>
            </p>
          ) : null}
          <p className="mt-2 text-sm text-sand-50">
            {example.fare.airline} · {example.fare.cabin} · checked {formatChecked(example.fare.observedDate)}
          </p>
          <p className="mt-1 text-sm text-ink-200">
            Travel dates: {formatChecked(example.fare.departureDate)} – {formatChecked(example.fare.returnDate)}
          </p>
          {routing ? <p className="mt-1 text-sm text-ink-200">{routing}</p> : null}
          {example.fare.isSelfTransfer ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-terracotta-200">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
              {SELF_TRANSFER_LABEL}
            </p>
          ) : null}
          {example.fare.journeyConsequences.length > 0 ? (
            <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-terracotta-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
              <span>{example.fare.journeyConsequences.join(' · ')}</span>
            </p>
          ) : null}
          <p className="mt-3 text-xs leading-relaxed text-ink-300">
            A dated observation, not today&apos;s price. Check the current fare with a booking provider.
          </p>
        </div>
      ) : null}

      <Link
        href={`/routes/${route.slug}`}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brass-300 underline decoration-brass-300/40 underline-offset-4 hover:text-brass-200"
      >
        Open the full route check
        <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
      </Link>
    </aside>
  );
}
