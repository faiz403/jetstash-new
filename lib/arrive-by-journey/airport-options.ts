import { getCatalogueAirport, getCatalogueAirports } from '../arrive-by-shared/airport-catalogue';
import { getAirportCapability } from '../arrive-by-shared/airport-capability';
import { getCountryName } from '../arrive-by-shared/airport-search';
import { DEPARTURE_CAPABILITY_EVIDENCE } from './departure-capability';

/**
 * The airport choices the internal form offers, computed on the SERVER from
 * the same evidence tables the API enforces (so the form can never offer an
 * airport the API would refuse for capability reasons). Server-only: it reads
 * the worldwide catalogue, which must never reach a client bundle -- the page
 * passes the resulting small list down as props.
 *
 *  - departure: UK airports with DEPARTURE evidence (directional, F2)
 *  - arrival:   airports whose ARRIVAL capability is approved (an explicit
 *               profile or `road_supported`); release is irrelevant to this
 *               internal beta and is not consulted
 */

export interface AirportOption {
  code: string;
  name: string;
  city: string;
  country: string;
}

const toOption = (code: string): AirportOption | undefined => {
  const airport = getCatalogueAirport(code);
  return airport ? { code: airport.iata, name: airport.name, city: airport.city, country: getCountryName(airport.countryCode) } : undefined;
};

const byLabel = (a: AirportOption, b: AirportOption) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city) || a.code.localeCompare(b.code);

export function getDepartureAirportOptions(): AirportOption[] {
  return Object.keys(DEPARTURE_CAPABILITY_EVIDENCE).map(toOption).filter((o): o is AirportOption => Boolean(o)).sort(byLabel);
}

export function getArrivalAirportOptions(): AirportOption[] {
  return getCatalogueAirports()
    .filter((airport) => getAirportCapability(airport.iata)?.capabilityApproved)
    .map((airport) => toOption(airport.iata))
    .filter((o): o is AirportOption => Boolean(o))
    .sort(byLabel);
}
