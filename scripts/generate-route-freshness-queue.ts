import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { routes } from '../data/routes';
import { airports } from '../data/airports';
import { destinations } from '../data/destinations';

const asOf = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const asOfDate = new Date(`${asOf}T00:00:00Z`);
const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
};
const due7 = addDays(asOfDate, 7);
const due14 = addDays(asOfDate, 14);

const rows = routes.map((route) => {
  const airport = airports.find((item) => item.slug === route.airportSlug);
  const destination = destinations.find((item) => item.slug === route.destinationSlug);
  const due = route.verification?.reviewDueDate ?? null;
  const bucket = !due ? 'needs-human-review' : due < asOf ? 'overdue' : due <= due7 ? 'due-within-7-days' : due <= due14 ? 'due-within-8-14-days' : 'scheduled';
  const ageDays = route.verification?.verifiedDate
    ? Math.max(0, Math.floor((asOfDate.getTime() - new Date(`${route.verification.verifiedDate}T00:00:00Z`).getTime()) / 86_400_000))
    : null;
  return {
    slug: route.slug,
    route: `${airport?.city ?? route.airportSlug} → ${destination?.city ?? route.destinationSlug}`,
    airportPair: `${airport?.code ?? '???'} → ${destination?.iataCode ?? '???'}`,
    verificationStatus: route.verification?.status ?? 'missing',
    verifiedDate: route.verification?.verifiedDate ?? null,
    reviewDueDate: due,
    currentEvidenceSource: route.verification?.sourceName ?? null,
    evidenceUrl: route.verification?.sourceUrl ?? null,
    standingClaims: {
      directness: route.isDirect ? 'direct option recorded' : 'connecting only recorded',
      frequency: route.frequency,
      flightTime: route.flightTime,
      operators: route.airlineSlugs,
    },
    ageDays,
    bucket,
    riskFlags: [
      route.verification?.status !== 'verified' ? 'status-not-verified' : null,
      route.isDirect ? 'directness-claim' : null,
      route.frequency ? 'frequency-claim' : null,
      ageDays !== null && ageDays > 60 ? 'old-evidence' : null,
    ].filter(Boolean),
  };
});

const priorityWeight = (row: (typeof rows)[number]) =>
  (row.bucket === 'overdue' ? 100 : row.bucket === 'due-within-7-days' ? 70 : row.bucket === 'due-within-8-14-days' ? 40 : 0)
  + (row.riskFlags.includes('status-not-verified') ? 30 : 0)
  + (row.riskFlags.includes('directness-claim') ? 20 : 0)
  + (row.riskFlags.includes('frequency-claim') ? 10 : 0)
  + Math.min(20, Math.floor((row.ageDays ?? 0) / 30));

const queue = rows.filter((row) => row.bucket !== 'scheduled').map((row) => ({ ...row, priorityScore: priorityWeight(row) })).sort((a, b) => b.priorityScore - a.priorityScore || a.reviewDueDate?.localeCompare(b.reviewDueDate ?? '') || a.slug.localeCompare(b.slug));
const summary = {
  asOf,
  overdue: queue.filter((row) => row.bucket === 'overdue').length,
  dueWithin7Days: queue.filter((row) => row.bucket === 'due-within-7-days').length,
  dueWithin8To14Days: queue.filter((row) => row.bucket === 'due-within-8-14-days').length,
  needsHumanReview: queue.filter((row) => row.bucket === 'needs-human-review').length,
  totalQueue: queue.length,
  policy: 'Queue generation never refreshes dates or changes public claims. A route moves forward only after fresh evidence is manually recorded and reviewed.',
};
const payload = { summary, queue };
const jsonPath = resolve(process.cwd(), `docs/project-control/route-freshness-queue-${asOf}.json`);
const markdownPath = resolve(process.cwd(), `docs/project-control/route-freshness-queue-${asOf}.md`);
const section = (bucket: string) => queue.filter((row) => row.bucket === bucket).map((row) => `| ${row.slug} | ${row.route} | ${row.verificationStatus} | ${row.verifiedDate ?? '—'} | ${row.reviewDueDate ?? '—'} | ${row.currentEvidenceSource ?? '—'} | ${row.priorityScore} |`).join('\n') || '| — | — | — | — | — | — | — |';
const markdown = `# JetStash route evidence freshness queue — ${asOf}\n\nGenerated read-only from current route data. This report does not refresh dates or alter claims.\n\n- Overdue: ${summary.overdue}\n- Due within 7 days: ${summary.dueWithin7Days}\n- Due within 8–14 days: ${summary.dueWithin8To14Days}\n- Needs human review: ${summary.needsHumanReview}\n- Total queue: ${summary.totalQueue}\n\n## Overdue\n\n| Slug | Route | Status | Verified | Due | Source | Priority |\n|---|---|---|---|---|---|---:|\n${section('overdue')}\n\n## Due within 7 days\n\n| Slug | Route | Status | Verified | Due | Source | Priority |\n|---|---|---|---|---|---|---:|\n${section('due-within-7-days')}\n\n## Due within 8–14 days\n\n| Slug | Route | Status | Verified | Due | Source | Priority |\n|---|---|---|---|---|---|---:|\n${section('due-within-8-14-days')}\n\n## Operating rule\n\n${summary.policy}\n`;
writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
writeFileSync(markdownPath, markdown, 'utf8');
console.log(jsonPath);
console.log(markdownPath);
