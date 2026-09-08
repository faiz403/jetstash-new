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
    expect(fareSignalSrc).toContain('Check current price on Trip.com');
    expect(fareSignalSrc).toContain('providerName="Trip.com"');
    expect(fareSignalSrc).toContain("source: standout ? 'fare-signal-standout' : 'fare-signal'");
    expect(fareSignalSrc).toContain('flex flex-col');
  });

  it('keeps an evidenced route CTA visible in the first commercial decision unit', () => {
    const signal = getFareSignalForRoute('manchester-dubai', '2026-08-25');
    const href = getSafeTripComFlightHandoffUrl('manchester-dubai');
    expect(href).toBeTruthy();
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: href, routeSlug: 'manchester-dubai' }));
    expect(html).toContain('Check current price on Trip.com');
    expect(html).toContain('Ad · Affiliate link.');
  });

  it('fails closed when the route has no safe partner handoff', () => {
    const signal = getFareSignalForRoute('london-heathrow-mumbai', '2026-08-11');
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: getSafeTripComFlightHandoffUrl('london-heathrow-mumbai'), routeSlug: 'london-heathrow-mumbai' }));
    expect(html).toContain('Exact partner booking link is not currently verified for this route.');
    expect(html).not.toContain('Check current price on Trip.com');
  });
});
