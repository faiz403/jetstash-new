import { describe, it, expect } from 'vitest';
import { getRouteBySlug, routes } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';

/**
 * Route Verification, 12 September due-soon batch.
 *
 * Two passes: the 7 September refresh covered the 15 routes the Founder
 * dashboard listed as "Review due 12 September 2026"; the 8 September
 * "final five" follow-up resolved the five records the first pass had
 * deliberately left unresolved rather than administratively extended
 * (three thin-but-verified Leeds Bradford Turkey routes, and two Gatwick
 * Morocco routes backed only by stale evidence).
 *
 * Not every route was reclassified — several were rechecked and found
 * genuinely unchanged, or (for one route) still lacking any genuinely
 * current, non-stale evidence even after a real live-search attempt. This
 * file proves every outcome is correct, not just the routes that changed.
 */

const NOW_ISO = '2026-09-08';

const DUE_SOON_SLUGS = [
  'manchester-dalaman',
  'manchester-bodrum',
  'manchester-antalya',
  'manchester-izmir',
  'leeds-bradford-antalya',
  'leeds-bradford-dalaman',
  'leeds-bradford-bodrum',
  'london-gatwick-dalaman',
  'london-gatwick-bodrum',
  'london-gatwick-izmir',
  'manchester-marrakech',
  'bristol-marrakech',
  'london-gatwick-marrakech',
  'london-gatwick-agadir',
  'london-heathrow-casablanca',
];

describe('1. All 15 due-soon routes have an evidence-backed current state', () => {
  it.each(DUE_SOON_SLUGS)('%s exists, is verified, and resolves to a real effective presentation', (slug) => {
    const route = getRouteBySlug(slug)!;
    expect(route, slug).toBeDefined();
    expect(route.verification?.status, slug).toBe('verified');
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
    expect(presentation.status, slug).toBe('direct');
  });
});

describe('2. Renewed routes have a correct fresh verifiedDate', () => {
  const renewed0907 = [
    'manchester-dalaman',
    'manchester-bodrum',
    'manchester-antalya',
    'manchester-izmir',
    'london-gatwick-dalaman',
    'london-gatwick-bodrum',
    'london-gatwick-izmir',
    'manchester-marrakech',
    'bristol-marrakech',
    'london-heathrow-casablanca',
  ];

  it.each(renewed0907)('%s has verifiedDate 2026-09-07 (7 September refresh)', (slug) => {
    const route = getRouteBySlug(slug)!;
    expect(route.verification?.verifiedDate, slug).toBe('2026-09-07');
  });

  const renewed0908 = [
    'leeds-bradford-antalya',
    'leeds-bradford-dalaman',
    'leeds-bradford-bodrum',
    'london-gatwick-marrakech',
    'london-gatwick-agadir',
  ];

  it.each(renewed0908)('%s has verifiedDate 2026-09-08 (12 September final-five follow-up)', (slug) => {
    const route = getRouteBySlug(slug)!;
    expect(route.verification?.verifiedDate, slug).toBe('2026-09-08');
  });

  it('london-gatwick-agadir has a fresh verifiedDate after current airline booking evidence was found', () => {
    const route = getRouteBySlug('london-gatwick-agadir')!;
    expect(route.verification?.verifiedDate).toBe('2026-09-08');
  });
});

describe('3. Renewed routes have a policy-compliant reviewDueDate', () => {
  const recentChanging0907 = [
    'manchester-dalaman',
    'manchester-bodrum',
    'manchester-antalya',
    'manchester-izmir',
    'london-gatwick-dalaman',
    'london-gatwick-bodrum',
    'london-gatwick-izmir',
    'london-heathrow-casablanca',
  ];

  it.each(recentChanging0907)('%s is classified RECENT/CHANGING — 30-day window from its 2026-09-07 verifiedDate', (slug) => {
    const route = getRouteBySlug(slug)!;
    expect(route.verification?.reviewDueDate, slug).toBe('2026-10-07');
  });

  const recentChanging0908 = ['leeds-bradford-antalya', 'leeds-bradford-dalaman', 'leeds-bradford-bodrum', 'london-gatwick-marrakech'];

  it.each(recentChanging0908)('%s is classified RECENT/CHANGING — 30-day window from its 2026-09-08 verifiedDate', (slug) => {
    const route = getRouteBySlug(slug)!;
    expect(route.verification?.reviewDueDate, slug).toBe('2026-10-08');
  });

  const stable90d = ['manchester-marrakech', 'bristol-marrakech'];

  it.each(stable90d)('%s is reclassified STABLE — 90-day window from the fresh verifiedDate', (slug) => {
    const route = getRouteBySlug(slug)!;
    expect(route.verification?.reviewDueDate, slug).toBe('2026-12-06');
  });
});

describe('4. The previously unresolved route is renewed with bounded seasonal evidence', () => {
  it('london-gatwick-agadir has a policy-compliant 30-day review window and named bounded operators', () => {
    const route = getRouteBySlug('london-gatwick-agadir')!;
    expect(route.verification?.reviewDueDate).toBe('2026-10-08');
    expect(route.airlineSlugs).toEqual(['easyjet', 'british-airways']);
    expect(route.airlineVerifications?.map((entry) => entry.airlineSlug)).toEqual(['easyjet', 'british-airways']);
  });

  it('none of the original 15 remains due exactly 2026-09-12 after this renewal', () => {
    const stillDue = DUE_SOON_SLUGS.filter((slug) => getRouteBySlug(slug)!.verification?.reviewDueDate === '2026-09-12');
    expect(stillDue).toEqual([]);
  });
});

describe('5. Live flight-board evidence produced genuine operator upgrades where none existed before', () => {
  it('leeds-bradford-bodrum names Jet2 for the first time, backed by a live departures-board flight', () => {
    const route = getRouteBySlug('leeds-bradford-bodrum')!;
    expect(route.airlineSlugs).toEqual(['jet2']);
    expect(route.airlineVerifications?.[0]?.effectivePeriod).toContain('LS215');
  });

  it('london-gatwick-marrakech names easyJet for the first time, backed by two live flight-search results', () => {
    const route = getRouteBySlug('london-gatwick-marrakech')!;
    expect(route.airlineSlugs).toEqual(['easyjet']);
    expect(route.airlineVerifications?.[0]?.effectivePeriod).toContain('EZY8705');
    expect(route.airlineVerifications?.[0]?.effectivePeriod).toContain('EZY8709');
  });
});

describe('6. Effective route presentation matches the refreshed evidence', () => {
  it('every reclassified STABLE route genuinely resolves to direct on the new evidence', () => {
    for (const slug of ['manchester-marrakech', 'bristol-marrakech']) {
      const route = getRouteBySlug(slug)!;
      expect(getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO).status, slug).toBe('direct');
    }
  });

  it('stripping verification from a refreshed route stops it resolving to direct — the status is genuinely evidence-gated', () => {
    for (const slug of ['manchester-dalaman', 'leeds-bradford-bodrum', 'london-gatwick-marrakech']) {
      const route = getRouteBySlug(slug)!;
      const stripped = { ...route, verification: undefined, airlineVerifications: undefined };
      expect(getEffectiveRoutePresentation(stripped, routeStatusEvents, NOW_ISO).status, slug).not.toBe('direct');
    }
  });
});

describe('7. Direct/connecting status remains truthful — no route silently changed directness', () => {
  it.each(DUE_SOON_SLUGS)('%s keeps isDirect: true — this batch never altered directness, only evidence freshness', (slug) => {
    const route = getRouteBySlug(slug)!;
    expect(route.isDirect, slug).toBe(true);
  });
});

describe('8. No unrelated route was changed by this batch', () => {
  it('the total route count is unchanged at 89 — this batch added zero new routes', () => {
    expect(routes).toHaveLength(89);
  });

  it('MAN→AUH was not added — no manchester-abu-dhabi route exists', () => {
    expect(getRouteBySlug('manchester-abu-dhabi')).toBeUndefined();
  });

  it('a sibling route sharing an airline/destination with this batch is untouched (manchester-agadir, not in the due-soon batch)', () => {
    const route = getRouteBySlug('manchester-agadir')!;
    expect(route.verification?.verifiedDate).toBe('2026-09-03');
    expect(route.verification?.reviewDueDate).toBe('2026-10-03');
  });

  it('a sibling route sharing an airport with this batch is untouched (london-gatwick-antalya, not in the due-soon batch)', () => {
    const route = getRouteBySlug('london-gatwick-antalya')!;
    expect(route.verification?.verifiedDate).not.toBe('2026-09-07');
    expect(route.verification?.verifiedDate).not.toBe('2026-09-08');
  });
});

describe('9. New operator claims are backed by the airline catalogue, not invented', () => {
  it('every route touched by this batch only adds airline slugs that exist in data/airlines.ts', async () => {
    const { airlines } = await import('@/data/airlines');
    const knownSlugs = new Set(airlines.map((a) => a.slug));
    for (const slug of ['leeds-bradford-dalaman', 'leeds-bradford-bodrum', 'bristol-marrakech', 'london-gatwick-marrakech']) {
      const route = getRouteBySlug(slug)!;
      for (const airlineSlug of route.airlineSlugs) {
        expect(knownSlugs.has(airlineSlug), `${slug} -> ${airlineSlug}`).toBe(true);
      }
    }
  });
});
