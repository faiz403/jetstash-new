export type RouteTimelineEventType =
  | 'service-launched'
  | 'service-ended'
  | 'frequency-change'
  | 'withdrawal-announced';

export interface RouteTimelineEvent {
  id: string;
  routeSlug: string;
  /** ISO date. Where the source only gives a month/year, use the 1st of that month — the title/description always states the real precision. */
  date: string;
  type: RouteTimelineEventType;
  title: string;
  description: string;
}

/**
 * Append-only log of real, dated changes to specific routes — this is what
 * lets a route page describe its actual history rather than only its
 * current state. Only add an entry here once it's a real, sourced fact;
 * never backfill a plausible-sounding one to fill a gap. See README's data
 * model conventions section.
 */
export const routeTimelineEvents: RouteTimelineEvent[] = [
  {
    id: 'man-del-2025-launch',
    routeSlug: 'manchester-delhi',
    date: '2025-11-01',
    type: 'service-launched',
    title: 'IndiGo launches non-stop Manchester–Delhi (November 2025)',
    description:
      'The first non-stop Manchester–Delhi service in 25 years, flown on a two-class Boeing 787-9 leased from Norse Atlantic Airways.',
  },
  {
    id: 'man-del-2026-withdrawal',
    routeSlug: 'manchester-delhi',
    date: '2026-09-01',
    type: 'withdrawal-announced',
    title: 'IndiGo withdrawal from Manchester takes effect 1 September 2026',
    description:
      'IndiGo has announced it will withdraw from Manchester entirely from this date, ending both the Delhi and Mumbai direct services. Frequency was already reduced once before this announcement.',
  },
  {
    id: 'man-bom-2025-launch',
    routeSlug: 'manchester-mumbai',
    date: '2025-07-01',
    type: 'service-launched',
    title: "IndiGo launches Manchester–Mumbai — the airline's first long-haul route (July 2025)",
    description:
      "IndiGo's Mumbai–Manchester service was the airline's first ever long-haul route and remains the only non-stop link between Manchester and Mumbai.",
  },
  {
    id: 'man-bom-2026-withdrawal',
    routeSlug: 'manchester-mumbai',
    date: '2026-09-01',
    type: 'withdrawal-announced',
    title: 'IndiGo withdrawal from Manchester takes effect 1 September 2026',
    description:
      'IndiGo has announced it will withdraw from Manchester entirely from this date, ending both the Mumbai and Delhi direct services.',
  },
  {
    id: 'man-khi-2025-26-expansion',
    routeSlug: 'manchester-karachi',
    date: '2025-06-01',
    type: 'frequency-change',
    title: "PIA's UK network expands through 2025–26 after a long suspension",
    description:
      'PIA significantly expanded its UK network through 2025–26 after a long suspension, with frequency on this route still settling — confirm the current weekly schedule before assuming daily availability.',
  },
];

export function getTimelineByRoute(routeSlug: string) {
  return routeTimelineEvents
    .filter((e) => e.routeSlug === routeSlug)
    .sort((a, b) => a.date.localeCompare(b.date));
}
