/**
 * Traveller-facing rendering of a stored fare `priceNote`.
 *
 * The archive keeps every observation's full evidence note unchanged (that is
 * the audit trail). Several of those notes carry collection-methodology
 * wording -- "searched as an exact airport pair", "the exact badge text shown
 * on the row was not recorded on the day", "against the previous comparable
 * check of £X" -- that is useful to the operator and meaningless, or
 * confusing, to a traveller deciding what to do next.
 *
 * This is a DISPLAY-ONLY transform. It never writes to the archive, it is not
 * used by any selection, eligibility, baseline or Fare Watcher logic, and it
 * only ever shortens a note: segments that carry traveller-relevant meaning
 * are kept or restated more briefly, segments that only describe how the check
 * was collected are dropped. Anything it does not recognise is kept as written
 * (the safe default is to show more, not less).
 *
 * Added for the 10 October 2026 customer copy / consistency batch.
 */

type Rule = { test: RegExp; out: string | null };

/**
 * Evaluated per segment (notes are semicolon-separated), first match wins.
 * `out: null` drops the segment; a string replaces it with concise wording.
 */
const SEGMENT_RULES: readonly Rule[] = [
  // Collection-method descriptions (no traveller value).
  { test: /^(lowest visible|cheapest clean fare visible)\b/i, out: null },
  { test: /^fresh Google Flights\b/i, out: null },
  { test: /^Google Flights, exact\b/i, out: null },
  { test: /^Google Flights returned zero results\b/i, out: null },
  { test: /^searched as (an )?exact airport pair\b/i, out: null },
  { test: /^no separate-tickets or self-transfer notice was shown\b/i, out: null },
  { test: /^against the previous comparable check\b/i, out: null },
  { test: /^cheaper secondary option to the clean fare\b/i, out: null },
  { test: /^(the )?connecting airports? (was|were) not recorded during this check\b/i, out: null },
  { test: /^connection airport not stated in the retained result summary\b/i, out: null },
  { test: /^earlier tracked fares for this route were for itineraries landing at a different airport\b/i, out: null },
  { test: /^those earlier records are kept as history\b/i, out: null },
  { test: /^KAYAK fallback result after Google Flights\b/i, out: null },
  { test: /^used KAYAK fallback\b/i, out: null },
  { test: /^recorded factually\b/i, out: null },
  { test: /^this observation does not itself resolve\b/i, out: null },
  { test: /^excluded .* per strict exact-airport rule\b/i, out: null },
  { test: /^Google Flights' own .*(Lowest total price|itinerary-summary)/i, out: null },
  { test: /^the locked methodology requires\b/i, out: null },
  { test: /^KAYAK notes prices may not include baggage fees\b/i, out: 'baggage fees may not be included' },
  { test: /^KAYAK's own live search found\b/i, out: 'self-transfer combination' },
  { test: /^the Cheapest-tab tile price\b/i, out: null },
  { test: /^recheck came back (lower|higher) than the routine check\b/i, out: null },
  { test: /^(baggage )?overhead bin access not included \(explicit tooltip/i, out: 'overhead-bin access not included' },
  { test: /^the routine batch's Cheapest-tab tooltip explicitly warned\b/i, out: 'overhead-bin access not included' },

  // Return leg not checked: traveller-relevant, said once and briefly.
  { test: /^the return leg was not opened\b/i, out: 'return leg not checked' },
  { test: /^(the search|Google Flights) did not present a separate return-leg selection screen\b/i, out: 'return leg not checked' },
  { test: /^return-leg directness not independently confirmed\b/i, out: 'return leg not checked' },
  { test: /^return-leg directness and timing were not independently opened or confirmed\b/i, out: 'return leg not checked' },
  { test: /^return leg not reviewed\b/i, out: 'return leg not checked' },
  { test: /^return leg was never reviewed\b/i, out: 'return leg not checked' },

  // Booking structure: keep the consequence, drop the badge-capture detail.
  {
    test: /^Google Flights flags this fare as separate tickets or self-transfer\b/i,
    out: 'separate tickets: not covered by one airline ticket, so a missed connection is not protected',
  },
  { test: /^self-transfer \(Google's own 'Self transfer' label\)/i, out: 'self-transfer' },
  { test: /^self-transfer shown$/i, out: 'self-transfer' },
  { test: /^Google's own 'Separate tickets booked together' label$/i, out: 'separate tickets booked together' },
  { test: /^separate tickets booked together \(Google's own label, not a self-transfer\)$/i, out: 'separate tickets booked together' },
];

const CONNECTION_DETAIL_PREFIX = /^connection detail shown:\s*/i;
// Sentences some older notes embed inside a segment.
const EMBEDDED_METHOD_SENTENCES: readonly RegExp[] = [
  /\bFresh Google Flights search for exact [^.]*\.\s*/g,
  /\bthis is the fresh lowest eligible result\.?\s*/gi,
];

/** Concise traveller-facing version of a stored fare note. Display only; never feeds logic. */
export function toTravellerFareNote(priceNote: string): string {
  const kept: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    if (seen.has(value)) return;
    seen.add(value);
    kept.push(value);
  };
  for (const raw of priceNote.split(/;\s+/)) {
    let segment = raw.trim();
    for (const sentence of EMBEDDED_METHOD_SENTENCES) segment = segment.replace(sentence, '');
    segment = segment.trim().replace(/\.$/, '');
    if (!segment) continue;
    const rule = SEGMENT_RULES.find((candidate) => candidate.test.test(segment));
    if (rule) {
      if (rule.out !== null) push(rule.out);
      continue;
    }
    push(segment.replace(CONNECTION_DETAIL_PREFIX, 'connection: '));
  }
  // Never return an empty note for a real observation.
  return kept.length > 0 ? kept.join('; ') : 'return, per person, one adult';
}
