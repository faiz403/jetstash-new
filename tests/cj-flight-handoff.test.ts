import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CjFlightLink } from '@/data/cj-flight-links';
import { getCjFlightHandoff } from '@/lib/cj-flight-handoff';
import { CjFlightCta } from '@/components/route/cj-flight-cta';
import { FareSignal } from '@/components/route/fare-signal';
import { getFareSignalForRoute } from '@/lib/fare-signal';

// Synthetic CJ-shaped fixture. This link is never fetched or published.
const record: CjFlightLink = {
  routeSlug: 'london-heathrow-delhi', provider: 'air-india',
  url: 'https://www.anrdoezrs.net/click-101818709-12345678?sid=fixture%20only',
  originIata: 'LHR', destinationIata: 'DEL', accountRelationship: 'active',
  ukWebsitePromotionAllowed: true, generatedBy: 'cj-get-code', searchType: 'dateless-exact-airports',
  verifiedDate: '2026-11-15', reviewDueDate: '2026-11-22', evidenceNote: 'Synthetic test evidence only.',
};
const lookup = (change: Partial<CjFlightLink> = {}, date = '2026-11-15') => getCjFlightHandoff(record.routeSlug, date, [{ ...record, ...change }]);
afterEach(() => vi.unstubAllEnvs());

describe('verified CJ flight handoffs', () => {
  it('has no invented public URLs and stays unavailable until the account work is complete', () => {
    expect(getCjFlightHandoff(record.routeSlug, '2026-11-15', [])).toBeNull();
  });

  it('preserves the exact generated URL and works independently of the Trip.com pause', () => {
    vi.stubEnv('NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED', 'true');
    expect(lookup()?.url).toBe(record.url);
    expect(lookup({}, '2026-11-22')?.providerName).toBe('Air India');
  });

  it.each<Partial<CjFlightLink>>([
    { originIata: 'MAN' }, { destinationIata: 'BOM' }, { routeSlug: 'missing-route' },
    { accountRelationship: 'pending' }, { accountRelationship: 'ended' }, { ukWebsitePromotionAllowed: false },
    { verifiedDate: '2026-11-16' }, { verifiedDate: '2026-02-30' }, { reviewDueDate: '2026-11-14' },
    { reviewDueDate: '2027-01-01' }, { evidenceNote: '' },
    { url: 'https://www.airindia.com/' }, { url: 'https://www.anrdoezrs.net.evil.example/click-101818709-12345678' },
    { url: 'http://www.anrdoezrs.net/click-101818709-12345678' },
    { url: 'https://user:password@www.anrdoezrs.net/click-101818709-12345678' },
    { url: 'https://www.anrdoezrs.net:8443/click-101818709-12345678' },
    { url: 'https://www.anrdoezrs.net/click-999999999-12345678' },
    { url: 'https://www.anrdoezrs.net/click-101818709-12345678#destination' },
  ])('rejects an unverified, stale or mismatched record: %j', (change) => expect(lookup(change)).toBeNull());

  it('rejects ambiguous configuration and invalid evaluation dates', () => {
    expect(getCjFlightHandoff(record.routeSlug, '2026-11-15', [record, record])).toBeNull();
    expect(lookup({}, '2026-02-30')).toBeNull();
    expect(lookup({}, '2026-11-23')).toBeNull();
    expect(getCjFlightHandoff('manchester-islamabad', '2026-11-15', [{ ...record, routeSlug: 'manchester-islamabad', originIata: 'MAN', destinationIata: 'ISB' }])).toBeNull();
  });

  it('replaces the no-fare fallback in the existing booking slot with the disclosed provider action', () => {
    const handoff = lookup();
    expect(handoff).not.toBeNull();
    const signal = { ...getFareSignalForRoute(record.routeSlug, '2026-11-15'), state: 'none' as const, observation: null, freshness: null };
    const html = renderToStaticMarkup(React.createElement(FareSignal, { signal, nowIso: '2026-11-15', routeSlug: record.routeSlug, tripComUrl: null, cjHandoff: handoff }));
    expect(html).toContain(record.url);
    expect(html).toContain('Ad · Affiliate link.');
    expect(html).toContain('Search flights on Air India');
    expect(html).not.toContain('Search flights on Google Flights');
    expect(html).toContain('not carried across');
    expect(html).toContain('nofollow sponsored noopener noreferrer');
    const fallback = renderToStaticMarkup(React.createElement(FareSignal, { signal, nowIso: '2026-11-23', routeSlug: record.routeSlug, tripComUrl: null, cjHandoff: lookup({}, '2026-11-23') }));
    expect(fallback).not.toContain('Search flights on Air India');
    expect(fallback).toContain('Search flights on Google Flights');
  });

  it('never labels a service-ended handoff as a current nonstop or a carried fare', () => {
    const html = renderToStaticMarkup(React.createElement(CjFlightCta, { handoff: lookup()!, routeSlug: record.routeSlug, serviceEnded: true }));
    expect(html).toContain('Search connecting flights on Air India');
    expect(html).toContain('does not confirm a nonstop service or availability');
  });
});
