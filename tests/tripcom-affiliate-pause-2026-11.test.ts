import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { routes } from '@/data/routes';
import { antalyaHotelEvidence } from '@/data/hotel-evidence';
import { expansionHotelEvidence } from '@/data/hotel-evidence-expansion';
import {
  getSafeTripComFlightHandoffUrl,
  getTripComDestinationHandoffUrl,
  getTripComFlightHandoff,
  getTripComFlightHandoffUrl,
  getTripComRouteUrl,
  hasTripComRoute,
} from '@/lib/booking-providers';
import { getTripComHotelUrl, hasTripComHotelLink } from '@/lib/hotel-booking-links';
import { getJourneyChoiceTripComHandoff } from '@/lib/tripcom-dated-handoff';
import { isTripComAffiliatePaused } from '@/lib/tripcom-affiliate-pause';

/**
 * Trip.com affiliate pause (founder decision, 4 November 2026). A switch, off by default, that makes every Trip.com
 * flight and hotel lookup return null so the existing fail-closed behaviour applies. It changes what JetStash links to;
 * it does not touch route evidence, fare data or the monthly Google-call guard.
 */
const ENV = 'NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED';
const NOW = '2026-11-03';
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

const hotelIds = [...antalyaHotelEvidence.map((h) => h.evidenceId), ...expansionHotelEvidence.map((h) => h.evidenceId)];
const pairs = [...new Set(routes.map((r) => `${r.airportSlug}|${r.destinationSlug}`))].map((p) => p.split('|') as [string, string]);

afterEach(() => vi.unstubAllEnvs());

describe('Trip.com affiliate pause: off by default, so nothing changes until the founder sets it', () => {
  it('is not paused when the variable is unset, and links resolve exactly as before', () => {
    expect(isTripComAffiliatePaused()).toBe(false);
    expect(getTripComRouteUrl('manchester-islamabad')).toContain('Allianceid=9804124');
    expect(hasTripComRoute('manchester-islamabad')).toBe(true);
    expect(getSafeTripComFlightHandoffUrl('manchester-islamabad', undefined, undefined, NOW)).toContain('Allianceid=9804124');
  });

  it('there are real flight and hotel links for the paused case to remove', () => {
    expect(routes.filter((r) => getTripComRouteUrl(r.slug)).length).toBeGreaterThan(30);
    expect(hotelIds.filter((id) => getTripComHotelUrl(id)).length).toBeGreaterThan(10);
  });

  it.each(['false', '1', 'TRUE', 'yes', ''])('only the exact value "true" pauses; "%s" does not', (value) => {
    vi.stubEnv(ENV, value);
    expect(isTripComAffiliatePaused()).toBe(false);
    expect(hasTripComRoute('manchester-islamabad')).toBe(true);
  });
});

describe('Trip.com affiliate pause: every flight and hotel handoff is removed when paused', () => {
  it('returns null or false from every flight lookup for every route', () => {
    vi.stubEnv(ENV, 'true');
    expect(isTripComAffiliatePaused()).toBe(true);
    for (const route of routes) {
      expect(getTripComRouteUrl(route.slug), route.slug).toBeNull();
      expect(hasTripComRoute(route.slug), route.slug).toBe(false);
      expect(getTripComFlightHandoff(route.slug, route.airportSlug, route.destinationSlug, NOW), route.slug).toBeNull();
      expect(getSafeTripComFlightHandoffUrl(route.slug, route.airportSlug, route.destinationSlug, NOW), route.slug).toBeNull();
      expect(getTripComFlightHandoffUrl(route.slug, route.airportSlug, route.destinationSlug), route.slug).toBeNull();
    }
  });

  it('returns null from the airport-pair destination lookup for every pair', () => {
    vi.stubEnv(ENV, 'true');
    for (const [origin, destination] of pairs) expect(getTripComDestinationHandoffUrl(origin, destination), `${origin}-${destination}`).toBeNull();
  });

  it('returns null or false from every hotel lookup', () => {
    vi.stubEnv(ENV, 'true');
    for (const id of hotelIds) {
      expect(getTripComHotelUrl(id), id).toBeNull();
      expect(hasTripComHotelLink(id), id).toBe(false);
    }
  });

  it('the dated Journey Choice handoff cannot be built without a route link', () => {
    vi.stubEnv(ENV, 'true');
    const choice = {} as never;
    expect(getJourneyChoiceTripComHandoff('manchester-islamabad', choice, getTripComRouteUrl('manchester-islamabad'))).toBeNull();
  });

  it('resuming restores the same links with no data change', () => {
    vi.stubEnv(ENV, 'true');
    expect(getTripComRouteUrl('manchester-islamabad')).toBeNull();
    vi.unstubAllEnvs();
    expect(getTripComRouteUrl('manchester-islamabad')).toContain('Allianceid=9804124');
  });
});

describe('Trip.com affiliate pause: guards against a future bypass', () => {
  const SOURCE_DIRS = ['lib', 'components', 'app', 'data'];
  const listFiles = (dir: string): string[] => {
    return readdirSync(join(process.cwd(), dir)).flatMap((name) => {
      const rel = join(dir, name);
      return statSync(join(process.cwd(), rel)).isDirectory() ? listFiles(rel) : /\.(ts|tsx)$/.test(name) ? [rel] : [];
    });
  };

  it('the affiliate identity is built only inside the two guarded lookup modules (plus the dated handoff, which only transforms a URL it is given)', () => {
    const holders = SOURCE_DIRS.flatMap(listFiles)
      .map((f) => f.replace(/\\/g, '/'))
      .filter((f) => /Allianceid=9804124|SID=327450313/.test(read(f)))
      .sort();
    expect(holders).toEqual(['lib/booking-providers.ts', 'lib/hotel-booking-links.ts']);
  });

  it('every function that reads a Trip.com URL map checks the pause switch first', () => {
    const flights = read('lib/booking-providers.ts');
    const hotels = read('lib/hotel-booking-links.ts');
    const body = (src: string, fn: string) => src.slice(src.indexOf(`export function ${fn}(`), src.indexOf('\n}\n', src.indexOf(`export function ${fn}(`)));
    for (const fn of ['getTripComRouteUrl', 'getTripComFlightHandoff', 'getTripComFlightHandoffUrl', 'getTripComDestinationHandoffUrl', 'hasTripComRoute']) {
      expect(body(flights, fn), fn).toContain('isTripComAffiliatePaused()');
    }
    for (const fn of ['getTripComHotelUrl', 'hasTripComHotelLink']) expect(body(hotels, fn), fn).toContain('isTripComAffiliatePaused()');
  });

  it('is a NEXT_PUBLIC_ variable because client components resolve these links in the browser', () => {
    expect(read('lib/tripcom-affiliate-pause.ts')).toContain('process.env.NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED');
  });

  it('does not touch the monthly Google-call counter or the Arrive By rate limiter', () => {
    expect(read('lib/tripcom-affiliate-pause.ts')).not.toMatch(/call-budget|rate-limit/);
  });
});
