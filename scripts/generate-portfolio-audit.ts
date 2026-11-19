import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPortfolioAudit, summarizePortfolioAudit, validatePortfolioData } from '../lib/portfolio-data-quality';
import { renderPortfolioAuditReport } from '../lib/portfolio-audit-report';
import { isTripComAffiliatePaused } from '../lib/tripcom-affiliate-pause';
import { gscRoutePerformancePeriods, gscRoutePerformanceSettledDate } from '../data/gsc-route-performance-2026-09-29';

const auditDate = process.argv[2] ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(auditDate) || !Number.isFinite(Date.parse(`${auditDate}T00:00:00Z`)) || new Date(`${auditDate}T00:00:00Z`).toISOString().slice(0, 10) !== auditDate) throw new Error('Audit date must be a real YYYY-MM-DD date.');
const routes = buildPortfolioAudit(auditDate);
const payload = {
  generatedAt: new Date().toISOString(),
  configuration: { tripComAffiliatePaused: isTripComAffiliatePaused(), source: 'local process environment, not Production inspection' },
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
      stalenessHandling: 'Requires programme eligibility, an account-generated URL, verified exact-airport landing and current dates; never publish a link whose outbound date has passed.',
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

const markdown = renderPortfolioAuditReport(routes, auditDate, {
  settledThrough: gscRoutePerformanceSettledDate,
  periods: gscRoutePerformancePeriods,
}, isTripComAffiliatePaused());
const reportOutput = resolve(process.cwd(), `docs/project-control/commercial-completeness-${auditDate}.md`);
writeFileSync(reportOutput, markdown, 'utf8');
console.log(reportOutput);
