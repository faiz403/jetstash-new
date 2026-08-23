import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { formatChecked } from '@/data/deals';

/**
 * Business Class route-vs-fare clarity panel — SEO Domination Batch 1B (23
 * Aug 2026). Renders next to a route's own Business Deal card: a
 * "Route service" / "Tracked Business fare" pair (same visual language as
 * FareSignal's existing RouteVsFareCallout — components/route/fare-signal.tsx
 * — reused deliberately rather than inventing a second treatment for the
 * same underlying idea), plus a visible on-page FAQ answering the exact
 * question this content exists for.
 *
 * Deliberately no FAQPage JSON-LD here: the site has no existing
 * FAQ/structured-data component to reuse (checked before writing this —
 * see components/seo/json-ld.tsx, which already documents why a
 * Product/Offer schema was deliberately skipped for the same staleness
 * reason), and inventing one solely to chase a rich result is exactly the
 * kind of scope this batch was told to avoid. The FAQ content is fully
 * visible to every visitor either way.
 *
 * The route-service half (`clarity`) is static, hand-authored data/routes.ts
 * content. The price and checked-date half is NEVER passed in as static
 * text — `fareRange` comes from the caller's own live
 * getFareRangeSummary(route.slug, 'Business', nowIso) call, the same
 * source DealCard/FareSignal already use, so this panel can never show a
 * stale or invented price. If the caller has no current Business fare
 * range, it must not render this component at all rather than pass a
 * fabricated one.
 */
export interface BusinessClarityData {
  /** e.g. "PIA operates Manchester–Lahore direct (confirmed via Manchester Airport's own announcement, re-verified 14 August 2026)." */
  routeServiceSummary: string;
  /** Itinerary shape only, no price — e.g. "a self-transfer itinerary across five other airlines, with three stops each way". */
  trackedFareShape: string;
  faqQuestion: string;
  /** Answers only the route-service half of faqQuestion; the fare half is appended here from the live fareRange. */
  faqRouteServiceAnswer: string;
}

export function BusinessClarityPanel({
  clarity,
  fareRange,
}: {
  clarity: BusinessClarityData;
  fareRange: { min: number; latestDate: string };
}) {
  const fareDescription = `£${fareRange.min.toLocaleString('en-GB')}, checked ${formatChecked(fareRange.latestDate)} — ${clarity.trackedFareShape}`;

  return (
    <div className="mt-8 rounded-md border border-terracotta-200 bg-white p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-terracotta-600">Route service</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{clarity.routeServiceSummary}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-terracotta-600">Tracked Business fare</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{fareDescription}.</p>
        </div>
      </div>
      <div className="mt-5 border-t border-ink-100 pt-5">
        <p className="text-sm font-semibold text-ink-900">{clarity.faqQuestion}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
          {clarity.faqRouteServiceAnswer} Separately, the Business Class fare JetStash currently tracks ({fareDescription}) is not that direct service.
        </p>
        {/* Internal-link work (SEO Domination Batch 1B, §8): this is the one
            place on a route page where a link to /business-class is
            genuinely contextual — right after the route-vs-fare comparison
            this panel exists to make, not a keyword-driven link bolted on
            elsewhere. */}
        <Link
          href="/business-class"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-terracotta-700 transition-colors hover:text-terracotta-800"
        >
          See all Business Class routes and tracked fares
          <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} />
        </Link>
      </div>
    </div>
  );
}
