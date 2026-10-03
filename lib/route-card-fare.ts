import type { FareSignalObservation } from '@/lib/fare-signal';

/**
 * Consumer clarity pass (3 Oct 2026). Pure helpers shared by the airport and destination
 * route cards so both describe a fare the same way: a short, exact airport name and a
 * one-phrase journey shape ("Direct", "1 stop", "2 stops", "Connecting"). Nothing here
 * selects or alters a fare; it only words what the existing Fare Signal already holds.
 */

/**
 * "Manchester Airport" -> "Manchester", "London Heathrow" stays "London Heathrow". This is the
 * same short label the homepage journey finder already uses, and it keeps Heathrow and Gatwick
 * apart (both have city "London"), which an ambiguous "London -> Dubai" card could not.
 */
export function airportShortName(name: string): string {
  return name.replace(/ Airport$/, '');
}

/** "Direct" / "1 stop" / "2 stops" / "Connecting", or null when the observation does not say. */
export function describeFareStops(observation: Pick<FareSignalObservation, 'directness' | 'outboundStops' | 'returnStops'>): string | null {
  if (observation.directness === 'direct') return 'Direct';
  if (observation.directness === 'connecting') {
    const { outboundStops, returnStops } = observation;
    if (outboundStops !== null && outboundStops === returnStops) {
      return `${outboundStops} stop${outboundStops === 1 ? '' : 's'}`;
    }
    return 'Connecting';
  }
  return null;
}
