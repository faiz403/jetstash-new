import type { AirportOption } from './airport-options';

const joinCities = (cities: string[]) =>
  cities.length <= 1 ? cities.join('') : `${cities.slice(0, -1).join(', ')} and ${cities[cities.length - 1]}`;

/**
 * The planner's coverage sentence, built from the same public arrival options
 * the API enforces, so the copy can never name an airport the planner refuses
 * or omit one it accepts. Transit-first airports (Manchester) are named
 * separately from road-only ones, whose onward leg is a driving or pickup
 * estimate with no public transport.
 */
export function describeOnwardCoverage(arrivals: Pick<AirportOption, 'city' | 'journeyEngine'>[]): string {
  const cities = (engine: string) => [...new Set(arrivals.filter((a) => a.journeyEngine === engine).map((a) => a.city))].sort();
  const transit = cities('TRANSIT_FIRST');
  const road = cities('ROAD_PICKUP_FIRST');
  const parts = [
    transit.length ? `${joinCities(transit)} (public transport, with a driving option)` : '',
    road.length ? `${joinCities(road)} (road only: driving or pickup, no public transport)` : '',
  ].filter(Boolean);
  if (!parts.length) return 'Onward planning is not available for any arrival airport at the moment.';
  return `Onward planning currently supports arrivals at ${parts.join('; and ')}.`;
}
