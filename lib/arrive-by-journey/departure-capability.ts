import { getCatalogueAirport } from '../arrive-by-shared/airport-catalogue';
import evidenceFile from './departure-capability-evidence.json';

/**
 * DEPARTURE capability: "can a traveller's start location be safely routed TO
 * this airport?" It is a different fact from the Phase C arrival evidence
 * ("can we route FROM this airport to a destination?") and is never inferred
 * from it -- not even for MAN, whose explicit arrival/transit profile proves
 * nothing about driving into it.
 *
 * Evidence is written only by the operator probe
 * (scripts/arrive-by-departure-probe.ts) and requires BOTH:
 *   identityVerified   Google agrees this airport is where the catalogue (or the
 *                      explicit profile's coordinate) says it is;
 *   routeProbed        a real traffic-aware DRIVE from a real UK start location
 *                      INTO the airport coordinate succeeded.
 * V1 scope is UK airports only, so a non-GB entry is invalid. It says nothing
 * about release: a departure-capable airport is not thereby public.
 */

export interface DepartureEvidence {
  iata: string;
  status: 'departure_supported';
  verifiedDate: string;
  note: string;
  checks: { identityVerified: true; routeProbed: true };
}

export function assertValidDepartureEvidence(entry: DepartureEvidence): void {
  const prefix = `Departure evidence ${entry.iata}`;
  const airport = getCatalogueAirport(entry.iata);
  if (!airport) throw new Error(`${prefix}: not a catalogue airport.`);
  if (airport.countryCode !== 'GB') throw new Error(`${prefix}: V1 departures are UK airports only.`);
  if (entry.status !== 'departure_supported') throw new Error(`${prefix}: unknown status.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.verifiedDate)) throw new Error(`${prefix}: verifiedDate must be YYYY-MM-DD.`);
  if (!entry.note.trim()) throw new Error(`${prefix}: a note is required.`);
  if (!entry.checks?.identityVerified || !entry.checks?.routeProbed) throw new Error(`${prefix}: needs a passed identity check AND a successful DRIVE route into the airport.`);
}

const RECORDS = (evidenceFile as { records: DepartureEvidence[] }).records;
for (const record of RECORDS) assertValidDepartureEvidence(record);

export const DEPARTURE_CAPABILITY_EVIDENCE: Readonly<Record<string, DepartureEvidence>> = Object.fromEntries(RECORDS.map((record) => [record.iata, record]));

/** True only with recorded directional evidence. The arrival profile, catalogue membership and release state are all irrelevant here. */
export function hasDepartureCapability(rawCode: string | null | undefined, table: Readonly<Record<string, DepartureEvidence>> = DEPARTURE_CAPABILITY_EVIDENCE): boolean {
  const code = rawCode?.trim().toUpperCase();
  return Boolean(code && table[code]);
}
