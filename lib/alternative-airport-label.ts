/**
 * Display label for an "Other UK airports" row on a route page.
 *
 * The row heading is `{origin} → {destination city}`. The city alone is
 * ambiguous when two airports share it (London Heathrow and London Gatwick),
 * either because two alternative rows have the same city or because the row's
 * city matches this page's own departure city. In those cases the airport's
 * own name is shown instead, so the rows read "London Heathrow → Doha" and
 * "London Gatwick → Doha". Everywhere else the heading is unchanged.
 */

interface LabelledAirport {
  slug: string;
  name: string;
  city: string;
}

export function isAlternativeAirportCityAmbiguous(
  alternative: LabelledAirport,
  pageAirport: LabelledAirport,
  allAlternatives: readonly LabelledAirport[],
): boolean {
  if (alternative.city === pageAirport.city) return true;
  return allAlternatives.some((other) => other.slug !== alternative.slug && other.city === alternative.city);
}

export function getAlternativeAirportOriginLabel(
  alternative: LabelledAirport,
  pageAirport: LabelledAirport,
  allAlternatives: readonly LabelledAirport[],
): string {
  return isAlternativeAirportCityAmbiguous(alternative, pageAirport, allAlternatives)
    ? alternative.name
    : alternative.city;
}
