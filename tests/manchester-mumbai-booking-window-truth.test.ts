import { describe, it, expect } from 'vitest';
import { getRouteBySlug } from '@/data/routes';

/**
 * Astra bounded trust review (10 Sept 2026) — finding #4, Mumbai unavailable
 * live-price wording.
 *
 * manchester-mumbai's bookingWindowNote said "fares often rise on this
 * route" and "since this is a single-airline direct service" — both stated
 * an actively-priceable direct service as present fact, but IndiGo's
 * Manchester-Mumbai direct service is confirmed `service-ended`
 * (data/route-status-events.ts, verified 2 Sept 2026). Rewritten to state
 * the seasonal Mumbai fare pattern generically (true regardless of route)
 * rather than as a live claim about this specific now-ended direct service,
 * while still pointing at the connecting alternative, which remains
 * genuinely comparable.
 *
 * Scope: this one field on this one route only. manchester-delhi carries
 * the identical pre-existing wording pattern but was NOT part of this
 * approved fix and is deliberately left untouched here.
 */

const route = getRouteBySlug('manchester-mumbai')!;
const delhiRoute = getRouteBySlug('manchester-delhi')!;

describe('manchester-mumbai bookingWindowNote no longer implies an actively-priceable direct service', () => {
  it('no longer claims fares rise "on this route" or that this "is a single-airline direct service"', () => {
    expect(route.bookingWindowNote).not.toMatch(/fares often rise on this route/i);
    expect(route.bookingWindowNote).not.toMatch(/since this is a single-airline direct service/i);
  });

  it('still gives the seasonal Diwali/Dec-Jan timing guidance and still points at the connecting alternative', () => {
    expect(route.bookingWindowNote).toMatch(/Diwali/i);
    expect(route.bookingWindowNote).toMatch(/December to January/i);
    expect(route.bookingWindowNote).toMatch(/one-stop Gulf-carrier options/i);
  });

  it('manchester-delhi\'s identical pre-existing pattern is untouched — not part of this approved fix', () => {
    expect(delhiRoute.bookingWindowNote).toMatch(/fares often rise on this route/i);
  });
});
