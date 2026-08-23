import { describe, it, expect } from 'vitest';
import { routes, getRouteBySlug, getRoutePresentation } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getFareRangeSummary } from '@/data/fare-observations';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { deals, getDealAirlineLabel, hasTrackedFare, getDealsByCategory } from '@/data/deals';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';
import { siteConfig } from '@/lib/site-config';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Manchester–Karachi Business SEO (23 Aug 2026) — the final, narrow step in
 * the Karachi arc (Business Fare Evidence Batch 1 -> PR #169's product
 * completion -> this metadata-only PR). Founder correction on the original
 * gate's proposed title ("...Business Class: Connecting Fare"): the route's
 * own connecting status is itself under a normal review cycle
 * (reviewDueDate 2026-10-05) and a future Business observation could use a
 * different airline, connection, or even directness — none of which should
 * ever require a metadata PR. seoTitle/seoDescription therefore describe
 * the durable JetStash product (a tracked, checked Business fare with full
 * itinerary detail) rather than today's specific fare shape; the live
 * Business Deal card (man-khi-business, PR #169) stays the one place that
 * time-sensitive truth (price, airline, connection, checked date) lives.
 */

const NOW_ISO = '2026-08-23';

describe('Exact Karachi metadata', () => {
  it('carries the exact proposed title and description', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    const presentation = getRoutePresentation(route, NOW_ISO);
    expect(presentation.metadataTitle).toBe('Manchester–Karachi Business Class Fares & Route Guide');
    expect(presentation.metadataDescription).toBe(
      'Track checked Business Class fares for Manchester–Karachi, with itinerary, connection and fare-history details kept separate from the route’s verified service status.'
    );
  });

  it('the full rendered <title> (with the automatic " | JetStash" template) fits the site\'s ≤65-character guideline', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    const presentation = getRoutePresentation(route, NOW_ISO);
    const rendered = `${presentation.metadataTitle} | ${siteConfig.name}`;
    expect(rendered.length, rendered).toBeLessThanOrEqual(65);
  });
});

describe('No time-sensitive fare shape hardcoded into metadata', () => {
  it('neither title nor description contains a price, an airline name, a connection city, a stop count, a checked date, or a directness claim', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    const presentation = getRoutePresentation(route, NOW_ISO);
    const text = `${presentation.metadataTitle} ${presentation.metadataDescription}`;
    expect(text).not.toMatch(/£\d/);
    expect(text.toLowerCase()).not.toMatch(/gulf air|bahrain|pia\b/);
    expect(text.toLowerCase()).not.toMatch(/\bone stop\b|\bconnecting\b/);
    expect(text).not.toMatch(/22 August 2026|checked \d/i);
    expect(text.toLowerCase()).not.toMatch(/\bdirect\b/);
  });

  it('no "best"/"cheapest" superlative', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    const presentation = getRoutePresentation(route, NOW_ISO);
    const text = `${presentation.metadataTitle} ${presentation.metadataDescription}`.toLowerCase();
    expect(text).not.toMatch(/\bbest\b|\bcheapest\b/);
  });

  it('this metadata would remain accurate even if the next Business observation used a different airline, connection or directness — it makes no claim about any of those', () => {
    // Structural proof, not a simulation: the title/description strings
    // themselves contain nothing that could be falsified by a future
    // observation, confirmed by the absence checks above. This test exists
    // to name that property explicitly, not to re-derive it differently.
    const route = getRouteBySlug('manchester-karachi')!;
    const presentation = getRoutePresentation(route, NOW_ISO);
    expect(presentation.metadataTitle).toContain('Fares & Route Guide');
  });
});

describe('No other page content added', () => {
  it('manchester-karachi still carries no businessClarity panel data — this is metadata-only', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    expect(route.businessClarity).toBeUndefined();
  });
});

describe('Live product state preserved — proven, not assumed', () => {
  it('generic Fare Signal remains £539 Economy', () => {
    const signal = getFareSignalForRoute('manchester-karachi', NOW_ISO);
    expect(signal.observation?.cabin).toBe('Economy');
    expect(signal.observation?.price).toBe(539);
  });

  it('the Business Deal still resolves £2,553, Gulf Air, connecting', () => {
    const range = getFareRangeSummary('manchester-karachi', 'Business', NOW_ISO)!;
    expect(range.min).toBe(2553);
    expect(range.sources).toEqual(['Gulf Air']);
    expect(range.observedDirectness).toBe('connecting');
  });

  it('Deal.airline still resolves to PIA (route-level convention, unrelated to this metadata change)', () => {
    const deal = deals.find((d) => d.id === 'man-khi-business')!;
    expect(getDealAirlineLabel(deal, NOW_ISO)).toBe('PIA');
  });

  it('routeServiceConnections stays unset — Bahrain remains scoped to the observation only', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    expect(route.routeServiceConnections).toBeUndefined();
  });

  it('the Trip.com CTA is unchanged', () => {
    const url = getTripComFlightHandoffUrl('manchester-karachi', 'manchester', 'karachi');
    expect(url).toContain('trip.com');
  });

  it('/business-class and /deals placement unchanged — the Deal still exists exactly once, in the business category', () => {
    const businessDeals = getDealsByCategory('business');
    expect(businessDeals.filter((d) => d.id === 'man-khi-business').length).toBe(1);
    const deal = deals.find((d) => d.id === 'man-khi-business')!;
    expect(hasTrackedFare(deal, NOW_ISO)).toBe(true);
  });
});

describe('Metadata isolation — only manchester-karachi gains this override', () => {
  it('exactly three routes now carry a seoTitle/seoDescription override', () => {
    const overridden = routes.filter((r) => r.seoTitle || r.seoDescription).map((r) => r.slug).sort();
    expect(overridden).toEqual(['london-heathrow-doha', 'manchester-karachi', 'manchester-lahore'].sort());
  });

  it('manchester-lahore and london-heathrow-doha overrides are byte-for-byte unchanged from PR #168', () => {
    const lahore = getRouteBySlug('manchester-lahore')!;
    const doha = getRouteBySlug('london-heathrow-doha')!;
    expect(lahore.seoTitle).toBe('Manchester–Lahore Business Class: Fare & Direct Route');
    expect(doha.seoTitle).toBe('London–Doha Business Class: Fare & Direct Route');
  });

  it('london-heathrow-lahore remains on its plain default metadata', () => {
    const route = getRouteBySlug('london-heathrow-lahore')!;
    expect(route.seoTitle).toBeUndefined();
    const presentation = getRoutePresentation(route, NOW_ISO);
    expect(presentation.metadataTitle).not.toContain('Business Class');
  });

  it('no other route in the network carries an override', () => {
    for (const route of routes) {
      if (['manchester-lahore', 'london-heathrow-doha', 'manchester-karachi'].includes(route.slug)) continue;
      expect(route.seoTitle, route.slug).toBeUndefined();
      expect(route.seoDescription, route.slug).toBeUndefined();
    }
  });
});

describe('Withdrawal-aware metadata retains higher precedence', () => {
  it('manchester-mumbai and manchester-delhi still get their withdrawal-aware titles, unaffected', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
      expect(presentation.metadataTitle, slug).toContain('Direct Flight Status Update');
    }
  });

  it('buildWithdrawalAnnouncedPresentation still computes metadataTitle/metadataDescription unconditionally over any seoTitle override (structural proof, unchanged since PR #168)', () => {
    const src = readFileSync(join(process.cwd(), 'lib/route-status-copy.ts'), 'utf8');
    const fnStart = src.indexOf('function buildWithdrawalAnnouncedPresentation');
    const fnBody = src.slice(fnStart, src.indexOf('\n}\n', fnStart));
    expect(fnBody).toMatch(/return \{ \.\.\.presentation, shareText, metadataTitle, metadataDescription \};/);
  });
});
