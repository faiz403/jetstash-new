export type TravellerTipCategory = 'documents' | 'baggage' | 'money' | 'culture' | 'logistics';

export interface TravellerTipScope {
  routeSlug?: string;
  destinationSlug?: string;
  airportSlug?: string;
}

export interface TravellerTip {
  id: string;
  scope: TravellerTipScope;
  category: TravellerTipCategory;
  title: string;
  body: string;
  addedDate?: string;
}

/**
 * Editorial traveller tips, scoped to a route, destination, or airport.
 * Seeded here from real advice already stated in destination
 * familyVisitContent / route copy elsewhere in the codebase — a
 * representative subset, not a forced migration of every sentence. This is
 * curated content (like the rest of the site), not open user submission —
 * see data/community-notes.ts for the (currently empty) user-submitted
 * counterpart.
 */
export const travellerTips: TravellerTip[] = [
  {
    id: 'lahore-excess-baggage',
    scope: { destinationSlug: 'lahore' },
    category: 'baggage',
    title: 'Pre-purchase excess baggage online, not at the airport',
    body: 'Gifts and shopping for the return leg routinely exceed standard allowances on this route, so pre-purchasing extra baggage online at the time of booking is consistently cheaper than paying at the airport.',
  },
  {
    id: 'lahore-nicop',
    scope: { destinationSlug: 'lahore' },
    category: 'documents',
    title: 'NICOP holders typically skip the separate visa',
    body: 'NICOP holders (Pakistan-origin UK nationals with a National Identity Card for Overseas Pakistanis) typically do not need a separate visa. Confirm current requirements with NADRA or your nearest Pakistani consulate before booking, as policy specifics change.',
  },
  {
    id: 'islamabad-onward-travel-time',
    scope: { destinationSlug: 'islamabad' },
    category: 'logistics',
    title: 'Factor onward road travel honestly if continuing north',
    body: 'Onward journeys into Khyber Pakhtunkhwa or northern Punjab can add a full day, which affects how tight a return flight booking should be.',
  },
  {
    id: 'karachi-connection-comfort',
    scope: { destinationSlug: 'karachi' },
    category: 'logistics',
    title: 'Weigh layover comfort, not just headline fare',
    body: "Karachi's longer flight time from most UK airports (often via a connection) makes layover comfort and luggage transfer reliability worth factoring into the airline choice.",
  },
  {
    id: 'delhi-oci-evisa',
    scope: { destinationSlug: 'delhi' },
    category: 'documents',
    title: 'OCI cardholders skip the e-Visa; others should apply early',
    body: 'OCI (Overseas Citizen of India) cardholders do not require a separate visa. Other UK passport holders need the standard e-Tourist or e-Business visa: apply at least 4 days ahead, earlier still during Diwali or December.',
  },
  {
    id: 'delhi-domestic-baggage',
    scope: { destinationSlug: 'delhi' },
    category: 'baggage',
    title: 'Domestic Indian flight baggage allowances are often stricter',
    body: 'If your onward journey involves a domestic Indian flight, check the domestic baggage allowance separately from your international one. The two are frequently different, and it catches travellers out.',
  },
  {
    id: 'mumbai-baggage-allowance',
    // Scoped to the specific route, not the whole destination — the advice
    // names the Manchester direct service and would be misleading shown
    // against, say, the Heathrow–Mumbai page's different carriers.
    scope: { routeSlug: 'manchester-mumbai' },
    category: 'baggage',
    title: "Confirm the Manchester direct service's baggage allowance directly",
    body: "If flying the Manchester direct service, check the current baggage allowance directly with the airline rather than assuming it matches a full-service carrier's standard.",
  },
  {
    id: 'ahmedabad-evisa-timing',
    scope: { destinationSlug: 'ahmedabad' },
    category: 'documents',
    title: 'Book the e-Visa alongside flights, not closer to departure',
    body: 'Other UK passport holders need the standard e-Visa, applied for at least 4 days ahead. Book it alongside flights rather than leaving it until closer to departure, especially around Navratri and Diwali.',
  },
  {
    // Split per-route rather than scoped to the whole destination — this is
    // specifically about the two DIRECT Amritsar services (Birmingham,
    // Gatwick). Leeds Bradford and Manchester have no direct Amritsar
    // service at all, so a "confirm the non-stop flight day" tip would
    // directly contradict those routes' own "no direct service" copy.
    id: 'birmingham-amritsar-reduced-frequency',
    scope: { routeSlug: 'birmingham-amritsar' },
    category: 'logistics',
    title: 'Confirm the specific flight day before assuming a non-stop exists',
    body: "Air India's direct Amritsar services run at reduced midweek frequency rather than daily. Confirm specific flight days before assuming a non-stop option exists on your preferred date.",
  },
  {
    id: 'gatwick-amritsar-reduced-frequency',
    scope: { routeSlug: 'london-gatwick-amritsar' },
    category: 'logistics',
    title: 'Confirm the specific flight day before assuming a non-stop exists',
    body: "Air India's direct Amritsar services run at reduced midweek frequency rather than daily. Confirm specific flight days before assuming a non-stop option exists on your preferred date.",
  },
];

export function getTipsForScope(scope: TravellerTipScope) {
  return travellerTips.filter(
    (t) =>
      (scope.routeSlug !== undefined && t.scope.routeSlug === scope.routeSlug) ||
      (scope.destinationSlug !== undefined && t.scope.destinationSlug === scope.destinationSlug) ||
      (scope.airportSlug !== undefined && t.scope.airportSlug === scope.airportSlug)
  );
}
