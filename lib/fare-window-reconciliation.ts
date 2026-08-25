/**
 * Fare travel-window reconciliation (Route Page Simplification Phase 1,
 * 25 Aug 2026).
 *
 * The Route Page Decision-First & Density audit's single P0 finding: on
 * manchester-islamabad the page tells four price stories that never
 * reconcile. As of the 25 Aug 2026 controlled weekly batch, Fare Signal
 * renders £460 (Riyadh Air) for travel 20 October–3 November; Journey
 * Choice renders £601/£621/£626 for travel 6–20 October. Those are
 * DIFFERENT TRIPS. Both blocks already print their own dates honestly, but
 * they sit ~4,500px apart at different type sizes with no cross-reference,
 * so a normal traveller reads the second set of numbers as a correction of
 * the first. The evidence was complete; the reconciliation was absent.
 * (These example figures move as fare-coverage batches log new checks —
 * this module derives from whatever dates the two blocks currently hold,
 * never from a fixed example; see the fail-closed rules below.)
 *
 * This module adds exactly that reconciliation and nothing else. It is:
 *
 *   - Purely derived. Both windows are values the two components already
 *     hold and already render (FareSignalObservation.departureDate/
 *     returnDate; JourneyChoiceOption.departureDate/returnDate). No new
 *     data file, no new observation, no new claim about either fare.
 *   - Fail-closed on absence. If either window is missing, it returns null
 *     — silence, never a guess about what the second block covers.
 *   - Fail-closed on sameness. If the two windows are identical, the two
 *     fares ARE for the same trip and there is nothing to reconcile, so it
 *     returns null and the route gains zero extra density. This is the
 *     common case: it must never fire "just in case".
 *
 * Deliberately knows nothing about prices, airlines, routing, cabins or
 * comparability. It never says one fare is better, cheaper or more
 * current than the other — only that they cover different travel dates and
 * therefore are not directly comparable. Journey Choice's own derivation
 * (lib/journey-choice.ts), its evidence drawer, its dated Trip.com handoff
 * and its measurement instrumentation are all untouched by this: it reads
 * two already-public date strings and writes one sentence.
 */

export interface FareTravelWindow {
  /** ISO yyyy-mm-dd. */
  departureDate: string;
  /** ISO yyyy-mm-dd. */
  returnDate: string;
}

/**
 * Matches components/route/journey-choice.tsx's own formatDate() exactly, so
 * the reconciliation sentence names each window in the same words the block
 * it describes uses (e.g. "6 October 2026"), never a second date format.
 */
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

function formatWindow(window: FareTravelWindow): string {
  return `${formatDate(window.departureDate)} to ${formatDate(window.returnDate)}`;
}

function sameWindow(a: FareTravelWindow, b: FareTravelWindow): boolean {
  return a.departureDate === b.departureDate && a.returnDate === b.returnDate;
}

function isUsableWindow(window: FareTravelWindow | null | undefined): window is FareTravelWindow {
  return Boolean(window && window.departureDate && window.returnDate);
}

export interface FareWindowReconciliation {
  /** The window the earlier fare block on the page covers (Fare Signal). */
  firstWindowLabel: string;
  /** The window the later fare block covers (Journey Choice). */
  secondWindowLabel: string;
  sentence: string;
}

/**
 * Returns the reconciliation for two fare blocks rendered on the same page,
 * or null when there is nothing honest to reconcile.
 *
 * @param firstBlockWindow  travel window of the fare block rendered FIRST
 *                          (higher up the page — Fare Signal today)
 * @param secondBlockWindow travel window of the fare block rendered SECOND
 *                          (Journey Choice today)
 */
export function deriveFareWindowReconciliation(
  firstBlockWindow: FareTravelWindow | null | undefined,
  secondBlockWindow: FareTravelWindow | null | undefined
): FareWindowReconciliation | null {
  if (!isUsableWindow(firstBlockWindow) || !isUsableWindow(secondBlockWindow)) return null;
  if (sameWindow(firstBlockWindow, secondBlockWindow)) return null;

  const firstWindowLabel = formatWindow(firstBlockWindow);
  const secondWindowLabel = formatWindow(secondBlockWindow);
  return {
    firstWindowLabel,
    secondWindowLabel,
    sentence:
      `These are two different trips. The Fare Signal higher up this page tracks travel ${firstWindowLabel}; `
      + `the options below are for travel ${secondWindowLabel}. Fares for different travel dates are not directly comparable.`,
  };
}
