import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import RoutePage from '@/app/routes/[slug]/page';
import { fareNamesNoRouteAirline, routeServiceFareMismatch } from '@/components/route/fare-signal';
import { getDestinationBySlug } from '@/data/destinations';

// Backlog recovery sprint Phase 2 (22 Oct 2026): Birmingham-Amritsar
// re-verified against Air India's own 22-28 Oct schedule; Manchester-Dhaka's
// flight-time wording and fare explanation corrected.
const TODAY = '2026-10-22';

async function renderRoute(slug: string): Promise<string> {
  return renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug }) }));
}

describe('Birmingham-Amritsar re-verification', () => {
  const route = getRouteBySlug('birmingham-amritsar')!;

  it('records the fresh check on the 30-day RECENT / CHANGING window', () => {
    expect(route.verification).toMatchObject({ status: 'verified', verifiedDate: '2026-10-22', reviewDueDate: '2026-11-21' });
    const days = (Date.parse(route.verification!.reviewDueDate) - Date.parse(route.verification!.verifiedDate)) / 86_400_000;
    expect(days).toBe(30);
  });

  it('separates the winter schedule from earlier departures', () => {
    expect(route.flightTime.startsWith("Nonstop: about 10h 35m out and 12h 35m back on Air India's winter schedule from 25 October 2026")).toBe(true);
    expect(route.flightTime).toContain('(about 10h 10m and 11h 40m before then)');
    expect(route.intro).toContain('winter schedule from 25 October 2026 shows AI118 at about 10h 35m (about 10h 10m on earlier departures)');
  });

  it('claims no weekly count and names no operating weekdays', () => {
    expect(route.frequency).toBe('Nonstop on selected days rather than daily; operating days vary, so confirm your date with Air India');
    expect(route.frequency).not.toMatch(/\b(one|two|three|four|five|six|\d+) (days?|times|flights)\b/i);
    const visible = [route.frequency, route.intro, route.bookingWindowNote].join(' ');
    expect(visible).not.toMatch(/monday|tuesday|wednesday|thursday|friday|saturday|sunday|several times weekly/i);
    expect(visible).not.toMatch(/\b(operates|runs|flies) (daily|every day)\b/i);
  });

  it('stays direct through the review date and fails closed the day after', () => {
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, '2026-11-21').status).toBe('direct');
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, '2026-11-22').status).not.toBe('direct');
  });
});

describe('Manchester-Dhaka customer-experience corrections', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  });
  afterEach(() => vi.useRealTimers());

  const route = getRouteBySlug('manchester-dhaka')!;

  it('the flight-time value answers the duration question before describing the stop', () => {
    expect(route.flightTime.startsWith('Not confirmed;')).toBe(true);
    expect(route.flightTime).toMatch(/one stop via Sylhet/);
    expect(route.flightTime).toMatch(/18 August 2026/);
    expect(route.verification).toMatchObject({ verifiedDate: '2026-08-18', reviewDueDate: '2026-10-02' });
  });

  it('the hero reads "Typical flight time: Not confirmed; ..."', async () => {
    const html = (await renderRoute('manchester-dhaka')).replaceAll('<!-- -->', '');
    expect(html).toContain('Typical flight time: Not confirmed; one stop via Sylhet');
  });

  it('explains that the Emirates and flydubai fare is a different journey from the Biman service', async () => {
    const html = await renderRoute('manchester-dhaka');
    expect(html).toContain('Emirates and flydubai');
    expect(html).toContain('Biman Bangladesh Airlines · Connecting');
    expect(html).toContain('This tracked fare is on Emirates and flydubai and may be a different connecting journey from this route&#x27;s own service. Check the airlines and stops before booking.');
  });

  it('Birmingham-Delhi (evidenced Air India service via Amritsar) explains its Lufthansa fare the same way', async () => {
    const html = await renderRoute('birmingham-delhi');
    expect(html).toContain('Air India · Connecting');
    expect(html).toContain('This tracked fare is on Lufthansa and may be a different connecting journey from this route&#x27;s own service.');
  });

});

describe('operating-airline comparison', () => {
  it('treats a fare as different only when it names none of the route airlines', () => {
    expect(fareNamesNoRouteAirline('Emirates and flydubai', ['Biman Bangladesh Airlines'])).toBe(true);
    expect(fareNamesNoRouteAirline('Air Arabia', ['Air India'])).toBe(true);
  });

  it('stays silent when the fare names the route airline, in full or by a distinctive first word', () => {
    expect(fareNamesNoRouteAirline('Lufthansa and Air India', ['Air India'])).toBe(false);
    expect(fareNamesNoRouteAirline('Biman', ['Biman Bangladesh Airlines'])).toBe(false);
  });

  it('never treats a generic first word such as "Air" as naming the airline', () => {
    expect(fareNamesNoRouteAirline('Air Arabia and Ryanair', ['Air India'])).toBe(true);
  });
});

describe('airline-text path never asserts a difference it cannot prove', () => {
  const connections = { outbound: ['ZYL'], return: ['ZYL'] };
  const run = (fareAirline: string, airports: string[] = []) =>
    routeServiceFareMismatch(connections, 'Connecting', 'Biman Bangladesh Airlines', 'connecting', airports, fareAirline, ['Biman Bangladesh Airlines']);

  it('hedges instead of asserting', () => {
    expect(run('Emirates and flydubai')?.note).toMatch(/may be a different connecting journey/);
    expect(run('Emirates and flydubai')?.note).not.toMatch(/is a different connecting journey on/);
  });

  it('stays silent for the route airline, an empty airline or an abbreviation', () => {
    expect(run('Biman')).toBeNull();
    expect(run('Biman Bangladesh Airlines and Emirates')).toBeNull();
    expect(run('')).toBeNull();
    expect(run('BG')).toBeNull();
  });

  it('keeps the structured airport path unchanged when the fare carries airports', () => {
    expect(run('Emirates', ['Osmani International Airport (ZYL)'])).toBeNull();
    expect(run('Emirates', ['Dubai International Airport (DXB)'])?.note).toBe('This tracked fare is a different connecting journey.');
  });

  it('never runs for a route without evidenced service connections', () => {
    expect(routeServiceFareMismatch(null, 'Connecting', 'Air India', 'connecting', [], 'Lufthansa', ['Air India'])).toBeNull();
  });
});

describe('Amritsar destination copy matches current route verification', () => {
  const amritsar = getDestinationBySlug('amritsar')!;

  it('names Birmingham, not the lapsed Gatwick route, as the direct option', () => {
    expect(amritsar.flightTimeFromUK).toMatch(/Direct from Birmingham/);
    expect(amritsar.flightTimeFromUK).not.toMatch(/Gatwick/);
    expect(amritsar.familyVisitContent!.packingNote).toMatch(/from Birmingham does not operate daily/);
    expect(amritsar.familyVisitContent!.packingNote).not.toMatch(/Birmingham, Leeds Bradford or Manchester departure would mean a connecting/);
  });
});
