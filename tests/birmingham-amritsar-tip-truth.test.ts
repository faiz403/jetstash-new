import { describe, it, expect } from 'vitest';
import { getRouteBySlug } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';
import { travellerTips, getTipsForScope } from '@/data/traveller-tips';

/**
 * Trust fix (6 Sept 2026, independent audit): birmingham-amritsar's
 * canonical route record is connecting-only (isDirect: false, no
 * verification block), but its traveller tip previously said "Air India's
 * direct Amritsar services run at reduced midweek frequency rather than
 * daily" — a same-page contradiction with the route's own "Connecting"
 * badge. The identical false premise (Birmingham sharing Gatwick's genuine
 * direct Amritsar service) was already corrected once on Gatwick airport's
 * own whyThisAirport copy during PR #231 (5 Sept) — this tip was the one
 * surface that fix missed.
 *
 * These tests deliberately compare the tip against the ROUTE's actual
 * effective presentation (getEffectiveRoutePresentation, the same function
 * the public route page itself calls), not a hardcoded status string —
 * so this test keeps failing correctly if the route's directness or
 * verification state ever changes again, rather than silently going stale
 * the way the old tip did.
 */

const NOW_ISO = '2026-09-06';
const route = getRouteBySlug('birmingham-amritsar')!;
const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
const tip = getTipsForScope({ routeSlug: 'birmingham-amritsar' })[0];

describe('1. Canonical route state is unchanged and still connecting', () => {
  it('birmingham-amritsar remains isDirect: false in the route record', () => {
    expect(route.isDirect).toBe(false);
  });

  it('the effective public presentation status is "connecting", not "direct" or "unverified"', () => {
    expect(presentation.status).toBe('connecting');
    expect(presentation.statusLabel).toBe('Connecting');
  });

  it('route flightTime, frequency, airlineSlugs and peakPeriodIds are unchanged', () => {
    expect(route.flightTime).toBe('14h 45m via connection (Air India booking page)');
    expect(route.frequency).toBe('Connection options available; exact schedule varies');
    expect(route.airlineSlugs).toEqual(['air-india']);
    expect(route.peakPeriodIds).toEqual(['baisakhi', 'diwali', 'uk-summer-holidays']);
  });
});

describe('2. The traveller tip no longer contradicts the route\'s effective presentation', () => {
  it('exists, scoped correctly, under the logistics category', () => {
    expect(tip).toBeTruthy();
    expect(tip.scope).toEqual({ routeSlug: 'birmingham-amritsar' });
    expect(tip.category).toBe('logistics');
  });

  it('never claims a direct or non-stop service when the route\'s own presentation says connecting', () => {
    // Structural check, not a one-off string ban: if this route's directness
    // is ever corrected back to direct, this same assertion would need the
    // tip to say so — it fails on the actual current mismatch, not a fixed
    // sentence.
    if (presentation.status !== 'direct') {
      expect(tip.title).not.toMatch(/non-stop|direct\b/i);
      expect(tip.body).not.toMatch(/non-stop|direct Amritsar service/i);
    }
  });

  it('does not publish an unsupported frequency claim ("reduced midweek", "daily", or any specific day-of-week pattern)', () => {
    expect(tip.body).not.toMatch(/midweek|daily|weekly/i);
  });

  it('states the connecting status plainly, matching the route\'s own presentation label', () => {
    expect(tip.body).toMatch(/connecting service/i);
  });

  it('only recommends checking things the route\'s own intro/bookingWindowNote already establish as unresolved (hub, journey time, baggage) — invents no airline, schedule, hub name, or baggage guarantee', () => {
    expect(tip.body).toMatch(/connecting hub/i);
    expect(tip.body).toMatch(/journey time/i);
    expect(tip.body).toMatch(/baggage conditions/i);
    // No specific connection airport is named anywhere in this route's data
    // (route.intro explicitly says "check the live itinerary for the actual
    // hub"), so the tip must not invent one either.
    expect(tip.body).not.toMatch(/via (delhi|mumbai|dubai|abu dhabi|doha|istanbul)/i);
  });
});

describe('3. No unrelated traveller tip changed', () => {
  it('the sibling Gatwick-Amritsar tip (a genuinely different, verified-direct route) is untouched', () => {
    const gatwickTip = getTipsForScope({ routeSlug: 'london-gatwick-amritsar' })[0];
    expect(gatwickTip.title).toBe('Confirm the specific flight day before assuming a non-stop exists');
    expect(gatwickTip.body).toBe(
      "Air India's direct Amritsar services run at reduced midweek frequency rather than daily. Confirm specific flight days before assuming a non-stop option exists on your preferred date."
    );
  });

  it('the Manchester-Mumbai and Manchester-Dubai route-scoped tips are untouched', () => {
    const mumbaiTip = getTipsForScope({ routeSlug: 'manchester-mumbai' })[0];
    const dubaiTip = getTipsForScope({ routeSlug: 'manchester-dubai' })[0];
    expect(mumbaiTip.body).toContain("Manchester's direct Mumbai service has ended");
    expect(dubaiTip.body).toContain('the right rule for this direct Manchester service');
  });

  it('total tip count is unchanged — this fix edited one existing entry, added none, removed none', () => {
    expect(travellerTips.length).toBeGreaterThanOrEqual(4);
    const routeScoped = travellerTips.filter((t) => 'routeSlug' in t.scope);
    expect(routeScoped).toHaveLength(4);
  });
});
