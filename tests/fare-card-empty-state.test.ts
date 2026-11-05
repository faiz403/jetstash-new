import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AirportPage from '@/app/airports/[slug]/page';
import { AirportRouteGrid, type AirportRouteItem } from '@/components/airport/airport-route-grid';
import { DestinationFlightGuides } from '@/components/destination/destination-flight-guides';
import { DealCard } from '@/components/ui/deal-card';
import { deals } from '@/data/deals';
import { getDestinationBySlug } from '@/data/destinations';
import * as archive from '@/data/fare-observations';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getFareCardEmptyStateLabel } from '@/lib/route-card-fare';

const NOW = '2026-11-05';
const render = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/<!-- -->/g, '');
const articles = (html: string) => html.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) ?? [];
const gridItem = (overrides: Partial<AirportRouteItem> = {}): AirportRouteItem => ({
  slug: 'fixture-route', country: 'Morocco', title: 'Heathrow → Casablanca',
  statusLabel: 'Verification pending', detail: null, fare: null, hasLoggedFare: true, ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${NOW}T12:00:00Z`));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('archive-aware fare-card empty copy', () => {
  it('distinguishes an absent eligible fare from a genuinely empty archive', () => {
    expect(getFareCardEmptyStateLabel(true)).toBe('No current fare to show');
    expect(getFareCardEmptyStateLabel(false)).toBe('No fare logged yet');
  });

  it.each([true, false])('uses the server-derived history flag in the airport grid: %s', (hasLoggedFare) => {
    const html = render(createElement(AirportRouteGrid, { items: [gridItem({ hasLoggedFare })] }));
    expect(html).toContain(getFareCardEmptyStateLabel(hasLoggedFare));
    expect(html).not.toContain(getFareCardEmptyStateLabel(!hasLoggedFare));
    expect(html).toContain('href="/routes/fixture-route"');
    expect(html).toContain('Verification pending');
    expect(html).not.toMatch(/£|unavailable|expired|never checked/i);
  });

  it('fixes the real Heathrow–Casablanca airport card without exposing a held-back price', async () => {
    expect(archive.getObservationsByRoute('london-heathrow-casablanca').length).toBeGreaterThan(0);
    expect(getFareSignalForRoute('london-heathrow-casablanca', NOW).state).toBe('none');
    const html = render(await AirportPage({ params: Promise.resolve({ slug: 'london-heathrow' }) }));
    const card = articles(html).find((article) => article.includes('href="/routes/london-heathrow-casablanca"'))!;
    expect(card).toBeDefined();
    expect(card).toContain('No current fare to show');
    expect(card).not.toContain('No fare logged yet');
    expect(card).not.toContain('£');
    expect(card).toContain('Verification pending');
  });

  it('uses the same correction on the real Casablanca destination card', () => {
    const html = render(DestinationFlightGuides({ destination: getDestinationBySlug('casablanca')!, nowIso: NOW }));
    const card = articles(html).find((article) => article.includes('href="/routes/london-heathrow-casablanca"'))!;
    expect(card).toContain('No current fare to show');
    expect(card).not.toContain('No fare logged yet');
    expect(card).not.toContain('£');
    expect(card).toContain('Route verification pending');
  });

  it('does not contradict the corrected destination card in its lower historical DealCard', () => {
    const deal = deals.find((item) => item.fromAirportSlug === 'london-heathrow' && item.toDestinationSlug === 'casablanca' && item.cabin === 'Economy')!;
    const html = render(DealCard({ deal, nowIso: NOW }));
    expect(archive.getObservationsByRouteAndCabin('london-heathrow-casablanca', 'Economy').length).toBeGreaterThan(0);
    expect(html).toContain('No current Economy fare to show');
    expect(html).not.toContain('No Economy fare checks logged yet');
    expect(html).not.toContain('£');
    expect(html).toContain('Verification pending');
  });

  it('preserves the separate no-package-evidence state, never treating a flight as a package price', () => {
    const deal = deals.find((item) => item.id === 'bhx-ayt-package')!;
    const html = render(DealCard({ deal, nowIso: NOW }));
    expect(html).toContain('No package price tracked yet.');
    expect(html).not.toContain('No current Economy fare to show');
    expect(html).not.toContain('£');
  });

  it('retains never-logged destination wording when the archive truly has no observations', () => {
    // Synthetic empty-archive fixture; never remove or re-date real observations.
    const history = vi.spyOn(archive, 'hasAnyObservationAmongRoutes').mockReturnValue(false);
    const html = render(DestinationFlightGuides({ destination: getDestinationBySlug('casablanca')!, nowIso: NOW }));
    const card = articles(html).find((article) => article.includes('href="/routes/london-heathrow-casablanca"'))!;
    expect(history).toHaveBeenCalledWith(['london-heathrow-casablanca']);
    expect(card).toContain('No fare logged yet');
    expect(card).not.toContain('No current fare to show');
  });

  it('preserves ended-service status and suppresses its ineligible price', async () => {
    const html = render(await AirportPage({ params: Promise.resolve({ slug: 'manchester' }) }));
    for (const slug of ['manchester-delhi', 'manchester-mumbai']) {
      const card = articles(html).find((article) => article.includes(`href="/routes/${slug}"`))!;
      expect(card).toContain('Direct service ended');
      expect(card).toContain('No current fare to show');
      expect(card).not.toContain('£');
      expect(getFareSignalForRoute(slug, NOW).state).toBe('none');
    }
  });

  it('leaves current airport and destination fares, checked dates and route links visible', async () => {
    const signal = getFareSignalForRoute('manchester-islamabad', NOW);
    expect(signal.state).toBe('current');
    const airportHtml = render(await AirportPage({ params: Promise.resolve({ slug: 'manchester' }) }));
    const destinationHtml = render(DestinationFlightGuides({ destination: getDestinationBySlug('islamabad')!, nowIso: NOW }));
    for (const html of [airportHtml, destinationHtml]) {
      const card = articles(html).find((article) => article.includes('href="/routes/manchester-islamabad"'))!;
      expect(card).toContain(`£${signal.observation!.price}`);
      expect(card).toContain('Checked 3 November 2026');
      expect(card).not.toContain('No current fare to show');
      expect(card).not.toContain('No fare logged yet');
    }
  });

  it.each(['current', 'recent'])('never replaces a supplied %s fare with empty-state copy', (state) => {
    const fare = createElement('p', null, state === 'recent' ? '£500 · Previous fare, checked 1 November 2026' : '£500 · Checked 1 November 2026');
    const html = render(createElement(AirportRouteGrid, { items: [gridItem({ fare })] }));
    expect(html).toContain('£500');
    expect(html).toContain(state === 'recent' ? 'Previous fare, checked' : 'Checked 1 November');
    expect(html).not.toContain('No current fare to show');
    expect(html).not.toContain('No fare logged yet');
  });
});
