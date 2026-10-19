import type { PeakPeriodOccurrence } from '@/data/peak-period-dates';

/**
 * Rolling weekly fare-sweep window (19 Oct 2026, founder-approved).
 *
 * The 6 and 13 October sweeps both reused one saved set of Google Flights
 * searches whose dates were frozen at 17 Nov–1 Dec 2026, so every "weekly"
 * sweep searched the same travel window instead of advancing it. This
 * module is the one place the sweep window is computed, per FARE-METHOD-001
 * (FARE_COLLECTION_CHECKLIST.md): departure = sweep date + 56 days (the
 * fixed 8-week horizon), return = departure + 14 nights.
 *
 * Collection tooling only. Nothing here touches fare observations, route
 * verification, affiliate links or anything the public site renders.
 *
 * Runtime-import-free on purpose (type imports are erased), so
 * scripts/fare-sweep/generate-sweep-urls.mjs can load it with Node's own
 * type stripping, without a build step.
 */

export const SWEEP_DEPARTURE_OFFSET_DAYS = 56;
export const SWEEP_STAY_NIGHTS = 14;
export const CHRISTMAS_NEW_YEAR_PEAK_PERIOD_ID = 'christmas-new-year';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoUtc(iso: string): Date {
  if (!ISO_DATE_RE.test(iso)) throw new Error(`Invalid ISO date: ${iso}`);
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error(`Invalid ISO date: ${iso}`);
  }
  return date;
}

export function addDaysIso(iso: string, days: number): string {
  const date = parseIsoUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isTuesdayIso(iso: string): boolean {
  return parseIsoUtc(iso).getUTCDay() === 2;
}

export interface SweepWindow {
  sweepDate: string;
  departureDate: string;
  returnDate: string;
}

/** The FARE-METHOD-001 travel window for a sweep run on `sweepDate`. */
export function getRollingSweepWindow(sweepDate: string): SweepWindow {
  const departureDate = addDaysIso(sweepDate, SWEEP_DEPARTURE_OFFSET_DAYS);
  return { sweepDate, departureDate, returnDate: addDaysIso(departureDate, SWEEP_STAY_NIGHTS) };
}

export interface PeakSeasonResult {
  isPeakSeason: boolean;
  /** The data/peak-period-dates.ts occurrence id the window overlaps, if any. */
  occurrenceId: string | null;
}

/**
 * Christmas/New Year peak flag for sweep evidence, using the existing
 * `christmas-new-year` occurrences in data/peak-period-dates.ts (never a
 * second calendar). Peak when any travel night falls inside an occurrence.
 * Throws when the window reaches a December/January with no occurrence on
 * file, so a missing calendar year can't silently mark a peak fare as
 * ordinary.
 */
export function getChristmasNewYearPeak(window: SweepWindow, occurrences: readonly PeakPeriodOccurrence[]): PeakSeasonResult {
  const christmas = occurrences.filter((o) => o.peakPeriodId === CHRISTMAS_NEW_YEAR_PEAK_PERIOD_ID);
  const hit = christmas.find((o) => window.departureDate <= (o.endDate ?? o.startDate) && window.returnDate >= o.startDate);
  if (hit) return { isPeakSeason: true, occurrenceId: hit.id };

  // Every December/January the window touches must be covered by some occurrence.
  for (const iso of [window.departureDate, window.returnDate]) {
    const [y, m] = iso.split('-').map(Number);
    if (m !== 12 && m !== 1) continue;
    const seasonStartYear = m === 12 ? y : y - 1;
    const covered = christmas.some((o) => Number(o.startDate.slice(0, 4)) === seasonStartYear);
    if (!covered) throw new Error(`No ${CHRISTMAS_NEW_YEAR_PEAK_PERIOD_ID} occurrence for ${seasonStartYear}; add one to data/peak-period-dates.ts before sweeping ${iso}.`);
  }
  return { isPeakSeason: false, occurrenceId: null };
}

// ---------------------------------------------------------------------------
// Google Flights `tfs` date rewrite
// ---------------------------------------------------------------------------

/**
 * Google Flights encodes a search in the `tfs` query parameter as a
 * base64url protobuf. Every saved sweep URL has the same verified layout:
 *   08 1c 10 02            header
 *   1a 1e  leg 1: 12 0a <date> 6a 07 08 01 12 03 <ORIGIN> 72 07 08 01 12 03 <DEST>
 *   1a 1e  leg 2: same, with origin and destination swapped
 *   ...    trailing options (passengers, cabin, currency), copied unchanged
 * Only the two 10-byte date strings are replaced, in place, so every length
 * prefix, airport and option stays byte-identical. Anything that doesn't
 * match this exact layout throws rather than being guessed at.
 */
const HEADER = [0x08, 0x1c, 0x10, 0x02];
/** The exact options suffix every saved template ends with (1 adult, economy, round trip). */
const TRAILER = [0x40, 0x01, 0x48, 0x01, 0x70, 0x01, 0x82, 0x01, 0x0b, 0x08, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01, 0x98, 0x01, 0x01];
const LEG_TAG = 0x1a;
const LEG_LENGTH = 0x1e;

function readLeg(bytes: Uint8Array, start: number): { dateOffset: number; origin: string; destination: string } {
  const expect = (offset: number, values: number[], what: string) => {
    values.forEach((v, i) => {
      if (bytes[offset + i] !== v) throw new Error(`Unexpected tfs layout (${what})`);
    });
  };
  expect(start, [LEG_TAG, LEG_LENGTH], 'leg header');
  expect(start + 2, [0x12, 0x0a], 'date field');
  const dateOffset = start + 4;
  const date = String.fromCharCode(...bytes.slice(dateOffset, dateOffset + 10));
  if (!ISO_DATE_RE.test(date)) throw new Error('Unexpected tfs layout (date value)');
  expect(start + 14, [0x6a, 0x07, 0x08, 0x01, 0x12, 0x03], 'origin field');
  const origin = String.fromCharCode(...bytes.slice(start + 20, start + 23));
  expect(start + 23, [0x72, 0x07, 0x08, 0x01, 0x12, 0x03], 'destination field');
  const destination = String.fromCharCode(...bytes.slice(start + 29, start + 32));
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) throw new Error('Unexpected tfs layout (airport code)');
  return { dateOffset, origin, destination };
}

function base64UrlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface GoogleFlightsRoundTrip {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
}

/** Reads the airports and dates a saved Google Flights round-trip URL actually encodes. */
export function readGoogleFlightsRoundTrip(url: string): GoogleFlightsRoundTrip {
  const parsed = new URL(url);
  if (parsed.hostname !== 'www.google.com' || parsed.pathname !== '/travel/flights/search') {
    throw new Error(`Not a Google Flights search URL: ${url}`);
  }
  const tfs = parsed.searchParams.get('tfs');
  if (!tfs) throw new Error('Missing tfs parameter');
  const bytes = base64UrlToBytes(tfs);
  HEADER.forEach((v, i) => {
    if (bytes[i] !== v) throw new Error('Unexpected tfs layout (header)');
  });
  // Exactly two legs followed by the known options suffix: an extra leg,
  // a truncated payload or any other option change fails closed.
  const trailerStart = 4 + 2 * (2 + LEG_LENGTH);
  if (bytes.length !== trailerStart + TRAILER.length || TRAILER.some((v, i) => bytes[trailerStart + i] !== v)) {
    throw new Error('Unexpected tfs layout (legs or options)');
  }
  const out = readLeg(bytes, 4);
  const back = readLeg(bytes, 4 + 2 + LEG_LENGTH);
  if (out.origin !== back.destination || out.destination !== back.origin) {
    throw new Error('Return leg does not reverse the outbound leg');
  }
  const date = (offset: number) => String.fromCharCode(...bytes.slice(offset, offset + 10));
  return { origin: out.origin, destination: out.destination, departureDate: date(out.dateOffset), returnDate: date(back.dateOffset) };
}

/**
 * Returns `url` with only its two travel dates replaced. The origin and
 * destination must match what the URL already encodes; all other query
 * parameters are left exactly as they were.
 */
export function withGoogleFlightsDates(url: string, expected: { origin: string; destination: string }, departureDate: string, returnDate: string): string {
  parseIsoUtc(departureDate);
  parseIsoUtc(returnDate);
  if (returnDate <= departureDate) throw new Error('Return date must be after departure date');
  const current = readGoogleFlightsRoundTrip(url);
  if (current.origin !== expected.origin || current.destination !== expected.destination) {
    throw new Error(`URL encodes ${current.origin}-${current.destination}, expected ${expected.origin}-${expected.destination}`);
  }
  const parsed = new URL(url);
  const tfs = parsed.searchParams.get('tfs')!;
  const bytes = base64UrlToBytes(tfs);
  const write = (offset: number, iso: string) => {
    for (let i = 0; i < 10; i++) bytes[offset + i] = iso.charCodeAt(i);
  };
  write(4 + 4, departureDate);
  write(4 + 2 + LEG_LENGTH + 4, returnDate);
  // Replace only the tfs value in the original string, so parameter order
  // and encoding of everything else are untouched.
  return url.replace(`tfs=${tfs}`, `tfs=${bytesToBase64Url(bytes)}`);
}

// ---------------------------------------------------------------------------
// KAYAK fallback
// ---------------------------------------------------------------------------

/**
 * KAYAK fallback search for the routes Google Flights returns no results
 * for. Path format is KAYAK's own public round-trip search URL; JetStash
 * earns nothing from it and it is used only for collection.
 */
export function buildKayakRoundTripUrl(origin: string, destination: string, departureDate: string, returnDate: string): string {
  parseIsoUtc(departureDate);
  parseIsoUtc(returnDate);
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) throw new Error('Airport codes must be 3-letter IATA');
  return `https://www.kayak.co.uk/flights/${origin}-${destination}/${departureDate}/${returnDate}`;
}
