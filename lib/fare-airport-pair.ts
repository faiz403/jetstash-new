import { airports } from '@/data/airports';
import { destinations } from '@/data/destinations';

/**
 * Fare airport-pair integrity (LGW→IST airport-integrity correction,
 * 19 October 2026).
 *
 * A fare observation may only price the exact airport pair its route
 * describes: Istanbul Airport (IST) and Sabiha Gökçen (SAW) are different
 * airports, as are DXB/SHJ and FCO/CIA. This module reads the airport codes
 * an observation's own source URL machine-encodes and compares them with the
 * route's origin airport and destination IATA code. Airports are never
 * inferred from airline names, city names, free text or route slugs.
 *
 * Two kinds of evidence are distinguished:
 *   - SEARCH evidence: the airports typed into a search form (a Google
 *     Flights `tfs` leg's airport references, or a KAYAK `/flights/AAA-BBB/…`
 *     path). It says what was searched for, not which airports the priced
 *     itinerary actually used, so it can never establish a match on its own.
 *   - ITINERARY evidence: the selected flight segments a Google Flights `tfs`
 *     carries once a specific outbound and return flight have been chosen
 *     (first segment's departure airport, last segment's arrival airport).
 *
 * Outcomes:
 *   - 'match': a complete round trip (exactly two legs) whose selected
 *     outbound itinerary departs the route's origin and arrives at its
 *     destination, whose selected return itinerary departs the destination
 *     and arrives at the origin, each a contiguous chain of segments, with no
 *     contradictory, duplicated or city-level airport evidence anywhere.
 *   - 'mismatch': on a one-way or round-trip URL (one or two legs), any
 *     exact airport code (search or itinerary) differs from the route's
 *     airport for that position. Such an observation must never publish for
 *     the route.
 *   - 'unknown': everything else: no URL, a free-text `q=` search, a
 *     search-only URL, a one-way or incomplete itinerary, a multi-city URL
 *     with more than two legs (outbound and return cannot be reliably
 *     identified), city-level codes,
 *     an unsupported host, or malformed / truncated data. A parser failure is
 *     always 'unknown', never a match. This module does not decide what to do
 *     with unknown evidence; see isAirportPairPublishable.
 */

export type AirportPairStatus = 'match' | 'mismatch' | 'unknown';

export interface DecodedLeg {
  /** Exact airport codes typed into the search form for this leg (city-level references are omitted). */
  searchOrigins: string[];
  searchDestinations: string[];
  /** True when any search reference for this leg was city-level, repeated, or otherwise not one exact airport. */
  searchAmbiguous: boolean;
  /** Selected flight segments, in order. Empty for a search-only leg. */
  segments: { departure: string; arrival: string }[];
}

export interface AirportPairEvidence {
  status: AirportPairStatus;
  source: 'google-flights-tfs' | 'kayak-path' | 'none';
  legs: DecodedLeg[];
  reason: string;
}

const IATA_RE = /^[A-Z]{3}$/;

/**
 * IATA metropolitan (city) codes. They name a city's group of airports, not
 * one airport, so they never count as exact airport evidence.
 */
const CITY_CODES: ReadonlySet<string> = new Set(['LON', 'MIL', 'ROM', 'PAR', 'NYC', 'MOW', 'STO', 'TYO', 'OSA', 'SEL', 'BUE', 'RIO', 'SAO', 'YTO', 'YMQ', 'WAS', 'CHI', 'JKT', 'BJS']);

/**
 * Codes accepted as exact airports from a KAYAK path, whose codes are not
 * typed: every route airport and destination in /data, plus the alternate
 * airports the archive has actually encountered. An unlisted KAYAK code is
 * treated as unknown, so a city code can never cause a false mismatch.
 */
const KNOWN_AIRPORT_CODES: ReadonlySet<string> = new Set([
  ...airports.map((a) => a.code.toUpperCase()),
  ...destinations.map((d) => d.iataCode.toUpperCase()),
  'SAW', 'SHJ', 'DWC', 'CIA', 'STN', 'LTN', 'LCY', 'SEN',
]);

const GOOGLE_HOSTS: ReadonlySet<string> = new Set(['www.google.com', 'www.google.co.uk']);
const GOOGLE_PATHS: ReadonlySet<string> = new Set(['/travel/flights', '/travel/flights/search', '/travel/flights/booking']);
const KAYAK_HOSTS: ReadonlySet<string> = new Set(['www.kayak.co.uk', 'kayak.co.uk', 'www.kayak.com', 'kayak.com']);

class Malformed extends Error {}

// ── Strict protobuf reader: any irregularity throws Malformed ──────────────

interface Field {
  num: number;
  wire: number;
  bytes?: Uint8Array;
  value?: number;
}

function readVarint(buf: Uint8Array, pos: number): [number, number] {
  let result = 0;
  for (let i = 0; i < 8; i++) {
    if (pos >= buf.length) throw new Malformed('truncated varint');
    const b = buf[pos++];
    result += (b & 0x7f) * 2 ** (7 * i);
    if (result > Number.MAX_SAFE_INTEGER) throw new Malformed('varint out of range');
    if ((b & 0x80) === 0) return [result, pos];
  }
  throw new Malformed('varint too long');
}

function readFields(buf: Uint8Array): Field[] {
  const fields: Field[] = [];
  let pos = 0;
  while (pos < buf.length) {
    const [key, p1] = readVarint(buf, pos);
    pos = p1;
    const num = Math.floor(key / 8);
    const wire = key % 8;
    if (num < 1 || num > 536870911) throw new Malformed('invalid field number');
    if (wire === 0) {
      const [value, p2] = readVarint(buf, pos);
      fields.push({ num, wire, value });
      pos = p2;
    } else if (wire === 2) {
      const [len, p2] = readVarint(buf, pos);
      if (p2 + len > buf.length) throw new Malformed('truncated length-delimited field');
      fields.push({ num, wire, bytes: buf.subarray(p2, p2 + len) });
      pos = p2 + len;
    } else if (wire === 1 || wire === 5) {
      const width = wire === 1 ? 8 : 4;
      if (pos + width > buf.length) throw new Malformed('truncated fixed-width field');
      // Kept (not skipped) so the field-number cardinality and wire-type
      // checks below see it: a fixed-width duplicate of an airport, segment
      // or leg field must make the evidence malformed, never a match.
      fields.push({ num, wire, bytes: buf.subarray(pos, pos + width) });
      pos += width;
    } else {
      throw new Malformed(`unsupported wire type ${wire}`);
    }
  }
  return fields;
}

/** Exactly one length-delimited field `num` holding a three-letter code, or Malformed. */
function onlyCode(fields: Field[], num: number): string {
  const matches = fields.filter((f) => f.num === num);
  if (matches.length !== 1 || matches[0].wire !== 2) throw new Malformed(`expected exactly one field ${num}`);
  const code = String.fromCharCode(...matches[0].bytes!);
  if (!IATA_RE.test(code)) throw new Malformed(`field ${num} is not an IATA code`);
  return code;
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Malformed('tfs is not unpadded base64url');
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  if (b64.length % 4 === 1) throw new Malformed('tfs has an impossible length');
  let bin: string;
  try {
    bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  } catch {
    throw new Malformed('tfs is not valid base64');
  }
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/**
 * An airport reference (leg field 13 = from, 14 = to): field 1 = kind
 * (1 = airport; 2 and 3 are city / place references), field 2 = code.
 * Returns the exact airport code, or null for a city-level reference.
 */
function readAirportRef(bytes: Uint8Array): string | null {
  const fields = readFields(bytes);
  const kinds = fields.filter((f) => f.num === 1);
  const codes = fields.filter((f) => f.num === 2);
  if (kinds.length !== 1 || kinds[0].wire !== 0 || codes.length !== 1 || codes[0].wire !== 2) throw new Malformed('irregular airport reference');
  if (kinds[0].value !== 1) return null;
  const code = String.fromCharCode(...codes[0].bytes!);
  if (!IATA_RE.test(code)) throw new Malformed('airport reference is not an IATA code');
  return CITY_CODES.has(code) ? null : code;
}

/** One leg (top-level field 3): its search airport references and any selected segments (field 4). */
function readGoogleLeg(bytes: Uint8Array): DecodedLeg {
  const fields = readFields(bytes);
  const from = fields.filter((f) => f.num === 13);
  const to = fields.filter((f) => f.num === 14);
  if ([...from, ...to].some((f) => f.wire !== 2)) throw new Malformed('irregular airport reference field');
  const fromCodes = from.map((f) => readAirportRef(f.bytes!));
  const toCodes = to.map((f) => readAirportRef(f.bytes!));
  const segments = fields
    .filter((f) => f.num === 4)
    .map((f) => {
      if (f.wire !== 2) throw new Malformed('irregular segment field');
      const seg = readFields(f.bytes!);
      return { departure: onlyCode(seg, 1), arrival: onlyCode(seg, 3) };
    });
  return {
    searchOrigins: fromCodes.filter((c): c is string => c !== null),
    searchDestinations: toCodes.filter((c): c is string => c !== null),
    searchAmbiguous: fromCodes.length > 1 || toCodes.length > 1 || fromCodes.includes(null) || toCodes.includes(null),
    segments,
  };
}

function decodeGoogleFlights(url: URL): DecodedLeg[] | null {
  if (url.protocol !== 'https:' || !GOOGLE_HOSTS.has(url.hostname) || !GOOGLE_PATHS.has(url.pathname.replace(/\/$/, ''))) return null;
  const tfsValues = url.searchParams.getAll('tfs');
  if (tfsValues.length === 0) return null;
  if (tfsValues.length > 1) throw new Malformed('more than one tfs parameter');
  const legs = readFields(base64UrlToBytes(tfsValues[0]))
    .filter((f) => f.num === 3)
    .map((f) => {
      if (f.wire !== 2) throw new Malformed('irregular leg field');
      return readGoogleLeg(f.bytes!);
    });
  if (legs.length === 0) throw new Malformed('no legs');
  return legs;
}

/**
 * A KAYAK path, parsed completely: `/flights/AAA-BBB/<date>` (one way),
 * `/flights/AAA-BBB/<date>/<date>` (round trip) or repeated
 * `AAA-BBB/<date>` pairs (multi-city), optionally ending `/<n>adults`. Any
 * other token makes the whole path unknown. KAYAK paths are search evidence
 * only. A code outside KNOWN_AIRPORT_CODES (for example a city code such as
 * LON) is not treated as an exact airport.
 */
function decodeKayak(url: URL): DecodedLeg[] | null {
  if (url.protocol !== 'https:' || !KAYAK_HOSTS.has(url.hostname)) return null;
  const tokens = url.pathname.split('/').filter(Boolean);
  if (tokens[0] !== 'flights') return null;
  let rest = tokens.slice(1);
  if (rest.length > 0 && /^\d+adults$/.test(rest[rest.length - 1])) rest = rest.slice(0, -1);
  const PAIR = /^([A-Z]{3})-([A-Z]{3})$/;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const exact = (c: string) => (KNOWN_AIRPORT_CODES.has(c) && !CITY_CODES.has(c) ? [c] : []);
  const searchLeg = (o: string, d: string): DecodedLeg => ({
    searchOrigins: exact(o),
    searchDestinations: exact(d),
    searchAmbiguous: exact(o).length === 0 || exact(d).length === 0,
    segments: [],
  });
  const legs: DecodedLeg[] = [];
  let i = 0;
  while (i < rest.length) {
    const pair = PAIR.exec(rest[i]);
    if (!pair || !DATE.test(rest[i + 1] ?? '')) throw new Malformed('unsupported KAYAK path');
    legs.push(searchLeg(pair[1], pair[2]));
    i += 2;
    if (legs.length === 1 && i === rest.length - 1 && DATE.test(rest[i])) {
      legs.push(searchLeg(pair[2], pair[1]));
      i += 1;
    }
  }
  if (legs.length === 0) throw new Malformed('no KAYAK legs');
  return legs;
}

/**
 * Routes where an observation must carry positive itinerary-level proof of
 * the exact airport pair before it can publish (anything else fails closed).
 * Limited to london-gatwick-istanbul by founder ruling (19 October 2026: the
 * route is LGW→IST; SAW is a different airport). It is already
 * verification-pending, so this changes no published fare. Applying the same
 * rule to other multi-airport destinations (Istanbul, Dubai and Rome routes)
 * would currently hide their displayed fares, whose source URLs carry no
 * itinerary-level airport evidence, so those routes are deliberately not
 * listed.
 */
export const STRICT_AIRPORT_PAIR_ROUTE_SLUGS: ReadonlySet<string> = new Set(['london-gatwick-istanbul']);

/**
 * Publication rule for one observation: an explicit airport mismatch never
 * publishes; on a strict route, only a positive itinerary-level match
 * publishes.
 */
export function isAirportPairPublishable(sourceUrl: string | undefined, routeSlug: string, routeOrigin: string, routeDestination: string): boolean {
  const evidence = getAirportPairEvidence(sourceUrl, routeOrigin, routeDestination);
  if (evidence.status === 'mismatch') return false;
  if (STRICT_AIRPORT_PAIR_ROUTE_SLUGS.has(routeSlug) && evidence.status !== 'match') return false;
  return true;
}

const unknown = (source: AirportPairEvidence['source'], reason: string, legs: DecodedLeg[] = []): AirportPairEvidence => ({ status: 'unknown', source, legs, reason });

/** Reads the airport codes an observation's source URL encodes and compares them with the route's exact pair. */
export function getAirportPairEvidence(sourceUrl: string | undefined, routeOrigin: string, routeDestination: string): AirportPairEvidence {
  if (!sourceUrl) return unknown('none', 'No source URL.');
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return unknown('none', 'Unparseable source URL.');
  }
  let legs: DecodedLeg[] | null;
  let source: AirportPairEvidence['source'];
  try {
    legs = decodeGoogleFlights(url);
    source = 'google-flights-tfs';
    if (!legs) {
      legs = decodeKayak(url);
      source = 'kayak-path';
    }
  } catch (error) {
    if (error instanceof Malformed) return unknown('none', `Airport evidence is malformed (${error.message}).`);
    throw error;
  }
  if (!legs) return unknown('none', 'No machine-readable airport codes in the source URL.');

  const origin = routeOrigin.toUpperCase();
  const destination = routeDestination.toUpperCase();

  // Only a one-way (one leg) or round trip (two legs) has known roles: the
  // first leg is the outbound and the second the return. A multi-city search
  // with more legs cannot be reliably divided into outbound and return
  // journeys (it may include a stopover), so it is never compared position
  // by position: it is unknown, never a mismatch and never a match.
  if (legs.length > 2) return unknown(source, `${legs.length} legs: the outbound and return journeys cannot be reliably identified.`, legs);

  // Any exact airport, from the search form or the selected itinerary, that
  // contradicts the route's pair is a mismatch.
  const problems: string[] = [];
  legs.forEach((leg, index) => {
    const name = index === 0 ? 'outbound' : 'return';
    const expectFrom = index === 0 ? origin : destination;
    const expectTo = index === 0 ? destination : origin;
    const from = [...leg.searchOrigins, ...(leg.segments.length ? [leg.segments[0].departure] : [])];
    const to = [...leg.searchDestinations, ...(leg.segments.length ? [leg.segments[leg.segments.length - 1].arrival] : [])];
    const badFrom = [...new Set(from.filter((c) => c !== expectFrom))];
    const badTo = [...new Set(to.filter((c) => c !== expectTo))];
    if (badFrom.length || badTo.length) {
      problems.push(`${name} ${badFrom[0] ?? expectFrom}-${badTo[0] ?? expectTo} is not ${expectFrom}-${expectTo}`);
    }
  });
  if (problems.length) return { status: 'mismatch', source, legs, reason: problems.join('; ') };

  // A match needs a complete, unambiguous, selected round-trip itinerary.
  if (source !== 'google-flights-tfs') return unknown(source, 'Search-form airports only; the priced itinerary is not identified.', legs);
  if (legs.length !== 2) return unknown(source, 'One-way evidence cannot establish a round trip.', legs);
  for (const [index, leg] of legs.entries()) {
    const name = index === 0 ? 'outbound' : 'return';
    if (leg.segments.length === 0) return unknown(source, `No selected ${name} flight; search-form airports do not identify the priced itinerary.`, legs);
    if (leg.searchAmbiguous) return unknown(source, `The ${name} search airports are city-level or repeated.`, legs);
    for (let s = 1; s < leg.segments.length; s++) {
      if (leg.segments[s - 1].arrival !== leg.segments[s].departure) return unknown(source, `The selected ${name} itinerary changes airport between flights.`, legs);
    }
  }
  return { status: 'match', source, legs, reason: 'Selected outbound and return itineraries both use the route airport pair.' };
}
