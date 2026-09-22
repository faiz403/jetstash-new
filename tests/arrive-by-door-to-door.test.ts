import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { exampleDoorJourney, blankDoorJourney } from '@/lib/arrive-by/door-example';
import { planDoorJourney, type DoorJourney, type ScheduledOnwardJourney, type ScheduledTransport } from '@/lib/arrive-by/door-to-door';

const NOW = '2026-09-20T12:00:00Z';
function run(change?: (input: ScheduledOnwardJourney) => void) {
  const input = exampleDoorJourney(); change?.(input); return planDoorJourney(input, NOW);
}
describe('Arrive By complete door-to-door chain', () => {
  it('selects the earliest qualifying train while retaining the latest deadline boundary', () => {
    const result = run();
    expect(result.errors).toEqual([]);
    const b = result.options[1];
    expect(b.state).toBe('YES');
    expect(b.onwardService).toBe('Example onward 17:10');
    expect(b.finalArrival?.timeHHmm).toBe('18:22');
    expect(b.latestDeadlineService?.id).toBe('Example onward 17:35');
    expect(b.waitMinutes).toBe(45);
    expect(b.deadlineMargin).toBe(38);
    expect(b.flightArrivalBy?.timeHHmm).toBe('15:25');
    expect(b.onwardServices.find((s) => s.id.endsWith('17:50'))).toMatchObject({ fitsDownstream: false, catchable: true, selected: false });
  });
  it('explains a non-qualifying catchable alternative without selecting it as viable', () => {
    const a = run().options[0];
    expect(a.state).toBe('NO');
    expect(a.onwardService).toBeUndefined();
    expect(a.diagnosticOnwardService).toBe('Example onward 18:20');
    expect(a.finalArrival?.timeHHmm).toBe('19:25');
    expect(a.deadlineStatus).toBe('MISSES DEADLINE');
    expect(a.onwardServices.find((s) => s.id.endsWith('17:35'))?.catchable).toBe(false);
    expect(a.onwardServices.find((s) => s.id.endsWith('17:50'))?.catchable).toBe(false);
  });
  it('works backwards through the pre-flight train, access walk and airport stages', () => {
    const b = run().options[1];
    expect(b.airportArrivalBy?.timeHHmm).toBe('07:15');
    expect(b.originService).toBe('Example train 05:48');
    expect(b.originServices.find((s) => s.id.endsWith('06:12'))?.fitsDownstream).toBe(false);
    expect(b.homeDeparture).toMatchObject({ dateIso: '2026-11-02', timeHHmm: '05:08', timeZone: 'Europe/London' });
    expect(b.tightest).toMatchObject({ spare: 15, state: 'COMFORTABLE' });
  });
  it('shows a qualified £40 entered-fare trade-off without recommending a purchase', () => {
    expect(run().tradeOff).toContain('£40.00 higher');
    expect(run().tradeOff).toContain('not verified like-for-like payable totals');
  });
  it('does not invent a fare difference when a price is missing', () => {
    expect(run((i) => { i.flights[0].priceGBP = null; }).tradeOff).toBeUndefined();
  });
  it('preserves overnight UK→India dates and every chronological segment', () => {
    const b = run().options[1];
    const flight = b.timeline.find((s) => s.label.startsWith('Flight:'))!;
    expect(flight.start).toMatchObject({ dateIso: '2026-11-02', timeHHmm: '10:15', timeZone: 'Europe/London' });
    expect(flight.end).toMatchObject({ dateIso: '2026-11-03', timeHHmm: '14:40', timeZone: 'Asia/Kolkata' });
    for (let x = 0; x < b.timeline.length; x++) {
      const leg = b.timeline[x]; expect(Date.parse(leg.end.utcIso)).toBeGreaterThanOrEqual(Date.parse(leg.start.utcIso));
      if (x) expect(leg.start.utcIso).toBe(b.timeline[x - 1].end.utcIso);
    }
  });
  it('supports same-day flights and final walking leg', () => {
    const result = run((i) => {
      i.toAirport = { kind: 'flexible', mode: 'car', minutes: 55, buffer: 20 };
      i.flights = [{ ...i.flights[1], departure: { date: '2026-11-03', time: '04:00', timeZone: 'Europe/London' } }];
      i.finalMile.mode = 'walk';
    }).options[0];
    expect(result.state).toBe('YES');
    expect(result.timeline.some((s) => s.label.startsWith('walk: final mile'))).toBe(true);
  });
  it('driving origin example gives 06:00 with 55min travel, 20min road buffer, zero extra cushion', () => {
    const b = run((i) => { i.connectionCushion = 0; i.toAirport = { kind: 'flexible', mode: 'car', minutes: 55, buffer: 20 }; }).options[1];
    expect(b.homeDeparture?.timeHHmm).toBe('06:00');
    expect(b.originService).toBeUndefined();
  });
  it.each(['car', 'taxi', 'rickshaw', 'walk', 'family pickup'] as const)('supports %s final mile without inventing a scheduled service', (mode) => {
    const b = run((i) => { i.onward = null; i.finalMile = { kind: 'flexible', mode, minutes: 45, buffer: 15 }; }).options[1];
    expect(b.state).toBe('YES'); expect(b.finalArrival?.timeHHmm).toBe('17:25');
    expect(b.onwardServices).toEqual([]);
  });
  it.each(['train', 'bus', 'coach', 'ferry'] as const)('uses fixed %s departures', (mode) => {
    expect(run((i) => { i.onward!.mode = mode; }).options[1].onwardService).toBe('Example onward 17:10');
  });
  it('a later service arriving after the final cutoff is rejected even if catchable', () => {
    const b = run().options[1];
    expect(b.onwardServices.find((s) => s.id.endsWith('18:20'))?.status).toBe('MISSES DEADLINE');
  });
  it('requires the station allowance as well as positive raw departure margin', () => {
    const result = run((i) => { i.flights[1].landing.time = '15:45'; }).options[1];
    expect(result.state).toBe('NO');
    expect(result.onwardServices.find((s) => s.id.endsWith('17:35'))?.catchable).toBe(false);
  });
  it('satisfying only the boarding allowance is insufficient when extra cushion is required', () => {
    const result = run((i) => { i.flights[1].landing.time = '15:40'; }).options[1];
    expect(result.state).toBe('NO');
    expect(result.onwardServices.find((s) => s.id.endsWith('17:35'))?.catchable).toBe(false);
  });
  it('the comfort threshold is founder configurable', () => {
    const result = run((i) => { i.connectionCushion = 0; i.flights[1].landing.time = '15:40'; }).options[1];
    expect(result.state).toBe('YES');
  });
  it('finds earliest onward and latest pre-flight departures with unordered candidates', () => {
    const result = run((i) => { i.onward!.services.reverse(); (i.toAirport as ScheduledTransport).services.reverse(); });
    expect(result.options[1].onwardService).toBe('Example onward 17:10');
    expect(result.options[1].originService).toBe('Example train 05:48');
  });
  it('stops when no entered pre-flight train fits', () => {
    expect(run((i) => { (i.toAirport as ScheduledTransport).services = (i.toAirport as ScheduledTransport).services.slice(1); }).options[1].state).toBe('NO');
  });
  it('does not substitute a made-up train when the timetable is empty', () => {
    const result = run((i) => { i.onward!.services = []; });
    expect(result.options).toEqual([]); expect(result.errors).toContain('After flight: NO SCHEDULED SERVICE PROVIDED.');
  });
  it('does not substitute zero for missing immigration or road estimates', () => {
    const result = run((i) => { i.arrivalProcess.immigration = null; i.finalMile.minutes = null; });
    expect(result.options).toEqual([]); expect(result.errors.join(' ')).toContain('immigration'); expect(result.errors.join(' ')).toContain('Final mile');
  });
  it('accepts explicit zero for stages that do not apply', () => {
    expect(run((i) => { i.arrivalProcess.baggage = 0; }).errors).toEqual([]);
  });
  it.each([-1, NaN, Infinity, 1.5, 10081])('rejects invalid processing allowance %s', (value) => {
    expect(run((i) => { i.arrivalProcess.baggage = value; }).options).toEqual([]);
  });
  it('rejects backwards service timestamps', () => {
    expect(run((i) => { i.onward!.services[0].arrival.time = '16:00'; }).options).toEqual([]);
  });
  it('rejects duplicate service identifiers', () => {
    expect(run((i) => { i.onward!.services[1].id = i.onward!.services[0].id; }).errors.join(' ')).toContain('distinct name');
  });
  it('handles overnight scheduled services as actual dates', () => {
    const result = run((i) => {
      i.deadline.date = '2026-11-04'; i.deadline.time = '03:00';
      i.onward!.services = [{ id: 'Overnight', departure: { date: '2026-11-03', time: '23:00', timeZone: 'Asia/Kolkata' }, arrival: { date: '2026-11-04', time: '01:00', timeZone: 'Asia/Kolkata' } }];
    }).options[1];
    expect(result.finalArrival).toMatchObject({ dateIso: '2026-11-04', timeHHmm: '01:20' });
  });
  it('uses the UK summer offset for a UK→India flight', () => {
    const result = run((i) => {
      i.deadline.date = '2026-10-20'; i.deadline.time = '23:00'; i.onward = null;
      i.toAirport = { kind: 'flexible', mode: 'taxi', minutes: 30, buffer: 15 };
      i.flights = [{ label: 'Summer offset', priceGBP: null, departure: { date: '2026-10-20', time: '10:15', timeZone: 'Europe/London' }, landing: { date: '2026-10-20', time: '20:45', timeZone: 'Asia/Kolkata' } }];
    }).options[0];
    expect(result.timeline.find((s) => s.label.startsWith('Flight:'))?.minutes).toBe(360);
  });
  it.each(['2026-10-25', '2027-03-28'])('refuses to guess ambiguous/nonexistent UK departure %s', (date) => {
    expect(run((i) => { i.flights[1].departure = { date, time: '01:30', timeZone: 'Europe/London' }; }).options[1].state).toBe('CANNOT CONFIRM');
  });
  it('refuses a mismatched airport/flight time zone', () => {
    expect(run((i) => { i.flights[1].landing.timeZone = 'Asia/Dubai'; }).options[1].state).toBe('CANNOT CONFIRM');
  });
  it('a late road-only final arrival remains NO', () => {
    expect(run((i) => { i.onward = null; i.finalMile.minutes = 300; }).options[1].state).toBe('NO');
  });
  it('the required final buffer is a constraint for road legs as well as scheduled legs', () => {
    const result = run((i) => { i.onward = null; i.finalMile.minutes = 140; i.finalMile.buffer = 8; }).options[1];
    expect(result.finalArrival?.timeHHmm).toBe('18:53'); expect(result.state).toBe('NO');
    expect(result.deadlineStatus).toBe('BEFORE DEADLINE, BUT BUFFER NOT MET');
    expect(result.reasons.join(' ')).toContain('required 10 min final buffer');
  });
  it('an already-past required home departure cannot produce YES', () => {
    expect(planDoorJourney(exampleDoorJourney(), '2026-11-02T09:00:00Z').options[1].state).toBe('NO');
  });
  it('a blank form produces a missing-data list instead of results', () => {
    const result = planDoorJourney(blankDoorJourney(), NOW); expect(result.options).toEqual([]); expect(result.errors.length).toBeGreaterThan(5);
  });
});

describe('door-to-door founder boundary', () => {
  const component = readFileSync('components/founder/arrive-by-door-to-door.tsx', 'utf8');
  const page = readFileSync('app/founder/arrive-by/page.tsx', 'utf8');
  it('actually mounts the reviewed private component behind the existing gate', () => {
    expect(page).toContain('<ArriveByDoorToDoor />'); expect(page).toContain('notFound()');
    expect(page).toContain("process.env.FOUNDER_DASHBOARD_ENABLED === 'true'");
  });
  it('adds no request, persistence or analytics', () => {
    expect(component).not.toMatch(/\bfetch\s*\(|localStorage|sessionStorage|\btrack\s*\(/);
  });
  it('labels synthetic example data and the limitations next to the output', () => {
    expect(component).toContain('FICTIONAL TEST DATA'); expect(component).toContain('not verified feasibility or an arrival promise');
  });
});

describe('earliest onward selection versus backwards boundary', () => {
  function scenario(change?: (input: ScheduledOnwardJourney) => void) {
    return run((i) => {
      i.flights[1].landing.time = '11:35'; // 105 minutes processing: ready 13:20 IST.
      i.onward!.minimumBeforeDeparture = 0; i.connectionCushion = 15;
      i.onward!.services = [['13:25', '14:00'], ['13:45', '14:30'], ['15:10', '16:02'], ['17:35', '18:27']].map(([departure, arrival]) => ({
        id: `Test ${departure}`, departure: { date: '2026-11-03', time: departure, timeZone: 'Asia/Kolkata' }, arrival: { date: '2026-11-03', time: arrival, timeZone: 'Asia/Kolkata' },
      }));
      change?.(i);
    });
  }
  it('reconciles 13:20 ready + 15 cushion: 13:25 rejected, 13:45 selected, 17:35 boundary', () => {
    const b = scenario().options[1];
    expect(b.readyForOnward?.timeHHmm).toBe('13:20');
    expect(b.onwardServices[0].catchable).toBe(false);
    expect(b.onwardService).toBe('Test 13:45');
    expect(b.latestDeadlineService?.departure.timeHHmm).toBe('17:35');
    expect(b.waitMinutes).toBe(25);
    expect(b.finalArrival?.timeHHmm).toBe('14:50');
    expect(b.deadlineMargin).toBe(250);
    expect(b.effectiveLatestArrival?.timeHHmm).toBe('18:50');
    expect(b.deadlineStatus).toBe('MEETS REQUIREMENT');
    expect(b.flightArrivalBy?.timeHHmm).toBe('15:35');
  });
  it('does not impose a four-hour wait for the deadline-boundary train', () => {
    const b = scenario().options[1];
    expect(b.waitMinutes).toBeLessThan(180);
    expect(b.timeline.find(t => t.label.startsWith('train: Test'))?.start.timeHHmm).toBe('13:45');
  });
  it('allows earliest and latest to be the same when only one service qualifies', () => {
    const b = scenario(i => { i.onward!.services = i.onward!.services.slice(-1); }).options[1];
    expect(b.onwardService).toBe(b.latestDeadlineService?.id);
    expect(b.waitMinutes).toBe(255); // A genuine timetable wait is retained.
  });
  it('calculates different selected services independently for the two flights', () => {
    const result = scenario(i => { i.flights[0].landing.time = '13:45'; }); // A ready 15:30.
    expect(result.options.map(o => o.onwardService)).toEqual(['Test 17:35', 'Test 13:45']);
    expect(result.options.map(o => o.finalArrival?.timeHHmm)).toEqual(['18:47', '14:50']);
    expect(result.options.map(o => o.latestDeadlineService?.id)).toEqual(['Test 17:35', 'Test 17:35']);
  });
  it('does not force different services for two flights with compatible readiness', () => {
    const result = scenario(i => { i.flights[0].landing.time = '11:40'; }); // A ready 13:25.
    expect(result.options.map(o => o.onwardService)).toEqual(['Test 13:45', 'Test 13:45']);
    expect(result.options.map(o => o.waitMinutes)).toEqual([20, 25]);
  });
  it('a slow-processing assumption changes the selected train, rather than reusing the normal result', () => {
    const normal = scenario().options[1];
    const slow = scenario(i => { i.arrivalProcess.immigration! += 60; }).options[1];
    expect(normal.onwardService).toBe('Test 13:45');
    expect(slow.readyForOnward?.timeHHmm).toBe('14:20');
    expect(slow.onwardService).toBe('Test 15:10');
    expect(slow.waitMinutes).toBe(50);
    expect(slow.finalArrival?.timeHHmm).toBe('16:22');
    expect(slow.deadlineMargin).toBe(158);
  });
  it.each([['11:44', true], ['11:45', true], ['11:46', false]] as const)('uses an inclusive cushion cutoff for landing %s', (landing, catchable) => {
    const b = scenario(i => { i.flights[1].landing.time = landing; }).options[1];
    expect(b.onwardServices.find(s => s.id === 'Test 13:45')?.catchable).toBe(catchable);
    expect(b.onwardService).toBe(catchable ? 'Test 13:45' : 'Test 15:10');
  });
  it('adds the boarding allowance and extra cushion exactly once', () => {
    const b = scenario(i => { i.onward!.minimumBeforeDeparture = 10; }).options[1];
    expect(b.onwardService).toBe('Test 13:45');
    expect(b.connections.find(c => c.label === 'Test 13:45')).toMatchObject({ margin: 25, minimum: 25, extraCushion: 15, spare: 0, state: 'COMFORTABLE' });
    expect(b.flightArrivalBy?.timeHHmm).toBe('15:25');
  });
  it('skips an earlier catchable service that fails the downstream requirement', () => {
    const b = scenario(i => { i.onward!.services[1].arrival.time = '19:30'; }).options[1];
    expect(b.onwardService).toBe('Test 15:10');
    expect(b.onwardServices[1]).toMatchObject({ catchable: true, fitsDownstream: false, selected: false });
  });
  it('retains earliest departure policy even when a later train is faster', () => {
    const b = scenario(i => { i.onward!.services[2].departure.time = '13:50'; i.onward!.services[2].arrival.time = '14:10'; }).options[1];
    expect(b.onwardService).toBe('Test 13:45');
  });
  it.each([
    ['18:30', 10, 'MEETS REQUIREMENT', 10, 'YES'],
    ['18:36', 10, 'BEFORE DEADLINE, BUT BUFFER NOT MET', 4, 'NO'],
    ['18:41', 10, 'MISSES DEADLINE', -1, 'NO'],
    ['18:40', 0, 'MEETS REQUIREMENT', 0, 'YES'],
    ['18:40', 10, 'AT DEADLINE, BUT BUFFER NOT MET', 0, 'NO'],
    ['18:39', 0, 'MEETS REQUIREMENT', 1, 'YES'],
  ] as const)('distinguishes final arrival from the required buffer: rail arrival %s, buffer %s', (arrival, buffer, status, margin, state) => {
    const b = scenario(i => { i.finalBuffer = buffer; i.onward!.services = [{ ...i.onward!.services[1], arrival: { ...i.onward!.services[1].arrival, time: arrival } }]; }).options[1];
    expect(b.deadlineStatus).toBe(status); expect(b.deadlineMargin).toBe(margin); expect(b.state).toBe(state);
    expect(b.deadline.timeHHmm).toBe('19:00');
    expect(b.effectiveLatestArrival.timeHHmm).toBe(buffer ? '18:50' : '19:00');
    if (state === 'NO') {
      expect(b.onwardService).toBeUndefined(); expect(b.diagnosticOnwardService).toBe('Test 13:45');
      expect(b.onwardServices.every(s => !s.selected)).toBe(true);
    }
  });
  it('does not invent an arrival when no service is catchable', () => {
    const b = scenario(i => { i.flights[1].landing.time = '18:00'; }).options[1];
    expect(b.state).toBe('NO'); expect(b.finalArrival).toBeUndefined(); expect(b.deadlineStatus).toBe('NOT ESTABLISHED');
    expect(b.latestDeadlineService?.id).toBe('Test 17:35');
    expect(b.connections.at(-1)?.state).toBe('NOT CATCHABLE');
  });
});
