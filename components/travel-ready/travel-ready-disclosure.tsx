'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Route-page PR E (November 2026, CEO-approved): the Travel Ready Check is a five-field form about 1,350px tall on a phone, so on a route
 * page it sits behind a native disclosure. Nothing is removed: the heading, scope line and every field, warning and result are in the page
 * at all times (a closed <details> keeps its content in the DOM, so the form's state, the result and Book-By's connection through
 * RouteReadinessProvider are all unaffected). The summary is the check's own heading and scope line, so the section still reads and ranks as
 * before, and it is a real button for keyboard and screen-reader users (native details/summary semantics: Enter or Space toggles it and the
 * expanded state is announced).
 *
 * It opens by itself wherever the page is pointed at it: a direct URL fragment (#travel-ready) on load, a hashchange, and a click on any
 * in-page link to #travel-ready (the pointer line under the fare card and Book-By's "see the Travel Ready Check" link), including a second
 * click on the same link when the hash has not changed. It never closes by itself, and the browser's own back and forward behaviour is
 * untouched. Without JavaScript it stays closed and can still be opened with a click.
 */
export const TRAVEL_READY_HASH = '#travel-ready';

/** True for the location hash that points at the Travel Ready section. */
export function isTravelReadyHash(hash: string): boolean {
  return hash === TRAVEL_READY_HASH;
}

/** True for an in-page link to the section: "#travel-ready", or a same-page absolute or relative path ending in it. */
export function isTravelReadyHref(href: string | null | undefined): boolean {
  return typeof href === 'string' && href.endsWith(TRAVEL_READY_HASH);
}

export function TravelReadyDisclosure({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const open = () => {
      if (ref.current) ref.current.open = true;
    };
    const openIfTargeted = () => {
      if (isTravelReadyHash(window.location.hash)) open();
    };
    // Capture phase, before the browser follows the link, so the section is open when it scrolls to it.
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a');
      if (anchor && isTravelReadyHref(anchor.getAttribute('href'))) open();
    };
    openIfTargeted();
    window.addEventListener('hashchange', openIfTargeted);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('hashchange', openIfTargeted);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  return (
    <details ref={ref} className="group" data-travel-ready-disclosure="">
      <summary className="flex cursor-pointer list-none flex-col gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brass-600 focus-visible:ring-offset-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">{summary}</div>
        <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-ink-900 sm:mt-1 sm:min-h-0">
          <span className="group-open:hidden">Show the check</span>
          <span className="hidden group-open:inline">Hide the check</span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={2.25} aria-hidden="true" />
        </span>
      </summary>
      {/* The form and result already carry their own top margin. */}
      <div>{children}</div>
    </details>
  );
}
