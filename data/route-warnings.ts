export type RouteWarningSeverity = 'info' | 'caution' | 'critical';
export type RouteWarningStatus = 'active' | 'resolved';

export interface RouteWarning {
  id: string;
  routeSlug: string;
  severity: RouteWarningSeverity;
  status: RouteWarningStatus;
  /** ISO date. Only set when a real dated trigger exists (e.g. an announced withdrawal date) — omit rather than invent one for a standing operational characteristic. */
  startDate?: string;
  title: string;
  body: string;
}

/**
 * Append-only warning log per route. Never delete a resolved warning —
 * flip status to 'resolved' so the history stays visible. Only add a
 * warning here for something already stated as fact elsewhere in the
 * codebase (route intro/bookingWindowNote, airport practical notes) —
 * this file restructures that prose, it doesn't invent new claims.
 */
export const routeWarnings: RouteWarning[] = [
  {
    id: 'lba-isb-unstable-direct-claims',
    routeSlug: 'leeds-bradford-islamabad',
    severity: 'critical',
    status: 'active',
    title: 'Direct Leeds Bradford to Islamabad claims have repeatedly failed to materialise',
    body:
      'A 2025 PIA announcement and an earlier start-up airline both failed to establish a stable, ongoing direct schedule. The start-up collapsed under a CAA investigation after cancelling booked passengers. Verify any "direct from Leeds Bradford" claim directly with the airline\'s own booking system before committing to it.',
  },
  // NOTE: the Manchester–Delhi and Manchester–Mumbai IndiGo withdrawal is
  // deliberately NOT duplicated here — it's already modelled authoritatively
  // by Route.directServiceEndDate/directServiceEndNote in data/routes.ts,
  // which renders its own dedicated banner on those route pages. Adding a
  // second hand-authored copy here would risk the two drifting out of sync
  // (e.g. if the date changes) and shows a redundant duplicate banner today.
  {
    id: 'man-khi-frequency-settling',
    routeSlug: 'manchester-karachi',
    severity: 'caution',
    status: 'active',
    title: 'Weekly frequency still settling after PIA\'s UK network expansion',
    body:
      'PIA\'s UK network has expanded significantly through 2025 and 2026 after a long suspension, and frequency is still settling. Confirm the current weekly schedule before assuming daily availability.',
  },
  {
    id: 'lgw-amd-reduced-frequency',
    routeSlug: 'london-gatwick-ahmedabad',
    severity: 'info',
    status: 'active',
    title: 'Runs 3 times a week, not daily',
    body:
      'This is a reduced-frequency route rather than a daily one. Confirm your travel dates align with an active flight day before booking.',
  },
  {
    id: 'lgw-atq-reduced-frequency',
    routeSlug: 'london-gatwick-amritsar',
    severity: 'info',
    status: 'active',
    title: 'Runs 3 times a week, not daily',
    body:
      'Like the Birmingham service, this runs 3 times a week rather than daily. Confirm the specific flight day before booking, and compare both Gatwick and Birmingham schedules for your travel dates.',
  },
  {
    id: 'bhx-atq-reduced-frequency',
    routeSlug: 'birmingham-amritsar',
    severity: 'info',
    status: 'active',
    title: 'Runs 3 times a week, not daily',
    body:
      'This is a reduced-frequency scheduled service. Confirm your travel dates fall on an active flight day before booking, and have a Delhi or Gatwick-connecting fallback priced as backup for off-schedule dates.',
  },
];

export function getWarningsByRoute(routeSlug: string) {
  return routeWarnings.filter((w) => w.routeSlug === routeSlug);
}

export function getActiveWarningsByRoute(routeSlug: string) {
  return routeWarnings.filter((w) => w.routeSlug === routeSlug && w.status === 'active');
}
