import { describe, it, expect } from 'vitest';
import { getRouteBySlug, routes } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';

/**
 * Route Verification Refresh, 12 September due-soon batch (7 September 2026).
 *
 * Covers the 15 routes the Founder dashboard listed as "Review due 12 September 2026":
 * Manchester/Leeds Bradford/London Gatwick x Dalaman/Bodrum/Antalya/Izmir, plus
 * Manchester/Bristol/London Gatwick-Marrakech, London Gatwick-Agadir, and
 * London Heathrow-Casablanca.
 *
 * Not every route was reclassified — several were rechecked and found either
 * genuinely unchanged (left untouched) or with only stale evidence available
 * (also left untouched, deliberately not administratively extended). This file
 * proves both outcomes are correct, not just the routes that changed.
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
  const renewedSlugs = [
    'manchester-dalaman',
    'manchester-bodrum',
    'manchester-antalya',
    'manchester-izmir',
    'leeds-bradford-dalaman',
    'london-gatwick-dalaman',
    'london-gatwick-bodrum',
    'london-gatwick-izmir',
    'manchester-marrakech',
    'bristol-marrakech',
    'london-heathrow-casablanca',
  ];

  it.each(renewedSlugs)('%s has verifiedDate 2026-09-07', (slug) => {
    const route = getRouteBySlug(slug)!;
    expect(route.verification?.verifiedDate, slug).toBe('2026-09-07');
  });

  const untouchedSlugs = ['leeds-bradford-antalya', 'leeds-bradford-bodrum', 'london-gatwick-marrakech', 'london-gatwick-agadir'];

  it.each(untouchedSlugs)('%s keeps its prior verifiedDate — no genuine new fact was found to justify a fresh one', (slug) => {
    const route = getRouteBySlug(slug)!;
    expect(route.verification?.verifiedDate, slug).not.toBe('2026-09-07');
  });
});

describe('3. Renewed routes have a policy-compliant reviewDueDate', () => {
  const recentChanging30d = [
    'manchester-dalaman',
    'manchester-bodrum',
    'manchester-antalya',
    'manchester-izmir',
    'london-gatwick-dalaman',
    'london-gatwick-bodrum',
    'london-gatwick-izmir',
    'london-heathrow-casablanca',
  ];

  it.each(recentChanging30d)('%s is classified RECENT/CHANGING — 30-day window from the fresh verifiedDate', (slug) => {
    const route = getRouteBySlug(slug)!;
    expect(route.verification?.reviewDueDate, slug).toBe('2026-10-07');
  });

  const stable90d = ['manchester-marrakech', 'bristol-marrakech'];

  it.each(stable90d)('%s is reclassified STABLE — 90-day window from the fresh verifiedDate', (slug) => {
    const route = getRouteBySlug(slug)!;
    expect(route.verification?.reviewDueDate, slug).toBe('2026-12-06');
  });
});

describe('4. Unsupported/unresolved routes do not receive administrative extensions', () => {
  it('leeds-bradford-dalaman gets a genuine operator-name upgrade, but reviewDueDate is NOT recalculated from the new verifiedDate', () => {
    const route = getRouteBySlug('leeds-bradford-dalaman')!;
    // The operator upgrade is real...
    expect(route.verification?.verifiedDate).toBe('2026-09-07');
    expect(route.airlineSlugs).toEqual(expect.arrayContaining(['jet2', 'tui']));
    // ...but the review window itself is left exactly as it was, not pushed out
    // to a fresh 30-day window merely because the record was reread today.
    expect(route.verification?.reviewDueDate).toBe('2026-09-12');
  });

  it('leeds-bradford-antalya and leeds-bradford-bodrum keep their original reviewDueDate — rechecked but genuinely unchanged', () => {
    for (const slug of ['leeds-bradford-antalya', 'leeds-bradford-bodrum']) {
      const route = getRouteBySlug(slug)!;
      expect(route.verification?.reviewDueDate, slug).toBe('2026-09-12');
    }
  });

  it('london-gatwick-marrakech and london-gatwick-agadir keep their original reviewDueDate — only stale evidence was found', () => {
    for (const slug of ['london-gatwick-marrakech', 'london-gatwick-agadir']) {
      const route = getRouteBySlug(slug)!;
      expect(route.verification?.reviewDueDate, slug).toBe('2026-09-12');
    }
  });
});

describe('5. Effective route presentation matches the refreshed evidence', () => {
  it('every reclassified STABLE route genuinely resolves to direct on the new evidence', () => {
    for (const slug of ['manchester-marrakech', 'bristol-marrakech']) {
      const route = getRouteBySlug(slug)!;
      expect(getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO).status, slug).toBe('direct');
    }
  });

  it('stripping verification from a refreshed route stops it resolving to direct — the status is genuinely evidence-gated', () => {
    const route = getRouteBySlug('manchester-dalaman')!;
    const stripped = { ...route, verification: undefined, airlineVerifications: undefined };
    expect(getEffectiveRoutePresentation(stripped, routeStatusEvents, NOW_ISO).status).not.toBe('direct');
  });
});

describe('6. Direct/connecting status remains truthful — no route silently changed directness', () => {
  it.each(DUE_SOON_SLUGS)('%s keeps isDirect: true — this batch never altered directness, only evidence freshness', (slug) => {
    const route = getRouteBySlug(slug)!;
    expect(route.isDirect, slug).toBe(true);
  });
});

describe('7. No unrelated route was changed by this batch', () => {
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
  });
});

describe('8. New operator claims are backed by the airline catalogue, not invented', () => {
  it('leeds-bradford-dalaman and bristol-marrakech only add airline slugs that exist in data/airlines.ts', async () => {
    const { airlines } = await import('@/data/airlines');
    const knownSlugs = new Set(airlines.map((a) => a.slug));
    for (const slug of ['leeds-bradford-dalaman', 'bristol-marrakech']) {
      const route = getRouteBySlug(slug)!;
      for (const airlineSlug of route.airlineSlugs) {
        expect(knownSlugs.has(airlineSlug), `${slug} -> ${airlineSlug}`).toBe(true);
      }
    }
  });
});
