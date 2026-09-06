import { describe, it, expect } from 'vitest';
import { airports, getAirportBySlug } from '@/data/airports';
import { getRouteBySlug } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';

/**
 * Trust fix (6 Sept 2026, independent audit): Manchester Airport's own
 * page-level summary fields (description, longHaulRoutes, whyThisAirport
 * in data/airports.ts) presented Manchester as a current direct gateway to
 * India via Delhi/Mumbai, after both manchester-delhi and manchester-mumbai
 * were confirmed `service-ended` by the Route Status ledger (2 September
 * 2026) — a contradiction the route detail pages themselves never had,
 * since they render getEffectiveRoutePresentation() ("Direct service
 * ended") live rather than a static field. This is the identical class of
 * cross-surface duplication this project keeps finding: one surface
 * (route pages) derives from the canonical ledger; a separate, manually
 * maintained surface (the airport record) doesn't, and goes stale when the
 * ledger changes after the airport copy was last edited.
 *
 * These tests deliberately compare the airport's own summary fields
 * against the ROUTE's actual effective presentation
 * (getEffectiveRoutePresentation(), the same function the route pages
 * themselves call) rather than a hardcoded string, so they keep failing
 * correctly if either route's lifecycle state changes again.
 */

const NOW_ISO = '2026-09-06';
const manchesterAirport = getAirportBySlug('manchester')!;
const manDel = getRouteBySlug('manchester-delhi')!;
const manBom = getRouteBySlug('manchester-mumbai')!;
const delPresentation = getEffectiveRoutePresentation(manDel, routeStatusEvents, NOW_ISO);
const bomPresentation = getEffectiveRoutePresentation(manBom, routeStatusEvents, NOW_ISO);

describe('1 & 2. Canonical MAN-DEL / MAN-BOM state remains service-ended', () => {
  it('manchester-delhi is effectively "service-ended", not "direct"', () => {
    expect(delPresentation.status).toBe('service-ended');
    expect(delPresentation.statusLabel).toBe('Direct service ended');
  });

  it('manchester-mumbai is effectively "service-ended", not "direct"', () => {
    expect(bomPresentation.status).toBe('service-ended');
    expect(bomPresentation.statusLabel).toBe('Direct service ended');
  });
});

describe('3. Manchester airport summary no longer implies a current direct India service', () => {
  it('description no longer claims India as a current direct-gateway destination', () => {
    expect(manchesterAirport.description).not.toMatch(/\bIndia\b/);
    // The genuinely current direct network (Pakistan, Gulf) is preserved.
    expect(manchesterAirport.description).toMatch(/Pakistan/);
    expect(manchesterAirport.description).toMatch(/Gulf/);
  });

  it('longHaulRoutes no longer lists Delhi or Mumbai — the only two ledger-confirmed service-ended entries in any airport\'s list', () => {
    expect(manchesterAirport.longHaulRoutes).not.toContain('Delhi');
    expect(manchesterAirport.longHaulRoutes).not.toContain('Mumbai');
    // Genuinely still-direct destinations are preserved, not collateral damage.
    expect(manchesterAirport.longHaulRoutes).toEqual(['Islamabad', 'Lahore', 'Dubai', 'Doha', 'Abu Dhabi']);
  });

  it('whyThisAirport no longer uses present-perfect ("has ... served ... since") phrasing that reads as an ongoing service', () => {
    expect(manchesterAirport.whyThisAirport).not.toMatch(/has (also )?served/i);
    // The historical fact is preserved in unambiguous past tense, not erased —
    // this airport genuinely did have a real, verified direct India service,
    // and that context remains useful even though it has since paused.
    expect(manchesterAirport.whyThisAirport).toMatch(/flew Manchester direct to Delhi and Mumbai/i);
    expect(manchesterAirport.whyThisAirport).toMatch(/pausing the service/i);
    expect(manchesterAirport.whyThisAirport).toMatch(/route guides for current verified status/i);
  });

  it('no field independently invents a specific end-date, resumption date, or new frequency claim beyond what the ledger/route already establish', () => {
    expect(manchesterAirport.description).not.toMatch(/2026|31 August/);
    expect(manchesterAirport.whyThisAirport).not.toMatch(/31 August|permanently|forever|resum(e|ing|ed)/i);
  });
});

describe('4. No route/fare data changed — this is an airport-copy-only fix', () => {
  it('manchester-delhi and manchester-mumbai route records (isDirect, verification, flightTime, frequency, airlineSlugs) are unchanged', () => {
    expect(manDel.isDirect).toBe(true);
    expect(manDel.verification?.status).toBe('verified');
    expect(manDel.frequency).toBe('3x weekly direct (reduced from 5x weekly in Feb 2026)');
    expect(manBom.isDirect).toBe(true);
    expect(manBom.verification?.status).toBe('verified');
    expect(manBom.frequency).toBe('4x weekly direct (Mon/Tue/Sat/Sun ex-Manchester, per Feb 2026 schedule)');
  });

  it('the route-status ledger itself is untouched — both service-ended events remain exactly as recorded', () => {
    const delEvent = routeStatusEvents.find((e) => e.id === 'man-del-indigo-service-ended-2026-09');
    const bomEvent = routeStatusEvents.find((e) => e.id === 'man-bom-indigo-service-ended-2026-09');
    expect(delEvent?.type).toBe('service-ended');
    expect(bomEvent?.type).toBe('service-ended');
    if (delEvent?.type === 'service-ended') expect(delEvent.verifiedOccurrence).toBe(true);
    if (bomEvent?.type === 'service-ended') expect(bomEvent.verifiedOccurrence).toBe(true);
  });
});

describe('5 & 6. No unrelated airport data changed', () => {
  it('manchester\'s other fields (name, code, city, servesCommunities, hasDirectLongHaul, shortHaulHighlights) are unchanged', () => {
    expect(manchesterAirport.name).toBe('Manchester Airport');
    expect(manchesterAirport.code).toBe('MAN');
    expect(manchesterAirport.hasDirectLongHaul).toBe(true);
    expect(manchesterAirport.shortHaulHighlights).toEqual(['Istanbul', 'Antalya', 'Dalaman', 'Marrakech', 'Barcelona']);
    expect(manchesterAirport.servesCommunities).toEqual(['Manchester', 'Bolton', 'Rochdale', 'Oldham', 'Blackburn', 'Bradford (via M62 corridor)']);
  });

  it('every other airport record is untouched', () => {
    const others = airports.filter((a) => a.slug !== 'manchester');
    expect(others).toHaveLength(10);
    const gatwick = others.find((a) => a.slug === 'london-gatwick')!;
    const birmingham = others.find((a) => a.slug === 'birmingham')!;
    expect(gatwick.longHaulRoutes).toEqual(['Dubai', 'Doha', 'Ahmedabad', 'Amritsar']);
    expect(birmingham.longHaulRoutes).toEqual(['Dubai', 'Sharjah', 'Doha']);
  });
});
