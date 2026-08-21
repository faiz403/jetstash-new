import { describe, it, expect } from 'vitest';
import type { FareObservation } from '@/data/fare-observations';
import {
  validateWeeklyFareEntry,
  validateWeeklyFareEvidenceBatch,
  checkManifestCompleteness,
  generateFareObservationCode,
  summarizeWeeklyFareBatch,
  resolveProfileId,
  WEEKLY_FARE_PROFILE_2026_08_18,
  type WeeklyFareEvidenceEntry,
} from '@/lib/weekly-fare-ingest';

/**
 * Weekly Full Fare Observation Refresh — Stage B ingestion helper tests.
 *
 * Every fixture here is synthetic and used ONLY to prove the validator's
 * behaviour. None of these are ever written to data/fare-observations.ts —
 * this file never imports or mutates the real archive, only reads it (for
 * duplicate-detection tests) via the real `fareObservations` export.
 */

const profile = WEEKLY_FARE_PROFILE_2026_08_18;
const noExistingObservations: FareObservation[] = [];

describe('validateWeeklyFareEntry — locked profile constant', () => {
  it('matches the 18 August 2026 run exactly (2026-10-13 to 2026-10-27, routine-weekly)', () => {
    expect(profile).toEqual({
      observedDate: '2026-08-18',
      departureDate: '2026-10-13',
      returnDate: '2026-10-27',
      observationReason: 'routine-weekly',
    });
  });
});

describe('1. simple direct return', () => {
  it('a fully-evidenced direct-both-ways observation validates and prepares a record', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 480,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
      sourceUrl: 'https://www.google.com/travel/flights?q=example',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('VALID');
    expect(result.issues).toEqual([]);
    expect(result.preparedObservation?.fareDirectness).toBe('direct');
    expect(result.preparedObservation?.price).toBe(480);
    expect(result.preparedObservation?.currency).toBe('GBP');
    expect(result.preparedObservation?.departureDate).toBe('2026-10-13');
    expect(result.preparedObservation?.returnDate).toBe('2026-10-27');
    expect(result.preparedObservation?.comparisonEligibility).toBe('current');
    expect(result.isRouteVerificationBlocked).toBe(false);
  });

  it('generates a "-baseline-v1" profileId, never "-23kg-v1", when the route has NO historical observation at all — a genuinely first-ever check (audited 18 August 2026; see obs-man-dxb-economy-20260806-8w-v1 for the archive\'s own precedent for this exact naming)', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 480,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.preparedObservation?.profileId).toBe('manchester-dubai-economy-1adult-baseline-v1');
    expect(result.preparedObservation?.profileId).not.toContain('23kg');
  });
});

describe('resolveProfileId — Fare Profile Decision Audit (18 August 2026): profileId is an opaque, stable comparison-series identifier, never baggage evidence; a new observation must continue its route\'s existing series, never invent a fresh one out from under it', () => {
  it('REGRESSION — Manchester–Dubai: exactly one historical profileId ("-baseline-v1", its own already-established series) is continued automatically, with no override needed', () => {
    const existing: FareObservation = {
      id: 'obs-man-dxb-economy-20260806-8w-v1',
      routeSlug: 'manchester-dubai',
      cabin: 'Economy',
      observedDate: '2026-08-06',
      price: 480,
      priceNote: 'return, per person',
      source: 'Gulf Air',
      profileId: 'manchester-dubai-economy-1adult-baseline-v1',
    };
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 350,
      airline: 'Pegasus',
      outboundDirectness: 'connecting',
      returnDirectness: 'connecting',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, [existing]);
    expect(result.status).toBe('VALID');
    expect(result.preparedObservation?.profileId).toBe('manchester-dubai-economy-1adult-baseline-v1');
  });

  it('REGRESSION — a genuinely first-ever observation for a route (zero historical profileIds) mints the neutral "-baseline-v1" convention', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-agadir',
      usable: true,
      fare: 94,
      airline: 'Ryanair',
      outboundDirectness: 'connecting',
      returnDirectness: 'connecting',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, []);
    expect(result.status).toBe('VALID');
    expect(result.preparedObservation?.profileId).toBe('manchester-agadir-economy-1adult-baseline-v1');
  });

  it('a route with exactly one historical "-23kg-v1" series continues it exactly, even though the token itself is a legacy naming habit, not baggage evidence', () => {
    const existing: FareObservation = {
      id: 'obs-man-lhe-economy-20260806-8w-v1',
      routeSlug: 'manchester-lahore',
      cabin: 'Economy',
      observedDate: '2026-08-06',
      price: 638,
      priceNote: 'return, per person',
      source: 'Turkish Airlines',
      baggage: 'not stated',
      profileId: 'manchester-lahore-economy-1adult-23kg-v1',
    };
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-lahore',
      usable: true,
      fare: 628,
      airline: 'Etihad',
      outboundDirectness: 'connecting',
      returnDirectness: 'connecting',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, [existing]);
    expect(result.status).toBe('VALID');
    expect(result.preparedObservation?.profileId).toBe('manchester-lahore-economy-1adult-23kg-v1');
    // The continued profileId says nothing about this observation's own
    // baggage evidence — that remains exactly what was supplied.
    expect(result.preparedObservation?.baggage).toBe('not stated');
  });

  it('REGRESSION — London Gatwick–Istanbul: two competing historical profileIds (a superseded, methodology-excluded generic series and the current valid exact-airport "-saw-" series) fail closed WITHOUT an override — the helper never guesses, never picks "most recent" or "most common"', () => {
    const supersededExcluded: FareObservation = {
      id: 'obs-lgw-ist-economy-20260814-8w-v1',
      routeSlug: 'london-gatwick-istanbul',
      cabin: 'Economy',
      observedDate: '2026-08-14',
      price: 149,
      priceNote: 'return, per person',
      source: 'Pegasus',
      profileId: 'london-gatwick-istanbul-economy-1adult-23kg-v1',
    };
    const currentValid: FareObservation = {
      id: 'obs-lgw-saw-economy-20260814-8w-v1',
      routeSlug: 'london-gatwick-istanbul',
      cabin: 'Economy',
      observedDate: '2026-08-14',
      price: 149,
      priceNote: 'return, per person; exact-destination search LGW-SAW',
      source: 'Pegasus',
      profileId: 'london-gatwick-istanbul-saw-economy-1adult-23kg-v1',
    };
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'london-gatwick-istanbul',
      usable: true,
      fare: 162,
      airline: 'Pegasus',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, [supersededExcluded, currentValid]);
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.field === 'profileId')).toBe(true);
    expect(result.issues.find((i) => i.field === 'profileId')?.message).toContain('london-gatwick-istanbul-economy-1adult-23kg-v1');
    expect(result.issues.find((i) => i.field === 'profileId')?.message).toContain('london-gatwick-istanbul-saw-economy-1adult-23kg-v1');
    expect(result.preparedObservation).toBeNull();
  });

  it('REGRESSION — London Gatwick–Istanbul: WITH an explicit profileIdOverride pointing at the current valid "-saw-" series, the entry validates and never revives the superseded generic series', () => {
    const supersededExcluded: FareObservation = {
      id: 'obs-lgw-ist-economy-20260814-8w-v1',
      routeSlug: 'london-gatwick-istanbul',
      cabin: 'Economy',
      observedDate: '2026-08-14',
      price: 149,
      priceNote: 'return, per person',
      source: 'Pegasus',
      profileId: 'london-gatwick-istanbul-economy-1adult-23kg-v1',
    };
    const currentValid: FareObservation = {
      id: 'obs-lgw-saw-economy-20260814-8w-v1',
      routeSlug: 'london-gatwick-istanbul',
      cabin: 'Economy',
      observedDate: '2026-08-14',
      price: 149,
      priceNote: 'return, per person; exact-destination search LGW-SAW',
      source: 'Pegasus',
      profileId: 'london-gatwick-istanbul-saw-economy-1adult-23kg-v1',
    };
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'london-gatwick-istanbul',
      usable: true,
      fare: 162,
      airline: 'Pegasus',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
      profileIdOverride: 'london-gatwick-istanbul-saw-economy-1adult-23kg-v1',
    };
    const result = validateWeeklyFareEntry(entry, profile, [supersededExcluded, currentValid]);
    expect(result.status).toBe('VALID');
    expect(result.preparedObservation?.profileId).toBe('london-gatwick-istanbul-saw-economy-1adult-23kg-v1');
    expect(result.preparedObservation?.profileId).not.toBe('london-gatwick-istanbul-economy-1adult-23kg-v1');
  });

  it('resolveProfileId exposed directly: same three cases, tested against the pure function itself', () => {
    const noHistory = resolveProfileId('some-new-route', 'Economy', [], undefined);
    expect(noHistory).toEqual({ profileId: 'some-new-route-economy-1adult-baseline-v1', ambiguous: false, competingProfileIds: [] });

    const oneHistory = resolveProfileId(
      'manchester-dubai',
      'Economy',
      [{ id: 'x', routeSlug: 'manchester-dubai', cabin: 'Economy', observedDate: '2026-08-06', price: 1, priceNote: '', source: '', profileId: 'manchester-dubai-economy-1adult-baseline-v1' }],
      undefined
    );
    expect(oneHistory).toEqual({ profileId: 'manchester-dubai-economy-1adult-baseline-v1', ambiguous: false, competingProfileIds: [] });

    const twoHistory = resolveProfileId(
      'london-gatwick-istanbul',
      'Economy',
      [
        { id: 'a', routeSlug: 'london-gatwick-istanbul', cabin: 'Economy', observedDate: '2026-08-14', price: 1, priceNote: '', source: '', profileId: 'london-gatwick-istanbul-economy-1adult-23kg-v1' },
        { id: 'b', routeSlug: 'london-gatwick-istanbul', cabin: 'Economy', observedDate: '2026-08-14', price: 1, priceNote: '', source: '', profileId: 'london-gatwick-istanbul-saw-economy-1adult-23kg-v1' },
      ],
      undefined
    );
    expect(twoHistory.ambiguous).toBe(true);
    expect(twoHistory.profileId).toBeNull();
    expect(twoHistory.competingProfileIds).toHaveLength(2);

    const overridden = resolveProfileId(
      'london-gatwick-istanbul',
      'Economy',
      [
        { id: 'a', routeSlug: 'london-gatwick-istanbul', cabin: 'Economy', observedDate: '2026-08-14', price: 1, priceNote: '', source: '', profileId: 'london-gatwick-istanbul-economy-1adult-23kg-v1' },
        { id: 'b', routeSlug: 'london-gatwick-istanbul', cabin: 'Economy', observedDate: '2026-08-14', price: 1, priceNote: '', source: '', profileId: 'london-gatwick-istanbul-saw-economy-1adult-23kg-v1' },
      ],
      'london-gatwick-istanbul-saw-economy-1adult-23kg-v1'
    );
    expect(overridden).toEqual({ profileId: 'london-gatwick-istanbul-saw-economy-1adult-23kg-v1', ambiguous: false, competingProfileIds: [] });
  });
});

describe('2. connecting both ways', () => {
  it('records fareDirectness connecting when either leg shows a stop', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 520,
      airline: 'Gulf Air',
      outboundDirectness: 'connecting',
      outboundConnectionAirports: ['Bahrain (BAH)'],
      returnDirectness: 'connecting',
      returnConnectionAirports: ['Bahrain (BAH)'],
      baggage: 'not stated',
      source: 'trip.com',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('VALID');
    expect(result.preparedObservation?.fareDirectness).toBe('connecting');
    expect(result.preparedObservation?.outboundConnectionAirports).toEqual(['Bahrain (BAH)']);
    expect(result.preparedObservation?.returnConnectionAirports).toEqual(['Bahrain (BAH)']);
  });
});

describe('3. mixed airlines outbound vs return', () => {
  it('accepts a free-text airline field describing different carriers per leg', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'birmingham-mumbai',
      usable: true,
      fare: 601,
      airline: 'KLM outbound, Air India return',
      outboundDirectness: 'connecting',
      outboundConnectionAirports: ['Amsterdam (AMS)'],
      returnDirectness: 'connecting',
      returnConnectionAirports: ['Delhi (DEL)'],
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('VALID');
    expect(result.preparedObservation?.source).toBe('KLM outbound, Air India return');
    expect(result.preparedObservation?.fareDirectness).toBe('connecting');
  });
});

describe('4. airport change on a connection', () => {
  it('records a self-transfer between two different connection airports verbatim', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 399,
      airline: 'Wizz Air / Pegasus (self-transfer)',
      outboundDirectness: 'connecting',
      outboundConnectionAirports: ['Milan Malpensa (MXP) → Milan Bergamo (BGY), self-transfer'],
      returnDirectness: 'connecting',
      returnConnectionAirports: ['Istanbul Sabiha Gökçen (SAW)'],
      baggage: 'not stated',
      source: 'trip.com',
      evidenceNote: 'Outbound requires a self-transfer between two different Milan airports; not a sold-through connection.',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('VALID');
    expect(result.preparedObservation?.priceNote).toContain('Milan Malpensa');
    expect(result.preparedObservation?.priceNote).toContain('self-transfer between two different Milan airports');
  });
});

describe('5. baggage EXTRA', () => {
  it('records an explicit extra-cost baggage figure verbatim, never converts it to a number', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 410,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not included; 23kg checked bag shown as +£45 return at checkout',
      source: 'airline',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('VALID');
    expect(result.preparedObservation?.baggage).toBe('not included; 23kg checked bag shown as +£45 return at checkout');
  });
});

describe('6. baggage NOT STATED', () => {
  it('accepts the literal "not stated" string as a valid, honest baggage value', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 455,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('VALID');
    expect(result.preparedObservation?.baggage).toBe('not stated');
  });
});

describe('7. NO RESULT', () => {
  it('a genuine no-usable-observation route is recorded as NO RESULT, never a manufactured price', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: false,
      noResultReason: 'No bookable itinerary returned for the exact 13-27 October dates on any of the three approved sources.',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('NO RESULT');
    expect(result.preparedObservation).toBeNull();
  });

  it('usable: false with no reason supplied fails closed as INVALID rather than silently becoming a NO RESULT', () => {
    const entry: WeeklyFareEvidenceEntry = { routeSlug: 'manchester-dubai', usable: false };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.field === 'noResultReason')).toBe(true);
  });
});

describe('8. malformed evidence', () => {
  it('missing outboundDirectness fails closed (return fare requires BOTH legs inspected)', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 480,
      airline: 'Emirates',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.field === 'outboundDirectness')).toBe(true);
  });

  it('missing returnDirectness fails closed (never assumed from the outbound alone)', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 480,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.field === 'returnDirectness')).toBe(true);
  });

  it('missing fare fails closed', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.field === 'fare')).toBe(true);
  });

  it('zero/negative fare fails closed, never accepted as a placeholder', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 0,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.field === 'fare')).toBe(true);
  });

  it('an unapproved source (e.g. a scraper label) fails closed', () => {
    const entry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 480,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'skyscanner-scrape',
    } as unknown as WeeklyFareEvidenceEntry;
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.field === 'source')).toBe(true);
  });

  it('an origin/destination cross-check mismatch fails closed (catches a mistyped route slug)', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      origin: 'MAN',
      destination: 'AUH', // wrong — manchester-dubai's destination is DXB
      usable: true,
      fare: 480,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.field === 'destination')).toBe(true);
  });
});

describe('9. duplicate observation', () => {
  it('an id collision against an existing archive entry is rejected', () => {
    const existing: FareObservation = {
      id: 'obs-man-dxb-economy-20260818-8w-v1',
      routeSlug: 'manchester-dubai',
      cabin: 'Economy',
      observedDate: '2026-08-18',
      price: 480,
      priceNote: 'return, per person',
      source: 'Emirates',
    };
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 495,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, [existing]);
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.field === 'id')).toBe(true);
  });

  it('a near-duplicate (same route/cabin/dates/price/source) already in the archive is flagged', () => {
    const existing: FareObservation = {
      id: 'obs-man-dxb-economy-some-other-id-v1',
      routeSlug: 'manchester-dubai',
      cabin: 'Economy',
      observedDate: '2026-08-11',
      price: 480,
      priceNote: 'return, per person',
      source: 'Emirates',
      departureDate: '2026-10-13',
      returnDate: '2026-10-27',
    };
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 480,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, [existing]);
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.field === 'duplicate')).toBe(true);
  });

  it('a route repeated twice within the same supplied batch is rejected on the second occurrence', () => {
    const entries: WeeklyFareEvidenceEntry[] = [
      {
        routeSlug: 'manchester-dubai',
        usable: true,
        fare: 480,
        airline: 'Emirates',
        outboundDirectness: 'direct',
        returnDirectness: 'direct',
        baggage: 'not stated',
        source: 'google-flights',
      },
      {
        routeSlug: 'manchester-dubai',
        usable: true,
        fare: 495,
        airline: 'Emirates',
        outboundDirectness: 'direct',
        returnDirectness: 'direct',
        baggage: 'not stated',
        source: 'trip.com',
      },
    ];
    const results = validateWeeklyFareEvidenceBatch(entries, profile, noExistingObservations);
    expect(results[0].status).toBe('VALID');
    expect(results[1].status).toBe('INVALID');
    expect(results[1].issues.some((i) => i.message.includes('more than once'))).toBe(true);
  });
});

describe('10. nonexistent route', () => {
  it('a route slug not present in data/routes.ts fails closed immediately', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'nonexistent-route-slug',
      usable: true,
      fare: 480,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.field === 'routeSlug')).toBe(true);
    expect(result.preparedObservation).toBeNull();
  });
});

describe('Route-verification and fare-observation truth stay separate', () => {
  it('an unverified route can still produce a VALID prepared observation, flagged as blocked — never silently dropped, never used to change verification', () => {
    // manchester-karachi was this fixture until COV-001 (21 August 2026)
    // reclassified it to verified-connecting — see
    // docs/project-control/ROUTE_VERIFICATION_CADENCE_POLICY.md, Batch 3.
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'birmingham-ahmedabad', // currently unverified in data/routes.ts
      usable: true,
      fare: 495,
      airline: 'Air India',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'airline',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.status).toBe('VALID');
    expect(result.isRouteVerificationBlocked).toBe(true);
    // The prepared observation itself carries no verification-block field —
    // publication eligibility is derived later, at render time, from the
    // route's own record via isObservationPublishable(). This module never
    // encodes a publication decision into the observation itself.
    expect(result.preparedObservation).not.toBeNull();
  });
});

describe('publicationNote and sourceDetail — accepted input fields must actually be used, never silently dropped', () => {
  it('publicationNote is carried through verbatim on the validation result, on every status, and never written into the prepared FareObservation itself', () => {
    const valid = validateWeeklyFareEntry(
      {
        routeSlug: 'manchester-karachi',
        usable: true,
        fare: 495,
        airline: 'PIA',
        outboundDirectness: 'direct',
        returnDirectness: 'direct',
        baggage: 'not stated',
        source: 'airline',
        publicationNote: 'CURRENT ROUTE VERIFICATION BLOCK — DO NOT USE THIS FARE TO RESOLVE ROUTE VERIFICATION',
      },
      profile,
      noExistingObservations
    );
    expect(valid.publicationNote).toBe('CURRENT ROUTE VERIFICATION BLOCK — DO NOT USE THIS FARE TO RESOLVE ROUTE VERIFICATION');
    expect(JSON.stringify(valid.preparedObservation)).not.toContain('VERIFICATION BLOCK');

    const noResult = validateWeeklyFareEntry(
      { routeSlug: 'manchester-dubai', usable: false, noResultReason: 'no bookable result', publicationNote: 'demo note' },
      profile,
      noExistingObservations
    );
    expect(noResult.publicationNote).toBe('demo note');

    const invalid = validateWeeklyFareEntry(
      { routeSlug: 'nonexistent-route-slug', usable: true, fare: 1, publicationNote: 'demo note' } as WeeklyFareEvidenceEntry,
      profile,
      noExistingObservations
    );
    expect(invalid.publicationNote).toBe('demo note');
  });

  it('sourceDetail, when supplied, is folded into priceNote rather than silently dropped', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 480,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
      sourceDetail: 'Google Flights results list, GBP display confirmed before reading fare',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.preparedObservation?.priceNote).toContain('Google Flights results list, GBP display confirmed');
  });
});

describe('generateFareObservationCode', () => {
  it('renders a VALID result as a single-line TS object literal', () => {
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 480,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
      sourceUrl: 'https://www.google.com/travel/flights?q=example',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    const code = generateFareObservationCode(result);
    expect(code).not.toBeNull();
    expect(code).toContain("routeSlug: 'manchester-dubai'");
    expect(code).toContain('price: 480');
    expect(code).toContain("currency: 'GBP'");
    expect(code).toMatch(/^ {2}\{.*\},$/);
  });

  it('returns null for a NO RESULT or INVALID result — never manufactures a record', () => {
    const noResult = validateWeeklyFareEntry(
      { routeSlug: 'manchester-dubai', usable: false, noResultReason: 'no bookable result' },
      profile,
      noExistingObservations
    );
    expect(generateFareObservationCode(noResult)).toBeNull();

    const invalid = validateWeeklyFareEntry(
      { routeSlug: 'nonexistent-route-slug', usable: true, fare: 1 } as WeeklyFareEvidenceEntry,
      profile,
      noExistingObservations
    );
    expect(generateFareObservationCode(invalid)).toBeNull();
  });
});

describe('checkManifestCompleteness', () => {
  it('reports routes missing from the supplied evidence and unexpected extra slugs', () => {
    const entries: WeeklyFareEvidenceEntry[] = [
      { routeSlug: 'manchester-dubai', usable: true, fare: 1, airline: 'x', outboundDirectness: 'direct', returnDirectness: 'direct', baggage: 'not stated', source: 'google-flights' },
      { routeSlug: 'typo-route-slug', usable: false, noResultReason: 'x' },
    ];
    const { missing, unexpected } = checkManifestCompleteness(entries, ['manchester-dubai', 'birmingham-mumbai']);
    expect(missing).toEqual(['birmingham-mumbai']);
    expect(unexpected).toEqual(['typo-route-slug']);
  });

  it('an empty missing/unexpected result means the batch exactly covers the frozen universe', () => {
    const entries: WeeklyFareEvidenceEntry[] = [
      { routeSlug: 'manchester-dubai', usable: true, fare: 1, airline: 'x', outboundDirectness: 'direct', returnDirectness: 'direct', baggage: 'not stated', source: 'google-flights' },
    ];
    const { missing, unexpected } = checkManifestCompleteness(entries, ['manchester-dubai']);
    expect(missing).toEqual([]);
    expect(unexpected).toEqual([]);
  });
});

describe('summarizeWeeklyFareBatch', () => {
  it('tallies VALID / INVALID / NO RESULT counts and the route-verification-blocked count', () => {
    // manchester-karachi was this fixture until COV-001 (21 August 2026)
    // reclassified it to verified-connecting — see
    // docs/project-control/ROUTE_VERIFICATION_CADENCE_POLICY.md, Batch 3.
    const entries: WeeklyFareEvidenceEntry[] = [
      { routeSlug: 'manchester-dubai', usable: true, fare: 480, airline: 'Emirates', outboundDirectness: 'direct', returnDirectness: 'direct', baggage: 'not stated', source: 'google-flights' },
      { routeSlug: 'birmingham-ahmedabad', usable: true, fare: 495, airline: 'Air India', outboundDirectness: 'direct', returnDirectness: 'direct', baggage: 'not stated', source: 'airline' },
      { routeSlug: 'birmingham-mumbai', usable: false, noResultReason: 'no bookable result for exact dates' },
      { routeSlug: 'nonexistent-route-slug', usable: true, fare: 1 } as WeeklyFareEvidenceEntry,
    ];
    const results = validateWeeklyFareEvidenceBatch(entries, profile, noExistingObservations);
    const summary = summarizeWeeklyFareBatch(results);
    expect(summary.total).toBe(4);
    expect(summary.valid).toBe(2);
    expect(summary.invalid).toBe(1);
    expect(summary.noResult).toBe(1);
    expect(summary.routeVerificationBlockedCount).toBe(1); // birmingham-ahmedabad
  });
});

describe('never writes anything — pure functions only', () => {
  it('the module exposes no file-system or archive-mutation exports', () => {
    // Structural guard: importing the module and calling its exports must
    // never require fs/path or touch data/fare-observations.ts's export
    // array. This test simply demonstrates the full validate -> generate
    // pipeline runs entirely in memory.
    const entry: WeeklyFareEvidenceEntry = {
      routeSlug: 'manchester-dubai',
      usable: true,
      fare: 480,
      airline: 'Emirates',
      outboundDirectness: 'direct',
      returnDirectness: 'direct',
      baggage: 'not stated',
      source: 'google-flights',
    };
    const result = validateWeeklyFareEntry(entry, profile, noExistingObservations);
    expect(result.preparedObservation).not.toBeNull();
    // No assertion possible against "did not write a file" other than the
    // absence of any fs import in lib/weekly-fare-ingest.ts itself, which
    // is verified by code review / grep, not a runtime test.
  });
});
