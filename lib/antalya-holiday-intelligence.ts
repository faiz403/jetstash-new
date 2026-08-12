import { antalyaHotelEvidence, type HotelEvidenceRecord } from '@/data/hotel-evidence';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';
import { getTripComDestinationHandoffUrl } from '@/lib/booking-providers';
import type { Destination } from '@/data/destinations';

export interface AntalyaPublicHotelExample {
  hotelName: string;
  providerArea: string;
  operationalArea: string;
  operationalSubArea: string;
  locationNote: string;
  factualSignals: readonly string[];
  checkedDate: string;
}

export interface AntalyaFlightHandoff {
  routeSlug: string;
  airportName: string;
  href: string;
}

export interface AntalyaFlightHandoffStatus {
  airportName: string;
  airportSlug: string;
  status: 'verified' | 'blocked';
  href: string | null;
}

const PUBLIC_FACT_CLAIMS: Readonly<Record<string, readonly string[]>> = {
  'Trendy Lara': ['Family accommodation shown', 'Private beach access', 'Aquapark shown'],
  'Regnum Carya': ['All-inclusive concept shown', 'Private beach access', 'Golf context shown', 'Family accommodation/facilities shown'],
  "Aydinbey King's Palace & Spa": ['Ultra all-inclusive concept shown', 'Private sandy beach access', 'Family accommodation shown'],
};

function factValue(record: HotelEvidenceRecord, claim: string): string {
  return record.propertyFacts.find((item) => item.claim === claim)?.value ?? '';
}

function locationNote(record: HotelEvidenceRecord): string {
  if (record.hotelName === 'Trendy Lara') {
    return 'The provider uses “Lara”, while the sourced operational context is Kundu/Aksu rather than Lara Beach proper.';
  }
  if (record.hotelName === 'Regnum Carya') {
    return 'The property is in Kadriye, within the Belek tourism area.';
  }
  return 'The property is in Evrenseki in the Side/Manavgat corridor. Sources place it approximately 8 km from Side Centre, but they do not establish a walkable route.';
}

export function getAntalyaPublicHotelExamples(): readonly AntalyaPublicHotelExample[] {
  return antalyaHotelEvidence.map((record) => ({
    hotelName: record.hotelName,
    providerArea: record.geography.providerMarketingLocationLabel,
    operationalArea: record.geography.operationalArea,
    operationalSubArea: record.geography.operationalSubArea,
    locationNote: locationNote(record),
    factualSignals: (PUBLIC_FACT_CLAIMS[record.hotelName] ?? [])
      .map((claim) => factValue(record, claim))
      .filter(Boolean),
    checkedDate: record.checkedDate,
  }));
}

export function getAntalyaFlightHandoffs(destination: Destination, nowIso: string): readonly AntalyaFlightHandoff[] {
  return getAntalyaFlightHandoffStatuses(destination, nowIso)
    .filter((entry): entry is AntalyaFlightHandoffStatus & { status: 'verified'; href: string } => entry.status === 'verified' && entry.href !== null)
    .map((entry) => ({ routeSlug: `${entry.airportSlug}-${destination.slug}`, airportName: entry.airportName, href: entry.href }));
}

export function getAntalyaFlightHandoffStatuses(destination: Destination, nowIso: string): readonly AntalyaFlightHandoffStatus[] {
  return getDestinationFlightGuideEntries(destination, nowIso).map((entry) => {
    const href = getTripComDestinationHandoffUrl(entry.airport.slug, destination.slug);
    return { airportName: entry.airport.name, airportSlug: entry.airport.slug, status: href ? 'verified' : 'blocked', href };
  });
}
