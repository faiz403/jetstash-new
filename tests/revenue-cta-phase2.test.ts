import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FareSignal } from '@/components/route/fare-signal';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getSafeTripComFlightHandoffUrl } from '@/lib/booking-providers';

const fareSignalSrc = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');

describe('Phase 2 public CTA clarity', () => {
  it('names Trip.com in the primary Fare Signal action while retaining the existing disclosure and analytics source', () => {
    // CTA label consolidation (12 Sept 2026, founder-approved): the literal
    // "Check current price on Trip.com" wording was one of five
    // inconsistent Trip.com CTA labels the funnel audit found; Fare
    // Signal's ordinary CTA now reads the shared TRIPCOM_DEFAULT_CTA_LABEL
    // constant instead of a hand-typed string. This test's own purpose —
    // Trip.com is named, disclosure/analytics/layout are unchanged — still
    // holds.
    expect(fareSignalSrc).toContain('TRIPCOM_DEFAULT_CTA_LABEL');
    expect(fareSignalSrc).toContain('providerName="Trip.com"');
    expect(fareSignalSrc).toContain("source: standout ? 'fare-signal-standout' : 'fare-signal'");
    expect(fareSignalSrc).toContain('flex flex-col');
  });

  it('keeps an evidenced route CTA visible in the first commercial decision unit', () => {
    const signal = getFareSignalForRoute('manchester-dubai', '2026-08-25');
    const href = getSafeTripComFlightHandoffUrl('manchester-dubai');
    expect(href).toBeTruthy();
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: href, routeSlug: 'manchester-dubai' }));
    expect(html).toContain('Compare flights on Trip.com');
    expect(html).toContain('Ad · Affiliate link.');
  });

  it('fails closed on the monetised-partner claim when the route has no safe partner handoff (Google Flights fallback, 12 Sept 2026, founder-approved: a non-monetised current-flight-search action now renders instead of the plain fail-closed sentence)', () => {
    const signal = getFareSignalForRoute('london-heathrow-mumbai', '2026-08-11');
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: getSafeTripComFlightHandoffUrl('london-heathrow-mumbai'), routeSlug: 'london-heathrow-mumbai' }));
    expect(html).not.toContain('Compare flights on Trip.com');
    expect(html).not.toContain('Ad · Affiliate link.');
    expect(html).toContain('Search current flights');
    expect(html).toContain('JetStash does not earn commission from this link');
  });
});
