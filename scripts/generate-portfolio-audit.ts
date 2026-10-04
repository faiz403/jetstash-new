import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPortfolioAudit, summarizePortfolioAudit, validatePortfolioData } from '../lib/portfolio-data-quality';

const auditDate = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const routes = buildPortfolioAudit(auditDate);
const payload = {
  generatedAt: `${auditDate}T12:00:00Z`,
  auditDate,
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
  })),
  routes,
};

const output = resolve(process.cwd(), `docs/project-control/portfolio-truth-audit-${auditDate}.json`);
writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(output);
