/**
 * Network Evidence — answers exactly one question: "is this destination
 * genuinely reachable from this UK airport?" It is deliberately separate
 * from the Route Status ledger (data/routes.ts), which answers a different
 * question — "how much has JetStash independently researched about this
 * specific route?" A destination can have strong network evidence and zero
 * route intelligence at the same time; this file must never inherit or
 * imply a Route Status confidence level, and data/routes.ts must never be
 * used as a substitute for this file.
 *
 * Source discipline: every record below comes from a primary source
 * actually opened and read — never a destinations.ts/airports.ts internal
 * claim, never a deals.ts curation entry, never a search-result snippet,
 * never an affiliate booking result, never an inferred or remembered
 * route. Where only Manchester Airport's own destination-guide page (a
 * Tier-1 source) could be reached — every commercial airline site
 * attempted was blocked by bot-detection, a JS-only shell, or repeated
 * timeouts — the record says so plainly rather than naming an unconfirmed
 * airline or an unconfirmed direct/connecting status.
 *
 * Audited 2026-07-25, Manchester departures only. Casablanca and Tangier
 * were investigated and excluded: neither has any Manchester claim in any
 * source, official or otherwise (both are London-only).
 */

export type NetworkMembership = 'supported' | 'seasonal' | 'not-supported';

export interface NetworkEvidenceRecord {
  destinationSlug: string;
  departureAirportSlug: string;
  membership: NetworkMembership;
  /** What was actually read, not an inferred or remembered claim. */
  evidenceSource: string;
  sourceUrl: string;
  dateVerified: string;
}

export const networkEvidenceRecords: NetworkEvidenceRecord[] = [
  {
    destinationSlug: 'istanbul',
    departureAirportSlug: 'manchester',
    membership: 'supported',
    evidenceSource: 'Manchester Airport, "Flights to Istanbul" destination guide — states a scheduled flight time (4h 30m); names no airline, no seasonality',
    sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/istanbul/',
    dateVerified: '2026-07-25',
  },
  {
    destinationSlug: 'antalya',
    departureAirportSlug: 'manchester',
    membership: 'supported',
    evidenceSource: 'Manchester Airport, "Flights to Antalya" destination guide — states a scheduled flight time (4h 45m); also appears in MAG\'s "Destinations & Guides" hub featured list',
    sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/antalya/',
    dateVerified: '2026-07-25',
  },
  {
    destinationSlug: 'dalaman',
    departureAirportSlug: 'manchester',
    membership: 'supported',
    evidenceSource: 'Manchester Airport, "Flights to Dalaman" destination guide — states a scheduled flight time (4h 30m); no seasonality stated',
    sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/dalaman/',
    dateVerified: '2026-07-25',
  },
  {
    destinationSlug: 'bodrum',
    departureAirportSlug: 'manchester',
    // The one destination in this set with an explicit, primary-sourced
    // seasonal statement — every other 'supported' record below has no
    // seasonality claim either way, which is why they are NOT marked
    // seasonal (never inferred, per the no-fabrication rule).
    membership: 'seasonal',
    evidenceSource: 'Manchester Airport, "Flights to Bodrum" destination guide — states explicitly: "flights to this destination are offered in summer only"',
    sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/bodrum/',
    dateVerified: '2026-07-25',
  },
  {
    destinationSlug: 'izmir',
    departureAirportSlug: 'manchester',
    membership: 'supported',
    evidenceSource: 'Manchester Airport, "Flights to Izmir" destination guide — states a scheduled flight time (4h 20m); no seasonality stated on this page (data/destinations.ts\' own description separately suggests seasonal service, but that claim is unsourced and is not relied on here)',
    sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/izmir/',
    dateVerified: '2026-07-25',
  },
  {
    destinationSlug: 'marrakech',
    departureAirportSlug: 'manchester',
    membership: 'supported',
    evidenceSource: 'Manchester Airport, "Flights to Marrakesh" destination guide — states a scheduled flight time (4h); no seasonality stated',
    sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/marrakesh/',
    dateVerified: '2026-07-25',
  },
  {
    destinationSlug: 'agadir',
    departureAirportSlug: 'manchester',
    membership: 'supported',
    evidenceSource: 'Manchester Airport, "Flights to Agadir" destination guide — states a scheduled flight time (3h 55m); no seasonality stated',
    sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/agadir/',
    dateVerified: '2026-07-25',
  },
  {
    destinationSlug: 'barcelona',
    departureAirportSlug: 'manchester',
    // The only destination in this set corroborated by a second, working
    // primary source — Vueling's own Barcelona→Manchester page, showing a
    // live price table spanning 2026-2027 (consistent with broad rather
    // than narrowly seasonal availability, though it never uses the words
    // "year-round"). Still no confirmation of direct-vs-connecting.
    membership: 'supported',
    evidenceSource: 'Manchester Airport, "Flights to Barcelona" destination guide (flight time 2h 30m), corroborated by Vueling\'s own "Flights from Barcelona to Manchester" page (flight duration 2:15h, live pricing shown across 2026-2027)',
    sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/barcelona/',
    dateVerified: '2026-07-25',
  },
  {
    destinationSlug: 'faro',
    departureAirportSlug: 'manchester',
    membership: 'supported',
    evidenceSource: 'Manchester Airport, "Flights to Faro" destination guide — states a scheduled flight time (3h); no seasonality stated. Note: data/airports.ts lists Faro under Birmingham\'s highlights, not Manchester\'s — that internal inconsistency remains unresolved and does not override this primary source',
    sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/faro/',
    dateVerified: '2026-07-25',
  },
  {
    destinationSlug: 'athens',
    departureAirportSlug: 'manchester',
    membership: 'supported',
    evidenceSource: 'Manchester Airport, "Flights to Athens" destination guide — states a scheduled flight time (3h 50m); no seasonality stated',
    sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/athens/',
    dateVerified: '2026-07-25',
  },
  {
    destinationSlug: 'rome',
    departureAirportSlug: 'manchester',
    membership: 'supported',
    evidenceSource: 'Manchester Airport, "Flights to Rome" destination guide — states a scheduled flight time (2h 45m); no seasonality stated',
    sourceUrl: 'https://www.manchesterairport.co.uk/destinations-and-guides/rome/',
    dateVerified: '2026-07-25',
  },
];

export function getNetworkEvidence(destinationSlug: string, departureAirportSlug: string): NetworkEvidenceRecord | undefined {
  return networkEvidenceRecords.find(
    (r) => r.destinationSlug === destinationSlug && r.departureAirportSlug === departureAirportSlug
  );
}
