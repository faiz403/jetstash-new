import type { DealCabin } from './deals';

export interface FareObservation {
  id: string;
  routeSlug: string;
  cabin: DealCabin;
  /** ISO date this fare was actually checked — same honesty rule as Deal.lastChecked, never a live price claim. */
  observedDate: string;
  price: number;
  priceNote: string;
  source: string; // airline the fare was observed on
}

/**
 * Append-only fare history per route. This is what a "fare observation
 * history" is — never overwrite an entry when a fare changes, add a new
 * one with a later observedDate so the trend stays visible. Seeded here by
 * converting each existing example fare in data/deals.ts (that maps to a
 * real route in data/routes.ts) into its first observation — same honest
 * numbers, restructured as history instead of a single snapshot.
 */
export const fareObservations: FareObservation[] = [
  { id: 'obs-man-lhe-economy-1', routeSlug: 'manchester-lahore', cabin: 'Economy', observedDate: '2026-06-15', price: 489, priceNote: 'example fare, return, per person', source: 'PIA' },
  { id: 'obs-man-lhe-business-1', routeSlug: 'manchester-lahore', cabin: 'Business', observedDate: '2026-06-09', price: 1845, priceNote: 'example fare, return, per person', source: 'PIA' },
  { id: 'obs-lhr-del-economy-1', routeSlug: 'london-heathrow-delhi', cabin: 'Economy', observedDate: '2026-06-14', price: 467, priceNote: 'example fare, return, per person', source: 'Virgin Atlantic' },
  { id: 'obs-lhr-del-business-1', routeSlug: 'london-heathrow-delhi', cabin: 'Business', observedDate: '2026-06-11', price: 2150, priceNote: 'example fare, return, per person', source: 'Virgin Atlantic' },
  { id: 'obs-bhx-atq-economy-1', routeSlug: 'birmingham-amritsar', cabin: 'Economy', observedDate: '2026-06-13', price: 521, priceNote: 'example fare, return, per person', source: 'Air India' },
  { id: 'obs-bhx-atq-business-1', routeSlug: 'birmingham-amritsar', cabin: 'Business', observedDate: '2026-06-08', price: 2080, priceNote: 'example fare, return, per person', source: 'Air India' },
  { id: 'obs-man-dxb-economy-1', routeSlug: 'manchester-dubai', cabin: 'Economy', observedDate: '2026-06-16', price: 349, priceNote: 'example fare, return, per person', source: 'Emirates' },
  { id: 'obs-man-dxb-business-1', routeSlug: 'manchester-dubai', cabin: 'Business', observedDate: '2026-06-12', price: 1840, priceNote: 'example fare, return, per person', source: 'Emirates' },
  { id: 'obs-lhr-doh-economy-1', routeSlug: 'london-heathrow-doha', cabin: 'Economy', observedDate: '2026-06-16', price: 398, priceNote: 'example fare, return, per person', source: 'Qatar Airways' },
  { id: 'obs-lhr-doh-business-1', routeSlug: 'london-heathrow-doha', cabin: 'Business', observedDate: '2026-06-11', price: 1640, priceNote: 'example fare, return, per person', source: 'Qatar Airways' },
  { id: 'obs-lhr-jed-economy-1', routeSlug: 'london-heathrow-jeddah', cabin: 'Economy', observedDate: '2026-06-09', price: 899, priceNote: 'example fare, 7 nights, flights + hotel, per person sharing', source: 'Saudia' },
  { id: 'obs-lhr-jed-business-1', routeSlug: 'london-heathrow-jeddah', cabin: 'Business', observedDate: '2026-06-10', price: 1730, priceNote: 'example fare, return, per person', source: 'Saudia' },
  { id: 'obs-man-med-economy-1', routeSlug: 'manchester-madinah', cabin: 'Economy', observedDate: '2026-06-09', price: 1149, priceNote: 'example fare, 14 nights Makkah & Madinah, flights + hotel, per person sharing', source: 'Saudia' },
  { id: 'obs-man-isb-business-1', routeSlug: 'manchester-islamabad', cabin: 'Business', observedDate: '2026-06-09', price: 1780, priceNote: 'example fare, return, per person', source: 'PIA' },
  { id: 'obs-man-khi-economy-1', routeSlug: 'manchester-karachi', cabin: 'Economy', observedDate: '2026-06-16', price: 495, priceNote: 'example fare, return, per person', source: 'PIA' },
  { id: 'obs-lgw-amd-economy-1', routeSlug: 'london-gatwick-ahmedabad', cabin: 'Economy', observedDate: '2026-06-17', price: 412, priceNote: 'example fare, return, per person', source: 'Air India' },
  { id: 'obs-lgw-amd-business-1', routeSlug: 'london-gatwick-ahmedabad', cabin: 'Business', observedDate: '2026-06-17', price: 1620, priceNote: 'example fare, return, per person', source: 'Air India' },
  { id: 'obs-lhr-bom-economy-1', routeSlug: 'london-heathrow-mumbai', cabin: 'Economy', observedDate: '2026-06-16', price: 498, priceNote: 'example fare, return, per person', source: 'British Airways' },
];

export function getObservationsByRoute(routeSlug: string) {
  return fareObservations
    .filter((o) => o.routeSlug === routeSlug)
    .sort((a, b) => a.observedDate.localeCompare(b.observedDate));
}

export function getLatestObservation(routeSlug: string) {
  const observations = getObservationsByRoute(routeSlug);
  return observations[observations.length - 1];
}
