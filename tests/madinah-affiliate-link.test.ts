import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getTripComRouteUrl, hasTripComRoute } from '@/lib/booking-providers';

/**
 * Superseded: LAUNCH_CHECKLIST.md item C1 (Madinah's TravelUp deep link)
 * described TravelUp-era behaviour that no longer exists. TravelUp has been
 * removed entirely from JetStash; Trip.com is now the sole provider, and
 * every one of its links is route-specific by construction (there is no
 * "general site, not a pre-filled search" degraded state any more — a route
 * either has an exact dashboard-generated link, or it has no CTA at all).
 * Both Madinah routes (manchester-madinah, birmingham-madinah) are in the
 * 23 supported routes, so they now get the same standard CTA as everything
 * else — nothing Madinah-specific remains to special-case.
 */

describe('Madinah routes get the same standard Trip.com link as every other supported route', () => {
  it('manchester-madinah resolves to a real, route-specific Trip.com URL', () => {
    const url = getTripComRouteUrl('manchester-madinah');
    expect(url).toContain('trip.com/flights/Manchester-to-Medina');
    expect(url).toContain('dcity=MAN&acity=MED');
  });

  it('birmingham-madinah resolves to a real, route-specific Trip.com URL', () => {
    const url = getTripComRouteUrl('birmingham-madinah');
    expect(url).toContain('trip.com/flights/Birmingham-to-Medina');
    expect(url).toContain('dcity=BHX&acity=MED');
  });

  it('both are reported as supported', () => {
    expect(hasTripComRoute('manchester-madinah')).toBe(true);
    expect(hasTripComRoute('birmingham-madinah')).toBe(true);
  });
});

describe('deal card no longer carries Madinah-specific CTA-caption logic', () => {
  const dealCardSrc = readFileSync(join(process.cwd(), 'components/ui/deal-card.tsx'), 'utf8');

  it('has no destination-specific caption branch — every supported route gets the same wording', () => {
    expect(dealCardSrc).not.toContain("deal.toDestinationSlug === 'madinah'");
    expect(dealCardSrc).not.toMatch(/not a pre-filled Madinah search/);
  });

  it('uses the standard Trip.com CTA and supporting copy', () => {
    // Whitespace-normalised: public-trust-corrections-aug2026 (August 2026)
    // wrapped this caption onto two source lines. The later commercial-trust
    // pass moved the commercial wording into the shared disclosure component;
    // the underlying itinerary/baggage/booking warning remains unchanged.
    const normalised = dealCardSrc.replace(/\s+/g, ' ');
    expect(normalised).toContain('Compare flights on Trip.com');
    expect(normalised).toContain('AffiliateLinkDisclosure');
    expect(normalised).toContain('Check the itinerary, baggage allowance and booking terms before paying.');
  });
});
