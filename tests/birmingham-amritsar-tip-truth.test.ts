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
 * Amendment (same day, founder review): the first fix still asserted an
 * independent, time-sensitive fact of its own — "Air India's current
 * booking page does not show a direct flight" — rather than staying
 * subordinate to JetStash's own canonical route presentation. That
 * recreated a smaller version of the exact "second source of truth for
 * current service state" problem this fix exists to close. The tip now
 * says only that JetStash *shows* the route as connecting (deferring to
 * getEffectiveRoutePresentation(), not to any airline's own booking page),
 * plus guidance already licensed by the route's own intro/bookingWindowNote.
 *
 * These tests deliberately compare the tip against the ROUTE's actual
 * effective presentation (getEffectiveRoutePresentation, the same function
 * the public route page itself calls), not a hardcoded status string —
 * so this test keeps failing correctly if the route's directness or
 * verification state ever changes again, rather than silently going stale
 * the way the old tip did. They also guard the general principle, not one
 * exact sentence: this tip (and by extension any future route-scoped tip)
 * must not make an independent claim about what a specific airline's
 * booking page currently shows — that is exactly the pattern that made
 * the original version of this tip go stale.
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
      expect(tip.body).not.toMatch(/non-stop|direct Amritsar service|direct flight/i);
    }
  });

  it('agrees with the route\'s own effective presentation label rather than asserting its own status', () => {
    // The tip must defer to JetStash's canonical presentation ("shown by
    // JetStash as ...") rather than independently declaring a service
    // state — so it should surface the same status word the route page
    // itself renders, and do so as a description of what JetStash shows,
    // not as a freestanding claim.
    expect(tip.body.toLowerCase()).toContain(presentation.statusLabel.toLowerCase());
  });

  it('does not publish an unsupported frequency claim ("reduced midweek", "daily", or any specific day-of-week pattern)', () => {
    expect(tip.body).not.toMatch(/midweek|daily|weekly/i);
  });

  it('does not make an independent claim about what a specific airline\'s booking page currently shows', () => {
    // This is the exact defect the founder's amendment targeted: the tip
    // must not become a second source of truth for current service state
    // by naming an airline or describing its booking page/website. It may
    // rely on the route's own canonical presentation, nothing more.
    expect(tip.body).not.toMatch(/air india/i);
    expect(tip.body).not.toMatch(/booking page/i);
    expect(tip.body).not.toMatch(/\bwebsite\b/i);
  });

  it('only recommends checking things the route\'s own intro/bookingWindowNote already establish as unresolved (connection point, journey time, baggage) — invents no airline, schedule, hub name, or baggage guarantee', () => {
    expect(tip.body).toMatch(/connection point/i);
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
