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
    title: 'IndiGo launches non-stop Manchester to Delhi (November 2025)',
    description:
      'The first non-stop Manchester to Delhi service in 25 years, flown on a two-class Boeing 787-9 leased from Norse Atlantic Airways.',
  },
  {
    id: 'man-del-2026-withdrawal',
    routeSlug: 'manchester-delhi',
    // The date this announcement was made (matches the Route Status ledger's
    // announcedAt in data/route-status-events.ts), not the future effective
    // date it names — a timeline records when a dated fact became known, and
    // an announced effective date is not itself proof of what happens on it.
    date: '2026-06-02',
    type: 'withdrawal-announced',
    title: 'IndiGo announces Manchester withdrawal, with effect from 31 August 2026',
    description:
      "IndiGo announced it will discontinue Manchester service, with effect from 31 August 2026 — affecting both the Delhi and Mumbai direct services. Described by IndiGo as temporary, with no resumption date given. Frequency was already reduced once before this announcement. See the route's current status above for whether this has taken effect.",
  },
  {
    id: 'man-bom-2025-launch',
    routeSlug: 'manchester-mumbai',
    date: '2025-07-01',
    type: 'service-launched',
    title: "IndiGo launches Manchester to Mumbai, the airline's first long-haul route (July 2025)",
    description:
      "IndiGo's Mumbai to Manchester service was the airline's first ever long-haul route and remains the only non-stop link between Manchester and Mumbai.",
  },
  {
    id: 'man-bom-2026-withdrawal',
    routeSlug: 'manchester-mumbai',
    // See man-del-2026-withdrawal's comment: this is the announcement date, not the future effective date.
    date: '2026-06-02',
    type: 'withdrawal-announced',
    title: 'IndiGo announces Manchester withdrawal, with effect from 31 August 2026',
    description:
      "IndiGo announced it will discontinue Manchester service, with effect from 31 August 2026 — affecting both the Mumbai and Delhi direct services. Described by IndiGo as temporary, with no resumption date given. See the route's current status above for whether this has taken effect.",
  },
  {
    id: 'man-khi-2025-26-expansion',
    routeSlug: 'manchester-karachi',
    date: '2025-06-01',
    type: 'frequency-change',
    title: "PIA's UK network expands through 2025 and 2026 after a long suspension",
    description:
      'PIA significantly expanded its UK network through 2025 and 2026 after a long suspension, and frequency on this route is still settling. Confirm the current weekly schedule before assuming daily availability.',
  },
];

export function getTimelineByRoute(routeSlug: string) {
  return routeTimelineEvents
    .filter((e) => e.routeSlug === routeSlug)
    .sort((a, b) => a.date.localeCompare(b.date));
}
