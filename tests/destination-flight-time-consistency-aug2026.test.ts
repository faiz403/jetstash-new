import { describe, expect, it } from 'vitest';
import { getDestinationBySlug } from '@/data/destinations';

/**
 * Destination flight-time consistency fix (August 2026).
 *
 * A prior read-only audit (following the Europe route-guide expansion to 80
 * route guides) found 10 destinations whose customer-facing
 * `flightTimeFromUK` field — rendered on the RegionHubPage template (e.g.
 * /family-holidays) and on each destination's Open Graph share image — had
 * fallen behind the stronger, later-verified route-guide evidence in
 * data/routes.ts:
 *
 * - Bodrum and Istanbul kept a flat "Xh direct from Manchester" figure the
 *   route guide's own evidence either contradicted (Istanbul: Manchester
 *   Airport actually publishes 4h30m) or explicitly declined to state as a
 *   single number (Bodrum: published timings conflict across sources).
 * - Barcelona, Athens and Rome kept a specific Manchester duration that
 *   diverged from Manchester Airport's own current published planning
 *   figure in the route guide (verified 2026-08-13).
 * - Marrakech, Agadir, Casablanca and Tangier kept a precise duration for
 *   their named departure airport (London Gatwick or London Heathrow) that
 *   the route guide explicitly could not confirm ("Published duration not
 *   recorded in this evidence check").
 * - Faro kept a precise Bristol duration despite the Bristol route guide
 *   explicitly not stating one (the Birmingham–Faro route-guide timing
 *   conflict was already fixed separately and is untouched here).
 *
 * Fix rule: where the route guide supports an approximate/planning figure,
 * the destination copy now says so explicitly and adds "exact flight time
 * varies" rather than presenting a bare precise number. Where the route
 * guide has no airport-specific duration evidence at all, the precise
 * number is removed rather than replaced with a guessed range.
 */

describe('destination flightTimeFromUK fields match current route-guide evidence (Aug 2026 fix)', () => {
  it('Bodrum no longer states a flat "4h direct from Manchester" the route guide could not support', () => {
    const bodrum = getDestinationBySlug('bodrum');
    expect(bodrum?.flightTimeFromUK).toBe('Published timings vary by source; check the exact Manchester flight');
    expect(bodrum?.flightTimeFromUK).not.toContain('4h direct from Manchester');
  });

  it('Istanbul states Manchester Airport\'s actual published planning figure (4h30m), not a bare "4h"', () => {
    const istanbul = getDestinationBySlug('istanbul');
    expect(istanbul?.flightTimeFromUK).toBe('Manchester Airport publishes around 4h 30m; exact flight time varies');
    expect(istanbul?.flightTimeFromUK).not.toBe('4h direct from Manchester');
  });

  it('Barcelona states Manchester Airport\'s current published planning figure (2h30m), not the stale 2h15m', () => {
    const barcelona = getDestinationBySlug('barcelona');
    expect(barcelona?.flightTimeFromUK).toBe('Manchester Airport publishes around 2h 30m; exact flight time varies');
    expect(barcelona?.flightTimeFromUK).not.toContain('2h 15m');
  });

  it('Athens states Manchester Airport\'s current published planning figure (3h50m), not the stale 3h40m', () => {
    const athens = getDestinationBySlug('athens');
    expect(athens?.flightTimeFromUK).toBe('Manchester Airport publishes around 3h 50m; exact flight time varies');
    expect(athens?.flightTimeFromUK).not.toContain('3h 40m');
  });

  it('Rome states Manchester Airport\'s current published planning figure (2h45m), not the stale 2h35m', () => {
    const rome = getDestinationBySlug('rome');
    expect(rome?.flightTimeFromUK).toBe('Manchester Airport publishes around 2h 45m; exact flight time varies');
    expect(rome?.flightTimeFromUK).not.toContain('2h 35m');
  });

  it('Marrakech no longer asserts an unverified precise London Gatwick duration', () => {
    const marrakech = getDestinationBySlug('marrakech');
    expect(marrakech?.flightTimeFromUK).toBe('Published duration not confirmed for London Gatwick; check the exact flight for your dates');
    expect(marrakech?.flightTimeFromUK).not.toContain('3h 30m');
  });

  it('Agadir no longer asserts an unverified precise London Gatwick duration', () => {
    const agadir = getDestinationBySlug('agadir');
    expect(agadir?.flightTimeFromUK).toBe('Published duration not confirmed for London Gatwick; check the exact flight for your dates');
    expect(agadir?.flightTimeFromUK).not.toContain('3h 45m');
  });

  it('Casablanca no longer asserts an unverified precise London Heathrow duration', () => {
    const casablanca = getDestinationBySlug('casablanca');
    expect(casablanca?.flightTimeFromUK).toBe('Published duration not confirmed for London Heathrow; check the exact flight for your dates');
    expect(casablanca?.flightTimeFromUK).not.toContain('3h 25m');
  });

  it('Tangier no longer asserts an unverified precise London Gatwick duration', () => {
    const tangier = getDestinationBySlug('tangier');
    expect(tangier?.flightTimeFromUK).toBe('Published duration not confirmed for London Gatwick; check the exact flight for your dates');
    expect(tangier?.flightTimeFromUK).not.toContain('2h 50m');
  });

  it('Faro no longer asserts an unverified precise Bristol duration', () => {
    const faro = getDestinationBySlug('faro');
    expect(faro?.flightTimeFromUK).toBe('Published duration not confirmed for Bristol; check the exact flight for your dates');
    expect(faro?.flightTimeFromUK).not.toContain('2h 45m');
  });

  it('none of the 10 corrected fields claim "direct" where the route guide could not confirm a single duration', () => {
    const uncertain = ['bodrum', 'marrakech', 'agadir', 'casablanca', 'tangier', 'faro'];
    for (const slug of uncertain) {
      const dest = getDestinationBySlug(slug);
      expect(dest?.flightTimeFromUK?.toLowerCase(), `${slug} still claims "direct" without route-guide support`).not.toContain('direct');
    }
  });

  it('destinations outside this fix\'s scope are unchanged (spot check: Antalya, Dalaman, Izmir, Dubai)', () => {
    expect(getDestinationBySlug('antalya')?.flightTimeFromUK).toBe(
      'Published timings vary by airline and date; check the exact Manchester flight',
    );
    expect(getDestinationBySlug('dalaman')?.flightTimeFromUK).toBe('Scheduled flight time: 4h 30m from Manchester');
    expect(getDestinationBySlug('izmir')?.flightTimeFromUK).toBe(
      'Published planning figure: 4h 20m from Manchester Airport; exact duration varies by flight',
    );
    expect(getDestinationBySlug('dubai')?.flightTimeFromUK).toBe('7h direct from most UK airports');
  });
});
