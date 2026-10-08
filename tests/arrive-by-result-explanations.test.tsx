import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ArriveByMissedServiceDetails, ArriveByReadyBySummary, ArriveByRoadEstimateDisclosure, ArriveByScheduledFlightDisclosure } from '@/components/arrive-by-result-explanations';
import type { JourneyPlan } from '@/lib/arrive-by-journey/types';

const plan = {
  state: 'POSSIBLE_WITH_MARGIN',
  stateLabel: 'POSSIBLE WITH MARGIN',
  reasons: ['15 minutes to spare.'],
  deadline: { iso: '2026-11-03T18:30:00.000Z', latestAcceptableIso: '2026-11-03T18:00:00.000Z', marginMinutes: 15 },
  finalArrival: { iso: '2026-11-03T17:45:00.000Z', clock: '17:45', zone: 'Europe/London', dateLabel: 'Tue 3 Nov', dayOffset: 0 },
  timeline: [{ kind: 'DESTINATION_READINESS', label: 'Time you need at the destination', startIso: '2026-11-03T17:45:00.000Z', endIso: '2026-11-03T18:15:00.000Z', minutes: 30, startZone: 'Europe/London', endZone: 'Europe/London', evidence: { kind: 'ASSUMPTION', source: 'Your own readiness estimate' } }],
} as JourneyPlan;

describe('Arrive By result explanations', () => {
  it('shows physical arrival, calculated ready time, deadline, and latest acceptable arrival separately', () => {
    const html = renderToStaticMarkup(createElement(ArriveByReadyBySummary, { plan }));
    expect(html).toContain('Expected physical arrival: around 17:45 on Tue 3 Nov.');
    expect(html).toContain('With your 30-minute readiness buffer, expected ready time is around 18:15 on Tue 3 Nov.');
    expect(html).toContain('You need to be ready by 18:30 on Tue 3 Nov.');
    expect(html).toContain('latest acceptable physical arrival is around 18:00 on Tue 3 Nov.');
    expect(html).toContain('About 15 minutes to spare against that arrival time.');
  });

  it('does not create a ready-by verdict when no deadline or arrival is available', () => {
    expect(ArriveByReadyBySummary({ plan: { ...plan, deadline: undefined } })).toBeNull();
    expect(ArriveByReadyBySummary({ plan: { ...plan, finalArrival: undefined } })).toBeNull();
  });

  it('uses the actual arrival timestamp for deadline arithmetic rather than the rounded headline clock', () => {
    const html = renderToStaticMarkup(createElement(ArriveByReadyBySummary, { plan: { ...plan, finalArrival: { ...plan.finalArrival!, iso: '2026-11-03T17:47:00.000Z', clock: '17:45' } } }));
    expect(html).toContain('Expected physical arrival: around 17:47');
  });

  it('opens the missed-service explanation when the next checked service misses the ready-by time and qualifies the road rescue', () => {
    const html = renderToStaticMarkup(createElement(ArriveByMissedServiceDetails, {
      timeZone: 'Europe/London',
      deadline: plan.deadline,
      transit: {
        firstService: 'Northern',
        expectedArrivalIso: '2026-11-03T17:00:00.000Z',
        missedServiceArrivalIso: '2026-11-03T18:45:00.000Z',
        missedServiceMeetsReadyBy: false,
        rescue: { attempted: true, available: true, arrivalIso: '2026-11-03T18:00:00.000Z', meetsReadyBy: true },
      },
    }));
    expect(html).toContain('<details open="">');
    expect(html).toContain('What if I miss the first service?');
    expect(html).toContain('arrives around 18:45 and misses your ready-by time.');
    expect(html).toContain('Car / taxi rescue estimate');
    expect(html).toContain('Estimated car / taxi arrival around 18:00 on Tue 3 Nov.');
    expect(html).toContain('Latest acceptable physical arrival: 18:00 on Tue 3 Nov.');
    expect(html).toContain('About 0 minutes before your latest acceptable arrival.');
    expect(html).toContain('does not confirm a taxi, driver or pickup is available, or give a price.');
  });

  it('does not imply a rescue exists when Google cannot confirm a drive estimate', () => {
    const html = renderToStaticMarkup(createElement(ArriveByMissedServiceDetails, {
      timeZone: 'Europe/London',
      transit: { firstService: 'Northern', expectedArrivalIso: '2026-11-03T17:00:00.000Z', rescue: { attempted: true, available: false } },
    }));
    expect(html).toContain('A reliable driving arrival time could not be confirmed.');
    expect(html).toContain('What if I miss the first service?');
  });

  it('describes a road estimate without claiming a booked or available vehicle', () => {
    const html = renderToStaticMarkup(createElement(ArriveByRoadEstimateDisclosure, { pickupLabel: 'Pre-booked driver/taxi' }));
    expect(html).toContain('traffic-aware driving estimate');
    expect(html).toContain('does not confirm a driver or vehicle is available, or give a price.');
  });

  it.each([['2026-11-03T17:42:00.000Z', '18 minutes before'], ['2026-11-03T18:12:00.000Z', '12 minutes after']])('calculates rescue margin from actual arrival %s', (arrivalIso, wording) => {
    const html = renderToStaticMarkup(createElement(ArriveByMissedServiceDetails, { timeZone: 'Europe/London', deadline: plan.deadline, transit: { firstService: 'Northern', expectedArrivalIso: '2026-11-03T17:45:00.000Z', rescue: { attempted: true, available: true, arrivalIso } } }));
    expect(html).toContain(`About ${wording} your latest acceptable arrival.`);
    expect(html).toContain('No allowance for finding or waiting for a taxi is included.');
  });

  it('does not imply a rescue works when its arrival timestamp is invalid even if the provider flag says yes', () => {
    const html = renderToStaticMarkup(createElement(ArriveByMissedServiceDetails, { timeZone: 'Europe/London', deadline: plan.deadline, transit: { firstService: 'Northern', expectedArrivalIso: '2026-11-03T17:45:00.000Z', rescue: { attempted: true, available: true, arrivalIso: 'invalid', meetsReadyBy: true } } }));
    expect(html).toContain('A reliable driving arrival time could not be confirmed.');
    expect(html).not.toContain('may still meet');
  });

  it('does not round a late rescue into a claim that it meets the deadline', () => {
    const html = renderToStaticMarkup(createElement(ArriveByMissedServiceDetails, { timeZone: 'Europe/London', deadline: plan.deadline, transit: { firstService: 'Northern', expectedArrivalIso: '2026-11-03T17:45:00.000Z', rescue: { attempted: true, available: true, arrivalIso: '2026-11-03T18:00:20.000Z', meetsReadyBy: true } } }));
    expect(html).toContain('after your latest acceptable arrival.');
    expect(html).toContain('The road journey does not meet your ready-by time.');
    expect(html).not.toContain('may still meet');
  });

  it('labels only a supplied pickup wait as included', () => {
    const html = renderToStaticMarkup(createElement(ArriveByRoadEstimateDisclosure, { pickupLabel: 'Family/friend collecting me', pickupWaitMinutes: 15 }));
    expect(html).toContain('Your entered 15-minute pickup wait is included separately before driving.');
  });

  it('states the exact entered final landing assumption without implying connection prediction', () => {
    const html = renderToStaticMarkup(createElement(ArriveByScheduledFlightDisclosure, { assumption: { arrivalAirportName: 'Islamabad International Airport', arrivesIso: '2026-10-09T23:30:00.000Z', timeZone: 'Asia/Karachi' } }));
    expect(html).toContain('We have not checked whether you will make your flight connection.');
    expect(html).toContain('04:30 on Sat 10 Oct, as entered');
    expect(html).toContain('airport-exit and pickup times are your own estimates');
  });

  it('clears stale results when journey inputs change and prevents edits while a live check is running', () => {
    const source = readFileSync(join(process.cwd(), 'components', 'arrive-by-full-journey.tsx'), 'utf8');
    expect(source.match(/onChange=.*clearResult\(\)/g)).toHaveLength(13);
    expect(source.match(/<fieldset disabled=\{loading\}/g)).toHaveLength(4);
  });
});
