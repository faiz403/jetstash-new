import { antalyaHotelEvidence, type HotelEvidenceRecord as AntalyaHotelEvidenceRecord } from '@/data/hotel-evidence';
import {
  getExpansionHotelEvidenceForDestination,
  type ExpansionHotelEvidenceRecord,
} from '@/data/hotel-evidence-expansion';
import { getStayAreaCopyForDestination, type DestinationStayAreaCopy } from '@/lib/hotel-stay-areas';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';
import { getTripComDestinationHandoffUrl } from '@/lib/booking-providers';
import { getTripComHotelUrl, HOTEL_PROVIDER_REL } from '@/lib/hotel-booking-links';
import type { Destination } from '@/data/destinations';

/**
 * The one Holiday Intelligence lib, shared by every destination that has
 * it — Antalya (the original pilot) and the Hotel Intelligence +
 * Monetisation Expansion destinations alike (August 2026 consolidation).
 *
 * Previously this was two parallel files (lib/antalya-holiday-intelligence.ts
 * + lib/holiday-intelligence.ts) kept separate deliberately, because
 * Antalya's pinned test suite asserted on exact file paths and its public
 * projection uses a hand-curated fact allowlist rather than "surface every
 * evidenced fact". That curation policy is preserved exactly below
 * (ANTALYA_PUBLIC_FACT_CLAIMS / antalyaLocationNote) — merging the files
 * changed where the code lives, not what it outputs for Antalya.
 *
 * Same evidence/commercial-handoff separation as before: this is the only
 * module (besides the founder-only prototype) allowed to import
 * data/hotel-evidence.ts or data/hotel-evidence-expansion.ts directly —
 * public components only ever see the curated PublicHotelExample
 * projection below, never a raw evidence record.
 */

export interface PublicHotelExample {
  hotelName: string;
  providerArea: string;
  operationalArea: string;
  operationalSubArea: string;
  locationNote: string;
  factualSignals: readonly string[];
  checkedDate: string;
  /**
   * "Check current price" handoff — `null` when no verified, dashboard-
   * generated Trip.com link exists yet for this property (see
   * lib/hotel-booking-links.ts). Callers MUST fail closed and render no CTA
   * at all rather than guess a link.
   */
  bookingUrl: string | null;
}

export { HOTEL_PROVIDER_REL };

export interface HolidayFlightHandoff {
  routeSlug: string;
  airportName: string;
  href: string;
}

export interface HolidayFlightHandoffStatus {
  airportName: string;
  airportSlug: string;
  status: 'verified' | 'blocked';
  href: string | null;
}

// ---------------------------------------------------------------------------
// Antalya pilot — curated public-fact allowlist, preserved verbatim from the
// original lib/antalya-holiday-intelligence.ts. Antalya shows a hand-picked
// subset of its evidenced facts, not every evidenced fact; every other
// destination shows every fact marked 'evidenced' (see
// expansionPublicFactualSignals below). This is a real, deliberate
// behavioural difference between Antalya and the newer destinations, not an
// oversight — preserved exactly so Antalya's live output is unchanged.
// ---------------------------------------------------------------------------

const ANTALYA_PUBLIC_FACT_CLAIMS: Readonly<Record<string, readonly string[]>> = {
  'Trendy Lara': ['Family accommodation shown', 'Private beach access', 'Aquapark shown'],
  'Regnum Carya': ['All-inclusive concept shown', 'Private beach access', 'Golf context shown', 'Family accommodation/facilities shown'],
  "Aydinbey King's Palace & Spa": ['Ultra all-inclusive concept shown', 'Private sandy beach access', 'Family accommodation shown'],
};

function antalyaFactValue(record: AntalyaHotelEvidenceRecord, claim: string): string {
  return record.propertyFacts.find((item) => item.claim === claim)?.value ?? '';
}

function antalyaLocationNote(record: AntalyaHotelEvidenceRecord): string {
  if (record.hotelName === 'Trendy Lara') {
    return 'The provider uses “Lara”, while the sourced operational context is Kundu/Aksu rather than Lara Beach proper.';
  }
  if (record.hotelName === 'Regnum Carya') {
    return 'The property is in Kadriye, within the Belek tourism area.';
  }
  return 'The property is in Evrenseki in the Side/Manavgat corridor. Sources place it approximately 8 km from Side Centre, but they do not establish a walkable route.';
}

function getAntalyaPublicHotelExamples(): readonly PublicHotelExample[] {
  return antalyaHotelEvidence.map((record) => ({
    hotelName: record.hotelName,
    providerArea: record.geography.providerMarketingLocationLabel,
    operationalArea: record.geography.operationalArea,
    operationalSubArea: record.geography.operationalSubArea,
    locationNote: antalyaLocationNote(record),
    factualSignals: (ANTALYA_PUBLIC_FACT_CLAIMS[record.hotelName] ?? [])
      .map((claim) => antalyaFactValue(record, claim))
      .filter(Boolean),
    checkedDate: record.checkedDate,
    bookingUrl: getTripComHotelUrl(record.evidenceId),
  }));
}

// ---------------------------------------------------------------------------
// Expansion destinations — every propertyFact marked 'evidenced' is shown;
// no per-hotel curated allowlist.
// ---------------------------------------------------------------------------

function expansionLocationNote(record: ExpansionHotelEvidenceRecord): string {
  if (record.geography.providerGeographyConflict === 'yes') {
    return `The provider uses "${record.geography.providerMarketingLocationLabel}", while the sourced operational context is ${record.geography.operationalArea}.`;
  }
  return `The property is in ${record.geography.operationalSubArea}, within ${record.geography.operationalArea}.`;
}

function expansionPublicFactualSignals(record: ExpansionHotelEvidenceRecord): readonly string[] {
  return record.propertyFacts.filter((item) => item.state === 'evidenced').map((item) => item.value);
}

function getExpansionPublicHotelExamples(destinationSlug: string): readonly PublicHotelExample[] {
  return getExpansionHotelEvidenceForDestination(destinationSlug).map((record) => ({
    hotelName: record.hotelName,
    providerArea: record.geography.providerMarketingLocationLabel,
    operationalArea: record.geography.operationalArea,
    operationalSubArea: record.geography.operationalSubArea,
    locationNote: expansionLocationNote(record),
    factualSignals: expansionPublicFactualSignals(record),
    checkedDate: record.checkedDate,
    bookingUrl: getTripComHotelUrl(record.evidenceId),
  }));
}

/** The one entry point every Holiday Intelligence component calls — dispatches to Antalya's curated projection or the expansion's evidenced-facts projection by destinationSlug. */
export function getPublicHotelExamples(destinationSlug: string): readonly PublicHotelExample[] {
  if (destinationSlug === 'antalya') return getAntalyaPublicHotelExamples();
  return getExpansionPublicHotelExamples(destinationSlug);
}

export function getStayAreaCopy(destinationSlug: string): DestinationStayAreaCopy | null {
  return getStayAreaCopyForDestination(destinationSlug);
}

// ---------------------------------------------------------------------------
// PUBLIC ALLOWLIST (Hotel Intelligence + Monetisation Expansion, August
// 2026 founder decision) — the one place that decides "does this
// destination's Holiday Intelligence section render publicly", kept
// deliberately separate from "does evidence exist for this destination".
//
// FINAL FREEZE (August 2026): this is the complete, final public set for
// the researched Hotel Intelligence programme — Antalya (original pilot)
// plus all 9 expansion destinations (Dubai/Madinah/Dalaman pilot +
// Istanbul/Marrakech/Bodrum/Agadir/Barcelona/Faro final activation
// batch). Expansion is frozen after this release: do not add a further
// slug here without a new, explicit founder decision backed by customer
// evidence — see JETSTASH_PRINCIPLES.md / project-control docs for the
// standing rule once recorded there.
// ---------------------------------------------------------------------------
const PUBLIC_HOLIDAY_INTELLIGENCE_DESTINATIONS: ReadonlySet<string> = new Set([
  'antalya',
  'dubai',
  'madinah',
  'dalaman',
  'istanbul',
  'marrakech',
  'bodrum',
  'agadir',
  'barcelona',
  'faro',
]);

/** Whether a destination's Holiday Intelligence section should render publicly: on the pilot allowlist AND has both stay-area copy and at least one approved property. */
export function hasHolidayIntelligence(destinationSlug: string): boolean {
  if (!PUBLIC_HOLIDAY_INTELLIGENCE_DESTINATIONS.has(destinationSlug)) return false;
  if (getStayAreaCopyForDestination(destinationSlug) === null) return false;
  const evidenceCount = destinationSlug === 'antalya' ? antalyaHotelEvidence.length : getExpansionHotelEvidenceForDestination(destinationSlug).length;
  return evidenceCount > 0;
}

export function getHolidayFlightHandoffStatuses(destination: Destination, nowIso: string): readonly HolidayFlightHandoffStatus[] {
  // Holiday Intelligence is the continuation for pairs without an exact
  // JetStash route guide. Route-guide pairs keep their booking journey on the
  // route page rather than receiving a competing destination-level CTA.
  return getDestinationFlightGuideEntries(destination, nowIso)
    .filter((entry) => entry.routeSlug === null)
    .map((entry) => {
      const href = getTripComDestinationHandoffUrl(entry.airport.slug, destination.slug);
      return { airportName: entry.airport.name, airportSlug: entry.airport.slug, status: href ? 'verified' : 'blocked', href } as HolidayFlightHandoffStatus;
    });
}

export function getHolidayFlightHandoffs(destination: Destination, nowIso: string): readonly HolidayFlightHandoff[] {
  return getHolidayFlightHandoffStatuses(destination, nowIso)
    .filter((entry): entry is HolidayFlightHandoffStatus & { status: 'verified'; href: string } => entry.status === 'verified' && entry.href !== null)
    .map((entry) => ({ routeSlug: `${entry.airportSlug}-${destination.slug}`, airportName: entry.airportName, href: entry.href }));
}
