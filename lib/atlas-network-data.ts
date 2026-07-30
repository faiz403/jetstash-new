import { getRouteBySlug, getRouteStatus as deriveRouteStatus } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getRouteStatusCopy, formatRouteStatusDate } from '@/lib/route-status-copy';
import { getDestinationBySlug } from '@/data/destinations';
import { getAirportBySlug } from '@/data/airports';
import { getNetworkEvidence } from '@/data/network-evidence';
import type { AirportNetworkData, CountryData, DestinationPoint } from '@/components/founder/atlas-feel-test';

const nowIso = new Date().toISOString().slice(0, 10);

function buildDestinationPoint(airportSlug: string, destSlug: string, x: number, y: number): DestinationPoint | null {
  const dest = getDestinationBySlug(destSlug);
  const route = getRouteBySlug(`${airportSlug}-${destSlug}`);
  if (!dest || !route) return null;

  const status = deriveRouteStatus(route, routeStatusEvents, nowIso);
  let evidenceState: DestinationPoint['evidenceState'] = 'pending';
  // Branches on route.isDirect, not just verification status â€” a route can
  // be genuinely VERIFIED as connecting (birmingham-mumbai: Birmingham
  // Airport's own page confirms no direct service exists at all), and the
  // earlier version of this function claimed "Direct service verified" for
  // exactly that case regardless of isDirect. Latent since Manchester never
  // happened to have a verified+non-direct route; surfaced the moment
  // Birmingham did. Fixed generically, not special-cased to Birmingham.
  let verdict = route.isDirect
    ? 'Direct service not yet independently verified â€” check directly with the airline before booking.'
    : 'Modelled as a connecting route â€” check directly with the airline for current routing before booking.';
  let detail: string | null = route.verification?.note ?? null;

  if (status?.status === 'withdrawal-announced') {
    const viewModel = getRouteStatusCopy(route, status, routeStatusEvents, nowIso);
    evidenceState = 'withdrawal-announced';
    if (viewModel.kind === 'withdrawal-announced') {
      verdict = `${viewModel.citations[0]?.publisher ?? 'The airline'} has announced a change, effective ${formatRouteStatusDate(viewModel.effectiveFrom)}.`;
      detail = viewModel.explanation;
    }
  } else if (route.verification?.status === 'verified') {
    evidenceState = 'verified';
    verdict = route.isDirect ? 'Direct service verified.' : 'Connecting route verified â€” no direct service currently exists.';
    detail = `Checked ${formatRouteStatusDate(route.verification.verifiedDate)}.`;
  }

  return {
    slug: destSlug,
    label: dest.city,
    x,
    y,
    // The route's own presence in the Route Status ledger IS the network
    // evidence here â€” a routes.ts entry is itself an individually
    // researched route guide, never a fabricated placeholder. None of the
    // routes.ts entries used by this Atlas so far are seasonal; if a future
    // one is, this will need to read that from the route record rather than
    // assuming 'supported'.
    networkMembership: 'supported',
    evidenceState,
    verdict,
    detail,
    flightTime: route.flightTime,
    href: `/destinations/${destSlug}`,
    routeHref: `/routes/${route.slug}`,
  };
}
// For real JetStash destinations that have no entry at all in the Route
// Status ledger (data/routes.ts) yet â€” no verification, no confidence,
// nothing getRouteBySlug can return. This does NOT mean the destination is
// unreachable from the selected airport: that separate question â€” "is it
// genuinely in the network?" â€” is answered by data/network-evidence.ts, a
// real, independently-audited network-evidence layer keyed by airport slug
// (see that file's header for full source discipline). A destination only
// reaches this function, and only appears in the Atlas at all, if that
// audit found 'supported' or 'seasonal' network evidence for this specific
// airport; if it found none, the destination is left out of that airport's
// network entirely rather than shown with a guessed status.
//
// evidenceState stays 'not-yet-tracked' regardless â€” that's the honest,
// separate statement that JetStash hasn't done its OWN route-intelligence
// research yet (fare history, verification, confidence), never conflated
// with the network-membership question this function already resolved.
function buildUntrackedDestinationPoint(airportSlug: string, destSlug: string, x: number, y: number): DestinationPoint | null {
  const dest = getDestinationBySlug(destSlug);
  const airport = getAirportBySlug(airportSlug);
  const evidence = getNetworkEvidence(destSlug, airportSlug);
  if (!dest || !airport || !evidence || evidence.membership === 'not-supported') return null;
  // dest.flightTimeFromUK is a general destinations.ts field that names
  // WHICHEVER UK airport that copy happened to be written about â€” for
  // Marrakech and Agadir it's London Gatwick, for Faro it's Bristol, not
  // necessarily this airport. Piping it straight through would leak a
  // different airport's flight time onto this route â€” exactly the
  // wrong-airport duration bug this project has already fixed once this
  // session. Only use it here when it actually names this airport's city.
  // Even where it does, the string still asserts "direct" â€” a claim the
  // network-evidence audit explicitly could not confirm for any airport
  // audited so far (direct-vs-connecting was unresolved on every primary
  // source reached). Strip that word rather than repeat an unconfirmed
  // claim; the duration and airport are still real.
  const flightTime = dest.flightTimeFromUK.includes(airport.city)
    ? dest.flightTimeFromUK.replace(` direct from ${airport.city}`, ` from ${airport.city}`)
    : `Flight time from ${airport.city} not yet confirmed.`;
  return {
    slug: destSlug,
    label: dest.city,
    x,
    y,
    networkMembership: evidence.membership,
    networkNote: `${evidence.evidenceSource} (verified ${formatRouteStatusDate(evidence.dateVerified)}).`,
    evidenceState: 'not-yet-tracked',
    verdict: 'Route intelligence not yet researched.',
    detail: null,
    flightTime,
    href: `/destinations/${destSlug}`,
    routeHref: null,
  };
}

// Country-level confidence is an honest aggregate of its own destinations'
// states â€” never a fabricated single score, just "what's the strongest
// signal present" so a visitor isn't clicking blind, per the agreed
// principle that confidence must never disappear until the city level.
function aggregateCountryConfidence(points: DestinationPoint[]): CountryData['confidence'] {
  if (points.some((p) => p.evidenceState === 'verified')) return 'strong';
  if (points.some((p) => p.evidenceState === 'withdrawal-announced')) return 'mixed';
  if (points.every((p) => p.evidenceState === 'pending')) return 'early';
  return 'early';
}

/**
 * Destination points below are NOT independently re-derived from a global
 * projection formula â€” that approach is exactly what produced unverifiable
 * hand-placed positions before. Instead, each point is computed as a real
 * lon/lat fraction WITHIN its own country's actual fetched bounding box
 * (see lib/atlas-country-geometry.ts for the source), so even if the
 * fraction estimate is imperfect, the point is mathematically guaranteed
 * to land inside or very near the real country shape it belongs to â€” the
 * failure mode of "marker floating outside its own country" is structurally
 * ruled out, which a from-scratch global formula could not guarantee.
 *
 * For the countries added when this feel test was extended to all current
 * JetStash destinations, that guarantee was made mechanical rather than
 * eyeballed: a Node script parsed each country's real path into its
 * constituent subpaths (so an offshore territory â€” Balearic Islands,
 * Sicily, Sardinia, the Azores â€” can't skew a mainland-only fraction
 * calculation), took the largest subpath as the country's mainland, and
 * ran a point-in-polygon check on every computed destination position
 * against that real mainland shape. Every point either landed inside it
 * outright, or â€” for a handful of coastal cities â€” within ~2px of its
 * edge, in which case the script snapped it to the nearest point ON the
 * real polygon rather than trusting the estimate. Nothing here was placed
 * by eye.
 *
 * Country bounding boxes / mainland subpaths (computed directly from the
 * fetched real paths): gb x 455.1-481.2 y 262.9-303.9; ie x 445.7-458.0 y
 * 276.4-294.7; in x 679.1-748.1 y 368.7-444.1; ae x 621.1-633.1 y
 * 388.9-396.4; pk x 682.0-693.2 y 351.7-361.6; tr mainland x 548.1-600.7 y
 * 333.3-355.7; ma x 437.9-471.9 y 355.4-382.6; es mainland x 449.0-484.2 y
 * 328.2-355.0; pt mainland x 448.3-457.5 y 333.0-351.6; gr mainland x
 * 538.0-549.6 y 334.6-353.6; it mainland x 493.5-526.8 y 313.6-348.4; qa x
 * 617.3-619.7 y 387.3-392.2; sa x 572.0-631.0 y 368.2-416.6.
 *
 * Real-world lon/lat used for the fraction calculation (standard,
 * publicly known city/country coordinates â€” Manchester, Mumbai, Delhi,
 * Amritsar, Ahmedabad and Dubai were previously verified against the
 * production route-map-hero formula earlier in this session; the rest
 * follow the same method): Lahore 74.35,31.55; Islamabad 73.05,33.68;
 * Karachi 67.03,24.86; Istanbul 28.98,41.01; Antalya 30.71,36.90; Dalaman
 * 28.79,36.71; Bodrum 27.43,37.03; Izmir 27.14,38.42; Marrakech
 * -7.98,31.63; Agadir -9.60,30.42; Barcelona 2.17,41.39; Faro -7.93,37.02;
 * Athens 23.73,37.98; Rome 12.50,41.90; Doha 51.53,25.29; Jeddah
 * 39.19,21.54; Madinah 39.61,24.47.
 *
 * Casablanca and Tangier are real JetStash destinations but are not
 * included here: a dedicated network-evidence audit (2026-07-25, see
 * data/network-evidence.ts) found no Manchester claim for either one in
 * any source, official or otherwise â€” both are genuinely London-only â€”
 * so there is no honest way to place them on a Manchester-origin map.
 * Their country, Morocco, still appears here via Marrakech and Agadir,
 * both confirmed Manchester-served by that same audit.
 */

// This function is the ENTIRE Manchester-specific part of the Atlas engine
// â€” everything downstream (the shared AtlasFeelTest component, the airport
// selector, the interaction model) is generic. Adding a second airport
// means writing a sibling function like this one and adding it to the
// `airports` array below; it never means touching atlas-feel-test.tsx.
// Nothing about this function's SHAPE is Manchester-specific either â€” only
// the coordinates and route slugs inside it are, because those are this
// airport's own real, audited network.
function buildManchesterNetwork(): AirportNetworkData {
  // Manchester Airport: 53.365Â°N, 2.275Â°W. The vertical ordering here is
  // intentionally geographic: Scottish airports sit above Newcastle, Leeds
  // and Manchester, with the Midlands and London further south.
  const origin = { x: 471.2, y: 286.4 };

  const indiaPoints = [
    buildDestinationPoint('manchester', 'mumbai', 690, 414), // west coast, lower-middle
    buildDestinationPoint('manchester', 'delhi', 701, 388), // north, near top
    buildDestinationPoint('manchester', 'amritsar', 695, 380), // far north
    buildDestinationPoint('manchester', 'ahmedabad', 690, 403), // west, mid-latitude
  ].filter((p): p is DestinationPoint => p !== null);

  const uaePoints = [
    buildDestinationPoint('manchester', 'dubai', 630, 391), // NE Gulf coast, near Strait of Hormuz
  ].filter((p): p is DestinationPoint => p !== null);

  const pakistanPoints = [
    buildDestinationPoint('manchester', 'lahore', 690.58, 356.42),
    buildDestinationPoint('manchester', 'islamabad', 689.74, 355.52),
    buildDestinationPoint('manchester', 'karachi', 686.32, 360),
  ].filter((p): p is DestinationPoint => p !== null);

  const bangladeshPoints = [
    // Dhaka (23.8103N, 90.4125E) and Sylhet (24.8949N, 91.8687E): same
    // regression method as Bengaluru/the Heathrow Dhaka point above, cross-
    // checked against the real mainland centroid computed directly from
    // this project's own extracted Bangladesh SVG path data
    // (lib/atlas-country-geometry.ts, 728.17/394.60) - both land within a
    // few px of that independently-computed centroid, the same margin the
    // Bengaluru regression already validated against.
    buildDestinationPoint('manchester', 'dhaka', 732.3, 401.2),
    buildDestinationPoint('manchester', 'sylhet', 735.75, 398.25),
  ].filter((p): p is DestinationPoint => p !== null);

  const qatarPoints = [
    buildDestinationPoint('manchester', 'doha', 619.44, 389.82),
  ].filter((p): p is DestinationPoint => p !== null);

  const saudiPoints = [
    buildDestinationPoint('manchester', 'jeddah', 584.88, 400.03),
    buildDestinationPoint('manchester', 'madinah', 586.05, 391.24),
  ].filter((p): p is DestinationPoint => p !== null);

  // Turkey, Morocco (excl. Casablanca/Tangier), Spain, Portugal, Greece and
  // Italy have no Route Status ledger entry yet â€” but they DO have real
  // network evidence (data/network-evidence.ts, audited 2026-07-25 against
  // Manchester Airport's own destination pages) confirming Manchester
  // reachability, which is why they're included here at all. Route
  // intelligence and network membership are deliberately different
  // questions â€” see the DestinationPoint comment in atlas-feel-test.tsx.
  const turkeyPoints = [
    buildUntrackedDestinationPoint('manchester', 'istanbul', 557.16, 337.18),
    buildUntrackedDestinationPoint('manchester', 'antalya', 561.92, 351.8),
    buildUntrackedDestinationPoint('manchester', 'dalaman', 556.64, 352.48),
    buildUntrackedDestinationPoint('manchester', 'bodrum', 552.9, 351.34),
    buildUntrackedDestinationPoint('manchester', 'izmir', 552.1, 346.39),
  ].filter((p): p is DestinationPoint => p !== null);

  const moroccoPoints = [
    buildUntrackedDestinationPoint('manchester', 'marrakech', 452.46, 369.56),
    buildUntrackedDestinationPoint('manchester', 'agadir', 447.94, 373.58),
  ].filter((p): p is DestinationPoint => p !== null);

  const spainPoints = [
    buildUntrackedDestinationPoint('manchester', 'barcelona', 480.8, 336.16),
  ].filter((p): p is DestinationPoint => p !== null);

  const portugalPoints = [
    buildUntrackedDestinationPoint('manchester', 'faro', 452.66, 351.2),
  ].filter((p): p is DestinationPoint => p !== null);

  const greecePoints = [
    buildUntrackedDestinationPoint('manchester', 'athens', 542.34, 348.05),
  ].filter((p): p is DestinationPoint => p !== null);

  const italyPoints = [
    buildUntrackedDestinationPoint('manchester', 'rome', 510, 330.8),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    // Country marker position = the real computed centroid of that
    // country's own fetched path (see lib/atlas-country-geometry.ts) â€”
    // an actual geometric property of the real shape, not estimated.
    // India and UAE keep their already-approved whole-shape centroids
    // unchanged; every country added afterwards uses its MAINLAND
    // subpath's centroid specifically, so an offshore territory (the
    // Azores for Portugal, the Balearics for Spain, Sicily/Sardinia for
    // Italy) can't drag the marker away from where its destinations
    // actually are.
    { slug: 'india', label: 'India', x: 722, y: 400, confidence: aggregateCountryConfidence(indiaPoints), destinations: indiaPoints },
    { slug: 'uae', label: 'United Arab Emirates', x: 628, y: 394, confidence: aggregateCountryConfidence(uaePoints), destinations: uaePoints },
    { slug: 'pakistan', label: 'Pakistan', x: 687.71, y: 357.09, confidence: aggregateCountryConfidence(pakistanPoints), destinations: pakistanPoints },
    { slug: 'bangladesh', label: 'Bangladesh', x: 728.17, y: 394.6, confidence: aggregateCountryConfidence(bangladeshPoints), destinations: bangladeshPoints },
    { slug: 'qatar', label: 'Qatar', x: 618.56, y: 390.2, confidence: aggregateCountryConfidence(qatarPoints), destinations: qatarPoints },
    { slug: 'saudi-arabia', label: 'Saudi Arabia', x: 602.66, y: 395.32, confidence: aggregateCountryConfidence(saudiPoints), destinations: saudiPoints },
    { slug: 'turkey', label: 'Turkey', x: 575.31, y: 345.75, confidence: aggregateCountryConfidence(turkeyPoints), destinations: turkeyPoints },
    { slug: 'morocco', label: 'Morocco', x: 459.51, y: 369.31, confidence: aggregateCountryConfidence(moroccoPoints), destinations: moroccoPoints },
    { slug: 'spain', label: 'Spain', x: 464.61, y: 338.83, confidence: aggregateCountryConfidence(spainPoints), destinations: spainPoints },
    { slug: 'portugal', label: 'Portugal', x: 452.75, y: 341.03, confidence: aggregateCountryConfidence(portugalPoints), destinations: portugalPoints },
    { slug: 'greece', label: 'Greece', x: 541.77, y: 343.4, confidence: aggregateCountryConfidence(greecePoints), destinations: greecePoints },
    { slug: 'italy', label: 'Italy', x: 508.35, y: 326.2, confidence: aggregateCountryConfidence(italyPoints), destinations: italyPoints },
    // Every country above has at least one real destination â€” none is
    // shown just for geographic decoration (that's what CONTEXT_PATH_KEYS
    // in the component is for).
  ].filter((c) => c.destinations.length > 0);

  return {
    airportSlug: 'manchester',
    airportName: 'Manchester',
    origin,
    defaultCountrySlug: 'india',
    countries,
  };
}

/**
 * Birmingham â€” the first Airport Pack built after Manchester, deliberately
 * scoped to validate the multi-airport architecture rather than to
 * maximise destination count (per the 2026-07-26 network audit,
 * docs/atlas-airport-network-audit.md).
 *
 * Every destination below has a real data/routes.ts entry for
 * 'birmingham-<destSlug>' â€” Amritsar, Lahore, Islamabad, Madinah, Mumbai,
 * the only five Birmingham routes with adequate sourced network evidence
 * per that audit. No network-evidence.ts-only ("route intelligence not yet
 * researched") destinations are included here: those require the same kind
 * of primary-source audit already done for Manchester's secondary
 * destinations (opening Birmingham Airport's own destination pages and
 * reading them directly), which hasn't been done for Birmingham yet â€” so
 * none are added rather than guessed at. buildDestinationPoint requires no
 * changes to add these; it was already generalised to accept any airport
 * slug when the engine was refactored.
 *
 * Destination and country coordinates are real geography, not re-derived â€”
 * a city's position on this map does not depend on which airport you fly
 * from, so Amritsar, Lahore, Islamabad, Madinah and Mumbai reuse the exact
 * same real, point-in-polygon-verified positions already established for
 * Manchester's network. Only the origin (Birmingham Airport's own real
 * position) is new.
 */
function buildBirminghamNetwork(): AirportNetworkData {
  // Birmingham Airport (BHX): 52.4539Â°N, 1.7480Â°W â€” standard, publicly
  // known airport coordinates. Projected with the same method and the same
  // implied UK reference extent as Manchester's origin, verified against the
  // same real-coordinate projection used for every airport in this pack
  // before trusting the method for a second airport.
  const origin = { x: 474.0, y: 292.2 };

  const indiaPoints = [
    buildDestinationPoint('birmingham', 'mumbai', 690, 414),
    buildDestinationPoint('birmingham', 'amritsar', 695, 380),
  ].filter((p): p is DestinationPoint => p !== null);

  const pakistanPoints = [
    buildDestinationPoint('birmingham', 'lahore', 690.58, 356.42),
    buildDestinationPoint('birmingham', 'islamabad', 689.74, 355.52),
  ].filter((p): p is DestinationPoint => p !== null);

  const saudiPoints = [
    buildDestinationPoint('birmingham', 'madinah', 586.05, 391.24),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'india', label: 'India', x: 722, y: 400, confidence: aggregateCountryConfidence(indiaPoints), destinations: indiaPoints },
    { slug: 'pakistan', label: 'Pakistan', x: 687.71, y: 357.09, confidence: aggregateCountryConfidence(pakistanPoints), destinations: pakistanPoints },
    { slug: 'saudi-arabia', label: 'Saudi Arabia', x: 602.66, y: 395.32, confidence: aggregateCountryConfidence(saudiPoints), destinations: saudiPoints },
  ].filter((c) => c.destinations.length > 0);

  return {
    airportSlug: 'birmingham',
    airportName: 'Birmingham',
    origin,
    defaultCountrySlug: 'india',
    countries,
  };
}

/**
 * London Heathrow - 6 routes.ts entries (bengaluru, delhi, doha, jeddah,
 * mumbai, dhaka), the full set with adequate sourced network evidence per
 * the 2026-07-26 audit plus the 2026-07-30 Bengaluru and 2026-07-30
 * Bangladesh additions. london-heathrow-dhaka is Verification Pending
 * (Heathrow's own airline directory confirms Biman Bangladesh Airlines
 * operates from Terminal 4, but names no destination/frequency/date) -
 * included because real, if incomplete, network evidence exists, same
 * standard as every other point here. No Sylhet from Heathrow - zero
 * evidence of any kind was found for that specific pairing, so it is not
 * included at all, not even as pending. No
 * Lahore/Karachi/Dubai/Madinah/Casablanca - all real Heathrow
 * destinations, none with a routes.ts entry, so none included.
 */
function buildHeathrowNetwork(): AirportNetworkData {
  // London Heathrow (LHR): 51.4700Â°N, 0.4543Â°W.
  const origin = { x: 476.6, y: 298.0 };

  const indiaPoints = [
    // Bengaluru (12.9716N, 77.5946E): not fit by eye like the others -
    // computed via linear regression against this file's own existing India
    // points (Delhi/Mumbai/Ahmedabad/Amritsar), which are already accurate
    // to within ~0.5px of their real lat/long on both axes. x = 690 +
    // (lon - 72.57) x 2.371 (Ahmedabad anchor); y = 414 - 2.709 x (lat -
    // 19.08) (Mumbai anchor) - both slopes cross-checked against all 4
    // reference points before use. Bengaluru sits south of every other
    // plotted India destination (larger y), which matches its real
    // geography.
    buildDestinationPoint('london-heathrow', 'bengaluru', 701.9, 430.6),
    buildDestinationPoint('london-heathrow', 'delhi', 701, 388),
    buildDestinationPoint('london-heathrow', 'mumbai', 690, 414),
  ].filter((p): p is DestinationPoint => p !== null);

  const qatarPoints = [
    buildDestinationPoint('london-heathrow', 'doha', 619.44, 389.82),
  ].filter((p): p is DestinationPoint => p !== null);

  const saudiPoints = [
    buildDestinationPoint('london-heathrow', 'jeddah', 584.88, 400.03),
  ].filter((p): p is DestinationPoint => p !== null);

  const bangladeshPoints = [
    // Dhaka (23.8103N, 90.4125E): same regression method as Bengaluru
    // above, cross-checked against the real mainland centroid computed
    // directly from this project's own extracted Bangladesh SVG path data
    // (lib/atlas-country-geometry.ts, 728.17/394.60) - the two independent
    // methods land within ~7px of each other, which is the same margin the
    // Bengaluru regression already validated against.
    buildDestinationPoint('london-heathrow', 'dhaka', 732.3, 401.2),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'india', label: 'India', x: 722, y: 400, confidence: aggregateCountryConfidence(indiaPoints), destinations: indiaPoints },
    { slug: 'qatar', label: 'Qatar', x: 618.56, y: 390.2, confidence: aggregateCountryConfidence(qatarPoints), destinations: qatarPoints },
    { slug: 'saudi-arabia', label: 'Saudi Arabia', x: 602.66, y: 395.32, confidence: aggregateCountryConfidence(saudiPoints), destinations: saudiPoints },
    { slug: 'bangladesh', label: 'Bangladesh', x: 728.17, y: 394.6, confidence: aggregateCountryConfidence(bangladeshPoints), destinations: bangladeshPoints },
  ].filter((c) => c.destinations.length > 0);

  return { airportSlug: 'london-heathrow', airportName: 'London Heathrow', origin, defaultCountrySlug: 'india', countries };
}

/**
 * London Gatwick â€” 2 routes.ts entries (ahmedabad, amritsar), the full set
 * with adequate sourced network evidence. One country, two destinations â€”
 * acceptable per instruction; not padded with unsourced claims.
 */
function buildGatwickNetwork(): AirportNetworkData {
  // London Gatwick (LGW): 51.1537Â°N, 0.1821Â°W.
  const origin = { x: 477.4, y: 300.0 };

  const indiaPoints = [
    buildDestinationPoint('london-gatwick', 'ahmedabad', 690, 403),
    buildDestinationPoint('london-gatwick', 'amritsar', 695, 380),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'india', label: 'India', x: 722, y: 400, confidence: aggregateCountryConfidence(indiaPoints), destinations: indiaPoints },
  ].filter((c) => c.destinations.length > 0);

  return { airportSlug: 'london-gatwick', airportName: 'London Gatwick', origin, defaultCountrySlug: 'india', countries };
}

/**
 * Glasgow â€” exactly one routes.ts entry (dubai). A single-country,
 * single-destination network is the honest shape of Glasgow's currently
 * evidenced network; not expanded to look fuller.
 */
function buildGlasgowNetwork(): AirportNetworkData {
  // Glasgow Airport (GLA): 55.8642Â°N, 4.4331Â°W.
  const origin = { x: 464.4, y: 273.2 };

  const uaePoints = [
    buildDestinationPoint('glasgow', 'dubai', 630, 391),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'uae', label: 'United Arab Emirates', x: 628, y: 394, confidence: aggregateCountryConfidence(uaePoints), destinations: uaePoints },
  ].filter((c) => c.destinations.length > 0);

  return { airportSlug: 'glasgow', airportName: 'Glasgow', origin, defaultCountrySlug: 'uae', countries };
}

/** Edinburgh â€” exactly one routes.ts entry (dubai), same shape as Glasgow. */
function buildEdinburghNetwork(): AirportNetworkData {
  // Edinburgh Airport (EDI): 55.9500Â°N, 3.3725Â°W.
  const origin = { x: 468.0, y: 274.4 };

  const uaePoints = [
    buildDestinationPoint('edinburgh', 'dubai', 630, 391),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'uae', label: 'United Arab Emirates', x: 628, y: 394, confidence: aggregateCountryConfidence(uaePoints), destinations: uaePoints },
  ].filter((c) => c.destinations.length > 0);

  return { airportSlug: 'edinburgh', airportName: 'Edinburgh', origin, defaultCountrySlug: 'uae', countries };
}

/** Newcastle â€” exactly one routes.ts entry (dubai), same shape again. */
function buildNewcastleNetwork(): AirportNetworkData {
  // Newcastle International Airport (NCL): 55.0375Â°N, 1.6917Â°W.
  const origin = { x: 473.7, y: 280.0 };

  const uaePoints = [
    buildDestinationPoint('newcastle', 'dubai', 630, 391),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'uae', label: 'United Arab Emirates', x: 628, y: 394, confidence: aggregateCountryConfidence(uaePoints), destinations: uaePoints },
  ].filter((c) => c.destinations.length > 0);

  return { airportSlug: 'newcastle', airportName: 'Newcastle', origin, defaultCountrySlug: 'uae', countries };
}

/**
 * Leeds Bradford â€” 2 routes.ts entries (amritsar, islamabad), both
 * genuinely researched as `isDirect: false` â€” Leeds Bradford has no stable
 * direct service to either, per airports.ts's own standing caution about
 * unproven direct-service claims on this airport. The honest network here
 * is two connecting-only destinations across two countries; the panel's
 * verdict text reflects that automatically via the isDirect-aware fix in
 * buildDestinationPoint, no special-casing required.
 */
function buildLeedsBradfordNetwork(): AirportNetworkData {
  // Leeds Bradford Airport (LBA): 53.8659Â°N, 1.6606Â°W.
  const origin = { x: 473.1, y: 287.6 };

  const indiaPoints = [
    buildDestinationPoint('leeds-bradford', 'amritsar', 695, 380),
  ].filter((p): p is DestinationPoint => p !== null);

  const pakistanPoints = [
    buildDestinationPoint('leeds-bradford', 'islamabad', 689.74, 355.52),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'india', label: 'India', x: 722, y: 400, confidence: aggregateCountryConfidence(indiaPoints), destinations: indiaPoints },
    { slug: 'pakistan', label: 'Pakistan', x: 687.71, y: 357.09, confidence: aggregateCountryConfidence(pakistanPoints), destinations: pakistanPoints },
  ].filter((c) => c.destinations.length > 0);

  return { airportSlug: 'leeds-bradford', airportName: 'Leeds Bradford', origin, defaultCountrySlug: 'india', countries };
}

// Adding another airport: write a sibling `build<Airport>Network()`
// function above (same shape as buildManchesterNetwork/
// buildBirminghamNetwork â€” a real, audited network-evidence.ts entry per
// destination, real routes.ts entries where they exist, real geometry from
// lib/atlas-country-geometry.ts) and push its result into this array.
// Nothing else changes.
//
// Bristol, Liverpool and East Midlands are deliberately absent: none has a
// single routes.ts entry for any destination (confirmed in the 2026-07-26
// audit) â€” Bristol was named alongside this batch, but the same "only
// build from destinations that already have approved Route Status
// records" rule that excludes Liverpool/East Midlands applies to it too.
// An Airport Pack with zero destinations isn't a smaller honest network,
// it's nothing to render â€” flagged back rather than built empty.
export function buildAtlasAirports(): AirportNetworkData[] {
  return [
    buildManchesterNetwork(),
    buildBirminghamNetwork(),
    buildHeathrowNetwork(),
    buildGatwickNetwork(),
    buildGlasgowNetwork(),
    buildEdinburghNetwork(),
    buildNewcastleNetwork(),
    buildLeedsBradfordNetwork(),
  ];
}
