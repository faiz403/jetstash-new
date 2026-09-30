/**
 * Human-readable label for a Google Geocoding result. Built ONLY from fields
 * Google returned for that result: a venue name is used only when Google
 * supplied an establishment / point_of_interest / premise component (never
 * invented, never a plus code). When no name exists the label says what kind
 * of place it is (from Google's own types) plus the street address, so a
 * traveller can still recognise it. No extra Google call is made.
 */

interface Component {
  long_name?: string;
  short_name?: string;
  types?: string[];
}

export interface DescribableResult {
  formatted_address?: string;
  types?: string[];
  address_components?: Component[];
}

const NAME_TYPES = ['establishment', 'point_of_interest', 'premise'];
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i;

const find = (components: Component[], type: string): string | undefined => components.find((c) => c.types?.includes(type))?.long_name;

function kindOf(types: string[]): string | undefined {
  const has = (...wanted: string[]) => wanted.some((t) => types.includes(t));
  if (has('lodging')) return 'hotel';
  if (has('hospital', 'health')) return 'hospital';
  if (has('airport')) return 'airport';
  if (has('train_station', 'subway_station', 'light_rail_station', 'bus_station', 'transit_station')) return 'station';
  if (has('university', 'school')) return 'campus';
  if (has('shopping_mall')) return 'shopping centre';
  return undefined;
}

/** True when Google itself supplied a usable venue name for this result (not a plus code). */
export function hasVenueName(result: DescribableResult): boolean {
  return (result.address_components ?? []).some((c) => NAME_TYPES.some((t) => c.types?.includes(t)) && c.long_name && !PLUS_CODE.test(c.long_name.trim()));
}

export function describePlace(result: DescribableResult): string | undefined {
  const components = result.address_components ?? [];
  const types = result.types ?? [];
  if (!components.length) return result.formatted_address;

  const named = components.find((c) => NAME_TYPES.some((t) => c.types?.includes(t)) && c.long_name && !PLUS_CODE.test(c.long_name.trim()));
  const name = named?.long_name;
  const kind = kindOf(types) ?? kindOf(named?.types ?? []);
  const street = [find(components, 'street_number'), find(components, 'route')].filter(Boolean).join(' ');
  const postcode = find(components, 'postal_code');

  const areaParts: string[] = [];
  for (const type of ['sublocality', 'neighborhood', 'locality', 'postal_town', 'administrative_area_level_2', 'administrative_area_level_1', 'country']) {
    const value = find(components, type);
    if (value && !areaParts.includes(value) && value !== name) areaParts.push(value);
  }

  if (name) return [kind && !name.toLowerCase().includes(kind.toLowerCase()) ? `${name} (${kind})` : name, ...areaParts].join(', ');

  if (street) {
    const lead = kind ? `${kind[0].toUpperCase()}${kind.slice(1)} at ${street}` : street;
    return [lead, postcode ? `${find(components, 'locality') ?? find(components, 'postal_town') ?? ''} ${postcode}`.trim() : undefined, find(components, 'country')].filter(Boolean).join(', ');
  }
  return areaParts.length ? areaParts.join(', ') : result.formatted_address;
}
