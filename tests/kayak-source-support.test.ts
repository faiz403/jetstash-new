import { describe, it, expect } from 'vitest';
import { fareObservations, isPubliclyPublishable, type FareObservation } from '@/data/fare-observations';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { isPoorItinerarySuitability } from '@/lib/itinerary-suitability';
import { routes } from '@/data/routes';

/**
 * KAYAK source-schema extension (16 September 2026, founder-approved,
 * narrow fallback-fare-recovery correction). `FareObservation.observedVia`
 * gained a `'kayak'` value because the fallback-fare-recovery task found
 * genuine, fully-evidenced KAYAK results that were cheaper (or, on one
 * route, within a few pounds) of the equivalent Trip.com fare for the same
 * exact controlled profile — the archive must record the best genuinely
 * observed fare from the approved priority order (airline-direct, KAYAK,
 * Skyscanner, Trip.com), not whichever source the type already happened to
 * support. See data/fare-observations.ts's own doc comment on this batch
 * for the full reasoning and docs/project-control/fare-evidence/
 * full-portfolio-controlled-batch-2026-09-15.md for the per-route
 * KAYAK-vs-Trip.com comparison.
 */

const KAYAK_ROUTE_SLUGS = [
  'bristol-antalya',
  'bristol-dalaman',
  'glasgow-dalaman',
  'leeds-bradford-antalya',
  'leeds-bradford-bodrum',
  'leeds-bradford-dalaman',
  'leeds-bradford-islamabad',
  'newcastle-dalaman',
];

const KAYAK_IDS = [
  'obs-brs-ayt-economy-20260916-kayak-v1',
  'obs-brs-dlm-economy-20260916-kayak-v1',
  'obs-gla-dlm-economy-20260916-kayak-v1',
  'obs-lba-ayt-economy-20260916-kayak-v1',
  'obs-lba-bjv-economy-20260916-kayak-v1',
  'obs-lba-dlm-economy-20260916-kayak-v1',
  'obs-lba-isb-economy-20260916-kayak-v1',
  'obs-ncl-dlm-economy-20260916-kayak-v1',
];

const kayakObservations = KAYAK_IDS.map((id) => fareObservations.find((o) => o.id === id)!);

describe("'kayak' is a valid FareObservation.observedVia value", () => {
  it('every fallback-recovery observation for the 8 KAYAK routes is genuinely recorded with observedVia: \'kayak\' — TypeScript alone proves the union accepts it, but this proves the archive actually uses it', () => {
    expect(kayakObservations.every(Boolean)).toBe(true);
    for (const o of kayakObservations) {
      expect(o.observedVia).toBe('kayak');
    }
  });

  it('no observation anywhere in the archive still uses the superseded observedVia: \'trip.com\' value for these 8 specific ids — the same-day Trip.com recovery observations were replaced, not left alongside as duplicates', () => {
    const supersededIds = [
      'obs-brs-ayt-economy-20260916-tripcom-v1',
      'obs-brs-dlm-economy-20260916-tripcom-v1',
      'obs-gla-dlm-economy-20260916-tripcom-v1',
      'obs-lba-ayt-economy-20260916-tripcom-v2',
      'obs-lba-bjv-economy-20260916-tripcom-v1',
      'obs-lba-dlm-economy-20260916-tripcom-v2',
      'obs-lba-isb-economy-20260916-tripcom-v1',
      'obs-ncl-dlm-economy-20260916-tripcom-v2',
    ];
    for (const id of supersededIds) {
      expect(fareObservations.find((o) => o.id === id)).toBeUndefined();
    }
  });
});

describe('KAYAK observations are treated exactly like any other source — no Trip.com-specific or provider-specific assumption applies to them', () => {
  it('all 8 are publicly publishable under the same, source-agnostic isPubliclyPublishable() predicate every other observation uses', () => {
    for (const o of kayakObservations) {
      expect(isPubliclyPublishable(o), o.id).toBe(true);
    }
  });

  it('self-transfer/poor-itinerary suitability is derived from priceNote wording alone (isSelfTransferItinerary/isPoorItinerarySuitability), the same predicate applied to every source — 7 of 8 KAYAK observations are genuinely self-transfer and correctly flagged poor; the 8th (leeds-bradford-islamabad, a standard interline booking) is correctly not flagged', () => {
    const expectedPoor: Record<string, boolean> = {
      'obs-brs-ayt-economy-20260916-kayak-v1': true,
      'obs-brs-dlm-economy-20260916-kayak-v1': true,
      'obs-gla-dlm-economy-20260916-kayak-v1': true,
      'obs-lba-ayt-economy-20260916-kayak-v1': true,
      'obs-lba-bjv-economy-20260916-kayak-v1': true,
      'obs-lba-dlm-economy-20260916-kayak-v1': true,
      'obs-lba-isb-economy-20260916-kayak-v1': false,
      'obs-ncl-dlm-economy-20260916-kayak-v1': true,
    };
    for (const o of kayakObservations) {
      expect(isPoorItinerarySuitability(o), o.id).toBe(expectedPoor[o.id]);
    }
  });

  it('every KAYAK observation carries genuine per-leg evidence — connection airports, stop counts and journey minutes are present for every route, never inferred or left blank', () => {
    for (const o of kayakObservations) {
      expect(typeof o.outboundStops, o.id).toBe('number');
      expect(typeof o.returnStops, o.id).toBe('number');
      expect(typeof o.outboundJourneyMinutes, o.id).toBe('number');
      expect(typeof o.returnJourneyMinutes, o.id).toBe('number');
      expect(Array.isArray(o.outboundConnectionAirports), o.id).toBe(true);
      expect(Array.isArray(o.returnConnectionAirports), o.id).toBe(true);
    }
  });
});

describe('public Fare Signal outcome for the 8 KAYAK routes — checked directly via the existing, unmodified selector, no route-specific logic', () => {
  const NOW = '2026-09-16';

  it('leeds-bradford-islamabad (the one non-poor KAYAK observation) is the live public representative fare', () => {
    const signal = getFareSignalForRoute('leeds-bradford-islamabad', NOW);
    expect(signal.state).toBe('current');
    expect(signal.observation?.price).toBe(680);
  });

  it('the other 7 KAYAK observations are genuinely poor (self-transfer) and are correctly NOT the public representative — each of these 7 routes already has an older, non-poor Economy observation on file (from routine-weekly checks in August 2026, for a different date window) that the pool-walk selector correctly surfaces instead; this is HISTORY-ONLY for the new observation, not POOR-ITINERARY-SUPPRESSED for the route, since a suitable representative does exist', () => {
    const poorRouteSlugs = KAYAK_ROUTE_SLUGS.filter((slug) => slug !== 'leeds-bradford-islamabad');
    for (const slug of poorRouteSlugs) {
      const signal = getFareSignalForRoute(slug, NOW);
      // A suitable representative is shown (not 'none') for every one of
      // these 7 — none of the 8 KAYAK routes shows "no current fare".
      expect(signal.state, slug).not.toBe('none');
      expect(signal.noneReason, slug).toBeNull();
      // And that representative is genuinely a different, older observation
      // than the new KAYAK one — proving the new poor observation stayed in
      // history rather than either being hidden from the archive or wrongly
      // promoted to public despite being poor.
      const kayakObs = kayakObservations.find((o) => o.routeSlug === slug)!;
      expect(signal.observation?.id, slug).not.toBe(kayakObs.id);
    }
  });
});

describe('portfolio coverage — the 8 fallback routes hold the exact controlled profile, no fabrication, no duplicate ids', () => {
  it('all 8 KAYAK observations use the exact controlled profile: 10 Nov 2026 out / 24 Nov 2026 back, 1 adult (via profileId), Economy, GBP', () => {
    for (const o of kayakObservations) {
      expect(o.departureDate, o.id).toBe('2026-11-10');
      expect(o.returnDate, o.id).toBe('2026-11-24');
      expect(o.cabin, o.id).toBe('Economy');
      expect(o.currency, o.id).toBe('GBP');
      expect(o.profileId, o.id).toMatch(/^[a-z-]+-economy-1adult-/);
    }
  });

  it('no observation id anywhere in the entire archive is duplicated', () => {
    const ids = fareObservations.map((o) => o.id);
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) duplicates.push(id);
      seen.add(id);
    }
    expect(duplicates).toEqual([]);
  });

  it('every one of the 89 public routes now has at least one Economy observation for the exact 10 Nov 2026 / 24 Nov 2026 controlled profile — 81 from the full-portfolio sweep + these 8 KAYAK recoveries', () => {
    const withControlledProfile = new Set(
      fareObservations
        .filter((o: FareObservation) => o.cabin === 'Economy' && o.departureDate === '2026-11-10' && o.returnDate === '2026-11-24')
        .map((o) => o.routeSlug)
    );
    const missing = routes.filter((r) => !withControlledProfile.has(r.slug));
    expect(missing.map((r) => r.slug)).toEqual([]);
    expect(withControlledProfile.size).toBe(routes.length);
  });
});
