import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getAirportBySlug } from '@/data/airports';
import { getDestinationBySlug } from '@/data/destinations';
import { getRouteBookingUrl, hasVerifiedDeepLink } from '@/lib/booking-providers';

/**
 * LAUNCH_CHECKLIST.md item C1: Madinah has real fare data (a logged
 * observation on manchester-madinah) but no manually-verified TravelUp
 * destination page, unlike every other route destination. The CTA wording
 * on the route hero and on Madinah's two deal cards previously implied a
 * route-specific search; both now say plainly that the link opens
 * TravelUp's general site instead, while still resolving to the real,
 * tracked CJ link (commission-earning, just not destination-specific).
 */

describe('hasVerifiedDeepLink', () => {
  it('is false for madinah — the one route destination with no verified TravelUp page', () => {
    expect(hasVerifiedDeepLink('madinah')).toBe(false);
  });

  it('is true for a destination that does have one, e.g. lahore', () => {
    expect(hasVerifiedDeepLink('lahore')).toBe(true);
  });
});

describe('getRouteBookingUrl for Madinah routes', () => {
  const manchester = getAirportBySlug('manchester')!;
  const madinah = getDestinationBySlug('madinah')!;

  it('resolves to the real tracked CJ link with no url= override', () => {
    const url = getRouteBookingUrl(manchester, madinah);
    expect(url).toContain('kqzyfj.com/click-101818709-15363607');
    expect(url).not.toContain('url=');
  });

  it('still carries a route-identifying sid for click attribution', () => {
    const url = getRouteBookingUrl(manchester, madinah);
    expect(url).toContain('sid=route-manchester-madinah');
  });
});

describe('route hero CTA does not overclaim route-specificity for Madinah', () => {
  const routePageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');

  it('imports hasVerifiedDeepLink and branches the CTA text on it', () => {
    expect(routePageSrc).toContain("hasVerifiedDeepLink");
    expect(routePageSrc).toMatch(/hasVerifiedDeepLink\(dest\.slug\)\s*\?\s*'Check live prices for this route'/);
  });

  it('the no-deep-link branch never claims "for this route"', () => {
    const match = routePageSrc.match(/hasVerifiedDeepLink\(dest\.slug\)\s*\?\s*'Check live prices for this route'\s*:\s*`([^`]*)`/);
    expect(match).not.toBeNull();
    expect(match![1]).not.toMatch(/for this route/i);
  });

  it('the caption honestly says it opens the general site, not a pre-filled search, when no deep link exists', () => {
    expect(routePageSrc).toMatch(/not a pre-filled search for this route/);
  });
});

describe('deal card CTA caption is honest for Madinah specifically, unchanged for everything else', () => {
  const dealCardSrc = readFileSync(join(process.cwd(), 'components/ui/deal-card.tsx'), 'utf8');

  it('scopes the alternate caption explicitly to the madinah destination slug', () => {
    expect(dealCardSrc).toContain("deal.toDestinationSlug === 'madinah'");
  });

  it('the Madinah caption says it opens a general site, not a pre-filled Madinah search', () => {
    expect(dealCardSrc).toMatch(/not a pre-filled Madinah search/);
  });

  it('every other destination keeps the original generic caption verbatim', () => {
    expect(dealCardSrc).toContain('Partner link. Prices change quickly, confirm the final price before booking');
  });
});
