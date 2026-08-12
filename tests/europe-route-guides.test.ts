import { describe, expect, it } from 'vitest';

import { getRouteBySlug } from '@/data/routes';
import { getTripComDestinationHandoffUrl } from '@/lib/booking-providers';

const BUILT = [
  'manchester-barcelona', 'birmingham-barcelona', 'london-gatwick-barcelona', 'bristol-barcelona', 'leeds-bradford-barcelona',
  'bristol-faro', 'manchester-faro', 'birmingham-faro', 'leeds-bradford-faro', 'london-gatwick-faro',
  'manchester-athens', 'birmingham-athens', 'london-gatwick-athens',
  'manchester-rome', 'birmingham-rome', 'london-gatwick-rome', 'bristol-rome',
];

const HANDOFFS = [
  ['manchester', 'barcelona'], ['birmingham', 'barcelona'], ['bristol', 'barcelona'], ['leeds-bradford', 'barcelona'],
  ['bristol', 'faro'], ['manchester', 'faro'], ['birmingham', 'faro'], ['leeds-bradford', 'faro'],
  ['manchester', 'athens'], ['birmingham', 'athens'], ['glasgow', 'athens'],
  ['manchester', 'rome'], ['birmingham', 'rome'], ['bristol', 'rome'],
];

describe('Europe route-guide completion', () => {
  it('publishes exactly the 17 evidence-backed guides and leaves Glasgow to Athens pending', () => {
    for (const slug of BUILT) {
      const route = getRouteBySlug(slug);
      expect(route, slug).toBeDefined();
      expect(route?.isDirect).toBe(true);
      expect(route?.verification?.status).toBe('verified');
      expect(route?.verification?.sourceUrl).toMatch(/^https:\/\//);
    }
    expect(getRouteBySlug('glasgow-athens')).toBeUndefined();
  });

  it('preserves exact booking handoffs while Gatwick remains fail-closed', () => {
    for (const [origin, destination] of HANDOFFS) {
      const url = getTripComDestinationHandoffUrl(origin, destination);
      expect(url, `${origin}-${destination}`).toMatch(/curr=GBP/);
      expect(url).toContain('Allianceid=');
      expect(url).toContain('SID=');
    }
    for (const destination of ['barcelona', 'faro', 'athens', 'rome']) {
      expect(getTripComDestinationHandoffUrl('gatwick', destination)).toBeNull();
    }
  });

  it('does not introduce recommendation or unsupported certainty language', () => {
    for (const slug of BUILT) {
      const route = getRouteBySlug(slug)!;
      const copy = `${route.intro} ${route.bookingWindowNote} ${route.frequency}`.toLowerCase();
      expect(copy).not.toMatch(/\b(best|cheapest|recommended|guaranteed|always)\b/);
    }
  });

  it('preserves the Birmingham-Faro duration conflict without settling on one figure', () => {
    const route = getRouteBySlug('birmingham-faro');
    expect(route?.flightTime).toBe('Published timings vary by source; check the exact flight for duration');
    expect(route?.intro).toContain('Published timings vary by source');
    expect(route?.intro).not.toContain('1h50');
    expect(route?.frequency).toContain('easyJet, Jet2 and TUI');
  });
});
