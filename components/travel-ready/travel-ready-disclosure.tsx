'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Route-page PR E (November 2026, CEO-approved): the Travel Ready Check is a five-field form about 1,350px tall on a phone, so on a route
 * page it sits behind a native disclosure. Nothing is removed: the heading, scope line and every field, warning and result are in the page
 * at all times (a closed <details> keeps its content in the DOM, so the form's state, the result and Book-By's connection through
 * RouteReadinessProvider are all unaffected). The summary is the check's own heading and scope line, so the section still reads and ranks as
 * before, and it is a real button for keyboard and screen-reader users (native details/summary semantics: Enter or Space toggles it and the
 * expanded state is announced). Its content is phrasing content plus the h2, as the HTML content model for <summary> requires.
 *
 * It opens by itself wherever the page is pointed at it: a direct URL fragment (#travel-ready) on load, a hashchange, and a plain click on any
 * in-page link to #travel-ready (the pointer line under the fare card and Book-By's "see the Travel Ready Check" link), including a second
 * click on the same link when the hash has not changed. A link to the same fragment on ANOTHER page, an external link and a modified click
 * (new tab, new window, download) never open it. It never closes by itself, and the browser's own back and forward behaviour is untouched.
 * Without JavaScript it stays closed and can still be opened with a click.
 */
export const TRAVEL_READY_HASH = '#travel-ready';

/** True for the location hash that points at the Travel Ready section. */
export function isTravelReadyHash(hash: string): boolean {
  return hash === TRAVEL_READY_HASH;
}

/**
 * True only for a link to this section ON THE CURRENT PAGE: "#travel-ready", or an absolute or relative URL with the same origin, path and
 * query as `currentHref` whose fragment is #travel-ready. "/another-page#travel-ready" and "https://example.org/#travel-ready" are false.
 */
export function isTravelReadyHref(href: string | null | undefined, currentHref: string): boolean {
  if (typeof href !== 'string' || href === '') return false;
  try {
    const target = new URL(href, currentHref);
    const here = new URL(currentHref);
    return target.hash === TRAVEL_READY_HASH && target.origin === here.origin && target.pathname === here.pathname && target.search === here.search;
  } catch {
    return false;
  }
}

/** The minimal shapes the opener needs, so its behaviour can be executed in a test without a DOM. */
export interface DisclosureLike {
  open: boolean;
}
export interface ClickEventLike {
  button?: number;
  defaultPrevented?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  target: { closest?: (selector: string) => { getAttribute: (name: string) => string | null } | null } | null;
}
export interface OpenerWindowLike {
  location: { hash: string; href: string };
  addEventListener: (type: 'hashchange', listener: () => void) => void;
  removeEventListener: (type: 'hashchange', listener: () => void) => void;
}
export interface OpenerDocumentLike {
  addEventListener: (type: 'click', listener: (event: ClickEventLike) => void, capture: boolean) => void;
  removeEventListener: (type: 'click', listener: (event: ClickEventLike) => void, capture: boolean) => void;
}

/** Wires the three ways the section is opened and returns the cleanup. It only ever sets `open` to true. */
export function attachTravelReadyOpeners(getDetails: () => DisclosureLike | null, win: OpenerWindowLike, doc: OpenerDocumentLike): () => void {
  const open = () => {
    const details = getDetails();
    if (details) details.open = true;
  };
  const openIfTargeted = () => {
    if (isTravelReadyHash(win.location.hash)) open();
  };
  // Capture phase, before the browser follows the link, so the section is open when it scrolls to it.
  const onClick = (event: ClickEventLike) => {
    if (event.defaultPrevented || (event.button !== undefined && event.button !== 0)) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; // new tab, new window, download: leave this page alone
    const anchor = event.target?.closest?.('a');
    if (anchor && isTravelReadyHref(anchor.getAttribute('href'), win.location.href)) open();
  };
  openIfTargeted();
  win.addEventListener('hashchange', openIfTargeted);
  doc.addEventListener('click', onClick, true);
  return () => {
    win.removeEventListener('hashchange', openIfTargeted);
    doc.removeEventListener('click', onClick, true);
  };
}

export function TravelReadyDisclosure({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(
    () =>
      attachTravelReadyOpeners(
        () => ref.current,
        window as unknown as OpenerWindowLike,
        document as unknown as OpenerDocumentLike
      ),
    []
  );

  return (
    <details ref={ref} className="group" data-travel-ready-disclosure="">
      <summary className="flex cursor-pointer list-none flex-col gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brass-600 focus-visible:ring-offset-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 [&::-webkit-details-marker]:hidden">
        <span className="block min-w-0">{summary}</span>
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
