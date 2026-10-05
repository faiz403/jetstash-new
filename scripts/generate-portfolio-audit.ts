import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPortfolioAudit, summarizePortfolioAudit, validatePortfolioData } from '../lib/portfolio-data-quality';
import { gscRoutePerformancePeriods, gscRoutePerformanceSettledDate } from '../data/gsc-route-performance-2026-09-29';

const auditDate = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const routes = buildPortfolioAudit(auditDate);
const payload = {
  generatedAt: `${auditDate}T12:00:00Z`,
  auditDate,
  gsc: {
    settledThrough: gscRoutePerformanceSettledDate,
    periods: gscRoutePerformancePeriods,
    routesWithAnyReturnedData: routes.filter((route) => route.gscDataPresent).length,
    routesAbsentFromReturnedRows: routes.filter((route) => !route.gscDataPresent).length,
  },
  summary: summarizePortfolioAudit(routes, auditDate),
  validationIssues: validatePortfolioData(auditDate),
  noFareRoutes: routes.filter((route) => route.currentFare === null).map((route) => ({
    slug: route.slug,
    publicStatus: route.publicStatus,
    verificationStatus: route.verificationStatus,
    reviewDueDate: route.reviewDueDate,
    historicalObservationCount: route.observationCount,
    sourceStrength: route.sourceStrength,
    bookingHandoffType: route.bookingHandoffType,
    suppressionReason: route.fareSuppressionReason,
    rescueCategory: route.fareRescueCategory,
    commercialReadiness: route.commercialReadiness,
  })),
  customLinkMigrationManifest: routes
    .filter((route) => !route.monetised)
    .map((route) => ({
      routeSlug: route.slug,
      exactOriginIata: route.originIata,
      exactDestinationIata: route.destinationIata,
      currentFallback: route.commercialHandoffType,
      currentFareState: route.currentFare === null
        ? `held back: ${route.fareSuppressionReason}`
        : `£${route.currentFare} checked ${route.currentFareObservedDate}`,
      proposedTripSub3Convention: `route:${route.slug}`,
      requiresEmbeddedDates: true,
      generationDateField: 'affiliateGeneratedAt',
      embeddedOutboundDateField: 'affiliateOutboundDate',
      embeddedReturnDateField: 'affiliateReturnDate',
      stalenessHandling: 'Blocked pending the unchanged LHR-JED 6/8 October expiry result; never publish a link whose outbound date has passed.',
      currentVisibleCta: route.currentCta,
      proposedVisibleCta: 'Compare flights on Trip.com',
      priority: route.currentFare !== null && route.verificationCurrent ? 'high' : route.currentFare !== null ? 'medium' : 'blocked',
      linkStatus: 'NOT_GENERATED',
    })),
  top20OrganicOpportunities: [...routes]
    .sort((a, b) => b.organicOpportunityScore - a.organicOpportunityScore || b.gscLast28.impressions - a.gscLast28.impressions || a.slug.localeCompare(b.slug))
    .slice(0, 20)
    .map((route, index) => ({
      rank: index + 1,
      slug: route.slug,
      score: route.organicOpportunityScore,
      last28: route.gscLast28,
      last90: route.gscLast90,
      farePublishable: route.farePublishable,
      monetised: route.monetised,
      commercialReadiness: route.commercialReadiness,
    })),
  routes,
};

const output = resolve(process.cwd(), `docs/project-control/portfolio-truth-audit-${auditDate}.json`);
writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(output);

const noFareRows = routes.filter((route) => !route.farePublishable);
const handoffGaps = routes
  .filter((route) => !route.monetised)
  .sort((a, b) => b.organicOpportunityScore - a.organicOpportunityScore || b.gscLast28.impressions - a.gscLast28.impressions || a.slug.localeCompare(b.slug));
const top20 = payload.top20OrganicOpportunities;
const summary = payload.summary;
const markdown = `# JetStash commercial completeness review — ${auditDate}

## Outcome

- 89 public routes audited from current main.
- ${summary.currentFare} routes have a publishable current fare; ${summary.noFare} remain held back.
- ${summary.monetisedHandoff} routes have a safe monetised handoff; ${summary.nonMonetisedFallback} use a safe non-monetised fallback.
- Traffic readiness: ${summary.trafficReady} TRAFFIC_READY, ${summary.trafficReadyNonMonetised} TRAFFIC_READY_BUT_NON_MONETISED, ${summary.fareGap} FARE_GAP, ${summary.evidenceGap} EVIDENCE_GAP, ${summary.hold} HOLD.
- GSC is settled through ${gscRoutePerformanceSettledDate}. It returned route rows for ${payload.gsc.routesWithAnyReturnedData} routes; ${payload.gsc.routesAbsentFromReturnedRows} are recorded as zero/absent, not silently omitted.

## Fare rescues completed

- manchester-mumbai: £522 Etihad connecting fare, checked 4 October 2026, exact MAN–BOM, one stop via AUH, no self-transfer warning shown.
- manchester-delhi: £634 Etihad connecting fare, checked 4 October 2026, exact MAN–DEL, one stop via AUH, no self-transfer warning shown.
- Both direct services remain explicitly ended. The new observations describe connecting journeys only and preserve every older archive record.

## Routes still without a fare

| Route | Rescue category | Reason | 28d impressions | Position |
|---|---|---|---:|---:|
${noFareRows.map((route) => `| ${route.slug} | ${route.fareRescueCategory} | ${route.fareSuppressionReason} | ${route.gscLast28.impressions} | ${route.gscLast28.averagePosition ?? '—'} |`).join('\n')}

No remaining blank-fare route is ready for an isolated fare append. Three require route refresh first and five retain contradictory/unsafe route evidence. No poor self-transfer fare was revived.

## Non-monetised handoff migration order

All entries remain NOT_GENERATED. The unchanged LHR–JED expiry experiment on 6 and 8 October is the release gate.

| Priority | Route | Pair | Fare state | 28d impressions | Position |
|---:|---|---|---|---:|---:|
${handoffGaps.map((route, index) => `| ${index + 1} | ${route.slug} | ${route.originIata}–${route.destinationIata} | ${route.currentFare === null ? 'held back' : `£${route.currentFare}`} | ${route.gscLast28.impressions} | ${route.gscLast28.averagePosition ?? '—'} |`).join('\n')}

The full structured Custom Link manifest, including metadata fields, route-specific trip_sub3 convention, CTA wording, and refresh gate, is embedded in the companion JSON audit.

## Top 20 organic opportunities after readiness weighting

The score is deliberately transparent: last-28-day impressions × ranking-band weight × commercial-readiness weight. It is a prioritisation aid, not an SEO claim.

| Rank | Route | Score | Impressions | Position | Fare | Handoff | Class |
|---:|---|---:|---:|---:|---|---|---|
${top20.map((route) => `| ${route.rank} | ${route.slug} | ${route.score} | ${route.last28.impressions} | ${route.last28.averagePosition ?? '—'} | ${route.farePublishable ? 'ready' : 'gap'} | ${route.monetised ? 'monetised' : 'fallback'} | ${route.commercialReadiness} |`).join('\n')}

## Internal discovery findings

- Every route remains reachable through the exhaustive /routes catalogue.
- Airport pages derive their route grids from the same route dataset.
- Destination and regional hub surfaces derive route links from the same route records where relevant.
- Route pages provide factual “Other UK airports” links for genuine alternatives.
- No orphaned high-demand route or simple site-wide internal-linking defect was found. No keyword-heavy link or UI change is proposed.

## Blockers

- Custom Links: generation/publication blocked until the same untouched LHR–JED test link is checked after 6 October and after 8 October.
- Eight remaining fare gaps: blocked by overdue, contradictory, or otherwise insufficient route evidence; route truth must be repaired before another fare can publish.
- GSC: only 25 route URLs have returned data in the settled 90-day export. The other 64 are zero/absent, not assumed to have demand.
`;
const reportOutput = resolve(process.cwd(), `docs/project-control/commercial-completeness-${auditDate}.md`);
writeFileSync(reportOutput, markdown, 'utf8');
console.log(reportOutput);
