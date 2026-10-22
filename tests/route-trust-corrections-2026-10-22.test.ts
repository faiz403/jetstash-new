import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRouteBySlug, getRoutePresentation, routes } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import RoutePage from '@/app/routes/[slug]/page';

// Route trust corrections (22 Oct 2026): the hero badge and its explanatory
// sentence now come from the same presentation object, and Manchester-Dhaka
// no longer presents an expired schedule check as current.
const TODAY = '2026-10-22';
const PENDING_SENTENCE = 'Current service is not yet independently confirmed';

describe('route hero status badge and sentence agree', () => {
  it.each(['london-heathrow-dhaka', 'manchester-rome'])('%s: "Service confirmed" is never paired with the pending sentence', (slug) => {
    const presentation = getEffectiveRoutePresentation(getRouteBySlug(slug)!, routeStatusEvents, TODAY);
    expect(presentation.status).toBe('unspecified');
    expect(presentation.statusLabel).toBe('Service confirmed');
    expect(presentation.statusHeadline).toBe('Service confirmed · stop pattern and schedule not established');
    expect(presentation.statusHeadline).not.toContain(PENDING_SENTENCE);
  });

  it('every published route pairs each label with exactly one headline', () => {
    const expected: Record<string, string[]> = {
      Direct: ['Direct flights available'],
      Connecting: ['Connecting flights available'],
      'Service confirmed': ['Service confirmed · stop pattern and schedule not established'],
      'Verification pending': [PENDING_SENTENCE],
      'Direct service ended': ['Former direct service ended · connecting flights available', 'Former direct service ended'],
    };
    for (const route of routes) {
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, TODAY);
      expect(expected[presentation.statusLabel], route.slug).toContain(presentation.statusHeadline);
    }
  });

  it('a pending route keeps the pending sentence', () => {
    const presentation = getEffectiveRoutePresentation(getRouteBySlug('manchester-jeddah')!, routeStatusEvents, TODAY);
    expect(presentation.status).toBe('unverified');
    expect(presentation.statusHeadline).toBe(PENDING_SENTENCE);
  });

  it('a service-ended route only promises connecting flights when it has connecting evidence', () => {
    for (const slug of ['manchester-delhi', 'manchester-mumbai']) {
      const route = getRouteBySlug(slug)!;
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, TODAY);
      expect(presentation.status).toBe('service-ended');
      expect(Boolean(route.connectingAlternative)).toBe(true);
      expect(presentation.statusHeadline).toBe('Former direct service ended · connecting flights available');
    }
  });

  it('the rendered hero for an unspecified route shows the matching sentence, not the pending one', async () => {
    // The page reads the real clock; freeze it inside Manchester-Rome's
    // verification window so this test cannot expire.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    try {
      const html = renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug: 'manchester-rome' }) }));
      const hero = html.slice(0, html.indexOf('</h1>') + 600);
      expect(hero).toContain('Service confirmed');
      expect(hero).toContain('stop pattern and schedule not established');
      expect(hero).not.toContain(PENDING_SENTENCE);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Manchester-Dhaka no longer presents an expired check as current', () => {
  const route = getRouteBySlug('manchester-dhaka')!;
  const visibleCopy = () => [route.flightTime, route.frequency, route.intro].join(' ');

  it('keeps the expired verification dates unchanged', () => {
    expect(route.verification).toMatchObject({ status: 'verified', verifiedDate: '2026-08-18', reviewDueDate: '2026-10-02' });
  });

  it('never calls the notice current and dates every schedule claim', () => {
    expect(visibleCopy()).not.toMatch(/current official notice/i);
    expect(visibleCopy()).not.toMatch(/\boperates every\b/i);
    expect(route.flightTime).toMatch(/18 August 2026/);
    expect(route.frequency).toMatch(/18 August 2026/);
    expect(route.intro).toMatch(/18 August 2026/);
    expect(route.frequency).toMatch(/not re-confirmed/);
  });

  it('keeps the confirmed one-stop shape, never a nonstop claim', () => {
    expect(route.isDirect).toBe(false);
    expect(getRoutePresentation(route, TODAY).status).toBe('connecting');
    expect(visibleCopy()).toMatch(/one stop via Sylhet, not a nonstop service/);
  });
});
