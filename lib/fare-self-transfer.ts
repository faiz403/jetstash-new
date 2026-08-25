/**
 * Self-transfer / separate-ticket evidence predicate (25 Aug 2026,
 * founder-approved, narrow customer-trust fix).
 *
 * Several fares in the 25 August 2026 controlled weekly batch are
 * materially cheaper because they are explicitly self-transfer or
 * separate-ticket itineraries -- the traveller, not an airline alliance,
 * is responsible for making the connection and re-checking baggage. A
 * plain Fare Signal could otherwise make one of these look equivalent to
 * an ordinary, protected connecting journey. This is a presentation
 * problem, not a data or Fare Watcher problem: the evidence is already
 * recorded, correctly, inside the observation's own `priceNote` -- it
 * just isn't surfaced anywhere prominent.
 *
 * This predicate is deliberately the ONE place that reads that evidence.
 * It is conservative by construction:
 *
 *   - It reads only `priceNote` -- the field this evidence is actually
 *     recorded in today. It never infers self-transfer from airline
 *     count, stop count, airport changes or price alone (see
 *     data/fare-observations.ts's own note on the 25 Aug batch: "Do not
 *     infer self-transfer from multiple airlines / number of stops /
 *     route-level editorial wording / a cheap price / airport changes
 *     alone").
 *   - Negation is checked BEFORE the positive match, and wins. Several
 *     existing observations explicitly record the ABSENCE of self-transfer
 *     ("no self-transfer notice", "NOT self-transfer, single itinerary",
 *     "single carrier, single booking, no self-transfer or
 *     separate-ticket notice shown") -- every one of those strings
 *     contains the literal substring "self-transfer", so a naive
 *     positive-only regex would mislabel them. Checking negation first
 *     is what keeps this predicate honest.
 *   - No structured `isSelfTransfer` field exists on `FareObservation`
 *     (the data model was intentionally not touched by this fix -- see
 *     the PR that added this file). A regex over recorded prose is the
 *     narrowest safe implementation until/unless a structured field is
 *     added later.
 */

export const SELF_TRANSFER_LABEL = 'Self-transfer itinerary';

const NEGATION_PATTERNS: RegExp[] = [
  /\bno\s+self-transfer\b/i,
  /\bnot\s+self-transfer\b/i,
  /\bno\s+separate[- ]tickets?\b/i,
  /\bnot\s+separate[- ]tickets?\b/i,
];

const POSITIVE_PATTERNS: RegExp[] = [
  /\bself-transfer\b/i,
  /\bseparate[- ]tickets?\b/i,
];

/**
 * True only when `priceNote` contains explicit, unnegated self-transfer or
 * separate-ticket wording. Missing/empty text returns false -- absence of
 * evidence is never treated as evidence of a self-transfer itinerary.
 */
export function isSelfTransferItinerary(priceNote: string | null | undefined): boolean {
  if (!priceNote) return false;
  if (NEGATION_PATTERNS.some((pattern) => pattern.test(priceNote))) return false;
  return POSITIVE_PATTERNS.some((pattern) => pattern.test(priceNote));
}
