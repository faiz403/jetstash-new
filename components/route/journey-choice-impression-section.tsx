'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { track } from '@/lib/analytics';

/**
 * Journey Choice measurement instrumentation (24 Aug 2026, one-time
 * founder-approved exception to the Journey Choice freeze — measurement
 * only, no product/UI change). Replaces the plain `<section>` wrapper that
 * used to open components/route/journey-choice.tsx's return with this same
 * element (identical `aria-labelledby`, identical `className`, identical
 * children) plus a ref and an IntersectionObserver — zero visual change,
 * the only addition is when 'journey_choice_impression' fires.
 *
 * Answers a different question from a page view: /routes/manchester-islamabad
 * loading proves nothing about whether the visitor actually scrolled far
 * enough to see Journey Choice, which renders well down the page (after the
 * hero, Fare Signal, Book-By and Travel Ready Check). This fires only once
 * the section itself has genuinely entered the viewport.
 *
 * Threshold: 0.25 (25% of the section's own bounding box visible), not the
 * default near-zero threshold IntersectionObserver would otherwise use.
 * Journey Choice's section is routinely taller than a mobile viewport —
 * decision sentence, two option cards, a secondary option, the route
 * service note, the baggage line, the CTA and the evidence disclosure all
 * stack inside it — and IntersectionObserver's ratio is computed against
 * the TARGET's own full height, not the viewport's. Requiring 50%+
 * visibility risks the event never firing on a 390px phone even after a
 * visitor has genuinely scrolled through and read the section. 25% is high
 * enough to rule out a one-pixel scroll-past sliver at the very top or
 * bottom edge, and low enough to reliably fire once a meaningful, roughly
 * one-mobile-screen portion of the section is in view — on both mobile and
 * desktop, where the section is usually shorter than the viewport and 25%
 * visibility is reached almost as soon as any of it is on screen.
 *
 * Fires at most once per mount, via two deliberately non-redundant
 * mechanisms: `firedRef` guards against the callback running again before
 * `disconnect()` takes effect (disconnect is not synchronous relative to
 * the callback's own execution), and `observer.disconnect()` itself stops
 * any further observation immediately, so scrolling away and back into
 * view never fires a second event.
 */
export function JourneyChoiceImpressionSection({
  routeSlug,
  children,
}: {
  routeSlug: string;
  children: ReactNode;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            firedRef.current = true;
            track('journey_choice_impression', { route: routeSlug, source: 'journey-choice' });
            observer.disconnect();
          }
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [routeSlug]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="journey-choice-heading"
      className="rounded-md border border-ink-200 bg-white p-5 sm:p-7"
    >
      {children}
    </section>
  );
}
