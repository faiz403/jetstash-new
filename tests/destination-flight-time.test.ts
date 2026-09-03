import { describe, expect, it } from 'vitest';
import { getDestinationBySlug } from '@/data/destinations';
import { getDestinationFlightTimeFromUK } from '@/lib/destination-flight-time';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';

describe('destination-level flight summaries respect route status', () => {
  it('suppresses the ended Manchester–Delhi direct claim', () => {
    const summary = getDestinationFlightTimeFromUK(getDestinationBySlug('delhi')!, '2026-09-03');
    expect(summary).toBe('8h 45m direct from London Heathrow; former Manchester direct service ended');
  });

  it('suppresses the ended Manchester–Mumbai direct claim', () => {
    const summary = getDestinationFlightTimeFromUK(getDestinationBySlug('mumbai')!, '2026-09-03');
    expect(summary).toBe('9h direct from London Heathrow; former Manchester direct service ended');
  });

  it('preserves the destination fallback before service-ended evidence is effective', () => {
    const destination = getDestinationBySlug('mumbai')!;
    expect(getDestinationFlightTimeFromUK(destination, '2026-08-25')).toBe(destination.flightTimeFromUK);
  });

  it('keeps destination route cards on the same service-ended status as the route guides', () => {
    for (const slug of ['delhi', 'mumbai']) {
      const entry = getDestinationFlightGuideEntries(getDestinationBySlug(slug)!, '2026-09-03').find(
        (item) => item.routeSlug === `manchester-${slug}`,
      );
      expect(entry?.routeStatus, slug).toBe('service-ended');
    }
  });
});
