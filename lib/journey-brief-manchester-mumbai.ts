import type { TravelReadySignal } from '@/lib/travel-intelligence-engine';

/**
 * Gate 2 prototype — Manchester → Mumbai Journey Brief, decision logic only.
 *
 * Deliberately does NOT call lib/booking-intelligence.ts or
 * lib/travel-intelligence-engine.ts. The Gate 1 Book-By audit found this
 * route has no booking-window, no fare observation and no route-warning
 * coverage, and that neither engine file reads `directServiceEndDate` at
 * all — so borrowing that machinery here would make an evidence-poor route
 * look engine-verified. Everything below is scoped to this one prototype
 * and stays out of the shared engine until the founder decides otherwise.
 *
 * The evidence bundle mirrors the founder-accepted chain from this
 * session's Truth Reset conversation (IndiGo's own 4 Feb 2026 schedule
 * release plus Norse Atlantic ASA's 2 Jun 2026 Euronext disclosure) — it is
 * NOT written into data/routes.ts, since that would extend the shared
 * per-route verification model on the strength of a single prototype
 * rather than a reviewed data-model change.
 */

export const WITHDRAWAL_BOUNDARY_DATE = '2026-08-31';

export type DateBoundaryState = 'before' | 'boundary' | 'after';

/** Pure date-string comparison — ISO dates sort correctly as strings. */
export function getDateBoundaryState(travelDateIso: string): DateBoundaryState {
  if (travelDateIso < WITHDRAWAL_BOUNDARY_DATE) return 'before';
  if (travelDateIso === WITHDRAWAL_BOUNDARY_DATE) return 'boundary';
  return 'after';
}

export const BOUNDARY_STATE_COPY: Record<DateBoundaryState, { label: string; headline: string; body: string }> = {
  before: {
    label: 'Before the announced change',
    // Deliberately does NOT say "a direct service is confirmed/on record for
    // this date" as a headline — exact-date operation was never verified,
    // only the general route. The headline must carry the same caveat the
    // body does, not a stronger claim than it.
    headline: 'Exact-date operation has not been confirmed.',
    body: "Your travel date falls before IndiGo's announced 31 August 2026 change. A direct service is on record, but JetStash has not confirmed operation on your exact date. Check directly with IndiGo before booking.",
  },
  boundary: {
    label: 'On the boundary date',
    headline: "This is the date itself — JetStash can't call it either way.",
    body: "Your travel date falls on the date IndiGo has named for this change. JetStash cannot confirm whether this specific date operates as a direct service. Check directly with IndiGo before booking.",
  },
  after: {
    label: 'After the announced change',
    headline: "The direct service isn't presented as available for this date.",
    body: "Your travel date falls after the date IndiGo named for discontinuing this direct service. JetStash has not yet verified the best alternative for these dates. Check current flight options before booking.",
  },
};

export const EVIDENCE_BUNDLE = {
  route: {
    airportSlug: 'manchester',
    destinationSlug: 'mumbai',
    airline: 'IndiGo',
    flightNumbers: '6E0031 / 6E0032',
    scheduleSnapshotDate: '2026-02-04',
    scheduleSnapshotNote: 'Operating days per IndiGo’s 4 Feb 2026 schedule release — not reconfirmed since.',
  },
  primarySource: {
    organisation: 'IndiGo',
    title: 'IndiGo Adjusts Wide-body Network to Enhance Operational Resilience and Schedule Reliability',
    url: 'https://www.goindigo.in/press-releases/indigo-adjusts-wide-body-network-to-enhance-operational-resilience-and-schedule-reliability.html',
    publicationDate: '2026-02-04',
    accessedDate: '2026-07-13',
  },
  corroboratingSource: {
    organisation: 'Norse Atlantic ASA (via Euronext company-news)',
    title: 'Norse Atlantic ASA: IndiGo ACMI operations – redelivery of one aircraft',
    url: 'https://live.euronext.com/en/products/equities/company-news/2026-06-02-norse-atlantic-asa-indigo-acmi-operations-redelivery-one',
    publicationDate: '2026-06-02',
    accessedDate: '2026-07-14',
  },
  characterisation: '“Temporary” is IndiGo’s own characterisation, quoted directly in the Norse Atlantic disclosure — no resumption date has been given.',
  nextReviewDate: '2026-08-14',
  boundaryReviewDate: '2026-08-31',
} as const;

export const BOOK_BY_UNAVAILABLE_COPY = {
  headline: 'Route-specific booking timing is not available yet for this journey.',
  actions: [
    'Check current flight options directly with the airline.',
    'Confirm exact-date operation before booking, especially for dates from 31 August 2026 onward.',
    'Use Route Watch to be told when this is reviewed again.',
    `Return after JetStash's next scheduled evidence review (${new Date(`${EVIDENCE_BUNDLE.nextReviewDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}).`,
  ],
} as const;

export const ECONOMY_COPY = {
  headline: 'No fare checks logged yet for this route.',
  body: 'JetStash has not logged a complete, dated fare observation for Manchester to Mumbai. Rather than show an estimate, this stays empty until a real check is on record.',
} as const;

export const BUSINESS_CLASS_COPY = {
  headline: "Business Class availability on this service hasn't been verified.",
  body: "JetStash has not confirmed whether IndiGo's Manchester–Mumbai service offers a Business cabin. No quote or concierge service exists yet — registering interest only tells JetStash you'd want to know if that changes.",
} as const;

/** Airport and flight-level facts already on record for this route — kept separate from the withdrawal/verification claims above. */
export const FLIGHT_CONSIDERATIONS = {
  departureAirport: 'Manchester Airport (MAN)',
  arrivalAirport: 'Chhatrapati Shivaji Maharaj International Airport, Mumbai (BOM)',
  flightNumbers: EVIDENCE_BUNDLE.route.flightNumbers,
  note: 'Terminal assignments and current-week operating days have not been independently reconfirmed this session — check these directly with IndiGo when you book.',
} as const;

export type BaggageNeed = 'cabin-only' | 'checked-bag' | 'not-sure';

export const BAGGAGE_NEED_OPTIONS: { value: BaggageNeed; label: string }[] = [
  { value: 'cabin-only', label: 'Cabin bag only' },
  { value: 'checked-bag', label: 'I need a checked bag' },
  { value: 'not-sure', label: "I'm not sure yet" },
];

/** Baggage evidence doesn't exist for this route yet — this only ever states that plainly, never a fabricated allowance. */
export function getBaggageNote(need: BaggageNeed): string {
  if (need === 'checked-bag') {
    return "You said you'll need a checked bag. JetStash hasn't verified checked-baggage allowance for this fare — confirm it directly with IndiGo before booking.";
  }
  if (need === 'cabin-only') {
    return "You said cabin bag only. JetStash hasn't verified cabin-baggage allowance for this fare — confirm it directly with IndiGo before booking.";
  }
  return "Baggage allowance for this fare hasn't been verified — worth checking directly with IndiGo once you're ready to book.";
}

// Deliberately Economy/Business only — the same two cabins the result panel
// actually has an honest state for. IndiGo has not been confirmed to offer a
// Premium Economy cabin on this service; offering it as an input with no
// corresponding result would either silently drop the traveller's answer or
// require inventing a claim about a cabin this route has no evidence for.
export type CabinPreference = 'Economy' | 'Business';

export const CABIN_PREFERENCE_OPTIONS: { value: CabinPreference; label: string }[] = [
  { value: 'Economy', label: 'Economy' },
  { value: 'Business', label: 'Business' },
];

export type DominantAction =
  | 'check-travel-ready'
  | 'wait-boundary-uncertain'
  | 'check-alternative'
  | 'check-live-fare-and-confirm'
  | 'enter-travel-dates';

export interface DominantActionResult {
  action: DominantAction;
  label: string;
  reason: string;
}

/**
 * The one dominant recommendation, worst-true-signal-wins — the same
 * philosophy as lib/travel-intelligence-engine.ts's computeReadiness,
 * deliberately re-implemented locally (see file header) rather than
 * imported, so an evidence-poor route can never inherit a verdict the
 * shared engine hasn't actually earned for it.
 */
export function getDominantAction(input: {
  boundaryState: DateBoundaryState | null;
  travelReadySignal?: TravelReadySignal | null;
}): DominantActionResult {
  const { boundaryState, travelReadySignal } = input;

  if (travelReadySignal?.severity === 'critical') {
    return {
      action: 'check-travel-ready',
      label: 'Check your travel readiness first',
      reason: travelReadySignal.detail,
    };
  }
  if (boundaryState === 'after') {
    return {
      action: 'check-alternative',
      label: 'Check current flight options',
      reason: BOUNDARY_STATE_COPY.after.body,
    };
  }
  if (boundaryState === 'boundary') {
    return {
      action: 'wait-boundary-uncertain',
      label: 'Check directly with IndiGo before booking',
      reason: BOUNDARY_STATE_COPY.boundary.body,
    };
  }
  if (boundaryState === 'before') {
    return {
      action: 'check-live-fare-and-confirm',
      label: 'Check the live price, then confirm your exact date',
      reason: BOUNDARY_STATE_COPY.before.body,
    };
  }
  return {
    action: 'enter-travel-dates',
    label: 'Tell us your travel dates for a dated recommendation',
    reason: 'No travel date has been entered yet, so JetStash has nothing date-specific to recommend.',
  };
}
