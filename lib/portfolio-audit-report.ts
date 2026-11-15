import type { PortfolioRouteAuditRow } from './portfolio-data-quality';
import { summarizePortfolioAudit } from './portfolio-data-quality';

export interface AuditSearchSnapshot {
  settledThrough: string;
  periods: unknown;
}

const cell = (value: unknown) => String(value ?? 'not recorded').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');

/** Report observations from this run only. Historical exports are never presented as live demand. */
export function renderPortfolioAuditReport(rows: PortfolioRouteAuditRow[], auditDate: string, search: AuditSearchSnapshot, tripComPaused: boolean): string {
  const summary = summarizePortfolioAudit(rows, auditDate);
  const noFare = rows.filter((row) => !row.farePublishable);
  const nonMonetised = rows.filter((row) => !row.monetised);
  const soon = new Date(`${auditDate}T12:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 14);
  const reviews = rows.filter((row) => row.reviewDueDate && row.reviewDueDate <= soon.toISOString().slice(0, 10))
    .sort((a, b) => a.reviewDueDate!.localeCompare(b.reviewDueDate!) || a.slug.localeCompare(b.slug));
  const demand = rows.filter((row) => row.gscDataPresent)
    .sort((a, b) => b.organicOpportunityScore - a.organicOpportunityScore || a.slug.localeCompare(b.slug)).slice(0, 20);
  return `# JetStash commercial and maintenance review: ${auditDate}

## Evidence from this checkout

* ${summary.totalPublicRoutes} routes evaluated as of ${auditDate}.
* ${summary.currentFare} have a publishable fare; ${summary.noFare} have none under the current rules.
* ${summary.monetisedHandoff} have a configured monetised flight handoff; ${summary.nonMonetisedFallback} use a non-monetised fallback.
* Trip.com affiliate pause in this run: **${tripComPaused ? 'ON' : 'OFF'}**. This is the local process configuration, not an inspection of Vercel Production.
* ${summary.overdue} route-level reviews are overdue; ${summary.dueWithin14Days} are due within 14 days.
* Readiness: ${summary.trafficReady} TRAFFIC_READY, ${summary.trafficReadyNonMonetised} TRAFFIC_READY_NON_MONETISED, ${summary.fareGap} FARE_GAP, ${summary.evidenceGap} EVIDENCE_GAP, ${summary.hold} HOLD.

A configured handoff is not a booking, commission or proven income. This report makes no revenue or conversion forecast.

## Manual source-review queue

These rows identify work; generating the report does not re-verify any source or extend a review date. Review each source and record only the facts it actually supports.

| Route | Review due | Last check | Source to review |
| --- | --- | --- | --- |
${reviews.map((row) => `| ${cell(row.slug)} | ${cell(row.reviewDueDate)} | ${cell(row.verifiedDate)} | ${cell(row.verificationSourceUrl)} |`).join('\n') || '| None | | | |'}

## Routes without a publishable fare

| Route | Recovery category | Current reason | Historical checks |
| --- | --- | --- | ---: |
${noFare.map((row) => `| ${cell(row.slug)} | ${cell(row.fareRescueCategory)} | ${cell(row.fareSuppressionReason)} | ${row.observationCount} |`).join('\n') || '| None | | | |'}

Re-check route truth before collecting a fare for a route with insufficient evidence. Fares remain append-only and require an actual dated observation; automation must not invent, re-date or scrape them.

## Flight handoffs without a monetised path

| Route | Exact pair | Public service state | Fare available | Current action |
| --- | --- | --- | --- | --- |
${nonMonetised.map((row) => `| ${cell(row.slug)} | ${cell(row.originIata)} to ${cell(row.destinationIata)} | ${cell(row.publicStatus)} | ${row.farePublishable ? 'yes' : 'no'} | ${cell(row.currentCta)} |`).join('\n') || '| None | | | | |'}

${tripComPaused ? 'The pause is a programme/account dependency. It is not evidence that an old link needs recreating. Resolve the account terms or use a separately approved and verified provider.' : 'A missing link requires its own approved, account-generated URL and verified destination. A link must never be guessed or modified to manufacture coverage.'}

## Historical search evidence only

The bundled Search Console export is settled through **${search.settledThrough}**. Its original periods are recorded in the companion JSON. It is not a current traffic report. Rows were returned for ${rows.filter((row) => row.gscDataPresent).length} routes; ${rows.filter((row) => !row.gscDataPresent).length} routes are absent from that export. Absence is not proof of zero searches or zero customer demand.

The following ordering uses that historical export and this run's readiness weights. Refresh the source evidence before treating it as today's acquisition priority.

| Route | Historical impressions | Historical position | Readiness | Score |
| --- | ---: | ---: | --- | ---: |
${demand.map((row) => `| ${cell(row.slug)} | ${row.gscLast28.impressions} | ${cell(row.gscLast28.averagePosition)} | ${cell(row.commercialReadiness)} | ${row.organicOpportunityScore} |`).join('\n') || '| No returned rows | | | | |'}

## Verification boundary

This is an offline derivation from repository records and the declared process configuration. It does not fetch source pages, submit forms, follow affiliate links, query analytics accounts, check provider reports or make paid routing calls. Public wording, live booking availability, customer outcomes and actual income require separate evidence.
`;
}
