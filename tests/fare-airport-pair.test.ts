import { describe, it, expect } from 'vitest';
import { getRouteBySlug, type Route } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getAirportBySlug } from '@/data/airports';
import { getDestinationBySlug } from '@/data/destinations';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { fareObservations, isObservationPublishable, isMethodologyExcluded, getPublishableObservationsByRoute, type FareObservation } from '@/data/fare-observations';
import { getAirportPairEvidence, isAirportPairPublishable, STRICT_AIRPORT_PAIR_ROUTE_SLUGS } from '@/lib/fare-airport-pair';
import { validateWeeklyFareEntry, type WeeklyFareEvidenceEntry, type WeeklyFareProfile } from '@/lib/weekly-fare-ingest';

/**
 * LGW→IST airport-integrity correction (19 October 2026). The route
 * london-gatwick-istanbul means London Gatwick → Istanbul Airport (IST).
 * Sabiha Gökçen (SAW) is a different airport and its fares must never verify
 * or price this route. A match needs itinerary-level evidence (the selected
 * outbound and return flights), never only the airports typed into a search.
 */

const NOW = '2026-10-19';

// Real archived source URLs (data/fare-observations.ts).
/** obs-lgw-ist-economy-20260929-v1: an exact LGW-IST search with no flight selected (search evidence only). */
const IST_SEARCH_URL = 'https://www.google.com/travel/flights/search?tfs=CBwQAhoeEgoyMDI2LTExLTE3agcIARIDTEdXcgcIARIDSVNUGh4SCjIwMjYtMTItMDFqBwgBEgNJU1RyBwgBEgNMR1dAAUgBcAGCAQsI____________AZgBAQ&tfu=EgoIABAAGAAgAigB&hl=en&gl=GB&curr=GBP';
/** obs-lgw-saw-economy-20260814-8w-v1: an LGW-SAW search with a selected LGW→SAW outbound flight. */
const SAW_URL = 'https://www.google.com/travel/flights/search?tfs=CBwQAhpAEgoyMDI2LTEwLTA4IiAKA0xHVxIKMjAyNi0xMC0wOBoDU0FXKgJQQzIEMTE4NmoHCAESA0xHV3IHCAESA1NBVxoeEgoyMDI2LTEwLTIyagcIARIDU0FXcgcIARIDTEdXQAFIAXABggELCP___________wGYAQE&tfu=CmxDalJJTVRJeWNHZ3RNalkwUVZWQlFtWllibWRDUnkwdExTMHRMUzB0TFMxM1ltNHhNMEZCUVVGQlIzQXRZV3hGUjB0b1NsVkJFZ1pRUXpFeE9EWWFDZ2lBZEJBQ0dnTkhRbEE0SEhDL25BRT0SAggAIgMKATA&hl=en&gl=GB&curr=GBP';
const Q_URL = 'https://www.google.com/travel/flights?q=Flights%20from%20London%20Gatwick%20to%20Istanbul%20October%208%202026&curr=GBP';

// ── Synthetic Google Flights `tfs` builder (airports and dates only) ──────
type Bytes = number[];
const varint = (n: number): Bytes => {
  const out: Bytes = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n) b |= 128;
    out.push(b);
  } while (n);
  return out;
};
const str = (s: string): Bytes => Array.from(s, (c) => c.charCodeAt(0));
const len = (field: number, bytes: Bytes): Bytes => [...varint(field * 8 + 2), ...varint(bytes.length), ...bytes];
const num = (field: number, n: number): Bytes => [...varint(field * 8), ...varint(n)];
const airportRef = (code: string, kind = 1): Bytes => [...num(1, kind), ...len(2, str(code))];
const segment = (dep: string, arr: string): Bytes => [...len(1, str(dep)), ...len(2, str('2026-12-15')), ...len(3, str(arr))];
interface LegSpec { from?: string[]; to?: string[]; fromKind?: number; segments?: [string, string][] }
const leg = ({ from = [], to = [], fromKind = 1, segments = [] }: LegSpec): Bytes => [
  ...len(2, str('2026-12-15')),
  ...segments.flatMap(([d, a]) => len(4, segment(d, a))),
  ...from.flatMap((c) => len(13, airportRef(c, fromKind))),
  ...to.flatMap((c) => len(14, airportRef(c))),
];
const tfsBytes = (legs: LegSpec[], tail: Bytes = []): Bytes => [...num(1, 28), ...num(2, 2), ...legs.flatMap((l) => len(3, leg(l))), ...num(19, 1), ...tail];
const b64url = (bytes: Bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const google = (legs: LegSpec[], opts: { host?: string; tail?: Bytes } = {}) =>
  `https://${opts.host ?? 'www.google.com'}/travel/flights/booking?tfs=${b64url(tfsBytes(legs, opts.tail))}&hl=en&gl=GB&curr=GBP`;

const OUT: LegSpec = { from: ['LGW'], to: ['IST'], segments: [['LGW', 'IST']] };
const BACK: LegSpec = { from: ['IST'], to: ['LGW'], segments: [['IST', 'LGW']] };
/** A correctly evidenced LGW-IST round trip: selected outbound LGW→IST and return IST→LGW. */
const IST_ITINERARY_URL = google([OUT, BACK]);

const status = (url: string | undefined, o = 'LGW', d = 'IST') => getAirportPairEvidence(url, o, d).status;

function route(slug: string): Route {
  const r = getRouteBySlug(slug);
  if (!r) throw new Error(slug);
  return r;
}
/** The route as it would be if its verification were renewed today. */
function renewed(r: Route): Route {
  return { ...r, verification: { ...r.verification!, status: 'verified', verifiedDate: NOW, reviewDueDate: '2026-11-18' } };
}

describe('correctly evidenced LGW-IST itineraries are accepted', () => {
  it('selected LGW→IST outbound and IST→LGW return flights match', () => {
    const e = getAirportPairEvidence(IST_ITINERARY_URL, 'LGW', 'IST');
    expect(e.status).toBe('match');
    expect(e.source).toBe('google-flights-tfs');
  });

  it('a contiguous one-stop itinerary on both legs matches', () => {
    expect(status(google([{ from: ['LGW'], to: ['IST'], segments: [['LGW', 'ATH'], ['ATH', 'IST']] }, { from: ['IST'], to: ['LGW'], segments: [['IST', 'ATH'], ['ATH', 'LGW']] }]))).toBe('match');
  });

  it('accepts the www.google.co.uk host and the search path', () => {
    expect(status(google([OUT, BACK], { host: 'www.google.co.uk' }))).toBe('match');
    expect(status(IST_ITINERARY_URL.replace('/booking?', '/search?'))).toBe('match');
  });
});

describe('P1: both legs need itinerary evidence; search airports alone never match', () => {
  it('an exact LGW-IST search with no selected flights is unknown, not a match', () => {
    expect(status(IST_SEARCH_URL)).toBe('unknown');
  });

  it('a one-way itinerary cannot establish a round trip', () => {
    expect(status(google([OUT]))).toBe('unknown');
  });

  it('a selected outbound with a search-only return is unknown', () => {
    expect(status(google([OUT, { from: ['IST'], to: ['LGW'] }]))).toBe('unknown');
  });

  it('a return itinerary that departs SAW is a mismatch even when the outbound is correct', () => {
    const e = getAirportPairEvidence(google([OUT, { from: ['IST'], to: ['LGW'], segments: [['SAW', 'LGW']] }]), 'LGW', 'IST');
    expect(e.status).toBe('mismatch');
    expect(e.reason).toContain('return SAW-LGW');
    expect(e.reason).not.toContain('outbound');
  });

  it('an itinerary that changes airport between flights is unknown', () => {
    expect(status(google([{ from: ['LGW'], to: ['IST'], segments: [['LGW', 'ATH'], ['SKG', 'IST']] }, BACK]))).toBe('unknown');
  });

  it('three or more legs are not a round trip', () => {
    expect(status(google([OUT, BACK, BACK]))).toBe('unknown');
  });

  it('KAYAK paths are search evidence only and never match', () => {
    expect(status('https://www.kayak.co.uk/flights/LGW-IST/2026-12-15/2026-12-29')).toBe('unknown');
    expect(status('https://www.kayak.co.uk/flights/LGW-IST/2026-12-15')).toBe('unknown');
  });

  it('a KAYAK multi-city path with an incompatible SAW return is a mismatch', () => {
    const e = getAirportPairEvidence('https://www.kayak.co.uk/flights/LGW-IST/2026-12-15/SAW-LGW/2026-12-29', 'LGW', 'IST');
    expect(e.status).toBe('mismatch');
    expect(e.reason).toContain('return SAW-LGW');
  });

  it('a KAYAK path with unsupported trailing tokens is unknown', () => {
    expect(status('https://www.kayak.co.uk/flights/LGW-IST/2026-12-15/2026-12-29/SAW')).toBe('unknown');
    expect(status('https://www.kayak.co.uk/flights/LGW-IST/2026-12-15/2026-12-29/1adults')).toBe('unknown');
    expect(status('https://www.kayak.co.uk/flights/LGW-SAW/2026-12-15/2026-12-29/1adults')).toBe('mismatch');
  });

  it('the real LGW-SAW observation URL is a mismatch on both legs', () => {
    const e = getAirportPairEvidence(SAW_URL, 'LGW', 'IST');
    expect(e.status).toBe('mismatch');
    expect(e.reason).toContain('outbound LGW-SAW');
    expect(e.reason).toContain('return SAW-LGW');
  });
});

describe('P1: conflicting or duplicated airport evidence', () => {
  it('a requested IST search with a selected LGW→SAW flight is a mismatch', () => {
    expect(status(google([{ from: ['LGW'], to: ['IST'], segments: [['LGW', 'SAW']] }, BACK]))).toBe('mismatch');
  });

  it('a requested SAW search with selected IST flights is a mismatch', () => {
    expect(status(google([{ from: ['LGW'], to: ['SAW'], segments: [['LGW', 'IST']] }, BACK]))).toBe('mismatch');
  });

  it('duplicate destination references IST then SAW are a mismatch', () => {
    expect(status(google([{ from: ['LGW'], to: ['IST', 'SAW'], segments: [['LGW', 'IST']] }, BACK]))).toBe('mismatch');
  });

  it('duplicated identical references are ambiguous, never a match', () => {
    expect(status(google([{ from: ['LGW'], to: ['IST', 'IST'], segments: [['LGW', 'IST']] }, BACK]))).toBe('unknown');
  });

  it('a segment with two arrival airports is malformed, never a match', () => {
    const dupArrival: Bytes = [...len(1, str('LGW')), ...len(3, str('IST')), ...len(3, str('SAW'))];
    const legBytes: Bytes = [...len(4, dupArrival), ...len(13, airportRef('LGW')), ...len(14, airportRef('IST'))];
    const bytes: Bytes = [...num(1, 28), ...len(3, legBytes), ...len(3, leg(BACK))];
    expect(status(`https://www.google.com/travel/flights/booking?tfs=${b64url(bytes)}`)).toBe('unknown');
  });

  it('more than one tfs parameter is unknown', () => {
    expect(status(`${IST_ITINERARY_URL}&tfs=${b64url(tfsBytes([{ from: ['LGW'], to: ['SAW'], segments: [['LGW', 'SAW']] }, BACK]))}`)).toBe('unknown');
  });
});

describe('P2: only allowlisted hosts are read', () => {
  it('lookalike or attacker-controlled KAYAK and Google hosts are unknown', () => {
    for (const host of ['kayak.attacker.com', 'www.kayak.co.uk.evil.example', 'evilkayak.co.uk', 'kayak.co']) {
      expect(status(`https://${host}/flights/LGW-SAW/2026-12-15/2026-12-29`), host).toBe('unknown');
    }
    for (const host of ['google.com.evil.example', 'www.google.com.evil.example', 'flights.google.com']) {
      expect(status(google([OUT, BACK], { host })), host).toBe('unknown');
    }
  });

  it('a non-https URL is unknown', () => {
    expect(status(IST_ITINERARY_URL.replace('https://', 'http://'))).toBe('unknown');
    expect(status('http://www.kayak.co.uk/flights/LGW-SAW/2026-12-15/2026-12-29')).toBe('unknown');
  });

  it('a Google URL outside the flights paths is unknown', () => {
    expect(status(IST_ITINERARY_URL.replace('/travel/flights/booking', '/travel/hotels'))).toBe('unknown');
  });
});

describe('P2: malformed, truncated or partially decoded evidence is never a match', () => {
  const valid = tfsBytes([OUT, BACK]);
  const url = (bytes: Bytes) => `https://www.google.com/travel/flights/booking?tfs=${b64url(bytes)}`;

  it('a trailing fixed64 or fixed32 tag with no payload is unknown', () => {
    expect(status(url([...valid, ...varint(30 * 8 + 1)]))).toBe('unknown');
    expect(status(url([...valid, ...varint(30 * 8 + 5), 0, 0]))).toBe('unknown');
  });

  it('a truncated length-delimited field or varint is unknown', () => {
    // Drops the 3-byte trailing field 19 plus the last byte of the return leg.
    expect(status(url(valid.slice(0, -4)))).toBe('unknown');
    expect(status(url([...valid, 0x80]))).toBe('unknown');
  });

  it('an over-long or out-of-range varint is unknown', () => {
    expect(status(url([...valid, ...num(30, 0).slice(0, 1), 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]))).toBe('unknown');
  });

  it('field number zero and group wire types are unknown', () => {
    expect(status(url([...valid, 0x00, 0x00]))).toBe('unknown');
    expect(status(url([...valid, ...varint(30 * 8 + 3)]))).toBe('unknown');
  });

  it('invalid base64, padding and impossible lengths are unknown', () => {
    expect(status(`https://www.google.com/travel/flights/booking?tfs=${b64url(valid)}=`)).toBe('unknown');
    expect(status(`https://www.google.com/travel/flights/booking?tfs=${b64url(valid)}%21`)).toBe('unknown');
    expect(status('https://www.google.com/travel/flights/booking?tfs=A')).toBe('unknown');
    expect(status('https://www.google.com/travel/flights/search?tfs=AAAA')).toBe('unknown');
  });

  it('an airport code that is not three letters is unknown', () => {
    expect(status(google([{ from: ['LGW'], to: ['IS'], segments: [['LGW', 'IST']] }, BACK]))).toBe('unknown');
  });

  it('a real archived URL that is truncated (booking path with padding) stays unknown', () => {
    expect(status('https://www.google.com/travel/flights/booking?tfs=CBwQAhpoEgoyMDI2LTEwLTE3Ih0KA01BThIKMjAyNi0xMC0xNyIdA0JBSCoCR0YyAzc1MmoMCAISCC9tLzA1MmJ3cg=', 'MAN', 'BAH')).toBe('unknown');
  });

  it('missing, free-text or unparseable URLs are unknown', () => {
    expect(status(undefined)).toBe('unknown');
    expect(status(Q_URL)).toBe('unknown');
    expect(status('not a url')).toBe('unknown');
  });
});

describe('P2: city codes are not exact airports', () => {
  it('a KAYAK LON search is not a mismatch for a Heathrow route (and not a match)', () => {
    expect(status('https://www.kayak.co.uk/flights/LON-DXB/2026-12-15/2026-12-29', 'LHR', 'DXB')).toBe('unknown');
  });

  it('LHR and LON are not interchangeable: LON never establishes LHR', () => {
    expect(status(google([{ from: ['LON'], to: ['DXB'], segments: [['LHR', 'DXB']] }, { from: ['DXB'], to: ['LHR'], segments: [['DXB', 'LHR']] }]), 'LHR', 'DXB')).toBe('unknown');
  });

  it('a Google city-level (non-airport) reference is not a match on the strict route', () => {
    expect(status(google([{ from: ['LGW'], to: ['IST'], fromKind: 2, segments: [['LGW', 'IST']] }, BACK]))).toBe('unknown');
  });

  it('an unrecognised KAYAK code never causes a mismatch on a non-strict route', () => {
    expect(isAirportPairPublishable('https://www.kayak.co.uk/flights/LON-DXB/2026-12-15/2026-12-29', 'london-heathrow-dubai', 'LHR', 'DXB')).toBe(true);
  });

  it('IST and SAW are never interchangeable', () => {
    expect(status('https://www.kayak.co.uk/flights/LGW-SAW/2026-12-15/2026-12-29')).toBe('mismatch');
    expect(status(google([{ from: ['LGW'], to: ['SAW'], segments: [['LGW', 'SAW']] }, { from: ['SAW'], to: ['LGW'], segments: [['SAW', 'LGW']] }]))).toBe('mismatch');
  });
});

describe('Codex round 2, finding 1: fixed-width duplicates of airport fields are malformed, never a match', () => {
  const fixed32 = (field: number): Bytes => [...varint(field * 8 + 5), 0, 0, 0, 0];
  const fixed64 = (field: number): Bytes => [...varint(field * 8 + 1), 0, 0, 0, 0, 0, 0, 0, 0];
  const url = (bytes: Bytes) => `https://www.google.com/travel/flights/booking?tfs=${b64url(bytes)}`;
  const legWith = (extraSegment: Bytes, extraRef: Bytes, extraLeg: Bytes): Bytes => [
    ...len(4, [...segment('LGW', 'IST'), ...extraSegment]),
    ...len(13, [...airportRef('LGW'), ...extraRef]),
    ...len(14, airportRef('IST')),
    ...extraLeg,
  ];
  const trip = (outbound: Bytes, tail: Bytes = []): Bytes => [...num(1, 28), ...len(3, outbound), ...len(3, leg(BACK)), ...tail];

  it('the exact Codex reproduction (arrival given as IST and as a fixed32) is unknown and rejected by ingestion', () => {
    const reproduction = 'https://www.google.com/travel/flights/booking?tfs=GhEiDwoDTEdXGgNJU1QdAAAAABoMIgoKA0lTVBoDTEdX';
    expect(status(reproduction)).toBe('unknown');
    expect(isAirportPairPublishable(reproduction, 'london-gatwick-istanbul', 'LGW', 'IST')).toBe(false);
    const profile = { observedDate: '2026-10-19', departureDate: '2026-12-15', returnDate: '2026-12-29', observationReason: 'routine-weekly' } as WeeklyFareProfile;
    const entry = { routeSlug: 'london-gatwick-istanbul', usable: true, fare: 162, airline: 'Pegasus', outboundDirectness: 'direct', returnDirectness: 'direct', baggage: 'not stated', source: 'google-flights', profileIdOverride: 'london-gatwick-istanbul-ist-economy-test-v1', sourceUrl: reproduction } as WeeklyFareEvidenceEntry;
    expect(validateWeeklyFareEntry(entry, profile, []).status).toBe('INVALID');
  });

  it('the same layout without the fixed32 duplicate is still a valid match (control)', () => {
    expect(status(url(trip(legWith([], [], []))))).toBe('match');
  });

  it('fixed32 or fixed64 duplicates of a segment departure or arrival are unknown', () => {
    expect(status(url(trip(legWith(fixed32(3), [], []))))).toBe('unknown');
    expect(status(url(trip(legWith(fixed64(3), [], []))))).toBe('unknown');
    expect(status(url(trip(legWith(fixed32(1), [], []))))).toBe('unknown');
    expect(status(url(trip(legWith(fixed64(1), [], []))))).toBe('unknown');
  });

  it('fixed-width duplicates of an airport reference kind or code are unknown', () => {
    expect(status(url(trip(legWith([], fixed32(2), []))))).toBe('unknown');
    expect(status(url(trip(legWith([], fixed64(1), []))))).toBe('unknown');
  });

  it('fixed-width airport-reference, segment or leg fields at the leg and trip levels are unknown', () => {
    expect(status(url(trip(legWith([], [], fixed32(14)))))).toBe('unknown');
    expect(status(url(trip(legWith([], [], fixed64(13)))))).toBe('unknown');
    expect(status(url(trip(legWith([], [], fixed32(4)))))).toBe('unknown');
    expect(status(url(trip(legWith([], [], []), fixed64(3))))).toBe('unknown');
  });
});

describe('Codex round 2, finding 2: multi-city URLs with more than two legs are unknown, not a mismatch', () => {
  const stopover = 'https://www.kayak.co.uk/flights/MAN-ATH/2026-12-15/ATH-IST/2026-12-16/IST-MAN/2026-12-29';
  const profile = { observedDate: '2026-10-19', departureDate: '2026-12-15', returnDate: '2026-12-29', observationReason: 'routine-weekly' } as WeeklyFareProfile;
  const entry = (routeSlug: string, sourceUrl: string) =>
    ({ routeSlug, usable: true, fare: 200, airline: 'Test', outboundDirectness: 'connecting', returnDirectness: 'direct', baggage: 'not stated', source: 'google-flights', profileIdOverride: `${routeSlug}-economy-test-v1`, sourceUrl }) as WeeklyFareEvidenceEntry;

  it('the exact Codex reproduction (MAN-IST via an Athens stopover) is unknown and still publishable on its non-strict route', () => {
    expect(status(stopover, 'MAN', 'IST')).toBe('unknown');
    expect(isAirportPairPublishable(stopover, 'manchester-istanbul', 'MAN', 'IST')).toBe(true);
    expect(validateWeeklyFareEntry(entry('manchester-istanbul', stopover), profile, []).issues.some((i) => i.field === 'sourceUrl')).toBe(false);
  });

  it('a Google three-leg stopover itinerary is unknown, not a mismatch', () => {
    const legs: LegSpec[] = [
      { from: ['MAN'], to: ['ATH'], segments: [['MAN', 'ATH']] },
      { from: ['ATH'], to: ['IST'], segments: [['ATH', 'IST']] },
      { from: ['IST'], to: ['MAN'], segments: [['IST', 'MAN']] },
    ];
    expect(status(google(legs), 'MAN', 'IST')).toBe('unknown');
  });

  it('a three-leg journey through SAW can never qualify for LGW-IST and is rejected by ingestion', () => {
    const viaSaw = google([
      { from: ['LGW'], to: ['SAW'], segments: [['LGW', 'SAW']] },
      { from: ['SAW'], to: ['IST'], segments: [['SAW', 'IST']] },
      { from: ['IST'], to: ['LGW'], segments: [['IST', 'LGW']] },
    ]);
    expect(status(viaSaw)).toBe('unknown');
    expect(isAirportPairPublishable(viaSaw, 'london-gatwick-istanbul', 'LGW', 'IST')).toBe(false);
    expect(validateWeeklyFareEntry(entry('london-gatwick-istanbul', viaSaw), profile, []).status).toBe('INVALID');
  });

  it('an explicit SAW arrival or SAW return departure on a one-way or round trip is still a mismatch', () => {
    expect(status(google([{ from: ['LGW'], to: ['SAW'], segments: [['LGW', 'SAW']] }]))).toBe('mismatch');
    expect(status(google([OUT, { from: ['SAW'], to: ['LGW'], segments: [['SAW', 'LGW']] }]))).toBe('mismatch');
    expect(status('https://www.kayak.co.uk/flights/LGW-IST/2026-12-15/SAW-LGW/2026-12-29')).toBe('mismatch');
  });

  it('a properly evidenced LGW-IST round trip still matches', () => {
    expect(status(IST_ITINERARY_URL)).toBe('match');
  });
});

describe('publication rule: mismatches never publish; the strict route needs an itinerary match', () => {
  it('london-gatwick-istanbul is the only strict route', () => {
    expect([...STRICT_AIRPORT_PAIR_ROUTE_SLUGS]).toEqual(['london-gatwick-istanbul']);
  });

  it('on the strict IST route only a complete LGW-IST itinerary can publish; anything else fails closed', () => {
    expect(isAirportPairPublishable(IST_ITINERARY_URL, 'london-gatwick-istanbul', 'LGW', 'IST')).toBe(true);
    for (const url of [SAW_URL, IST_SEARCH_URL, Q_URL, undefined, google([OUT]), 'https://www.kayak.co.uk/flights/LGW-IST/2026-12-15/2026-12-29']) {
      expect(isAirportPairPublishable(url, 'london-gatwick-istanbul', 'LGW', 'IST'), String(url)).toBe(false);
    }
  });

  it('on other routes a mismatch never publishes but unknown legacy evidence is unchanged', () => {
    expect(isAirportPairPublishable(SAW_URL, 'manchester-istanbul', 'LGW', 'IST')).toBe(false);
    expect(isAirportPairPublishable(Q_URL, 'manchester-istanbul', 'MAN', 'IST')).toBe(true);
  });

  it('across the whole archive only the already-excluded LGW-SAW observation is an airport mismatch', () => {
    const mismatches = fareObservations.filter((o) => {
      const r = getRouteBySlug(o.routeSlug);
      const originCode = r && getAirportBySlug(r.airportSlug)?.code;
      const destinationCode = r && getDestinationBySlug(r.destinationSlug)?.iataCode;
      return originCode && destinationCode ? status(o.sourceUrl, originCode, destinationCode) === 'mismatch' : false;
    });
    expect(mismatches.map((o) => o.id)).toEqual(['obs-lgw-saw-economy-20260814-8w-v1']);
    expect(isMethodologyExcluded('obs-lgw-saw-economy-20260814-8w-v1')).toBe(true);
  });
});

describe('Gatwick to Istanbul: SAW fares can never publish, now or after a future renewal', () => {
  const r = route('london-gatwick-istanbul');
  const lgwIst = fareObservations.filter((o) => o.routeSlug === 'london-gatwick-istanbul');
  const sawObs = lgwIst.filter((o) => /SAW|Sabiha/i.test(`${o.profileId ?? ''} ${o.priceNote} ${o.sourceUrl ?? ''}`));

  it('keeps the route identity and stays verification-pending with no publishable fare', () => {
    expect(r.destinationSlug).toBe('istanbul');
    expect(getEffectiveRoutePresentation(r, routeStatusEvents, NOW).status).toBe('unverified');
    expect(getPublishableObservationsByRoute('london-gatwick-istanbul', NOW)).toHaveLength(0);
  });

  it('the known £162 Pegasus SAW observation is excluded but preserved unchanged in the archive', () => {
    const o = fareObservations.find((x) => x.id === 'obs-lgw-ist-economy-20260818-8w-v1')!;
    expect(o).toMatchObject({ routeSlug: 'london-gatwick-istanbul', price: 162, source: 'Pegasus', profileId: 'london-gatwick-istanbul-saw-economy-1adult-23kg-v1' });
    expect(isMethodologyExcluded(o.id)).toBe(true);
  });

  it('every SAW observation stays unpublishable even if the route verification were renewed', () => {
    expect(sawObs.map((o) => o.id).sort()).toEqual([
      'obs-lgw-ist-economy-20260814-8w-v1',
      'obs-lgw-ist-economy-20260818-8w-v1',
      'obs-lgw-ist-economy-20260901-8w-v1',
      'obs-lgw-ist-economy-20260916-8w-v1',
      'obs-lgw-saw-economy-20260814-8w-v1',
    ]);
    const renewedRoute = renewed(r);
    expect(getEffectiveRoutePresentation(renewedRoute, routeStatusEvents, NOW).status).toBe('direct');
    for (const o of sawObs) expect(isObservationPublishable(o, renewedRoute, NOW), o.id).toBe(false);
  });

  it('the £162 SAW fare cannot publish even if it were relabelled with IST itinerary evidence, because it stays excluded', () => {
    const o = fareObservations.find((x) => x.id === 'obs-lgw-ist-economy-20260818-8w-v1')!;
    expect(isObservationPublishable({ ...o, sourceUrl: IST_ITINERARY_URL }, renewed(r), NOW)).toBe(false);
  });

  it('no archived observation on this route has itinerary-level IST evidence, so none would publish after a renewal', () => {
    const renewedRoute = renewed(r);
    for (const o of lgwIst) {
      expect(status(o.sourceUrl), o.id).not.toBe('match');
      expect(isObservationPublishable(o, renewedRoute, NOW), o.id).toBe(false);
    }
  });

  it('a correctly evidenced IST observation would publish after a renewal', () => {
    const base = fareObservations.find((x) => x.id === 'obs-lgw-ist-economy-20260929-v1')!;
    const evidenced: FareObservation = { ...base, sourceUrl: IST_ITINERARY_URL };
    expect(isObservationPublishable(base, renewed(r), NOW)).toBe(false);
    expect(isObservationPublishable(evidenced, renewed(r), NOW)).toBe(true);
  });

  it('the route slug, observation id or profile id never substitute for airport evidence', () => {
    const base = fareObservations.find((x) => x.id === 'obs-lgw-ist-economy-20260929-v1')!;
    const sawItinerary = google([{ from: ['LGW'], to: ['IST'], segments: [['LGW', 'SAW']] }, { from: ['IST'], to: ['LGW'], segments: [['SAW', 'LGW']] }]);
    const disguised: FareObservation = { ...base, id: 'obs-lgw-ist-economy-test-v1', profileId: 'london-gatwick-istanbul-ist-economy-test-v1', sourceUrl: sawItinerary };
    expect(isObservationPublishable(disguised, renewed(r), NOW)).toBe(false);
  });
});

describe('ingestion applies the same airport rule', () => {
  const profile = { observedDate: '2026-10-19', departureDate: '2026-12-15', returnDate: '2026-12-29', observationReason: 'routine-weekly' } as WeeklyFareProfile;
  const base = {
    routeSlug: 'london-gatwick-istanbul',
    usable: true,
    fare: 162,
    airline: 'Pegasus',
    outboundDirectness: 'direct',
    returnDirectness: 'direct',
    baggage: 'not stated',
    source: 'google-flights',
    profileIdOverride: 'london-gatwick-istanbul-ist-economy-test-v1',
  } as WeeklyFareEvidenceEntry;
  const airportIssue = (sourceUrl: string | undefined, over: Partial<WeeklyFareEvidenceEntry> = {}) =>
    validateWeeklyFareEntry({ ...base, ...over, sourceUrl }, profile, []).issues.find((i) => i.field === 'sourceUrl');

  it('rejects a SAW itinerary even though the route slug and profile id say IST', () => {
    const result = validateWeeklyFareEntry({ ...base, sourceUrl: SAW_URL }, profile, []);
    expect(result.status).toBe('INVALID');
    expect(airportIssue(SAW_URL)?.message).toContain('LGW-SAW');
  });

  it('rejects a conflicting IST search with a selected SAW flight', () => {
    expect(airportIssue(google([{ from: ['LGW'], to: ['IST'], segments: [['LGW', 'SAW']] }, BACK]))).toBeDefined();
  });

  it('rejects missing, free-text, search-only, one-way and KAYAK evidence on the strict route', () => {
    for (const url of [undefined, Q_URL, IST_SEARCH_URL, google([OUT]), 'https://www.kayak.co.uk/flights/LGW-IST/2026-12-15/2026-12-29']) {
      expect(validateWeeklyFareEntry({ ...base, sourceUrl: url }, profile, []).status, String(url)).toBe('INVALID');
      expect(airportIssue(url), String(url)).toBeDefined();
    }
  });

  it('accepts a complete LGW-IST itinerary without an airport issue', () => {
    expect(airportIssue(IST_ITINERARY_URL)).toBeUndefined();
  });

  it('leaves non-strict routes unchanged for free-text and city-level evidence', () => {
    expect(airportIssue(Q_URL, { routeSlug: 'manchester-istanbul', profileIdOverride: 'manchester-istanbul-economy-test-v1' })).toBeUndefined();
    expect(airportIssue('https://www.kayak.co.uk/flights/LON-DXB/2026-12-15/2026-12-29', { routeSlug: 'london-heathrow-dubai', profileIdOverride: 'london-heathrow-dubai-economy-test-v1' })).toBeUndefined();
  });
});
