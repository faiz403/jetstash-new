import type { FareObservation } from '@/data/fare-observations';
import { isSelfTransferItinerary } from '@/lib/fare-self-transfer';

/**
 * Fare Signal / Book-By poor-itinerary suppression (31 Aug 2026, Users 3 & 4
 * real-user validation). Selection previously optimised purely for
 * recency/price with no itinerary-suitability check at all — a
 * self-transfer, multi-stop itinerary could win simply by being the newest
 * same-day recheck, regardless of how operationally unreasonable it is for
 * a normal traveller to consider (confirmed live: Manchester-Lahore's £547
 * and Birmingham-Amritsar's £591 "Frankenstein" itineraries, both
 * explicitly flagged by real testers as reducing trust in JetStash's fare
 * numbers).
 *
 * Deliberately the smallest possible, non-arbitrary gate: no invented
 * duration threshold, no airline-coherence rule, no new suitability score
 * — just the one signature the read-only Fare Signal audit found common to
 * every confirmed-poor case and to none of the confirmed-fine ones:
 * self-transfer AND 2+ stops on at least one leg. Self-transfer detection
 * (isSelfTransferItinerary) is itself already conservative — true only
 * when the observation's own priceNote explicitly, unambiguously records a
 * self-transfer or separate-ticket itinerary, never inferred from stop or
 * airline count — so this never fires on stop count alone.
 *
 * Suppression only, never a fallback: known-bad fails closed to "no
 * current fare" rather than fishing backwards through the archive for an
 * older observation, which could itself be stale, incomplete, or
 * genuinely no better. An observation with missing
 * outboundStops/returnStops/self-transfer evidence is UNKNOWN quality,
 * never silently treated as safe by this check — it simply can't match
 * this rule's condition, so it passes through unaffected exactly as
 * before; that is a known gap in the archive's evidence, not a claim this
 * gate certifies those observations as representative.
 *
 * PR #232 decisive-duration correction (5 Sept 2026): extracted out of
 * lib/fare-signal.ts into this dependency-free module (only
 * lib/fare-self-transfer.ts and the FareObservation type) so
 * lib/journey-consequence.ts can reuse this SAME canonical rule to decide
 * when a leg's known duration is worth surfacing on a poor-itinerary
 * observation (e.g. Manchester-Lahore's £3,051 Business fare) — without
 * creating a circular import (lib/fare-signal.ts already imports FROM
 * lib/journey-consequence.ts, so the reverse import would have cycled back
 * through it). lib/fare-signal.ts re-exports this function so every
 * existing import site is unaffected; this is the one and only
 * definition, never duplicated or re-derived.
 */
export function isPoorItinerarySuitability(o: Pick<FareObservation, 'priceNote' | 'outboundStops' | 'returnStops'>): boolean {
  return isSelfTransferItinerary(o.priceNote) && ((o.outboundStops ?? 0) >= 2 || (o.returnStops ?? 0) >= 2);
}
