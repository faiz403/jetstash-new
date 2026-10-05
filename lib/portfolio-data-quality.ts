import { airports, getAirportBySlug } from '@/data/airports';
import { destinations, getDestinationBySlug } from '@/data/destinations';
import { fareObservations, getPublishableObservationsByRoute, type FareObservation } from '@/data/fare-observations';
import { gscRoutePerformance, type GscPeriodMetrics } from '@/data/gsc-route-performance-2026-09-29';
import { routeStatusEvents, validateStatusLedger } from '@/data/route-status-events';
import { routeWarnings } from '@/data/route-warnings';
import { routes, type Route } from '@/data/routes';
import { getTripComFlightHandoff, getTripComRouteUrl } from '@/lib/booking-providers';
import { isSelfTransferItinerary } from '@/lib/fare-self-transfer';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { daysBetweenIso } from '@/lib/freshness-thresholds';
import { getFreshFareCoverageLevel, getRollingFareTravelWindow } from '@/lib/fare-window';
import type { FareSearchCoverageLevel } from '@/data/fare-observations';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';

export type PortfolioValidationSeverity = 'error' | 'warning';

export interface PortfolioValidationIssue {
  severity: PortfolioValidationSeverity;
  code: string;
  subject: string;
  message: string;
}

export interface PortfolioRouteAuditRow {
  slug: string;
  origin: string;
  destination: string;
  originIata: string;
  destinationIata: string;
  publicStatus: string;
  declaredDirectness: 'direct' | 'connecting';
  operatorClaims: string[];
  frequencyClaim: string;
  durationClaim: string;
  verificationStatus: string | null;
  verifiedDate: string | null;
  reviewDueDate: string | null;
  verificationSource: string | null;
  verificationSourceUrl: string | null;
  sourceStrength: 'primary' | 'mixed-or-contradictory' | 'secondary-or-unclear' | 'missing';
  currentFare: number | null;
  currentFareObservedDate: string | null;
  currentFareDepartureDate: string | null;
  currentFareReturnDate: string | null;
  currentFareAgeDays: number | null;
  currentFareWindowStatus: 'current' | 'stale' | 'none';
  currentFareHasThreeMonthCoverage: boolean;
  currentFareCoverageLevel: FareSearchCoverageLevel | null;
  currentFareRefreshDueDate: string | null;
  currentFareKind: 'clean' | 'self-transfer' | null;
  currentFareProfile: string | null;
  bookingHandoffType: string | null;
  commercialHandoffType: 'exact-tripcom' | 'tripcom-destination-fallback' | 'google-flights' | 'none';
  exactAirportPreserved: boolean;
  monetised: boolean;
  currentCta: string | null;
  farePublishable: boolean;
  fareSuppressionReason: string | null;
  fareRescueCategory: 'A_FRESH_CHECK_READY' | 'B_REFRESH_ROUTE_FIRST' | 'C_SERVICE_ENDED_CONNECTING_ONLY' | 'D_CONTRADICTORY_OR_UNSAFE' | 'E_STALE_CLEAN_HISTORY' | 'F_POOR_ITINERARY_ONLY' | null;
  verificationCurrent: boolean;
  commercialReadiness: 'TRAFFIC_READY' | 'TRAFFIC_READY_NON_MONETISED' | 'FARE_GAP' | 'EVIDENCE_GAP' | 'HOLD';
  gscDataPresent: boolean;
  gscLast28: GscPeriodMetrics;
  gscPrior28: GscPeriodMetrics;
  gscLast90: GscPeriodMetrics;
  organicOpportunityScore: number;
  activeWarnings: string[];
  serviceEnded: boolean;
  observationCount: number;
  publishableObservationCount: number;
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
}

function validIsoDate(value: string | undefined): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)));
}

function sourceStrength(route: Route): PortfolioRouteAuditRow['sourceStrength'] {
  const verification = route.verification;
  if (!verification) return 'missing';
  const evidence = `${verification.sourceName} ${verification.note ?? ''}`;
  if (/contradict|conflict|secondary|aggregator|unresolved|pending/i.test(evidence)) return 'mixed-or-contradictory';
  if (/official|airport|airline|booking engine|press release|newsroom|flight information/i.test(evidence)) return 'primary';
  return 'secondary-or-unclear';
}

function observationErrors(observation: FareObservation): PortfolioValidationIssue[] {
  const subject = observation.id;
  const issues: PortfolioValidationIssue[] = [];
  if (!routes.some((route) => route.slug === observation.routeSlug)) {
    issues.push({ severity: 'error', code: 'FARE_ORPHAN_ROUTE', subject, message: `Unknown route ${observation.routeSlug}.` });
  }
  if (!validIsoDate(observation.observedDate)) {
    issues.push({ severity: 'error', code: 'FARE_INVALID_OBSERVED_DATE', subject, message: 'observedDate must be a real YYYY-MM-DD date.' });
  }
  if (observation.departureDate && !validIsoDate(observation.departureDate)) {
    issues.push({ severity: 'error', code: 'FARE_INVALID_DEPARTURE_DATE', subject, message: 'departureDate must be a real YYYY-MM-DD date.' });
  }
  if (observation.returnDate && !validIsoDate(observation.returnDate)) {
    issues.push({ severity: 'error', code: 'FARE_INVALID_RETURN_DATE', subject, message: 'returnDate must be a real YYYY-MM-DD date.' });
  }
  if (observation.departureDate && observation.observedDate > observation.departureDate) {
    issues.push({ severity: 'error', code: 'FARE_OBSERVED_AFTER_DEPARTURE', subject, message: 'Fare was recorded after its outbound date.' });
  }
  if (observation.departureDate && observation.returnDate && observation.returnDate < observation.departureDate) {
    issues.push({ severity: 'error', code: 'FARE_RETURN_BEFORE_DEPARTURE', subject, message: 'returnDate is before departureDate.' });
  }
  if (!Number.isFinite(observation.price) || observation.price <= 0) {
    issues.push({ severity: 'error', code: 'FARE_INVALID_PRICE', subject, message: 'price must be positive.' });
  }
  if (observation.currency && observation.currency !== 'GBP') {
    issues.push({ severity: 'error', code: 'FARE_INVALID_CURRENCY', subject, message: 'JetStash fare observations must use GBP.' });
  }
  if (observation.comparisonEligibility === 'current' && (!observation.profileId || !observation.departureDate || !observation.returnDate || !observation.currency || !observation.baggage || !observation.observationReason)) {
    issues.push({ severity: 'error', code: 'FARE_CURRENT_MISSING_FIELDS', subject, message: 'Current-comparison observation is missing profile, dates, currency, baggage, or reason.' });
  }
  if (observation.outboundStops === 0 && observation.outboundDirectness === 'connecting') {
    issues.push({ severity: 'error', code: 'FARE_OUTBOUND_STOP_CONTRADICTION', subject, message: 'Zero outbound stops conflicts with connecting directness.' });
  }
  if (observation.returnStops === 0 && observation.returnDirectness === 'connecting') {
    issues.push({ severity: 'error', code: 'FARE_RETURN_STOP_CONTRADICTION', subject, message: 'Zero return stops conflicts with connecting directness.' });
  }
  if (observation.fareDirectness === 'direct' && ((observation.outboundStops ?? 0) > 0 || (observation.returnStops ?? 0) > 0)) {
    issues.push({ severity: 'error', code: 'FARE_DIRECT_WITH_STOPS', subject, message: 'Direct fare records one or more stops.' });
  }
  if (observation.sourceUrl) {
    try { new URL(observation.sourceUrl); } catch { issues.push({ severity: 'error', code: 'FARE_INVALID_SOURCE_URL', subject, message: 'sourceUrl is not a valid absolute URL.' }); }
  }
  const coverage = observation.searchCoverage;
  if (coverage) {
    if (coverage.level === 'fixed' && coverage.method !== 'fixed-date') {
      issues.push({ severity: 'error', code: 'FARE_INVALID_SEARCH_COVERAGE_LEVEL', subject, message: 'FIXED coverage must use a fixed-date search method.' });
    }
    if (coverage.level === 'full-continuous' && coverage.method !== 'flexible-date') {
      issues.push({ severity: 'error', code: 'FARE_INVALID_SEARCH_COVERAGE_LEVEL', subject, message: 'FULL_CONTINUOUS coverage must use a flexible-date search method.' });
    }
    if (coverage.level === 'full-profiled' && coverage.method !== 'flexible-date') {
      issues.push({ severity: 'error', code: 'FARE_INVALID_SEARCH_COVERAGE_LEVEL', subject, message: 'FULL_PROFILED coverage must use a flexible-date search method.' });
    }
    if (coverage.level === 'full-continuous' && !coverage.continuousStayRange) {
      issues.push({ severity: 'error', code: 'FARE_INVALID_SEARCH_COVERAGE_LEVEL', subject, message: 'FULL_CONTINUOUS coverage must record an explicit continuous stay range.' });
    }
    if (coverage.level === 'full-profiled' && JSON.stringify([...new Set(coverage.stayProfiles ?? [])].sort((a, b) => a - b)) !== JSON.stringify([7, 14, 21, 28, 42])) {
      issues.push({ severity: 'error', code: 'FARE_INVALID_SEARCH_COVERAGE_LEVEL', subject, message: 'FULL_PROFILED coverage must record all approved stay profiles: 7, 14, 21 and 28 and 42 nights.' });
    }
    if (!validIsoDate(coverage.windowStart) || !validIsoDate(coverage.windowEnd) || coverage.windowEnd < coverage.windowStart) {
      issues.push({ severity: 'error', code: 'FARE_INVALID_SEARCH_WINDOW', subject, message: 'searchCoverage window must contain an ordered pair of real YYYY-MM-DD dates.' });
    }
    if (!Number.isInteger(coverage.stayMinNights) || !Number.isInteger(coverage.stayMaxNights) || coverage.stayMinNights < 1 || coverage.stayMaxNights < coverage.stayMinNights) {
      issues.push({ severity: 'error', code: 'FARE_INVALID_SEARCH_STAY_RANGE', subject, message: 'searchCoverage stay range must contain ordered positive whole-night values.' });
    }
    if (Number.isNaN(Date.parse(coverage.searchedAt))) {
      issues.push({ severity: 'error', code: 'FARE_INVALID_SEARCHED_AT', subject, message: 'searchCoverage searchedAt must be a real timestamp.' });
    }
  }
  return issues;
}

export function validatePortfolioData(nowIso: string): PortfolioValidationIssue[] {
  const issues: PortfolioValidationIssue[] = [];
  for (const slug of duplicates(routes.map((route) => route.slug))) {
    issues.push({ severity: 'error', code: 'ROUTE_DUPLICATE_SLUG', subject: slug, message: 'Route slug is duplicated.' });
  }
  for (const id of duplicates(fareObservations.map((observation) => observation.id))) {
    issues.push({ severity: 'error', code: 'FARE_DUPLICATE_ID', subject: id, message: 'Fare observation ID is duplicated.' });
  }
  for (const id of duplicates(routeWarnings.map((warning) => warning.id))) {
    issues.push({ severity: 'error', code: 'WARNING_DUPLICATE_ID', subject: id, message: 'Route warning ID is duplicated.' });
  }
  for (const airport of airports) {
    if (!/^[A-Z]{3}$/.test(airport.code)) issues.push({ severity: 'error', code: 'AIRPORT_INVALID_IATA', subject: airport.slug, message: `Invalid IATA code ${airport.code}.` });
  }
  for (const destination of destinations) {
    if (!/^[A-Z]{3}$/.test(destination.iataCode)) issues.push({ severity: 'error', code: 'DESTINATION_INVALID_IATA', subject: destination.slug, message: `Invalid IATA code ${destination.iataCode}.` });
  }
  for (const route of routes) {
    if (!getAirportBySlug(route.airportSlug)) issues.push({ severity: 'error', code: 'ROUTE_UNKNOWN_ORIGIN', subject: route.slug, message: `Unknown airport ${route.airportSlug}.` });
    if (!getDestinationBySlug(route.destinationSlug)) issues.push({ severity: 'error', code: 'ROUTE_UNKNOWN_DESTINATION', subject: route.slug, message: `Unknown destination ${route.destinationSlug}.` });
    if (!route.verification) {
      issues.push({ severity: route.airlineVerifications?.length ? 'warning' : 'error', code: 'ROUTE_MISSING_VERIFICATION', subject: route.slug, message: route.airlineVerifications?.length ? 'Route has per-airline evidence but no route-level verification object.' : 'Public route has no explicit verification object.' });
    } else {
      if (!validIsoDate(route.verification.verifiedDate) || !validIsoDate(route.verification.reviewDueDate)) issues.push({ severity: 'error', code: 'ROUTE_INVALID_REVIEW_DATE', subject: route.slug, message: 'Verification dates must be real YYYY-MM-DD dates.' });
      if (route.verification.reviewDueDate < route.verification.verifiedDate) issues.push({ severity: 'error', code: 'ROUTE_REVIEW_BEFORE_VERIFICATION', subject: route.slug, message: 'reviewDueDate precedes verifiedDate.' });
      if (!route.verification.sourceName.trim()) issues.push({ severity: 'error', code: 'ROUTE_EMPTY_SOURCE', subject: route.slug, message: 'Verification sourceName is empty.' });
      if (route.verification.reviewDueDate < nowIso) issues.push({ severity: 'warning', code: 'ROUTE_REVIEW_OVERDUE', subject: route.slug, message: `Review was due ${route.verification.reviewDueDate}.` });
    }
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
    const handoff = getTripComFlightHandoff(route.slug, route.airportSlug, route.destinationSlug, nowIso);
    if (presentation.status === 'service-ended' && handoff && handoff.kind !== 'service-ended-connecting') issues.push({ severity: 'error', code: 'ROUTE_ENDED_INVALID_HANDOFF', subject: route.slug, message: 'Service-ended route has an active-service handoff.' });
    if (handoff) {
      const url = new URL(handoff.url);
      const origin = getAirportBySlug(route.airportSlug)?.code;
      const destination = getDestinationBySlug(route.destinationSlug)?.iataCode;
      if (url.searchParams.get('dcity') !== origin || url.searchParams.get('acity') !== destination) issues.push({ severity: 'error', code: 'ROUTE_HANDOFF_AIRPORT_MISMATCH', subject: route.slug, message: 'Effective Trip.com handoff dcity/acity does not match the route exact-airport pair.' });
    }
    const exactUrl = getTripComRouteUrl(route.slug);
    if (exactUrl) {
      const url = new URL(exactUrl);
      const origin = getAirportBySlug(route.airportSlug)?.code;
      const destination = getDestinationBySlug(route.destinationSlug)?.iataCode;
      if (url.searchParams.get('dcity') !== origin || url.searchParams.get('acity') !== destination) issues.push({ severity: 'error', code: 'ROUTE_HANDOFF_AIRPORT_MISMATCH', subject: route.slug, message: 'Trip.com dcity/acity does not match the route exact-airport pair.' });
    }
  }
  for (const warning of routeWarnings) {
    if (!routes.some((route) => route.slug === warning.routeSlug)) issues.push({ severity: 'error', code: 'WARNING_ORPHAN_ROUTE', subject: warning.id, message: `Unknown route ${warning.routeSlug}.` });
  }
  for (const observation of fareObservations) issues.push(...observationErrors(observation));
  const publishableIds = new Set(routes.flatMap((route) => getPublishableObservationsByRoute(route.slug, nowIso).map((observation) => observation.id)));
  const comparableProfiles = new Map<string, Set<string>>();
  for (const observation of fareObservations.filter((item) => publishableIds.has(item.id) && item.comparisonEligibility === 'current' && item.profileId && item.departureDate && item.returnDate)) {
    const key = [observation.routeSlug, observation.cabin, observation.departureDate, observation.returnDate].join('|');
    const profiles = comparableProfiles.get(key) ?? new Set<string>();
    profiles.add(observation.profileId!);
    comparableProfiles.set(key, profiles);
  }
  for (const [key, profiles] of comparableProfiles) {
    if (profiles.size > 1) issues.push({ severity: 'error', code: 'FARE_COMPARISON_PROFILE_MISMATCH', subject: key, message: `Like-for-like comparison group has multiple profiles: ${[...profiles].join(', ')}.` });
  }
  for (const ledgerError of validateStatusLedger(routeStatusEvents, new Set(routes.map((route) => route.slug)))) {
    issues.push({ severity: 'error', code: `STATUS_${ledgerError.code.toUpperCase()}`, subject: ledgerError.eventId ?? 'status-ledger', message: ledgerError.message });
  }
  return issues;
}

export function buildPortfolioAudit(nowIso: string): PortfolioRouteAuditRow[] {
  return routes.map((route) => {
    const airport = getAirportBySlug(route.airportSlug);
    const destination = getDestinationBySlug(route.destinationSlug);
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
    const signal = getFareSignalForRoute(route.slug, nowIso);
    const raw = fareObservations.filter((observation) => observation.routeSlug === route.slug);
    const publishable = getPublishableObservationsByRoute(route.slug, nowIso);
    const selectedRaw = signal.observation ? fareObservations.find((observation) => observation.id === signal.observation?.id) : undefined;
    const handoff = getTripComFlightHandoff(route.slug, route.airportSlug, route.destinationSlug, nowIso);
    const verificationCurrent = presentation.status !== 'unverified'
      && presentation.status !== 'service-ended'
      && Boolean(route.verification?.reviewDueDate && route.verification.reviewDueDate >= nowIso);
    const fareSuppressionReason = signal.observation
      ? null
      : signal.noneReason === 'poor-itinerary-suppressed'
        ? 'Only poor-itinerary evidence is currently eligible; the public fare is suppressed.'
        : presentation.status === 'unverified'
          ? 'Route verification/status is not strong enough to support a current public fare.'
          : presentation.status === 'service-ended'
            ? 'The direct service has ended and no suitable current connecting fare is publishable.'
            : publishable.length === 0 && raw.length > 0
              ? 'Historical observations exist, but none currently passes publishability and freshness rules.'
              : 'No current publishable fare observation exists.';
    const commercialReadiness: PortfolioRouteAuditRow['commercialReadiness'] = presentation.status === 'service-ended'
      ? 'HOLD'
      : presentation.status === 'unverified'
      ? 'EVIDENCE_GAP'
      : !signal.observation
          ? (handoff ? 'FARE_GAP' : 'EVIDENCE_GAP')
          : !handoff
            ? 'TRAFFIC_READY_NON_MONETISED'
            : verificationCurrent
              ? 'TRAFFIC_READY'
              : 'EVIDENCE_GAP';
    const fareRescueCategory: PortfolioRouteAuditRow['fareRescueCategory'] = signal.observation
      ? null
      : presentation.status === 'service-ended'
        ? 'C_SERVICE_ENDED_CONNECTING_ONLY'
        : presentation.status === 'unverified' && sourceStrength(route) === 'mixed-or-contradictory'
          ? 'D_CONTRADICTORY_OR_UNSAFE'
          : presentation.status === 'unverified'
            ? 'B_REFRESH_ROUTE_FIRST'
            : signal.noneReason === 'poor-itinerary-suppressed'
              ? 'F_POOR_ITINERARY_ONLY'
              : raw.some((observation) => !isSelfTransferItinerary(observation.priceNote))
                ? 'E_STALE_CLEAN_HISTORY'
                : 'A_FRESH_CHECK_READY';
    const gsc = gscRoutePerformance.find((entry) => entry.slug === route.slug);
    const emptyGsc: GscPeriodMetrics = { clicks: 0, impressions: 0, ctrPercent: 0, averagePosition: null };
    const gscLast28 = gsc?.last28 ?? emptyGsc;
    const position = gscLast28.averagePosition;
    const positionWeight = position === null ? 0 : position >= 4 && position <= 10 ? 4 : position > 10 && position <= 20 ? 3 : position > 20 && position <= 40 ? 2 : 1;
    const readinessWeight = commercialReadiness === 'TRAFFIC_READY'
      ? 1
      : commercialReadiness === 'TRAFFIC_READY_NON_MONETISED'
        ? 0.8
        : commercialReadiness === 'FARE_GAP'
          ? 0.6
          : commercialReadiness === 'EVIDENCE_GAP'
            ? 0.25
            : 0.1;
    return {
      slug: route.slug,
      origin: airport?.city ?? route.airportSlug,
      destination: destination?.city ?? route.destinationSlug,
      originIata: airport?.code ?? '',
      destinationIata: destination?.iataCode ?? '',
      publicStatus: presentation.status,
      declaredDirectness: route.isDirect ? 'direct' : 'connecting',
      operatorClaims: [...route.airlineSlugs],
      frequencyClaim: route.frequency,
      durationClaim: route.flightTime,
      verificationStatus: route.verification?.status ?? null,
      verifiedDate: route.verification?.verifiedDate ?? null,
      reviewDueDate: route.verification?.reviewDueDate ?? null,
      verificationSource: route.verification?.sourceName ?? null,
      verificationSourceUrl: route.verification?.sourceUrl ?? null,
      sourceStrength: sourceStrength(route),
      currentFare: signal.observation?.price ?? null,
      currentFareObservedDate: signal.observation?.observedDate ?? null,
      currentFareDepartureDate: signal.observation?.departureDate ?? null,
      currentFareReturnDate: signal.observation?.returnDate ?? null,
      currentFareWindowStatus: signal.observation ? (signal.state === 'current' ? 'current' : 'stale') : 'none',
      currentFareHasThreeMonthCoverage: selectedRaw ? getFreshFareCoverageLevel(selectedRaw, nowIso) === 'full-continuous' : false,
      currentFareCoverageLevel: selectedRaw ? getFreshFareCoverageLevel(selectedRaw, nowIso) : null,
      currentFareAgeDays: signal.observation ? daysBetweenIso(signal.observation.observedDate, nowIso) : null,
      currentFareRefreshDueDate: signal.observation ? addDays(signal.observation.observedDate, 14) : null,
      currentFareKind: selectedRaw ? (isSelfTransferItinerary(selectedRaw.priceNote) ? 'self-transfer' : 'clean') : null,
      currentFareProfile: selectedRaw?.profileId ?? null,
      bookingHandoffType: handoff?.kind ?? null,
      commercialHandoffType: handoff
        ? handoff.kind === 'destination-fallback' ? 'tripcom-destination-fallback' : 'exact-tripcom'
        : 'google-flights',
      exactAirportPreserved: Boolean(handoff),
      monetised: Boolean(handoff),
      currentCta: handoff
        ? handoff.kind === 'service-ended-connecting' ? 'Compare current connecting flights on Trip.com' : 'Compare flights on Trip.com'
        : 'Search current flights',
      farePublishable: Boolean(signal.observation),
      fareSuppressionReason,
      fareRescueCategory,
      verificationCurrent,
      commercialReadiness,
      gscDataPresent: Boolean(gsc),
      gscLast28,
      gscPrior28: gsc?.prior28 ?? emptyGsc,
      gscLast90: gsc?.last90 ?? emptyGsc,
      organicOpportunityScore: Math.round(gscLast28.impressions * positionWeight * readinessWeight * 100) / 100,
      activeWarnings: routeWarnings.filter((warning) => warning.routeSlug === route.slug && warning.status === 'active').map((warning) => warning.id),
      serviceEnded: presentation.status === 'service-ended',
      observationCount: raw.length,
      publishableObservationCount: publishable.length,
    };
  });
}

export function summarizePortfolioAudit(rows: PortfolioRouteAuditRow[], nowIso: string) {
  const soon = new Date(`${nowIso}T12:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 14);
  const dueSoonIso = soon.toISOString().slice(0, 10);
  return {
    totalPublicRoutes: rows.length,
    threeMonthFareCoverage: `${rows.filter((row) => row.currentFareHasThreeMonthCoverage).length} / ${rows.length}`,
    fullProfiledFareCoverage: `${rows.filter((row) => row.currentFareCoverageLevel === 'full-profiled').length} / ${rows.length}`,
    threeMonthFareWindow: getRollingFareTravelWindow(nowIso),
    verified: rows.filter((row) => row.publicStatus === 'direct' || row.publicStatus === 'connecting' || row.publicStatus === 'unspecified').length,
    unverifiedOrPending: rows.filter((row) => row.publicStatus === 'unverified').length,
    serviceEnded: rows.filter((row) => row.serviceEnded).length,
    missingVerificationObjects: rows.filter((row) => row.verificationStatus === null).length,
    overdue: rows.filter((row) => row.reviewDueDate !== null && row.reviewDueDate < nowIso).length,
    dueWithin14Days: rows.filter((row) => row.reviewDueDate !== null && row.reviewDueDate >= nowIso && row.reviewDueDate <= dueSoonIso).length,
    currentFare: rows.filter((row) => row.currentFare !== null).length,
    noFare: rows.filter((row) => row.currentFare === null).length,
    selfTransferPrimary: rows.filter((row) => row.currentFareKind === 'self-transfer').length,
    cleanPrimary: rows.filter((row) => row.currentFareKind === 'clean').length,
    monetisedHandoff: rows.filter((row) => row.bookingHandoffType !== null).length,
    nonMonetisedFallback: rows.filter((row) => row.bookingHandoffType === null).length,
    trafficReady: rows.filter((row) => row.commercialReadiness === 'TRAFFIC_READY').length,
    trafficReadyNonMonetised: rows.filter((row) => row.commercialReadiness === 'TRAFFIC_READY_NON_MONETISED').length,
    fareGap: rows.filter((row) => row.commercialReadiness === 'FARE_GAP').length,
    evidenceGap: rows.filter((row) => row.commercialReadiness === 'EVIDENCE_GAP').length,
    hold: rows.filter((row) => row.commercialReadiness === 'HOLD').length,
  };
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
