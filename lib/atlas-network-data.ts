import { getRouteBySlug, getRouteStatus as deriveRouteStatus, getDisplayDirectness } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getRouteStatusCopy, formatRouteStatusDate } from '@/lib/route-status-copy';
import { getDestinationBySlug } from '@/data/destinations';
import { getAirportBySlug } from '@/data/airports';
import { getNetworkEvidence } from '@/data/network-evidence';
import { getPublishableObservationsByRoute } from '@/data/fare-observations';
import { getActiveWarningsByRoute } from '@/data/route-warnings';
import { isBookByRoute } from '@/lib/booking-intelligence';
import { travellerTips } from '@/data/traveller-tips';
import { deals, hasTrackedFare } from '@/data/deals';
import type { AirportNetworkData, CountryData, DestinationPoint, RouteIntelligenceLevel, CountryIntelligenceLevel } from '@/components/founder/atlas-feel-test';

// Read once at module load, not per call — a long-lived server process must
// keep this fixed for its lifetime rather than rolling over at midnight
// mid-process. buildAtlasAirports() below exposes this as an overridable
// default parameter purely as a test-determinism seam; production callers
// must never pass an explicit value, so this exact module-load semantics is
// preserved unchanged. See the route verification test determinism batch,
// 29 Aug 2026.
const defaultNowIso = new Date().toISOString().slice(0, 10);

/**
 * Route Coverage Truth (August 2026) — the honest, three-level answer to
 * "how much has JetStash actually researched this route", replacing the
 * old evidenceState/confidence system that let a single verified
 * destination make an entire country look "strong" (aggregateCountryIntelligence
 * below fixes the aggregation half of that; this fixes the per-route half).
 *
 * Deliberately NOT the same thing as the `factsConfidence` field
 * data/routes.ts documents removing (see that file's comment, ~line 974):
 * that field collapsed a route's WHOLE FACT BUNDLE into one "verified"
 * label, which was false the moment frequency or a specific airline wasn't
 * independently confirmed. This never claims that. It answers a narrower,
 * honestly-answerable question — does real, BROAD depth of guidance exist
 * beyond the baseline route page — using only fields that already exist and
 * are already independently gated.
 *
 * Corrected (August 2026, product-truth review of the first version of this
 * function): the original threshold required only ONE depth signal, which
 * let a route reach "JetStash knows this route well" on the strength of a
 * single connecting-alternative paragraph or a single reduced-frequency
 * warning, with nothing else behind it. Tested against the real 32-route
 * dataset, that let 7 of 16 "Strong" routes qualify on exactly one signal
 * (Manchester-Amritsar/Ahmedabad on connectingAlternative alone; Leeds
 * Bradford-Islamabad and both Gatwick routes on a warning alone;
 * Heathrow-Bengaluru on airline verification alone) — thinner than the
 * customer-facing wording defensibly implies. The fix requires BREADTH: at
 * least two of the six categories below, not any single one. A prior
 * candidate category ("has an independently checkable source URL") was
 * tested against the real data and dropped — every route-level `verified`
 * record in this dataset already carries a sourceUrl (14/14), so it never
 * actually differentiated anything; it would have inflated every verified
 * route's score by exactly one point without adding real signal. Airport
 * -specific transfer guidance was considered too, but 0 of 41 routes
 * currently have any (data/traveller-tips.ts has no airport-scoped entry
 * yet) — including it as a required or scored category today would be
 * un-clearable by definition, not a meaningful bar; it's tracked in the
 * audit doc instead and should be added here once at least one route earns
 * one. Trip.com hand-off is deliberately excluded from scoring too — it's
 * commercial/affiliate completeness (which UK airports Trip.com covers),
 * not evidence JetStash has researched the route, and several of the
 * thinnest routes in the dataset (Manchester-Amritsar/Ahmedabad) have a
 * Trip.com link purely because Manchester has broad affiliate coverage.
 *
 * Bug fix folded in here (unchanged from the first version): the old
 * evidenceState only ever checked route.verification (route-level), never
 * route.airlineVerifications (per-airline). That's a known, previously
 * -documented gap (see the git history around
 * tests/heathrow-bengaluru-route.test.ts) that quietly under-stated
 * Heathrow-Delhi, Heathrow-Mumbai and Heathrow-Bengaluru as "pending"
 * despite each having a current, primary-sourced airline verification.
 * getDisplayDirectness() already correctly checks both, so routing through
 * it here fixes that leak generically rather than special-casing three
 * routes.
 */
export function computeRouteIntelligenceLevel(route: NonNullable<ReturnType<typeof getRouteBySlug>>, nowIsoDate: string): RouteIntelligenceLevel {
  const directness = getDisplayDirectness(route, nowIsoDate);
  if (directness === 'unverified') return 'useful';

  // Six independently-gated depth categories. Each answers a genuinely
  // different question about how much JetStash has actually researched
  // this specific route — none is inferred from another, and none can be
  // satisfied by rewording prose.
  const hasAirlineDepth = Boolean(route.airlineVerifications && route.airlineVerifications.length > 0); // per-carrier breakdown, not just one route-level claim
  const hasConnectingDepth = Boolean(route.connectingAlternative); // real hub/stops/journey-time detail
  const hasFareDepth = getPublishableObservationsByRoute(route.slug, nowIsoDate).length > 0; // dated, publishable fare evidence
  const hasBookByDepth = isBookByRoute(route.slug); // dated, festival-anchored booking-timing guidance, not just generic prose
  // A specific, sourced, investigated warning (e.g. Leeds Bradford's
  // repeatedly-failed direct-service claims) is itself real research, not
  // an absence of it — never the vague "0 warnings means nothing to say"
  // reading.
  const hasWarningDepth = getActiveWarningsByRoute(route.slug).length > 0;
  const hasBaggageDepth = travellerTips.some(
    (t) => t.category === 'baggage' && (t.scope.routeSlug === route.slug || t.scope.destinationSlug === route.destinationSlug)
  );

  const depthCategoryCount = [hasAirlineDepth, hasConnectingDepth, hasFareDepth, hasBookByDepth, hasWarningDepth, hasBaggageDepth].filter(Boolean).length;

  // Route Intelligence Scoring v2 (RIS-001, August 2026): breadth of
  // CATEGORY COUNT alone was found — by Fare Coverage Expansion Batch A's
  // own audit — to let a route reach "JetStash knows this route well" on
  // exactly the two cheapest-to-obtain categories (connectingAlternative +
  // a single fare check), with the fare sometimes not even rendered
  // anywhere a visitor could see it. v1's 2-of-6 threshold is unchanged
  // below (Gate 1), but two further, independent gates were added rather
  // than loosening or replacing it — see ROUTE_COVERAGE_AUDIT.md's RIS-001
  // audit for the full reasoning and the real 32-route recomputation this
  // was validated against before being written here.
  //
  // GATE 1 (unchanged from v1): breadth — at least two of the six
  // categories above.
  if (depthCategoryCount < 2) return 'useful';

  // GATE 2 (new): category DIVERSITY, not just count. connectingAlternative
  // and fare are both genuinely useful, but both are comparatively cheap to
  // obtain — connectingAlternative is a single editorial paragraph, and a
  // fare check is one manual search. airlineVerifications, Book-By
  // priority, an investigated warning and baggage guidance each require
  // real, independently-gated research work. A route whose only two
  // categories are connectingAlternative + fare has NOT been looked at from
  // more than one genuinely deep angle — it has been looked at from one
  // deep-ish angle (fare) and one cheap one. Requiring at least one
  // "substantive" category (independent of how many total categories exist)
  // directly rules out that specific combination without requiring any
  // category that may not apply to every route.
  const hasSubstantiveDepth = hasAirlineDepth || hasBookByDepth || hasWarningDepth || hasBaggageDepth;
  if (!hasSubstantiveDepth) return 'useful';

  // GATE 3 (new): visible-content baseline — the depth categories above
  // describe what JetStash has researched; this gate asks whether a real
  // visitor can actually SEE the result on the rendered page, independent
  // of category count. Two checks, both grounded in what the route page
  // template (app/routes/[slug]/page.tsx) actually conditionally renders —
  // never a fabricated or invented UI signal:
  //
  // 1. Fare intelligence must be visibly rendered, not merely archived —
  //    a real DealCard showing a price a visitor can see, not a fare
  //    observation sitting in the archive behind NoFareFallback's "we
  //    haven't logged a tracked fare... yet". This directly generalises
  //    the exact defect Batch A's audit found and fixed for 7 routes (see
  //    FARE_OBSERVATION_ARCHIVE.md) into a permanent rule, so a future
  //    route can never repeat it and still register as Strong.
  const matchingDeals = deals.filter((d) => d.fromAirportSlug === route.airportSlug && d.toDestinationSlug === route.destinationSlug);
  const hasVisibleFare = matchingDeals.some((d) => hasTrackedFare(d, nowIsoDate));
  if (!hasVisibleFare) return 'useful';

  // 2. For a CONNECTING route specifically, the page's "How this connecting
  //    route usually works" section (hub airports, typical stops, typical
  //    journey time) is the one thing that actually explains the route to
  //    a visitor who has no direct option — without it, a connecting
  //    route's page has essentially nothing beyond the mandatory intro and
  //    a price. Deliberately NOT required for a DIRECT route (a direct
  //    route's own verified status already is the core fact a visitor
  //    needs; the equivalent "1-stop alternative" block there is a genuine
  //    bonus, never a requirement — matching the standing "a direct route
  //    may not need transfer guidance" principle).
  if (!route.isDirect && !hasConnectingDepth) return 'useful';

  return 'strong';
}

function buildDestinationPoint(airportSlug: string, destSlug: string, x: number, y: number, nowIso: string): DestinationPoint | null {
  const dest = getDestinationBySlug(destSlug);
  const route = getRouteBySlug(`${airportSlug}-${destSlug}`);
  if (!dest || !route) return null;

  const status = deriveRouteStatus(route, routeStatusEvents, nowIso);
  const intelligenceLevel = computeRouteIntelligenceLevel(route, nowIso);
  // Branches on route.isDirect, not just verification status — a route can
  // be genuinely VERIFIED as connecting (birmingham-mumbai: Birmingham
  // Airport's own page confirms no direct service exists at all), and the
  // earlier version of this function claimed "Direct service verified" for
  // exactly that case regardless of isDirect. Latent since Manchester never
  // happened to have a verified+non-direct route; surfaced the moment
  // Birmingham did. Fixed generically, not special-cased to Birmingham.
  let verdict = route.isDirect
    ? 'Direct service not yet independently verified — check directly with the airline before booking.'
    : 'Modelled as a connecting route — check directly with the airline for current routing before booking.';
  let detail: string | null = route.verification?.note ?? null;

  if (route.verification?.status === 'verified' || getDisplayDirectness(route, nowIso) === 'direct') {
    verdict = route.isDirect ? 'Direct service verified.' : 'Connecting route verified — no direct service currently exists.';
    if (route.verification) {
      detail = `Checked ${formatRouteStatusDate(route.verification.verifiedDate)}.`;
    } else {
      // No route-level verification record — the 'direct' verdict above
      // came from a current per-airline verification instead (see
      // getDisplayDirectness/computeRouteIntelligenceLevel). Cite that
      // evidence directly rather than leaving detail blank.
      const currentAirline = (route.airlineVerifications ?? []).find((v) => v.verifiedDate);
      detail = currentAirline ? `${currentAirline.sourceName}, checked ${formatRouteStatusDate(currentAirline.verifiedDate)}.` : detail;
    }
  }

  // An active service-change/withdrawal notice is a SEPARATE, additive
  // signal from intelligenceLevel above — a well-researched route (Route
  // Status ledger entry, dated citations, an explained effective date)
  // doesn't become less well-researched because the service itself is
  // changing; it becomes a route worth a closer look right now, which is a
  // different fact and stays visible on its own rather than silently
  // demoting the route's evidence tier (see JETSTASH_PRINCIPLES.md's Atlas
  // section for the full reasoning).
  let serviceNotice: DestinationPoint['serviceNotice'] = null;
  if (status?.status === 'withdrawal-announced') {
    const viewModel = getRouteStatusCopy(route, status, routeStatusEvents, nowIso);
    if (viewModel.kind === 'withdrawal-announced') {
      serviceNotice = {
        label: `${viewModel.citations[0]?.publisher ?? 'The airline'} has announced a change, effective ${formatRouteStatusDate(viewModel.effectiveFrom)}.`,
        detail: viewModel.explanation,
      };
    }
  }

  return {
    slug: destSlug,
    label: dest.city,
    x,
    y,
    // The route's own presence in the Route Status ledger IS the network
    // evidence here — a routes.ts entry is itself an individually
    // researched route guide, never a fabricated placeholder. None of the
    // routes.ts entries used by this Atlas so far are seasonal; if a future
    // one is, this will need to read that from the route record rather than
    // assuming 'supported'.
    networkMembership: 'supported',
    intelligenceLevel,
    serviceNotice,
    verdict,
    detail,
    flightTime: route.flightTime,
    href: `/destinations/${destSlug}`,
    routeHref: `/routes/${route.slug}`,
  };
}
// For real JetStash destinations that have no entry at all in the Route
// Status ledger (data/routes.ts) yet — no verification, no confidence,
// nothing getRouteBySlug can return. This does NOT mean the destination is
// unreachable from the selected airport: that separate question — "is it
// genuinely in the network?" — is answered by data/network-evidence.ts, a
// real, independently-audited network-evidence layer keyed by airport slug
// (see that file's header for full source discipline). A destination only
// reaches this function, and only appears in the Atlas at all, if that
// audit found 'supported' or 'seasonal' network evidence for this specific
// airport; if it found none, the destination is left out of that airport's
// network entirely rather than shown with a guessed status.
//
// intelligenceLevel stays 'expanding' regardless — that's the honest,
// separate statement that JetStash hasn't done its OWN route-intelligence
// research yet (fare history, verification, guidance depth), never
// conflated with the network-membership question this function already
// resolved. This is also, structurally, why no Atlas route can ever be
// blank: a destination either has a real routes.ts entry (computed above
// via computeRouteIntelligenceLevel) or it lands here and gets exactly this
// one honest, always-present label — there is no third code path that
// renders nothing.
function buildUntrackedDestinationPoint(airportSlug: string, destSlug: string, x: number, y: number): DestinationPoint | null {
  const dest = getDestinationBySlug(destSlug);
  const airport = getAirportBySlug(airportSlug);
  const evidence = getNetworkEvidence(destSlug, airportSlug);
  if (!dest || !airport || !evidence || evidence.membership === 'not-supported') return null;
  // dest.flightTimeFromUK is a general destinations.ts field that names
  // WHICHEVER UK airport that copy happened to be written about — for
  // Marrakech and Agadir it's London Gatwick, for Faro it's Bristol, not
  // necessarily this airport. Piping it straight through would leak a
  // different airport's flight time onto this route — exactly the
  // wrong-airport duration bug this project has already fixed once this
  // session. Only use it here when it actually names this airport's city.
  // Even where it does, the string still asserts "direct" — a claim the
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
    intelligenceLevel: 'expanding',
    serviceNotice: null,
    verdict: 'Route intelligence not yet researched.',
    detail: null,
    flightTime,
    href: `/destinations/${destSlug}`,
    routeHref: null,
  };
}

// Route Coverage Truth (August 2026): conservative aggregation, replacing
// the old .some(verified) rule that let a single strong destination make an
// entire country read "strong" even when its siblings were pending or
// untracked. A country's badge must never claim more than its WEAKEST
// meaningfully-represented destination supports:
//   - every destination at 'strong'            -> 'strong'   (the country really is well known)
//   - a mix of 'strong' and anything weaker     -> 'mixed'    (some routes need a closer look)
//   - no 'strong' destination, but some 'useful' -> 'useful'   (real guidance exists, not yet strongest)
//   - every destination is 'expanding'          -> 'expanding' (early-stage across the board)
export function aggregateCountryIntelligence(points: DestinationPoint[]): CountryIntelligenceLevel {
  const allStrong = points.every((p) => p.intelligenceLevel === 'strong');
  if (allStrong) return 'strong';
  const anyStrong = points.some((p) => p.intelligenceLevel === 'strong');
  if (anyStrong) return 'mixed';
  const anyUseful = points.some((p) => p.intelligenceLevel === 'useful');
  return anyUseful ? 'useful' : 'expanding';
}

/**
 * Destination points below are NOT independently re-derived from a global
 * projection formula — that approach is exactly what produced unverifiable
 * hand-placed positions before. Instead, each point is computed as a real
 * lon/lat fraction WITHIN its own country's actual fetched bounding box
 * (see lib/atlas-country-geometry.ts for the source), so even if the
 * fraction estimate is imperfect, the point is mathematically guaranteed
 * to land inside or very near the real country shape it belongs to — the
 * failure mode of "marker floating outside its own country" is structurally
 * ruled out, which a from-scratch global formula could not guarantee.
 *
 * For the countries added when this feel test was extended to all current
 * JetStash destinations, that guarantee was made mechanical rather than
 * eyeballed: a Node script parsed each country's real path into its
 * constituent subpaths (so an offshore territory — Balearic Islands,
 * Sicily, Sardinia, the Azores — can't skew a mainland-only fraction
 * calculation), took the largest subpath as the country's mainland, and
 * ran a point-in-polygon check on every computed destination position
 * against that real mainland shape. Every point either landed inside it
 * outright, or — for a handful of coastal cities — within ~2px of its
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
 * publicly known city/country coordinates — Manchester, Mumbai, Delhi,
 * Amritsar, Ahmedabad and Dubai were previously verified against the
 * production route-map-hero formula earlier in this session; the rest
 * follow the same method): Lahore 74.35,31.55; Islamabad 73.05,33.68;
 * Karachi 67.03,24.86; Istanbul 28.98,41.01; Antalya 30.71,36.90; Dalaman
 * 28.79,36.71; Bodrum 27.43,37.03; Izmir 27.14,38.42; Marrakech
 * -7.98,31.63; Agadir -9.60,30.42; Barcelona 2.17,41.39; Faro -7.93,37.02;
 * Athens 23.73,37.98; Rome 12.50,41.90; Doha 51.53,25.29; Jeddah
 * 39.19,21.54; Madinah 39.61,24.47.
 *
 * Casablanca and Tangier are real JetStash destinations, each reachable
 * only from a London airport (Heathrow and Gatwick respectively per
 * data/routes.ts — neither has a Manchester route, matching the original
 * 2026-07-25 network-evidence audit finding that found no Manchester claim
 * for either), so neither appears in Manchester's own network below. Their
 * points are computed the same regression way as every other destination
 * here, anchored on this file's own already-verified Marrakech/Agadir pair
 * (slope: 2.7901 x-units per degree longitude, -3.3223 y-units per degree
 * latitude — both cross-checked against the Marrakech-Agadir line before
 * use): Tangier 35.7595,-5.834 → x458.45,y355.84 (used on Gatwick's
 * network, its only served airport); Casablanca 33.5731,-7.5898 →
 * x453.55,y363.10 (used on Heathrow's network, its only served airport).
 * Both land inside this file's own documented Morocco mainland bounding
 * box (x 437.9-471.9, y 355.4-382.6) — Tangier sits at the box's northern
 * edge, consistent with its real position on the Strait of Gibraltar.
 */

// This function is the ENTIRE Manchester-specific part of the Atlas engine
// — everything downstream (the shared AtlasFeelTest component, the airport
// selector, the interaction model) is generic. Adding a second airport
// means writing a sibling function like this one and adding it to the
// `airports` array below; it never means touching atlas-feel-test.tsx.
// Nothing about this function's SHAPE is Manchester-specific either — only
// the coordinates and route slugs inside it are, because those are this
// airport's own real, audited network.
function buildManchesterNetwork(nowIso: string): AirportNetworkData {
  // Manchester Airport: 53.365Â°N, 2.275Â°W. The vertical ordering here is
  // intentionally geographic: Scottish airports sit above Newcastle, Leeds
  // and Manchester, with the Midlands and London further south.
  const origin = { x: 471.2, y: 286.4 };

  const indiaPoints = [
    buildDestinationPoint('manchester', 'mumbai', 690, 414, nowIso), // west coast, lower-middle
    buildDestinationPoint('manchester', 'delhi', 701, 388, nowIso), // north, near top
    buildDestinationPoint('manchester', 'amritsar', 695, 380, nowIso), // far north
    buildDestinationPoint('manchester', 'ahmedabad', 690, 403, nowIso), // west, mid-latitude
  ].filter((p): p is DestinationPoint => p !== null);

  const uaePoints = [
    buildDestinationPoint('manchester', 'dubai', 630, 391, nowIso), // NE Gulf coast, near Strait of Hormuz
  ].filter((p): p is DestinationPoint => p !== null);

  const pakistanPoints = [
    buildDestinationPoint('manchester', 'lahore', 690.58, 356.42, nowIso),
    buildDestinationPoint('manchester', 'islamabad', 689.74, 355.52, nowIso),
    buildDestinationPoint('manchester', 'karachi', 686.32, 360, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const bangladeshPoints = [
    // Dhaka (23.8103N, 90.4125E) and Sylhet (24.8949N, 91.8687E): same
    // regression method as Bengaluru/the Heathrow Dhaka point above, cross-
    // checked against the real mainland centroid computed directly from
    // this project's own extracted Bangladesh SVG path data
    // (lib/atlas-country-geometry.ts, 728.17/394.60) - both land within a
    // few px of that independently-computed centroid, the same margin the
    // Bengaluru regression already validated against.
    buildDestinationPoint('manchester', 'dhaka', 732.3, 401.2, nowIso),
    buildDestinationPoint('manchester', 'sylhet', 735.75, 398.25, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const qatarPoints = [
    buildDestinationPoint('manchester', 'doha', 619.44, 389.82, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const saudiPoints = [
    buildDestinationPoint('manchester', 'jeddah', 584.88, 400.03, nowIso),
    buildDestinationPoint('manchester', 'madinah', 586.05, 391.24, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  // Route Intelligence Completion (August 2026): Turkey, Morocco (excl.
  // Casablanca/Tangier — Manchester has no route to either), Spain,
  // Portugal, Greece and Italy each gained a real data/routes.ts entry via
  // the Turkey/Morocco/Europe route-guide batches (12 August 2026) — these
  // are no longer network-evidence-only destinations, so they now go
  // through buildDestinationPoint (real computeRouteIntelligenceLevel
  // grading) rather than buildUntrackedDestinationPoint's hardcoded
  // 'expanding'. Before this fix, all 11 of these routes had a genuine
  // route guide but the Atlas silently showed "Intelligence still being
  // expanded" for every one of them — the exact class of gap
  // computeRouteIntelligenceLevel was built to report honestly, just never
  // wired in here after the route guides shipped.
  const turkeyPoints = [
    buildDestinationPoint('manchester', 'istanbul', 557.16, 337.18, nowIso),
    buildDestinationPoint('manchester', 'antalya', 561.92, 351.8, nowIso),
    buildDestinationPoint('manchester', 'dalaman', 556.64, 352.48, nowIso),
    buildDestinationPoint('manchester', 'bodrum', 552.9, 351.34, nowIso),
    buildDestinationPoint('manchester', 'izmir', 552.1, 346.39, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const moroccoPoints = [
    buildDestinationPoint('manchester', 'marrakech', 452.46, 369.56, nowIso),
    buildDestinationPoint('manchester', 'agadir', 447.94, 373.58, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const spainPoints = [
    buildDestinationPoint('manchester', 'barcelona', 480.8, 336.16, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const portugalPoints = [
    buildDestinationPoint('manchester', 'faro', 452.66, 351.2, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const greecePoints = [
    buildDestinationPoint('manchester', 'athens', 542.34, 348.05, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const italyPoints = [
    buildDestinationPoint('manchester', 'rome', 510, 330.8, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    // Country marker position = the real computed centroid of that
    // country's own fetched path (see lib/atlas-country-geometry.ts) —
    // an actual geometric property of the real shape, not estimated.
    // India and UAE keep their already-approved whole-shape centroids
    // unchanged; every country added afterwards uses its MAINLAND
    // subpath's centroid specifically, so an offshore territory (the
    // Azores for Portugal, the Balearics for Spain, Sicily/Sardinia for
    // Italy) can't drag the marker away from where its destinations
    // actually are.
    { slug: 'india', label: 'India', x: 722, y: 400, intelligenceLevel: aggregateCountryIntelligence(indiaPoints), destinations: indiaPoints },
    { slug: 'uae', label: 'United Arab Emirates', x: 628, y: 394, intelligenceLevel: aggregateCountryIntelligence(uaePoints), destinations: uaePoints },
    { slug: 'pakistan', label: 'Pakistan', x: 687.71, y: 357.09, intelligenceLevel: aggregateCountryIntelligence(pakistanPoints), destinations: pakistanPoints },
    { slug: 'bangladesh', label: 'Bangladesh', x: 728.17, y: 394.6, intelligenceLevel: aggregateCountryIntelligence(bangladeshPoints), destinations: bangladeshPoints },
    { slug: 'qatar', label: 'Qatar', x: 618.56, y: 390.2, intelligenceLevel: aggregateCountryIntelligence(qatarPoints), destinations: qatarPoints },
    { slug: 'saudi-arabia', label: 'Saudi Arabia', x: 602.66, y: 395.32, intelligenceLevel: aggregateCountryIntelligence(saudiPoints), destinations: saudiPoints },
    { slug: 'turkey', label: 'Turkey', x: 575.31, y: 345.75, intelligenceLevel: aggregateCountryIntelligence(turkeyPoints), destinations: turkeyPoints },
    { slug: 'morocco', label: 'Morocco', x: 459.51, y: 369.31, intelligenceLevel: aggregateCountryIntelligence(moroccoPoints), destinations: moroccoPoints },
    { slug: 'spain', label: 'Spain', x: 464.61, y: 338.83, intelligenceLevel: aggregateCountryIntelligence(spainPoints), destinations: spainPoints },
    { slug: 'portugal', label: 'Portugal', x: 452.75, y: 341.03, intelligenceLevel: aggregateCountryIntelligence(portugalPoints), destinations: portugalPoints },
    { slug: 'greece', label: 'Greece', x: 541.77, y: 343.4, intelligenceLevel: aggregateCountryIntelligence(greecePoints), destinations: greecePoints },
    { slug: 'italy', label: 'Italy', x: 508.35, y: 326.2, intelligenceLevel: aggregateCountryIntelligence(italyPoints), destinations: italyPoints },
    // Every country above has at least one real destination — none is
    // shown just for geographic decoration (that's what CONTEXT_PATH_KEYS
    // in the component is for).
  ].filter((c) => c.destinations.length > 0);

  return {
    airportSlug: 'manchester',
    airportName: 'Manchester',
    origin,
    // UAE (Dubai), not India (Mumbai) — Mumbai and Delhi are the only two
    // Manchester routes with any route-status-events.ts entry at all, and
    // both are currently 'withdrawal-announced' (see the events at the
    // bottom of that file), so India was never a stable landing state, only
    // ever the accident of being first in indiaPoints. Manchester-Dubai is
    // the strongest verified, non-withdrawal alternative already in this
    // network: verified directly on Emirates' own route page (the most
    // recently checked of any Manchester route here), zero
    // route-status-events, and one of the six routes STATUS.md's
    // SOFT_LAUNCH_PACK originally hand-picked for "logged fare evidence and
    // a verified TravelUp deep link today" — that quote is historical
    // (TravelUp has since been removed entirely; see lib/booking-providers.ts),
    // but the route independently carries a genuine Trip.com link today too,
    // so the directness/verification part of that justification still
    // holds. Route Coverage Truth correction (August 2026): the two logged
    // fare observations this comment used to cite (obs-man-dxb-economy-1/
    // business-1) predate the Truth Reset departureDate/returnDate
    // requirement (isPubliclyPublishable(), data/fare-observations.ts) and
    // are therefore NOT currently publicly displayable — computeRouteIntelligenceLevel
    // correctly grades this route 'useful', not 'strong', on that basis (see
    // docs/project-control/ROUTE_COVERAGE_AUDIT.md for the full finding).
    // Kept as the default landing country anyway: it's still the strongest
    // verified, non-withdrawal, single-destination option in this network,
    // and a route being the honest default doesn't require it to already be
    // the strongest-graded one — the Atlas is explicit that it isn't. UAE
    // is also architecturally the simplest possible default: exactly one
    // destination, so there's no ordering ambiguity about which city shows
    // first, unlike India or Pakistan's multi-destination arrays. Mumbai
    // itself is untouched — still visible, still selectable, still showing
    // its real withdrawal notice, just no longer what a first-time visitor
    // sees before choosing anything.
    defaultCountrySlug: 'uae',
    countries,
  };
}

/**
 * Birmingham — the first Airport Pack built after Manchester, originally
 * scoped to five destinations to validate the multi-airport architecture
 * (per the 2026-07-26 network audit, docs/atlas-airport-network-audit.md).
 *
 * Route Intelligence Completion (August 2026): the Turkey and Morocco
 * route-guide batches (12 August 2026) added real data/routes.ts entries
 * for Birmingham–Istanbul/Antalya/Dalaman/Bodrum/Agadir, and the Europe
 * batch added Barcelona/Faro/Athens/Rome — none of these nine were ever
 * wired into this function, so all nine had a genuine route guide with zero
 * Atlas presence at all (not even the honest "expanding" state — simply
 * absent). Added below using the same buildDestinationPoint mechanism as
 * the original five; no new evidence was researched, this only wires up
 * evidence that already existed. Birmingham has no Marrakech or Tangier
 * route, so Morocco appears here via Agadir only.
 *
 * Final Route-Guide Completion, second evidence pass (13 August 2026):
 * Delhi, Ahmedabad, Dubai, Doha and Jeddah added — each backed by a
 * Birmingham Airport-own source (its current destination page for Dubai;
 * its own launch press releases for Doha and Jeddah) reached via
 * search-indexed content after direct WebFetch to birminghamairport.co.uk
 * returned 403 across every subdomain — see data/routes.ts's
 * birmingham-dubai/-doha/-jeddah/-delhi/-ahmedabad records for the full
 * evidence and, for Delhi specifically, a genuine disclosed conflict this
 * Atlas entry deliberately does not paper over (computeRouteIntelligenceLevel
 * still grades it honestly from the 'unverified' status the route record
 * carries).
 *
 * Destination and country coordinates are real geography, not re-derived —
 * a city's position on this map does not depend on which airport you fly
 * from, so every destination below reuses the exact same real,
 * point-in-polygon-verified (or, for the newer batch, regression-derived —
 * see the big geometry comment above buildManchesterNetwork) positions
 * already established elsewhere in this file. Only the origin (Birmingham
 * Airport's own real position) is airport-specific.
 */
function buildBirminghamNetwork(nowIso: string): AirportNetworkData {
  // Birmingham Airport (BHX): 52.4539Â°N, 1.7480Â°W — standard, publicly
  // known airport coordinates. Projected with the same method and the same
  // implied UK reference extent as Manchester's origin, verified against the
  // same real-coordinate projection used for every airport in this pack
  // before trusting the method for a second airport.
  const origin = { x: 474.0, y: 292.2 };

  const indiaPoints = [
    buildDestinationPoint('birmingham', 'mumbai', 690, 414, nowIso),
    buildDestinationPoint('birmingham', 'amritsar', 695, 380, nowIso),
    // Delhi and Ahmedabad added in the Final Route-Guide Completion
    // batch's second evidence pass (13 August 2026) — Delhi's Route
    // Intelligence deliberately reflects a genuine, disclosed evidence
    // conflict (see data/routes.ts's birmingham-delhi record) rather than
    // asserting a resolved direct/connecting answer.
    buildDestinationPoint('birmingham', 'delhi', 701, 388, nowIso),
    buildDestinationPoint('birmingham', 'ahmedabad', 690, 403, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const pakistanPoints = [
    buildDestinationPoint('birmingham', 'lahore', 690.58, 356.42, nowIso),
    buildDestinationPoint('birmingham', 'islamabad', 689.74, 355.52, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const uaePoints = [
    // Birmingham–Dubai added in the Final Route-Guide Completion batch's
    // second evidence pass (13 August 2026) — Birmingham Airport's own
    // Dubai destination page, confirmed via search-indexed content after
    // direct WebFetch to birminghamairport.co.uk returned 403 (see
    // data/routes.ts's birmingham-dubai record for the full evidence).
    buildDestinationPoint('birmingham', 'dubai', 630, 391, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const qatarPoints = [
    // Birmingham–Doha added in the same second evidence pass — Birmingham
    // Airport's own "Qatar Airways Returns to Birmingham Airport" press
    // release.
    buildDestinationPoint('birmingham', 'doha', 619.44, 389.82, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const saudiPoints = [
    buildDestinationPoint('birmingham', 'madinah', 586.05, 391.24, nowIso),
    // Jeddah added in the same second evidence pass — Birmingham Airport's
    // own "Saudia Launches Three-Times-A-Week Jeddah Service from BHX"
    // press release.
    buildDestinationPoint('birmingham', 'jeddah', 584.88, 400.03, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const turkeyPoints = [
    buildDestinationPoint('birmingham', 'istanbul', 557.16, 337.18, nowIso),
    buildDestinationPoint('birmingham', 'antalya', 561.92, 351.8, nowIso),
    buildDestinationPoint('birmingham', 'dalaman', 556.64, 352.48, nowIso),
    buildDestinationPoint('birmingham', 'bodrum', 552.9, 351.34, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const moroccoPoints = [
    buildDestinationPoint('birmingham', 'agadir', 447.94, 373.58, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const spainPoints = [
    buildDestinationPoint('birmingham', 'barcelona', 480.8, 336.16, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const portugalPoints = [
    buildDestinationPoint('birmingham', 'faro', 452.66, 351.2, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const greecePoints = [
    buildDestinationPoint('birmingham', 'athens', 542.34, 348.05, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const italyPoints = [
    buildDestinationPoint('birmingham', 'rome', 510, 330.8, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'india', label: 'India', x: 722, y: 400, intelligenceLevel: aggregateCountryIntelligence(indiaPoints), destinations: indiaPoints },
    { slug: 'pakistan', label: 'Pakistan', x: 687.71, y: 357.09, intelligenceLevel: aggregateCountryIntelligence(pakistanPoints), destinations: pakistanPoints },
    { slug: 'uae', label: 'United Arab Emirates', x: 628, y: 394, intelligenceLevel: aggregateCountryIntelligence(uaePoints), destinations: uaePoints },
    { slug: 'qatar', label: 'Qatar', x: 618.56, y: 390.2, intelligenceLevel: aggregateCountryIntelligence(qatarPoints), destinations: qatarPoints },
    { slug: 'saudi-arabia', label: 'Saudi Arabia', x: 602.66, y: 395.32, intelligenceLevel: aggregateCountryIntelligence(saudiPoints), destinations: saudiPoints },
    { slug: 'turkey', label: 'Turkey', x: 575.31, y: 345.75, intelligenceLevel: aggregateCountryIntelligence(turkeyPoints), destinations: turkeyPoints },
    { slug: 'morocco', label: 'Morocco', x: 459.51, y: 369.31, intelligenceLevel: aggregateCountryIntelligence(moroccoPoints), destinations: moroccoPoints },
    { slug: 'spain', label: 'Spain', x: 464.61, y: 338.83, intelligenceLevel: aggregateCountryIntelligence(spainPoints), destinations: spainPoints },
    { slug: 'portugal', label: 'Portugal', x: 452.75, y: 341.03, intelligenceLevel: aggregateCountryIntelligence(portugalPoints), destinations: portugalPoints },
    { slug: 'greece', label: 'Greece', x: 541.77, y: 343.4, intelligenceLevel: aggregateCountryIntelligence(greecePoints), destinations: greecePoints },
    { slug: 'italy', label: 'Italy', x: 508.35, y: 326.2, intelligenceLevel: aggregateCountryIntelligence(italyPoints), destinations: italyPoints },
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
 * London Heathrow - 8 routes.ts entries (bengaluru, delhi, doha, jeddah,
 * mumbai, dhaka, sylhet, casablanca), the full set with adequate sourced
 * network evidence per the 2026-07-26 audit plus the 2026-07-30 Bengaluru
 * and Bangladesh additions, plus Casablanca from the 12 August 2026 Morocco
 * route-guide batch (Route Intelligence Completion, August 2026 — wired in
 * here, having had a real route guide with zero Atlas presence). Casablanca
 * is Heathrow's only Morocco route — Marrakech/Agadir/Tangier are all
 * London Gatwick or Manchester routes, not Heathrow's.
 * london-heathrow-dhaka and london-heathrow-sylhet are
 * both Verification Pending: Heathrow's own live flight-tracking pages
 * confirm named flights BG201/BG202 (Dhaka-London) currently operate, and
 * independent flight-schedule sources consistently describe that same
 * flight as making a scheduled Sylhet stop, but no primary source has
 * confirmed the stop directly - included because real, if incomplete,
 * network evidence exists for both, same standard as every other point
 * here. (An earlier version of this comment stated "zero evidence" for
 * Sylhet from Heathrow - corrected 2026-07-30 per a founder-directed
 * recheck; the real signal was there, just not primary-source-confirmed.)
 * Lahore added in the Final Route-Guide Completion batch (13 August 2026) —
 * verified via Heathrow Airport's own media centre press release. Dubai
 * added in that same batch's second evidence pass — Heathrow's own live
 * flight-tracking system indexes multiple current Emirates flight-detail
 * pages for this pair, reached via search-indexed content after direct
 * WebFetch returned only a JS shell. Karachi and Madinah remain real
 * Heathrow destinations with no routes.ts entry — no current, authoritative
 * evidence was found for either across both evidence passes (see
 * docs/project-control/ROUTE_COVERAGE.md), so neither is included.
 */
function buildHeathrowNetwork(nowIso: string): AirportNetworkData {
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
    buildDestinationPoint('london-heathrow', 'bengaluru', 701.9, 430.6, nowIso),
    buildDestinationPoint('london-heathrow', 'delhi', 701, 388, nowIso),
    buildDestinationPoint('london-heathrow', 'mumbai', 690, 414, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const pakistanPoints = [
    buildDestinationPoint('london-heathrow', 'lahore', 690.58, 356.42, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const uaePoints = [
    // Heathrow–Dubai added in the Final Route-Guide Completion batch's
    // second evidence pass (13 August 2026) — Heathrow's own live
    // flight-tracking system indexes multiple current Emirates
    // Heathrow-Dubai flight-detail pages (see data/routes.ts's
    // london-heathrow-dubai record for the full evidence).
    buildDestinationPoint('london-heathrow', 'dubai', 630, 391, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const qatarPoints = [
    buildDestinationPoint('london-heathrow', 'doha', 619.44, 389.82, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const saudiPoints = [
    buildDestinationPoint('london-heathrow', 'jeddah', 584.88, 400.03, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const bangladeshPoints = [
    // Dhaka and Sylhet (23.8103N/90.4125E, 24.8949N/91.8687E): same
    // regression method as Bengaluru above and as Manchester's own Dhaka/
    // Sylhet points, cross-checked against the real mainland centroid
    // computed directly from this project's own extracted Bangladesh SVG
    // path data (lib/atlas-country-geometry.ts, 728.17/394.60) - the
    // independent methods land within a few px of each other, the same
    // margin the Bengaluru regression already validated against.
    buildDestinationPoint('london-heathrow', 'dhaka', 732.3, 401.2, nowIso),
    buildDestinationPoint('london-heathrow', 'sylhet', 735.75, 398.25, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  // Casablanca 33.5731,-7.5898 -> x453.55,y363.10 — see the geometry
  // comment above buildManchesterNetwork for the exact regression this was
  // computed with (anchored on Marrakech/Agadir).
  const moroccoPoints = [
    buildDestinationPoint('london-heathrow', 'casablanca', 453.55, 363.1, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'india', label: 'India', x: 722, y: 400, intelligenceLevel: aggregateCountryIntelligence(indiaPoints), destinations: indiaPoints },
    { slug: 'pakistan', label: 'Pakistan', x: 687.71, y: 357.09, intelligenceLevel: aggregateCountryIntelligence(pakistanPoints), destinations: pakistanPoints },
    { slug: 'uae', label: 'United Arab Emirates', x: 628, y: 394, intelligenceLevel: aggregateCountryIntelligence(uaePoints), destinations: uaePoints },
    { slug: 'qatar', label: 'Qatar', x: 618.56, y: 390.2, intelligenceLevel: aggregateCountryIntelligence(qatarPoints), destinations: qatarPoints },
    { slug: 'saudi-arabia', label: 'Saudi Arabia', x: 602.66, y: 395.32, intelligenceLevel: aggregateCountryIntelligence(saudiPoints), destinations: saudiPoints },
    { slug: 'bangladesh', label: 'Bangladesh', x: 728.17, y: 394.6, intelligenceLevel: aggregateCountryIntelligence(bangladeshPoints), destinations: bangladeshPoints },
    { slug: 'morocco', label: 'Morocco', x: 459.51, y: 369.31, intelligenceLevel: aggregateCountryIntelligence(moroccoPoints), destinations: moroccoPoints },
  ].filter((c) => c.destinations.length > 0);

  return { airportSlug: 'london-heathrow', airportName: 'London Heathrow', origin, defaultCountrySlug: 'india', countries };
}

/**
 * London Gatwick — originally 2 routes.ts entries (ahmedabad, amritsar).
 *
 * Route Intelligence Completion (August 2026): the Turkey, Morocco and
 * Europe route-guide batches (12 August 2026) added 12 more real
 * data/routes.ts entries for Gatwick — Istanbul/Antalya/Dalaman/Bodrum/Izmir
 * (Turkey), Marrakech/Agadir/Tangier (Morocco — Gatwick is the only UK
 * airport JetStash serves Tangier from), and Barcelona/Faro/Athens/Rome
 * (Europe) — none were ever wired into this function, so all 12 had a
 * genuine route guide with zero Atlas presence. Added below using the same
 * buildDestinationPoint mechanism as the original two.
 *
 * Dubai added in the Final Route-Guide Completion batch (13 August 2026) —
 * verified via Gatwick's own destinations.html page ("Dubai, UAE... 7-8
 * hours flight time... Serviced by Emirates").
 */
function buildGatwickNetwork(nowIso: string): AirportNetworkData {
  // London Gatwick (LGW): 51.1537Â°N, 0.1821Â°W.
  const origin = { x: 477.4, y: 300.0 };

  const indiaPoints = [
    buildDestinationPoint('london-gatwick', 'ahmedabad', 690, 403, nowIso),
    buildDestinationPoint('london-gatwick', 'amritsar', 695, 380, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const uaePoints = [
    buildDestinationPoint('london-gatwick', 'dubai', 630, 391, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const turkeyPoints = [
    buildDestinationPoint('london-gatwick', 'istanbul', 557.16, 337.18, nowIso),
    buildDestinationPoint('london-gatwick', 'antalya', 561.92, 351.8, nowIso),
    buildDestinationPoint('london-gatwick', 'dalaman', 556.64, 352.48, nowIso),
    buildDestinationPoint('london-gatwick', 'bodrum', 552.9, 351.34, nowIso),
    buildDestinationPoint('london-gatwick', 'izmir', 552.1, 346.39, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  // Tangier 35.7595,-5.834 -> x458.45,y355.84 — see the geometry comment
  // above buildManchesterNetwork for the regression this was computed with.
  const moroccoPoints = [
    buildDestinationPoint('london-gatwick', 'marrakech', 452.46, 369.56, nowIso),
    buildDestinationPoint('london-gatwick', 'agadir', 447.94, 373.58, nowIso),
    buildDestinationPoint('london-gatwick', 'tangier', 458.45, 355.84, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const spainPoints = [
    buildDestinationPoint('london-gatwick', 'barcelona', 480.8, 336.16, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const portugalPoints = [
    buildDestinationPoint('london-gatwick', 'faro', 452.66, 351.2, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const greecePoints = [
    buildDestinationPoint('london-gatwick', 'athens', 542.34, 348.05, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const italyPoints = [
    buildDestinationPoint('london-gatwick', 'rome', 510, 330.8, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'india', label: 'India', x: 722, y: 400, intelligenceLevel: aggregateCountryIntelligence(indiaPoints), destinations: indiaPoints },
    { slug: 'uae', label: 'United Arab Emirates', x: 628, y: 394, intelligenceLevel: aggregateCountryIntelligence(uaePoints), destinations: uaePoints },
    { slug: 'turkey', label: 'Turkey', x: 575.31, y: 345.75, intelligenceLevel: aggregateCountryIntelligence(turkeyPoints), destinations: turkeyPoints },
    { slug: 'morocco', label: 'Morocco', x: 459.51, y: 369.31, intelligenceLevel: aggregateCountryIntelligence(moroccoPoints), destinations: moroccoPoints },
    { slug: 'spain', label: 'Spain', x: 464.61, y: 338.83, intelligenceLevel: aggregateCountryIntelligence(spainPoints), destinations: spainPoints },
    { slug: 'portugal', label: 'Portugal', x: 452.75, y: 341.03, intelligenceLevel: aggregateCountryIntelligence(portugalPoints), destinations: portugalPoints },
    { slug: 'greece', label: 'Greece', x: 541.77, y: 343.4, intelligenceLevel: aggregateCountryIntelligence(greecePoints), destinations: greecePoints },
    { slug: 'italy', label: 'Italy', x: 508.35, y: 326.2, intelligenceLevel: aggregateCountryIntelligence(italyPoints), destinations: italyPoints },
  ].filter((c) => c.destinations.length > 0);

  return { airportSlug: 'london-gatwick', airportName: 'London Gatwick', origin, defaultCountrySlug: 'india', countries };
}

/**
 * Glasgow — originally exactly one routes.ts entry (dubai).
 *
 * Route Intelligence Completion (August 2026): the Turkey route-guide batch
 * (12 August 2026) added three real data/routes.ts entries for Glasgow —
 * Antalya, Dalaman, Bodrum — never wired into this function, so all three
 * had a genuine route guide with zero Atlas presence. Added below using the
 * same buildDestinationPoint mechanism as the original Dubai entry.
 */
function buildGlasgowNetwork(nowIso: string): AirportNetworkData {
  // Glasgow Airport (GLA): 55.8642Â°N, 4.4331Â°W.
  const origin = { x: 464.4, y: 273.2 };

  const uaePoints = [
    buildDestinationPoint('glasgow', 'dubai', 630, 391, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const turkeyPoints = [
    buildDestinationPoint('glasgow', 'antalya', 561.92, 351.8, nowIso),
    buildDestinationPoint('glasgow', 'dalaman', 556.64, 352.48, nowIso),
    buildDestinationPoint('glasgow', 'bodrum', 552.9, 351.34, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'uae', label: 'United Arab Emirates', x: 628, y: 394, intelligenceLevel: aggregateCountryIntelligence(uaePoints), destinations: uaePoints },
    { slug: 'turkey', label: 'Turkey', x: 575.31, y: 345.75, intelligenceLevel: aggregateCountryIntelligence(turkeyPoints), destinations: turkeyPoints },
  ].filter((c) => c.destinations.length > 0);

  return { airportSlug: 'glasgow', airportName: 'Glasgow', origin, defaultCountrySlug: 'uae', countries };
}

/** Edinburgh — exactly one routes.ts entry (dubai), same shape as Glasgow. */
function buildEdinburghNetwork(nowIso: string): AirportNetworkData {
  // Edinburgh Airport (EDI): 55.9500Â°N, 3.3725Â°W.
  const origin = { x: 468.0, y: 274.4 };

  const uaePoints = [
    buildDestinationPoint('edinburgh', 'dubai', 630, 391, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'uae', label: 'United Arab Emirates', x: 628, y: 394, intelligenceLevel: aggregateCountryIntelligence(uaePoints), destinations: uaePoints },
  ].filter((c) => c.destinations.length > 0);

  return { airportSlug: 'edinburgh', airportName: 'Edinburgh', origin, defaultCountrySlug: 'uae', countries };
}

/**
 * Newcastle — originally exactly one routes.ts entry (dubai).
 *
 * Route Intelligence Completion (August 2026): the Turkey route-guide batch
 * (12 August 2026) added one real data/routes.ts entry for Newcastle —
 * Dalaman, its only Turkey route — never wired into this function.
 */
function buildNewcastleNetwork(nowIso: string): AirportNetworkData {
  // Newcastle International Airport (NCL): 55.0375Â°N, 1.6917Â°W.
  const origin = { x: 473.7, y: 280.0 };

  const uaePoints = [
    buildDestinationPoint('newcastle', 'dubai', 630, 391, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const turkeyPoints = [
    buildDestinationPoint('newcastle', 'dalaman', 556.64, 352.48, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'uae', label: 'United Arab Emirates', x: 628, y: 394, intelligenceLevel: aggregateCountryIntelligence(uaePoints), destinations: uaePoints },
    { slug: 'turkey', label: 'Turkey', x: 575.31, y: 345.75, intelligenceLevel: aggregateCountryIntelligence(turkeyPoints), destinations: turkeyPoints },
  ].filter((c) => c.destinations.length > 0);

  return { airportSlug: 'newcastle', airportName: 'Newcastle', origin, defaultCountrySlug: 'uae', countries };
}

/**
 * Leeds Bradford — originally 2 routes.ts entries (amritsar, islamabad),
 * both genuinely researched as `isDirect: false` — Leeds Bradford has no
 * stable direct service to either, per airports.ts's own standing caution
 * about unproven direct-service claims on this airport. The panel's verdict
 * text reflects that automatically via the isDirect-aware fix in
 * buildDestinationPoint, no special-casing required.
 *
 * Route Intelligence Completion (August 2026): the Turkey and Europe
 * route-guide batches (12 August 2026) added five real data/routes.ts
 * entries for Leeds Bradford — Antalya/Dalaman/Bodrum (Turkey, all
 * genuinely `isDirect: true` per Leeds Bradford Airport's own destinations
 * directory, unlike the original two connecting-only routes above) and
 * Barcelona/Faro (Europe) — never wired into this function, so all five had
 * a genuine route guide with zero Atlas presence. Leeds Bradford has no
 * Morocco, Greece or Italy route.
 */
function buildLeedsBradfordNetwork(nowIso: string): AirportNetworkData {
  // Leeds Bradford Airport (LBA): 53.8659Â°N, 1.6606Â°W.
  const origin = { x: 473.1, y: 287.6 };

  const indiaPoints = [
    buildDestinationPoint('leeds-bradford', 'amritsar', 695, 380, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const pakistanPoints = [
    buildDestinationPoint('leeds-bradford', 'islamabad', 689.74, 355.52, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const turkeyPoints = [
    buildDestinationPoint('leeds-bradford', 'antalya', 561.92, 351.8, nowIso),
    buildDestinationPoint('leeds-bradford', 'dalaman', 556.64, 352.48, nowIso),
    buildDestinationPoint('leeds-bradford', 'bodrum', 552.9, 351.34, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const spainPoints = [
    buildDestinationPoint('leeds-bradford', 'barcelona', 480.8, 336.16, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const portugalPoints = [
    buildDestinationPoint('leeds-bradford', 'faro', 452.66, 351.2, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'india', label: 'India', x: 722, y: 400, intelligenceLevel: aggregateCountryIntelligence(indiaPoints), destinations: indiaPoints },
    { slug: 'pakistan', label: 'Pakistan', x: 687.71, y: 357.09, intelligenceLevel: aggregateCountryIntelligence(pakistanPoints), destinations: pakistanPoints },
    { slug: 'turkey', label: 'Turkey', x: 575.31, y: 345.75, intelligenceLevel: aggregateCountryIntelligence(turkeyPoints), destinations: turkeyPoints },
    { slug: 'spain', label: 'Spain', x: 464.61, y: 338.83, intelligenceLevel: aggregateCountryIntelligence(spainPoints), destinations: spainPoints },
    { slug: 'portugal', label: 'Portugal', x: 452.75, y: 341.03, intelligenceLevel: aggregateCountryIntelligence(portugalPoints), destinations: portugalPoints },
  ].filter((c) => c.destinations.length > 0);

  return { airportSlug: 'leeds-bradford', airportName: 'Leeds Bradford', origin, defaultCountrySlug: 'india', countries };
}

/**
 * Bristol — Route Intelligence Completion (August 2026). Bristol had zero
 * Atlas presence at all (no build function existed) despite the Turkey,
 * Morocco and Europe route-guide batches (12 August 2026) giving it 6 real
 * data/routes.ts entries — Antalya, Dalaman (Turkey), Marrakech (Morocco)
 * and Barcelona, Faro, Rome (Europe), all genuinely `isDirect: true` per
 * Bristol Airport's own current destination pages. This is a brand-new
 * build function, not a fix to an existing one — the original 2026-07-26
 * network audit correctly found zero Bristol routes.ts entries at the time
 * and correctly left it out; that's no longer true, so it's added the same
 * way every other airport in this file was: real routes.ts entries only,
 * real geometry reused from the destinations already plotted elsewhere in
 * this file. Bristol has no Istanbul, Bodrum, Izmir, Agadir, Tangier, Athens
 * or Casablanca route — Turkey appears via Antalya/Dalaman only, Morocco via
 * Marrakech only, and there is no Greece destination at all.
 */
function buildBristolNetwork(nowIso: string): AirportNetworkData {
  // Bristol Airport (BRS): 51.3827Â°N, 2.7191Â°W.
  const origin = { x: 465.9, y: 302.4 };

  const turkeyPoints = [
    buildDestinationPoint('bristol', 'antalya', 561.92, 351.8, nowIso),
    buildDestinationPoint('bristol', 'dalaman', 556.64, 352.48, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const moroccoPoints = [
    buildDestinationPoint('bristol', 'marrakech', 452.46, 369.56, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const spainPoints = [
    buildDestinationPoint('bristol', 'barcelona', 480.8, 336.16, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const portugalPoints = [
    buildDestinationPoint('bristol', 'faro', 452.66, 351.2, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const italyPoints = [
    buildDestinationPoint('bristol', 'rome', 510, 330.8, nowIso),
  ].filter((p): p is DestinationPoint => p !== null);

  const countries: CountryData[] = [
    { slug: 'turkey', label: 'Turkey', x: 575.31, y: 345.75, intelligenceLevel: aggregateCountryIntelligence(turkeyPoints), destinations: turkeyPoints },
    { slug: 'morocco', label: 'Morocco', x: 459.51, y: 369.31, intelligenceLevel: aggregateCountryIntelligence(moroccoPoints), destinations: moroccoPoints },
    { slug: 'spain', label: 'Spain', x: 464.61, y: 338.83, intelligenceLevel: aggregateCountryIntelligence(spainPoints), destinations: spainPoints },
    { slug: 'portugal', label: 'Portugal', x: 452.75, y: 341.03, intelligenceLevel: aggregateCountryIntelligence(portugalPoints), destinations: portugalPoints },
    { slug: 'italy', label: 'Italy', x: 508.35, y: 326.2, intelligenceLevel: aggregateCountryIntelligence(italyPoints), destinations: italyPoints },
  ].filter((c) => c.destinations.length > 0);

  return { airportSlug: 'bristol', airportName: 'Bristol', origin, defaultCountrySlug: 'spain', countries };
}

// Adding another airport: write a sibling `build<Airport>Network()`
// function above (same shape as buildManchesterNetwork/
// buildBirminghamNetwork — real routes.ts entries where they exist, real
// geometry from lib/atlas-country-geometry.ts) and push its result into
// this array. Nothing else changes.
//
// Liverpool and East Midlands are deliberately absent: neither has a single
// routes.ts entry for any destination (reconfirmed against the current
// 80-route catalogue during Route Intelligence Completion, August 2026) —
// the same "only build from destinations that already have a real route
// guide" rule that used to also exclude Bristol (now added above, since
// Bristol gained real routes.ts entries the 2026-07-26 audit predates). An
// Airport Pack with zero destinations isn't a smaller honest network, it's
// nothing to render — flagged back rather than built empty.
// Optional injection seam for deterministic tests only — production callers
// (app/founder/atlas-feel-test/page.tsx, components/homepage-v2/journey-desk-home.tsx)
// pass nothing and get the exact prior behaviour: the module-load-time date
// above, never a fresh `new Date()` per call. Never pass an explicit value
// from application code.
export function buildAtlasAirports(nowIso: string = defaultNowIso): AirportNetworkData[] {
  return [
    buildManchesterNetwork(nowIso),
    buildBirminghamNetwork(nowIso),
    buildHeathrowNetwork(nowIso),
    buildGatwickNetwork(nowIso),
    buildGlasgowNetwork(nowIso),
    buildEdinburghNetwork(nowIso),
    buildNewcastleNetwork(nowIso),
    buildLeedsBradfordNetwork(nowIso),
    buildBristolNetwork(nowIso),
  ];
}
