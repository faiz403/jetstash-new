import { describe, it, expect } from 'vitest';
import { fareObservations } from '@/data/fare-observations';
import { toSignalObservation, type FareSignalObservation } from '@/lib/fare-signal';
import { formatStops, formatRouting } from '@/components/route/fare-signal';
import { formatStops as formatStopsTrackedFares, directnessLabel } from '@/components/sections/tracked-fares-explorer';
import type { TrackedFareEntry } from '@/lib/tracked-fare-groups';

/**
 * Asymmetric-itinerary fix (5 September 2026) — independently reproduced
 * Astra finding, confirmed on manchester-agadir and bristol-faro in
 * production ("Connecting · 0 stops each way" next to a return leg that
 * actually had 1 stop). Root cause: both components/route/fare-signal.tsx's
 * formatStops() and components/sections/tracked-fares-explorer.tsx's
 * directnessLabel() built their "X stops each way" text from outboundStops
 * alone, never checking it against returnStops — while
 * components/route/journey-choice.tsx and smart-fare-comparison.tsx already
 * had the correct equality check. This file protects the fix at both the
 * specific-record level (the two live-reproduced cases) and the
 * dataset-wide level (every currently asymmetric observation in
 * data/fare-observations.ts, so a future data addition can't silently
 * reintroduce the bug on a new route).
 */

function toObservation(id: string): FareSignalObservation {
  const raw = fareObservations.find((o) => o.id === id);
  if (!raw) throw new Error(`fixture observation not found: ${id}`);
  const observation = toSignalObservation(raw);
  if (!observation) throw new Error(`observation not publicly publishable: ${id}`);
  return observation;
}

function toTrackedEntry(observation: FareSignalObservation): TrackedFareEntry {
  return {
    routeSlug: 'fixture-route',
    routeHref: '/routes/fixture-route',
    destCity: 'Fixture City',
    destCountry: 'Fixture Country',
    observation,
    tripComUrl: null,
    searchIndex: 'fixture',
  };
}

const EACH_WAY_PATTERN = /^\d+ stops? each way$/;

describe('Asymmetric-itinerary fix — the two live-reproduced production cases', () => {
  it('manchester-agadir (obs-man-aga-economy-20260901-8w-v1): 0 stops outbound, 1 stop return — must never say "0 stops each way"', () => {
    const observation = toObservation('obs-man-aga-economy-20260901-8w-v1');
    expect(observation.outboundStops).toBe(0);
    expect(observation.returnStops).toBe(1);

    const stops = formatStops(observation);
    expect(stops).not.toMatch(EACH_WAY_PATTERN);
    expect(stops).toBe('0 stops outbound, 1 stop return');

    const routing = formatRouting(observation);
    expect(routing).not.toMatch(/0 stops each way/);
    expect(routing).toBe('Connecting · 0 stops outbound, 1 stop return');

    const trackedStops = formatStopsTrackedFares(observation);
    expect(trackedStops).toBe('0 stops outbound, 1 stop return');
    const label = directnessLabel(toTrackedEntry(observation));
    expect(label).not.toMatch(/0 stops each way/);
    expect(label).toBe('Connecting · 0 stops outbound, 1 stop return');
  });

  it('bristol-faro (obs-brs-fao-economy-20260901-8w-v1): 0 stops outbound, 1 stop return — same fix, second reproduced route', () => {
    const observation = toObservation('obs-brs-fao-economy-20260901-8w-v1');
    expect(observation.outboundStops).toBe(0);
    expect(observation.returnStops).toBe(1);

    expect(formatStops(observation)).toBe('0 stops outbound, 1 stop return');
    expect(formatRouting(observation)).toBe('Connecting · 0 stops outbound, 1 stop return');
    expect(formatStopsTrackedFares(observation)).toBe('0 stops outbound, 1 stop return');
    expect(directnessLabel(toTrackedEntry(observation))).toBe('Connecting · 0 stops outbound, 1 stop return');
  });
});

describe('Asymmetric-itinerary fix — dataset-wide protection', () => {
  const publishable = fareObservations
    .map((raw) => toSignalObservation(raw))
    .filter((o): o is FareSignalObservation => o !== null);

  const asymmetric = publishable.filter(
    (o) => o.outboundStops !== null && o.returnStops !== null && o.outboundStops !== o.returnStops
  );
  const symmetric = publishable.filter(
    (o) => o.outboundStops !== null && o.returnStops !== null && o.outboundStops === o.returnStops
  );

  it('found at least the known 44 asymmetric records to protect (dataset may grow, never shrink below this without review)', () => {
    expect(asymmetric.length).toBeGreaterThanOrEqual(44);
  });

  it('no asymmetric observation ever produces the misleading "X stops each way" phrasing, in either component', () => {
    for (const observation of asymmetric) {
      const stops = formatStops(observation);
      const trackedStops = formatStopsTrackedFares(observation);
      expect(stops, observation.id).not.toMatch(EACH_WAY_PATTERN);
      expect(trackedStops, observation.id).not.toMatch(EACH_WAY_PATTERN);
      // Both real numbers must actually appear, not be silently dropped.
      expect(stops, observation.id).toBe(`${observation.outboundStops} stop${observation.outboundStops === 1 ? '' : 's'} outbound, ${observation.returnStops} stop${observation.returnStops === 1 ? '' : 's'} return`);
      expect(trackedStops, observation.id).toBe(stops);
    }
  });

  it('no asymmetric, connecting observation ever renders a self-contradictory composed routing/directness string', () => {
    for (const observation of asymmetric) {
      if (observation.directness !== 'connecting') continue;
      const routing = formatRouting(observation);
      const label = directnessLabel(toTrackedEntry(observation));
      expect(routing, observation.id).not.toMatch(/each way/);
      expect(label, observation.id).not.toMatch(/each way/);
    }
  });

  it('control: a genuinely symmetric observation still correctly uses "each way" phrasing (the fix did not break the true-positive case)', () => {
    expect(symmetric.length).toBeGreaterThan(0);
    for (const observation of symmetric) {
      const stops = formatStops(observation);
      expect(stops, observation.id).toMatch(EACH_WAY_PATTERN);
      expect(formatStopsTrackedFares(observation), observation.id).toBe(stops);
    }
  });

  it('control: a direct (0-stop, symmetric) observation still renders "Direct journey" / "Direct", unaffected by this fix', () => {
    const direct = publishable.filter((o) => o.directness === 'direct');
    expect(direct.length).toBeGreaterThan(0);
    for (const observation of direct) {
      expect(formatRouting(observation), observation.id).toBe('Direct journey');
      expect(directnessLabel(toTrackedEntry(observation)), observation.id).toBe('Direct');
    }
  });
});
