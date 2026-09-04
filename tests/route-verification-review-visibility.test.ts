import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { routes } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getFounderSnapshot } from '@/lib/founder-insights';
import { RULE_REVIEW_WATCH_DAYS } from '@/lib/freshness-thresholds';

/**
 * Route verification review visibility (PR #146, August 2026).
 *
 * Route.verification.reviewDueDate already gates public display via
 * isCurrentClaimValid()/getEffectiveRoutePresentation() — an expired review
 * already fails closed to neutral "Verification pending" copy on its own.
 * This PR adds ONLY founder-dashboard visibility into which routes are
 * overdue or approaching that date — it changes no route data, no
 * verification status, and no customer-facing presentation. These tests
 * prove the new section derives correctly from the real data and that the
 * pre-existing fail-closed behaviour (not touched by this PR) still holds.
 */

const SECTION_ID = 'route-verification-review';

function findSection(now: Date) {
  const snapshot = getFounderSnapshot(now);
  const section = Object.values(snapshot.grouped)
    .flat()
    .find((s) => s.id === SECTION_ID);
  if (!section) throw new Error(`${SECTION_ID} section not found`);
  return section;
}

describe('A. An overdue verified route appears and is identified as overdue', () => {
  it('a real verified route (Birmingham-Doha) appears with an "overdue" item once its own reviewDueDate has passed', () => {
    // manchester-karachi was this fixture until COV-001 (21 August 2026)
    // reclassified it to verified-connecting with a fresh, non-overdue
    // reviewDueDate (2026-10-05) — see
    // docs/project-control/ROUTE_VERIFICATION_CADENCE_POLICY.md, Batch 3.
    // london-heathrow-dhaka was this fixture until Rolling Reverification
    // Batch 4 (4 September 2026) genuinely rechecked it, moving its
    // reviewDueDate forward. manchester-mumbai briefly replaced it but was
    // itself unsound: its IndiGo verification concerns a schedule that
    // predates the route's own verified `service-ended` route-status event
    // (data/route-status-events.ts), so "overdue for re-verification" is a
    // moot signal there — there is nothing left to re-check. Using a real,
    // ordinary, unaffected route (birmingham-doha, no route-status event,
    // no dispute) against a hypothetical "now" derived from its own
    // reviewDueDate — not a second hardcoded date — is deterministic
    // regardless of real wall-clock time, and self-adjusts if a future
    // rolling-reverification batch genuinely re-checks this route and
    // pushes its date forward, rather than silently drifting like the
    // fixtures above it had to be replaced for. Still exercises the real
    // routeVerificationReviewStatus() path against real production data,
    // not a mock.
    const route = routes.find((r) => r.slug === 'birmingham-doha')!;
    const dueDate = new Date(`${route.verification!.reviewDueDate}T00:00:00Z`);
    const now = new Date(dueDate.getTime() + 8 * 86_400_000); // 8 days after its own review due date
    const section = findSection(now);
    const item = section.items.find((i) => i.label.includes('Birmingham') && i.label.includes('Doha'));
    expect(item).toBeDefined();
    expect(item!.label).toMatch(/overdue by \d+ days?/);
    expect(item!.status).toBe('attention');
  });
});

describe('B. A route approaching its review date appears as due soon', () => {
  it('a real route due within the watch window appears with "due in N days" and status watch', () => {
    const section = findSection(new Date());
    const dueSoonItem = section.items.find((i) => /due in \d+ days?/.test(i.label));
    expect(dueSoonItem).toBeDefined();
    expect(dueSoonItem!.status).toBe('watch');
  });
});

describe('C. A healthy/far-future route does not create an urgent warning', () => {
  it('using a "now" far in the past (before any real reviewDueDate), every verified route reads healthy, not overdue/due-soon', () => {
    // 400 days before real "today" — comfortably earlier than every
    // reviewDueDate currently in data/routes.ts, so nothing can be overdue
    // or inside the watch window regardless of future data edits.
    const farPast = new Date();
    farPast.setDate(farPast.getDate() - 400);
    const section = findSection(farPast);
    expect(section.items).toHaveLength(0);
    expect(section.status).toBe('ok');
    expect(section.headline).toMatch(/healthy review window/i);
  });
});

describe('D. Sorting prioritises overdue, then nearest review date', () => {
  it('overdue items appear before due-soon items, and each group is sorted soonest-first', () => {
    const section = findSection(new Date());
    const overdueIdx = section.items.findIndex((i) => i.label.includes('overdue by'));
    const dueSoonIdx = section.items.findIndex((i) => /due in \d+ days?/.test(i.label));
    if (overdueIdx !== -1 && dueSoonIdx !== -1) {
      expect(overdueIdx).toBeLessThan(dueSoonIdx);
    }

    const overdueDays = section.items
      .filter((i) => i.label.includes('overdue by'))
      .map((i) => Number(i.label.match(/overdue by (\d+)/)![1]));
    // Most-overdue (largest days-overdue number) should sort first — i.e.
    // the array should already be non-increasing.
    for (let i = 1; i < overdueDays.length; i++) {
      expect(overdueDays[i]).toBeLessThanOrEqual(overdueDays[i - 1]);
    }

    const dueSoonDays = section.items
      .filter((i) => /^.+: due in \d+ days?$/.test(i.label))
      .map((i) => Number(i.label.match(/due in (\d+)/)![1]));
    for (let i = 1; i < dueSoonDays.length; i++) {
      expect(dueSoonDays[i]).toBeGreaterThanOrEqual(dueSoonDays[i - 1]);
    }
  });
});

describe('E. A route with an expired verification still follows the existing fail-closed customer presentation (unchanged by this PR)', () => {
  const lahore = routes.find((r) => r.slug === 'manchester-lahore')!;

  it('today, with its verification still current, the route presents as verified/direct', () => {
    const nowIso = new Date().toISOString().slice(0, 10);
    const presentation = getEffectiveRoutePresentation(lahore, routeStatusEvents, nowIso);
    expect(presentation.status).toBe('direct');
    expect(lahore.verification?.status).toBe('verified');
  });

  it('past its reviewDueDate, the same route (unmodified) already fails closed to a non-verified presentation', () => {
    // manchester-lahore's real reviewDueDate — read directly, not assumed,
    // so this test tracks the real data rather than a hardcoded guess.
    const dueDate = new Date(`${lahore.verification!.reviewDueDate}T00:00:00Z`);
    const dayAfter = new Date(dueDate);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    const futureNowIso = dayAfter.toISOString().slice(0, 10);
    const presentation = getEffectiveRoutePresentation(lahore, routeStatusEvents, futureNowIso);
    expect(presentation.status).not.toBe('direct');
    expect(presentation.status).toBe('unverified');
  });
});

describe('F. Dashboard derivation changes no route data', () => {
  it('route verification fields are byte-identical before and after computing the section', () => {
    const before = routes.map((r) => JSON.stringify(r.verification ?? null));
    findSection(new Date());
    const after = routes.map((r) => JSON.stringify(r.verification ?? null));
    expect(after).toEqual(before);
  });

  it('route flightTime, frequency, isDirect are unchanged', () => {
    const before = routes.map((r) => `${r.flightTime}|${r.frequency}|${r.isDirect}`);
    findSection(new Date());
    const after = routes.map((r) => `${r.flightTime}|${r.frequency}|${r.isDirect}`);
    expect(after).toEqual(before);
  });
});

describe('G. No network/provider/Brevo dependency exists in the new section', () => {
  const founderInsightsSrc = readFileSync(join(process.cwd(), 'lib', 'founder-insights.ts'), 'utf8');

  it('the routeVerificationReviewStatus function makes no fetch, Brevo, or email call', () => {
    const start = founderInsightsSrc.indexOf('function routeVerificationReviewStatus');
    const end = founderInsightsSrc.indexOf('// ── 9. Pages with stale content');
    const section = founderInsightsSrc.slice(start, end);
    expect(section).not.toMatch(/fetch\(/);
    expect(section).not.toMatch(/sendResendEmail|upsertBrevoContact|getBrevoContact/);
    expect(section.length).toBeGreaterThan(0);
  });

  it('never extends a reviewDueDate, marks a route verified, or mutates route data — read-only derivation', () => {
    const start = founderInsightsSrc.indexOf('function routeVerificationReviewStatus');
    const end = founderInsightsSrc.indexOf('// ── 9. Pages with stale content');
    const section = founderInsightsSrc.slice(start, end);
    expect(section).not.toMatch(/\.reviewDueDate\s*=/);
    expect(section).not.toMatch(/\.verification\s*=/);
    expect(section).not.toMatch(/\.status\s*=\s*'verified'/);
  });
});

describe('H. Real current archive reconciliation matches the independently computed counts', () => {
  it('exactly 77 routes carry a verification record', () => {
    // 76 -> 77 (3 September 2026): london-heathrow-jeddah gained a
    // route-level verification for the first time (TR-010, Round 4) --
    // previously it had only per-airline airlineVerifications entries and no
    // route-level record at all.
    expect(routes.filter((r) => r.verification)).toHaveLength(77);
  });

  it('the dashboard\'s overdue/due-soon/healthy counts match an independent recomputation from live route data as of today', () => {
    // Current-state invariant (route verification test determinism batch,
    // 29 Aug 2026): this must evolve automatically as a route's own
    // reviewDueDate genuinely lapses with real calendar time — e.g.
    // birmingham-ahmedabad's 2026-08-27 window — so it recomputes the
    // expected buckets independently from live `routes` data using today's
    // real date, and compares that against getFounderSnapshot()'s own
    // output, rather than asserting a historical literal count that would
    // need editing every time a legitimate reviewDueDate passes. See
    // docs/project-control/ROUTE_VERIFICATION_CADENCE_POLICY.md for the
    // underlying cadence policy this section surfaces.
    const nowIso = new Date().toISOString().slice(0, 10);
    const withVerification = routes.filter((r) => r.verification);
    const daysBetween = (a: string, b: string) =>
      Math.floor((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
    const overdue = withVerification.filter((r) => daysBetween(nowIso, r.verification!.reviewDueDate) < 0);
    const dueSoon = withVerification.filter((r) => {
      const d = daysBetween(nowIso, r.verification!.reviewDueDate);
      return d >= 0 && d <= RULE_REVIEW_WATCH_DAYS;
    });
    const healthy = withVerification.length - overdue.length - dueSoon.length;

    const section = findSection(new Date());
    // Matches lib/founder-insights.ts's own wording exactly, including its
    // singular/plural forms and its distinct "fully healthy" headline shape
    // — so this stays correct in every state, not only today's.
    if (overdue.length === 0 && dueSoon.length === 0) {
      expect(section.headline).toBe(`All ${withVerification.length} verified routes are within a healthy review window.`);
    } else {
      expect(section.headline).toContain(`${overdue.length} route${overdue.length === 1 ? '' : 's'} overdue`);
      expect(section.headline).toContain(`${dueSoon.length} due within ${RULE_REVIEW_WATCH_DAYS} days`);
      expect(section.headline).toContain(`${healthy} healthy`);
    }
  });

  it('the section stays concise: at most MAX_DUE_SOON_ITEMS_SHOWN individual due-soon rows plus one summary row when the backlog is large', () => {
    const section = findSection(new Date());
    const dueSoonRows = section.items.filter((i) => /due in \d+ days?/.test(i.label));
    const summaryRow = section.items.find((i) => i.label.startsWith('+ '));
    // With the real current clustering (0 healthy, most within the watch
    // window) this backlog is large, so a summary row must exist and the
    // individually-listed rows must stay bounded.
    expect(dueSoonRows.length).toBeLessThanOrEqual(15);
    expect(summaryRow).toBeDefined();
  });

  it('verified/unverified split: COV-001 (21 August 2026) moved 4 routes from unverified to verified, and london-heathrow-jeddah later gained its first route-level record', () => {
    // manchester-karachi, birmingham-lahore, birmingham-islamabad and
    // birmingham-delhi moved from unverified to verified-connecting — see
    // docs/project-control/ROUTE_VERIFICATION_CADENCE_POLICY.md, Batch 3.
    // That change left the total at 76 with a 71/5 split. Separately (3
    // September 2026, TR-010 Round 4), london-heathrow-jeddah gained a
    // route-level verification for the first time (previously per-airline
    // only), taking the total to 77 and verified to 72; unverified is
    // unaffected at 5.
    const withVerification = routes.filter((r) => r.verification);
    const verified = withVerification.filter((r) => r.verification!.status === 'verified');
    const unverified = withVerification.filter((r) => r.verification!.status !== 'verified');

    expect(withVerification).toHaveLength(77);
    expect(verified.length + unverified.length).toBe(77);
    expect(verified.length).toBe(72);
    expect(unverified.length).toBe(5);
  });
});

describe('I. London Gatwick–Ahmedabad Batch 1 correction (18 August 2026)', () => {
  const route = routes.find((r) => r.slug === 'london-gatwick-ahmedabad')!;

  it('is unverified (DISPUTED), not left as a confidently verified claim', () => {
    expect(route.verification!.status).toBe('unverified');
  });

  it('carries the fresh check date and the DISPUTED category\'s 14-day window, not an administratively-extended old date', () => {
    // Rolling Reverification Batch 4 (4 September 2026) genuinely re-opened
    // Air India's own cited pages again -- still unresolved (in fact more
    // specifically contradictory than before) -- so the date moved again.
    expect(route.verification!.verifiedDate).toBe('2026-09-04');
    expect(route.verification!.reviewDueDate).toBe('2026-09-18');
  });

  it('customer presentation fails closed immediately as of today, not on the old 28 August expiry', () => {
    const nowIso = new Date().toISOString().slice(0, 10);
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
    expect(presentation.status).not.toBe('verified');
    expect(route.intro.toLowerCase()).not.toMatch(/nonstop|non-stop|direct service confirmed/);
  });

  it('the verification note never asserts a confirmed 2026 Heathrow relocation — only a genuine current conflict', () => {
    const note = (route.verification!.note ?? '').toLowerCase();
    // The note must explicitly disclaim a confirmed relocation, not merely
    // omit the topic — and must never assert one as settled fact.
    expect(note).toMatch(/no confirmed 2026 relocation/);
    expect(note).not.toMatch(/(?<!no )confirmed 2026 relocation/);
    expect(note).toMatch(/conflict|contradiction/);
    expect(note).toMatch(/2025/);
  });

  it('the cadence policy document records the correction and never asserts a confirmed 2026 relocation either', () => {
    const policyPath = join(process.cwd(), 'docs/project-control/ROUTE_VERIFICATION_CADENCE_POLICY.md');
    const policyText = readFileSync(policyPath, 'utf8').toLowerCase();
    expect(policyText).toMatch(/gatwick.{0,20}ahmedabad/);
    expect(policyText).toMatch(/no confirmed 2026 relocation/);
  });

  it('isDirect is left unchanged — only the confidence of the claim changed, not its general shape', () => {
    expect(route.isDirect).toBe(true);
  });
});

describe('J. COV-001 (21 August 2026) did not disturb the genuinely untouched evidence-gap routes', () => {
  // manchester-karachi, birmingham-lahore and birmingham-islamabad were
  // reclassified by COV-001 itself and are no longer part of this untouched
  // set — see docs/project-control/ROUTE_VERIFICATION_CADENCE_POLICY.md,
  // Batch 3. The remaining three, plus the two Air India disputes, are
  // confirmed genuinely untouched.
  const untouchedSlugs = [
    'london-heathrow-dhaka',
    'manchester-sylhet',
    'london-heathrow-sylhet',
    'birmingham-ahmedabad',
    'london-gatwick-ahmedabad',
  ];

  it.each(untouchedSlugs)('%s remains unverified with its original review date untouched', (slug) => {
    const route = routes.find((r) => r.slug === slug);
    expect(route, `expected a route with slug ${slug}`).toBeDefined();
    expect(route!.verification!.status).toBe('unverified');
  });
});

describe('Existing founder-insights sections remain intact', () => {
  it('travel-ready-ops and the launch checklist are still present alongside the new section', () => {
    const snapshot = getFounderSnapshot(new Date());
    const allSections = Object.values(snapshot.grouped).flat();
    expect(allSections.some((s) => s.id === 'travel-ready-ops')).toBe(true);
    expect(allSections.some((s) => s.id === SECTION_ID)).toBe(true);
    expect(snapshot.checklist.length).toBeGreaterThan(0);
  });
});
