import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatRouteStatusDate, getRouteStatusCopy, type ResolvedServiceNotice } from '@/lib/route-status-copy';
import { mapViewModelToFlagshipCopy, buildFlagshipStatusCopy } from '@/lib/flagship-status-copy';
import { getRouteBySlug, getRouteStatus, type Route, type RouteStatusResult } from '@/data/routes';
import { routeStatusEvents, type RouteStatusEvent, type SourceRef } from '@/data/route-status-events';

/**
 * Hosted-acceptance correction — a single shared Route Status date
 * formatter (formatRouteStatusDate, exported from lib/route-status-copy.ts)
 * must be the ONLY place any customer-facing Route Status date is
 * rendered, so the route page's evidence panel and the homepage's evidence
 * copy can never drift into showing raw ISO on one surface and UK
 * long-form on the other.
 */

const FIXED_TODAY = '2026-07-23';
const ISO_DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;

function makeRoute(overrides: Partial<Route>): Route {
  return {
    slug: 'fixture-date-route',
    airportSlug: 'manchester',
    destinationSlug: 'lahore',
    flightTime: '8h direct',
    frequency: 'Daily direct',
    airlineSlugs: ['pia'],
    isDirect: true,
    intro: 'Fixture intro.',
    bookingWindowNote: 'Fixture booking window note.',
    peakPeriodIds: [],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<RouteStatusEvent> & Pick<RouteStatusEvent, 'type'>): RouteStatusEvent {
  const source: SourceRef = { publisher: 'Fixture Publisher', url: 'https://example.com/fixture', accessedAt: FIXED_TODAY };
  const base = {
    id: 'fixture-date-event',
    routeSlug: 'fixture-date-route',
    serviceId: 'fixture-date-service',
    scope: { kind: 'airline' as const, airlineSlug: 'pia' },
    headline: 'Fixture headline',
    explanation: 'Fixture explanation.',
    sources: [source],
    verifiedAt: FIXED_TODAY,
  };
  return { ...base, ...overrides } as RouteStatusEvent;
}

describe('formatRouteStatusDate — the single shared Route Status date formatter', () => {
  it('renders UK long-form dates from ISO input', () => {
    expect(formatRouteStatusDate('2026-07-23')).toBe('23 July 2026');
    expect(formatRouteStatusDate('2026-08-31')).toBe('31 August 2026');
    expect(formatRouteStatusDate('2026-01-05')).toBe('5 January 2026'); // single-digit day, no leading zero
    expect(formatRouteStatusDate('2026-12-01')).toBe('1 December 2026');
  });

  it('never returns a raw ISO-shaped string', () => {
    for (const iso of ['2026-07-23', '2026-08-31', '2026-01-01', '2027-12-31']) {
      expect(formatRouteStatusDate(iso)).not.toMatch(ISO_DATE_PATTERN);
    }
  });
});

describe('app/routes/[slug]/page.tsx uses the shared formatter for every date it renders', () => {
  const source = readFileSync(join(process.cwd(), 'app', 'routes', '[slug]', 'page.tsx'), 'utf-8');

  it('imports formatRouteStatusDate from the canonical Route Status library', () => {
    expect(source).toMatch(/formatRouteStatusDate/);
    expect(source).toMatch(/from '@\/lib\/route-status-copy'/);
  });

  it('never interpolates citation.accessedAt or notice.effectiveFrom raw — every occurrence is wrapped in formatRouteStatusDate(...)', () => {
    expect(source).not.toMatch(/\$\{citation\.accessedAt\}/);
    expect(source).not.toMatch(/\$\{notice\.effectiveFrom\}/);
    // Both citation-rendering paths, plus all three notice.effectiveFrom branches, must call the formatter.
    const calls = source.match(/formatRouteStatusDate\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(5);
  });

  it('does not introduce a second, private date formatter on this page (no local formatDate function)', () => {
    expect(source).not.toMatch(/function formatDate\(/);
  });
});

describe('the real Manchester–Mumbai withdrawal-announced route panel shows the checked date in UK long-form', () => {
  it('the resolved citation\'s accessedAt, run through the shared formatter, is exactly "23 July 2026" — matching the hosted-acceptance report', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    const result = getRouteStatus(route, routeStatusEvents, FIXED_TODAY)!;
    expect(result.status).toBe('withdrawal-announced');
    const viewModel = getRouteStatusCopy(route, result, routeStatusEvents, FIXED_TODAY);
    expect(viewModel.kind).toBe('withdrawal-announced');
    if (viewModel.kind !== 'withdrawal-announced') return;
    expect(viewModel.citations[0].accessedAt).toBe('2026-07-23'); // the stored ISO value is untouched
    expect(formatRouteStatusDate(viewModel.citations[0].accessedAt!)).toBe('23 July 2026'); // what the page must render
  });
});

describe('verified-direct, service-ended and status-reverification-pending notices never leak a raw ISO date once formatted', () => {
  function buildNotices(): ResolvedServiceNotice[] {
    const route = makeRoute({
      airlineSlugs: ['pia', 'emirates'],
      airlineVerifications: [{ airlineSlug: 'emirates', status: 'verified', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01', effectivePeriod: 'Current at access', supportedClaim: 'y' }],
    });

    const endedEvent = makeEvent({ id: 'ev-date-ended', type: 'service-ended', verifiedOccurrence: true, effectiveFrom: '2026-07-01', currentClaimValidBefore: '2027-01-01' });
    const endedResult: RouteStatusResult = {
      status: 'verified-direct',
      verifiedDirectBasis: [{ kind: 'airline', airlineSlug: 'emirates', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' }],
      serviceNotices: [{ airlineSlug: 'pia', kind: 'service-ended', effectiveFrom: '2026-07-01', drivingEventId: 'ev-date-ended' }],
    };
    const endedViewModel = getRouteStatusCopy(route, endedResult, [endedEvent], FIXED_TODAY);

    const boundaryEvent = makeEvent({ id: 'ev-date-boundary', type: 'withdrawal-announced', announcedAt: '2026-01-01', effectiveFrom: '2026-06-15', currentClaimValidBefore: '2026-06-15' });
    const boundaryResult: RouteStatusResult = {
      status: 'verified-direct',
      verifiedDirectBasis: [{ kind: 'airline', airlineSlug: 'emirates', sourceName: 'x', verifiedDate: FIXED_TODAY, reviewDueDate: '2027-01-01' }],
      serviceNotices: [{ airlineSlug: 'pia', kind: 'status-reverification-pending', effectiveFrom: '2026-06-15', drivingEventId: 'ev-date-boundary' }],
    };
    const boundaryViewModel = getRouteStatusCopy(route, boundaryResult, [boundaryEvent], FIXED_TODAY);

    const notices: ResolvedServiceNotice[] = [];
    if (endedViewModel.kind === 'verified-direct') notices.push(...endedViewModel.serviceNotices);
    if (boundaryViewModel.kind === 'verified-direct') notices.push(...boundaryViewModel.serviceNotices);
    return notices;
  }

  it('produces exactly a service-ended and a status-reverification-pending notice, each formattable to UK long-form with no ISO leakage', () => {
    const notices = buildNotices();
    expect(notices.map((n) => n.kind).sort()).toEqual(['service-ended', 'status-reverification-pending']);

    for (const notice of notices) {
      const formattedEffectiveFrom = formatRouteStatusDate(notice.effectiveFrom);
      expect(formattedEffectiveFrom).not.toMatch(ISO_DATE_PATTERN);
      expect(formattedEffectiveFrom).toMatch(/^\d{1,2} \w+ \d{4}$/);

      expect(notice.citations.length).toBeGreaterThan(0);
      for (const citation of notice.citations) {
        if (!citation.accessedAt) continue;
        const formattedAccessedAt = formatRouteStatusDate(citation.accessedAt);
        expect(formattedAccessedAt).not.toMatch(ISO_DATE_PATTERN);
      }
    }
  });

  it('the ended notice reads "1 July 2026" and the reverification-pending notice reads "15 June 2026"', () => {
    const notices = buildNotices();
    const ended = notices.find((n) => n.kind === 'service-ended')!;
    const boundary = notices.find((n) => n.kind === 'status-reverification-pending')!;
    expect(formatRouteStatusDate(ended.effectiveFrom)).toBe('1 July 2026');
    expect(formatRouteStatusDate(boundary.effectiveFrom)).toBe('15 June 2026');
  });
});

describe('the homepage evidence copy uses the identical shared formatter — no drift between surfaces', () => {
  it('mapViewModelToFlagshipCopy\'s evidenceDetail date and a direct formatRouteStatusDate call on the same ISO value produce byte-identical output', () => {
    const citationDate = '2026-07-23';
    const route = makeRoute({ verification: { status: 'verified', sourceName: 'x', sourceUrl: 'https://example.com', verifiedDate: citationDate, reviewDueDate: '2027-01-01' } });
    const result: RouteStatusResult = {
      status: 'verified-direct',
      verifiedDirectBasis: [{ kind: 'route', sourceName: 'x', sourceUrl: 'https://example.com', verifiedDate: citationDate, reviewDueDate: '2027-01-01' }],
      serviceNotices: [],
    };
    const viewModel = getRouteStatusCopy(route, result, [], FIXED_TODAY);
    expect(viewModel.kind).toBe('verified-direct');
    const copy = mapViewModelToFlagshipCopy(viewModel, ['Fixture Air']);
    expect(copy.evidenceDetail).toBe(`Current route evidence checked ${formatRouteStatusDate(citationDate)}.`);
    expect(copy.evidenceDetail).toContain('23 July 2026');
  });

  it('the real Manchester–Mumbai homepage copy and the real route-page citation format the same underlying ISO date identically', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    const result = getRouteStatus(route, routeStatusEvents, FIXED_TODAY)!;
    const viewModel = getRouteStatusCopy(route, result, routeStatusEvents, FIXED_TODAY);
    const flagshipCopy = buildFlagshipStatusCopy('manchester-mumbai', routeStatusEvents, FIXED_TODAY);

    expect(viewModel.kind).toBe('withdrawal-announced');
    if (viewModel.kind !== 'withdrawal-announced') return;
    const pageDate = formatRouteStatusDate(viewModel.citations[0].accessedAt!);
    expect(flagshipCopy.evidenceDetail).toContain(pageDate); // same formatter, same source date, same rendered text
  });
});

describe('no customer-visible Route Status copy contains a raw YYYY-MM-DD date', () => {
  it('sweeps every FlagshipStatusCopy field for the real corridor at several lifecycle points', () => {
    for (const [slug, nowIso] of [
      ['manchester-mumbai', FIXED_TODAY],
      ['manchester-mumbai', '2026-08-31'],
      ['manchester-delhi', FIXED_TODAY],
      ['manchester-delhi', '2026-08-31'],
    ] as const) {
      const copy = buildFlagshipStatusCopy(slug, routeStatusEvents, nowIso);
      for (const [field, value] of Object.entries(copy)) {
        expect(value, `${slug}@${nowIso}.${field}`).not.toMatch(ISO_DATE_PATTERN);
      }
    }
  });

  it('sweeps every resolved citation and notice date for the real corridor, formatted, for no ISO leakage', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi'] as const) {
      const route = getRouteBySlug(slug)!;
      const result = getRouteStatus(route, routeStatusEvents, FIXED_TODAY)!;
      const viewModel = getRouteStatusCopy(route, result, routeStatusEvents, FIXED_TODAY);
      if ('citations' in viewModel) {
        for (const citation of viewModel.citations) {
          if (citation.accessedAt) expect(formatRouteStatusDate(citation.accessedAt)).not.toMatch(ISO_DATE_PATTERN);
        }
      }
    }
  });
});
