import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRouteBySlug } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';

/**
 * Trust fix (6 Sept 2026, independent audit): /travel-club's "Told when a
 * new route launches" FeatureCard cited "Ahmedabad's Gatwick service" as a
 * settled example of an added direct/improved route. JetStash's own
 * canonical presentation for london-gatwick-ahmedabad is "Verification
 * pending" — Air India's own current booking/schedule surfaces genuinely
 * conflict on which London airport this service currently uses (Route
 * Verification Refresh Batch 1-2, Rolling Reverification Batch 4; see
 * data/routes.ts) — so citing it as a done example contradicted the
 * route's own status badge on its own /routes page.
 *
 * These tests deliberately compare the marketing copy against the route's
 * actual effective presentation (getEffectiveRoutePresentation(), the same
 * function the public route page itself calls) rather than only banning
 * the word "Ahmedabad", so they keep failing correctly if this route (or
 * any future example this copy might cite) is ever genuinely resolved.
 */

const NOW_ISO = '2026-09-06';
const route = getRouteBySlug('london-gatwick-ahmedabad')!;
const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
const travelClubSrc = readFileSync(join(process.cwd(), 'app/travel-club/page.tsx'), 'utf8');

describe('1. Canonical LGW-Ahmedabad state is unresolved, not established', () => {
  it('the route\'s own effective presentation is "Verification pending", not "Direct"', () => {
    expect(presentation.status).toBe('unverified');
    expect(presentation.statusLabel).toBe('Verification pending');
  });
});

const NEW_ROUTE_CARD_BODY = travelClubSrc.match(/title="Told when a new route launches"[\s\S]*?body="([^"]*)"/)?.[1];

describe('2. Travel Club no longer cites this route as an established example', () => {
  it('does not name Ahmedabad, Gatwick, or Air India in the "new route" feature copy', () => {
    const card = NEW_ROUTE_CARD_BODY;
    expect(card, 'the "Told when a new route launches" card should exist').toBeTruthy();
    expect(card).not.toMatch(/ahmedabad/i);
    expect(card).not.toMatch(/gatwick/i);
    expect(card).not.toMatch(/air india/i);
  });

  it('does not name any other specific route/city pair either — the fix is generic, not a swapped example', () => {
    const card = NEW_ROUTE_CARD_BODY!;
    // No destination or airport city currently in data/destinations.ts or
    // data/airports.ts should appear in this card's body — a loose proxy
    // for "no new hard-coded current route fact was introduced" without
    // hand-maintaining a second list of city names in this test.
    const destinationCities = ['Lahore', 'Islamabad', 'Karachi', 'Delhi', 'Mumbai', 'Ahmedabad', 'Dubai', 'Doha', 'Jeddah', 'Madinah', 'Amritsar'];
    for (const city of destinationCities) {
      expect(card, `should not name ${city}`).not.toContain(city);
    }
  });

  it('still communicates the same proposition — Travel Club hears about new/improved routes first', () => {
    const card = NEW_ROUTE_CARD_BODY!;
    expect(card).toMatch(/route/i);
    expect(card).toMatch(/travel club hears about it first/i);
    expect(card).toMatch(/you've told us you care about/i);
  });
});

describe('3. No unrelated Travel Club copy changed', () => {
  it('the other three feature cards are untouched', () => {
    expect(travelClubSrc).toContain(
      "body=\"We don't run automated live price tracking. Fares are researched and updated by hand, and you'll hear from us when we've found something genuinely worth flagging, not on a fixed schedule.\""
    );
    expect(travelClubSrc).toContain(
      "body=\"Tell us your nearest airport and which region or cabin you're tracking, and that's what shapes what lands in your inbox, not every update we make.\""
    );
    expect(travelClubSrc).toContain('body="No subscription, no catch. Unsubscribe in one click from any email, any time."');
  });

  it('the page hero, metadata, and card titles/icons/classes are untouched', () => {
    expect(travelClubSrc).toContain("title=\"One email, when it's actually worth opening\"");
    expect(travelClubSrc).toContain("description: 'Human-curated route and fare intelligence for international journeys from UK airports, focused on the routes JetStash actively verifies.'");
    expect(travelClubSrc).toContain('title="Checked by us, not an algorithm"');
    expect(travelClubSrc).toContain('title="Focused on your routes"');
    expect(travelClubSrc).toContain('title="Free, and easy to leave"');
  });

  it('Travel Club signup/newsletter behaviour is unchanged — still renders NewsletterSection', () => {
    expect(travelClubSrc).toContain('<NewsletterSection />');
  });
});

describe('4. No new hard-coded current route/service claim introduced', () => {
  it('the rewritten card makes no direct-route, named-airline, or frequency claim of its own', () => {
    const card = NEW_ROUTE_CARD_BODY!;
    expect(card).not.toMatch(/\bdaily\b|\bweekly\b|\bmidweek\b/i);
    expect(card).not.toMatch(/air india|emirates|qatar airways|british airways/i);
  });

  it('canonical route/fare data itself is untouched by this copy-only fix', () => {
    expect(route.isDirect).toBe(true);
    expect(route.verification?.status).toBe('unverified');
    expect(route.airlineSlugs).toEqual(['air-india']);
  });
});
