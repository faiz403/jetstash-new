import { describe, it, expect } from 'vitest';
import {
  computeRate,
  computeRatePercent,
  computePerUnit,
  computeWeeklyFunnelRates,
  attributed,
  unallocated,
  notObservable,
  type WeeklyFunnelRow,
} from '@/lib/commercial-funnel';

describe('computeRate — the fail-closed core every other calculation goes through', () => {
  it('computes a correct rate for two genuinely comparable route-scoped values', () => {
    const clicks = attributed(12, 'manchester-islamabad');
    const visitors = attributed(240, 'manchester-islamabad');
    expect(computeRate(clicks, visitors)).toBe(0.05);
  });

  it('computes a correct rate for two matching account-wide UNALLOCATED values', () => {
    const bookings = unallocated(1);
    const clicks = unallocated(47);
    expect(computeRate(bookings, clicks)).toBeCloseTo(1 / 47);
  });

  it('fails closed to N/A when the denominator is zero', () => {
    const clicks = attributed(0, 'manchester-islamabad');
    const bookings = attributed(0, 'manchester-islamabad');
    expect(computeRate(bookings, clicks)).toBe('N/A');
  });

  it('fails closed to N/A when either value is NOT_OBSERVABLE', () => {
    const visitors = notObservable('route', 'manchester-islamabad');
    const clicks = attributed(12, 'manchester-islamabad');
    expect(computeRate(clicks, visitors)).toBe('N/A');
    expect(computeRate(visitors, clicks)).toBe('N/A');
  });

  it('never combines a route-scoped value with an account-wide value, even if both look numeric', () => {
    // The exact forbidden case the funnel brief names explicitly: route
    // visitors + account-wide Trip.com clicks must never become a rate.
    const routeVisitors = attributed(240, 'manchester-islamabad');
    const accountWideClicks = unallocated(47);
    expect(computeRate(accountWideClicks, routeVisitors)).toBe('N/A');
    expect(computeRate(routeVisitors, accountWideClicks)).toBe('N/A');
  });

  it('never combines two different routes, even though both are route-scoped and ATTRIBUTED', () => {
    const manIsbClicks = attributed(12, 'manchester-islamabad');
    const manLheVisitors = attributed(300, 'manchester-lahore');
    expect(computeRate(manIsbClicks, manLheVisitors)).toBe('N/A');
  });

  it('a PARTIALLY_ATTRIBUTED value still computes normally — quality below ATTRIBUTED is not itself a reason to refuse division, only NOT_OBSERVABLE and scope mismatches are', () => {
    const partial: ReturnType<typeof attributed> = { value: 10, scope: 'route', quality: 'PARTIALLY_ATTRIBUTED', routeSlug: 'manchester-islamabad' };
    const visitors = attributed(200, 'manchester-islamabad');
    expect(computeRate(partial, visitors)).toBe(0.05);
  });
});

describe('computeRatePercent and computePerUnit — display wrappers stay N/A when computeRate is N/A', () => {
  it('formats a real rate as a percentage', () => {
    expect(computeRatePercent(attributed(5, 'manchester-islamabad'), attributed(100, 'manchester-islamabad'))).toBe('5.0%');
  });

  it('passes N/A through unchanged, never "N/A%"', () => {
    expect(computeRatePercent(notObservable('route'), attributed(100, 'manchester-islamabad'))).toBe('N/A');
  });

  it('formats a real per-unit figure with the currency symbol', () => {
    expect(computePerUnit(attributed(50, 'manchester-islamabad'), attributed(10, 'manchester-islamabad'))).toBe('£5.00');
  });

  it('passes N/A through unchanged for per-unit too', () => {
    expect(computePerUnit(notObservable('route'), attributed(10, 'manchester-islamabad'))).toBe('N/A');
  });
});

describe('computeWeeklyFunnelRates — the full weekly row, every named rate from the funnel brief', () => {
  const fullyObservedRow: WeeklyFunnelRow = {
    weekLabel: '2026-09-03 to 2026-09-09',
    routeSlugOrScope: 'manchester-islamabad',
    visitors: attributed(240, 'manchester-islamabad'),
    usefulInteractions: attributed(30, 'manchester-islamabad'),
    partnerCtaClicks: attributed(12, 'manchester-islamabad'),
    validatedBookings: attributed(1, 'manchester-islamabad'),
    commissionSettledGbp: attributed(0, 'manchester-islamabad'),
    commissionPendingGbp: attributed(3, 'manchester-islamabad'),
    founderEffortMinutes: 90,
  };

  it('computes every rate correctly when every stage is genuinely observed', () => {
    const rates = computeWeeklyFunnelRates(fullyObservedRow);
    expect(rates.visitorToInteractionRate).toBe('12.5%');
    expect(rates.interactionToCtaRate).toBe('40.0%');
    expect(rates.visitorToCtaRate).toBe('5.0%');
    expect(rates.ctaToBookingRate).toBe('8.3%');
    expect(rates.visitorToBookingRate).toBe('0.4%');
    expect(rates.commissionPerVisitor).toBe('£0.01');
    expect(rates.commissionPerCta).toBe('£0.25');
    expect(rates.commissionPerFounderHour).toBe('£2.00');
  });

  it('an entirely NOT_OBSERVABLE week produces N/A for every rate, never a fabricated zero', () => {
    const unobservedRow: WeeklyFunnelRow = {
      weekLabel: '2026-09-03 to 2026-09-09',
      routeSlugOrScope: 'manchester-islamabad',
      visitors: notObservable('route', 'manchester-islamabad'),
      usefulInteractions: notObservable('route', 'manchester-islamabad'),
      partnerCtaClicks: notObservable('route', 'manchester-islamabad'),
      validatedBookings: notObservable('route', 'manchester-islamabad'),
      commissionSettledGbp: notObservable('route', 'manchester-islamabad'),
      commissionPendingGbp: notObservable('route', 'manchester-islamabad'),
      founderEffortMinutes: null,
    };
    const rates = computeWeeklyFunnelRates(unobservedRow);
    expect(Object.values(rates).every((r) => r === 'N/A')).toBe(true);
  });

  it('a route with UNALLOCATED account-wide CTA clicks next to real route visitors never produces a route conversion rate', () => {
    const mixedScopeRow: WeeklyFunnelRow = {
      ...fullyObservedRow,
      partnerCtaClicks: unallocated(47), // account-wide, not this route
    };
    const rates = computeWeeklyFunnelRates(mixedScopeRow);
    expect(rates.visitorToCtaRate).toBe('N/A');
    expect(rates.interactionToCtaRate).toBe('N/A');
    expect(rates.commissionPerCta).toBe('N/A');
    // Stages unaffected by the mismatched clicks value still compute normally.
    expect(rates.visitorToInteractionRate).toBe('12.5%');
  });

  it('a zero-click week (genuine zero, not unobserved) correctly yields N/A for CTA-derived rates rather than a divide-by-zero artefact', () => {
    const zeroClicksRow: WeeklyFunnelRow = {
      ...fullyObservedRow,
      partnerCtaClicks: attributed(0, 'manchester-islamabad'),
      validatedBookings: attributed(0, 'manchester-islamabad'),
    };
    const rates = computeWeeklyFunnelRates(zeroClicksRow);
    expect(rates.ctaToBookingRate).toBe('N/A');
    expect(rates.commissionPerCta).toBe('N/A');
    // visitor-denominated rates are unaffected by a zero CTA count.
    expect(rates.visitorToCtaRate).toBe('0.0%');
  });

  it('missing founder effort (not logged that week) yields N/A for commission-per-founder-hour without affecting other rates', () => {
    const noEffortRow: WeeklyFunnelRow = { ...fullyObservedRow, founderEffortMinutes: null };
    const rates = computeWeeklyFunnelRates(noEffortRow);
    expect(rates.commissionPerFounderHour).toBe('N/A');
    expect(rates.commissionPerCta).toBe('£0.25');
  });

  it('a NOT_OBSERVABLE pending-commission figure next to a real settled figure never silently understates total commission as just the settled amount', () => {
    const partialCommissionRow: WeeklyFunnelRow = {
      ...fullyObservedRow,
      commissionSettledGbp: attributed(10, 'manchester-islamabad'),
      commissionPendingGbp: notObservable('route', 'manchester-islamabad'),
    };
    const rates = computeWeeklyFunnelRates(partialCommissionRow);
    expect(rates.commissionPerCta).toBe('N/A');
    expect(rates.commissionPerVisitor).toBe('N/A');
  });
});
