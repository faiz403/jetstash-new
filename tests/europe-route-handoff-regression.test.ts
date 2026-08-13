import { describe, expect, it } from 'vitest';

import { getTripComDestinationHandoffUrl, getTripComFlightHandoffUrl } from '@/lib/booking-providers';

const RESTORED = [
  ['manchester', 'barcelona'], ['birmingham', 'barcelona'], ['bristol', 'barcelona'], ['leeds-bradford', 'barcelona'],
  ['bristol', 'faro'], ['manchester', 'faro'], ['birmingham', 'faro'], ['leeds-bradford', 'faro'],
  ['manchester', 'athens'], ['birmingham', 'athens'],
  ['manchester', 'rome'], ['birmingham', 'rome'], ['bristol', 'rome'],
] as const;

describe('Europe route-guide handoff regression', () => {
  it('reuses the exact verified destination handoff on each restored route guide', () => {
    for (const [origin, destination] of RESTORED) {
      const routeSlug = `${origin}-${destination}`;
      const destinationHandoff = getTripComDestinationHandoffUrl(origin, destination);
      const routeHandoff = getTripComFlightHandoffUrl(routeSlug, origin, destination);
      expect(destinationHandoff, routeSlug).not.toBeNull();
      expect(routeHandoff, routeSlug).not.toBeNull();
      expect(routeHandoff).toContain('locale=en-XX&curr=GBP');
      expect(routeHandoff).toContain('Allianceid=9804124');
      expect(routeHandoff).toContain('SID=327450313');
      expect(routeHandoff).toBe(destinationHandoff);
    }
  });

  it('keeps Gatwick fail-closed even when a route guide exists', () => {
    for (const destination of ['barcelona', 'faro', 'athens', 'rome']) {
      expect(getTripComFlightHandoffUrl(`london-gatwick-${destination}`, 'london-gatwick', destination)).toBeNull();
    }
  });
});
