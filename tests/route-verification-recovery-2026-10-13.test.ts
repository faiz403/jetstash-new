import { describe, expect, it } from 'vitest';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getFareAgeWarningText } from '@/lib/fare-age-warning';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';
import { getRouteBySlug } from '@/data/routes';

const RECOVERED_ROUTES = [
  {
    slug: 'manchester-lahore',
    fareId: 'obs-man-lhe-economy-20261006-v1',
    fare: 585,
  },
  {
    slug: 'london-gatwick-faro',
    fareId: 'obs-lgw-fao-economy-20260922-v1',
    fare: 56,
  },
] as const;

describe('13 October route verification recovery preserves the intended Fare Signals', () => {
  it.each(RECOVERED_ROUTES)('$slug has a sourced 30-day review and remains verified through 15 October', ({ slug }) => {
    const route = getRouteBySlug(slug)!;

    expect(route.verification?.status).toBe('verified');
    expect(route.verification?.verifiedDate).toBe('2026-10-13');
    expect(route.verification?.reviewDueDate).toBe('2026-11-12');
    expect(route.verification?.sourceUrl).toMatch(/^https:\/\//);
    expect(route.verification?.note).toContain('13 October 2026');

    for (const date of ['2026-10-13', '2026-10-15']) {
      expect(getEffectiveRoutePresentation(route, routeStatusEvents, date).status).toBe('direct');
    }
  });

  it.each(RECOVERED_ROUTES)('$slug keeps its intended public fare and has no 30-day age warning on 15 October', ({ slug, fareId, fare }) => {
    const signal = getFareSignalForRoute(slug, '2026-10-15');

    expect(signal.state).toBe('current');
    expect(signal.observation?.id).toBe(fareId);
    expect(signal.observation?.price).toBe(fare);
    expect(signal.observation && getFareAgeWarningText(signal.observation.observedDate, '2026-10-15')).toBeNull();
  });
});
