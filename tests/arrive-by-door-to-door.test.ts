import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { exampleDoorJourney, blankDoorJourney, blankScheduled } from '@/lib/arrive-by/door-example';
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
      i.flights = [{ label: 'Summer offset', priceGBP: null, hasUnmodelledConnection: false, departure: { date: '2026-10-20', time: '10:15', timeZone: 'Europe/London' }, landing: { date: '2026-10-20', time: '20:45', timeZone: 'Asia/Kolkata' } }];
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

/**
 * SAFETY/COMPREHENSION FIX (Tester 3, 23 Sep 2026, EK22 scenario). A failed
 * option (no qualifying onward service — `onwardService` undefined,
 * `diagnosticOnwardService` set) used to render a generic paragraph
 * unconditionally alongside "First service you can realistically catch:
 * None established" claiming that service "meets... final requirement" —
 * gated only on `onwardServices.length > 0`, not on a real selection
 * existing. Fixed to gate on `value.onwardService` and give the
 * diagnostic-only case its own, explicitly non-qualifying sentence. See
 * lib/arrive-by/door-to-door.ts's DoorOptionResult for the underlying
 * onwardService/diagnosticOnwardService contract this render logic depends
 * on (already covered at the data layer by "explains a non-qualifying
 * catchable alternative without selecting it as viable" above); these
 * checks are the render-layer half of that same guarantee.
 */
describe('door-to-door founder render — no success-specific copy on a failed option', () => {
  const component = readFileSync('components/founder/arrive-by-door-to-door.tsx', 'utf8');
  it('the qualifying-service explainer is gated on a real selection, never on services merely being entered', () => {
    expect(component).toMatch(/\{value\.onwardService && <p[^>]*>The first service you can realistically catch drives the timeline/);
    expect(component).not.toMatch(/\{value\.onwardServices\.length > 0 && <p[^>]*>The (earliest|first) qualifying service drives the timeline/);
  });
  it('a diagnostic-only (non-qualifying) alternative gets its own, explicitly failure-specific sentence', () => {
    expect(component).toMatch(/\{!value\.onwardService && value\.diagnosticOnwardService && <p/);
    expect(component).toContain('This service is shown only to explain the failure. It does not meet your requirement');
  });
  it('EK22-style failure (Manchester -> Dubai, Emirates coach, Yas Marina Circuit deadline): no onwardService, so the success-specific paragraph cannot render', () => {
    const b = run((i) => {
      i.destination = { name: 'Yas Marina Circuit', timeZone: 'Asia/Dubai' };
      i.deadline = { date: '2026-12-06', time: '17:00', timeZone: 'Asia/Dubai' };
      i.arrivalAirport = { name: 'Dubai Terminal 3', timeZone: 'Asia/Dubai' };
      i.onward = { ...blankScheduled('Asia/Dubai', 'Asia/Dubai'), mode: 'coach', from: { name: 'Dubai Terminal 3 coach stand', timeZone: 'Asia/Dubai' }, to: { name: 'Abu Dhabi', timeZone: 'Asia/Dubai' }, minimumBeforeDeparture: 15,
        services: [{ id: 'EK22 coach', departure: { date: '2026-12-06', time: '10:00', timeZone: 'Asia/Dubai' }, arrival: { date: '2026-12-06', time: '11:30', timeZone: 'Asia/Dubai' } }] };
      // A very long final-mile allowance means the coach is genuinely
      // catchable (ready well before its required boarding cushion) but its
      // arrival still cannot reach the destination in time for the
      // deadline -- exactly "EK22 says no qualifying service exists"
      // (catchable, but does not fit the downstream deadline).
      i.finalMile = { kind: 'flexible', mode: 'taxi', minutes: 500, buffer: 10 };
      i.flights[1] = { ...i.flights[1], label: 'EK22', departure: { date: '2026-12-05', time: '22:00', timeZone: 'Europe/London' }, landing: { date: '2026-12-06', time: '08:00', timeZone: 'Asia/Dubai' } };
      i.arrivalProcess = { disembark: 10, immigration: 30, baggage: 20, customs: 5, walkToTransport: 10 };
    }).options[1];
    expect(b.state).toBe('NO');
    expect(b.onwardService).toBeUndefined();
    expect(b.diagnosticOnwardService).toBe('EK22 coach');
    // The data contract the render fix depends on: no real selection exists
    // for this option, so `{value.onwardService && ...}` cannot render the
    // success-specific paragraph for it.
  });
  it('replaces the three traveller-facing technical labels with plain language, without touching calculation semantics', () => {
    expect(component).toContain("['Latest arrival that still works', fmt(value.effectiveLatestArrival)]");
    expect(component).toContain("['Time before your deadline', value.deadlineMargin === undefined");
    expect(component).toContain("['First service you can realistically catch',");
    expect(component).toContain("['Latest entered service that still gets you there in time',");
    expect(component).not.toContain("['Effective latest arrival',");
    expect(component).not.toContain("['Clock-deadline margin',");
    expect(component).not.toContain("['Earliest qualifying onward service',");
    expect(component).not.toContain("['Latest deadline-compatible service — planning boundary',");
  });
  it('keeps the fragility and fallback features (Tester 2) unchanged by this fix — same source, same conditions', () => {
    expect(component).toContain('YES — BUT THIS PLAN IS FRAGILE');
    expect(component).toContain('NO FALLBACK HAS BEEN ENTERED');
    expect(component).toContain("value.confidence === 'FRAGILE'");
  });
  it('the option card layout still resists horizontal overflow at narrow widths (320px)', () => {
    expect(component).toContain('min-w-0 break-words');
    expect(component).not.toMatch(/\bw-\[\d{3,}px\]/); // no hardcoded wide pixel width that would force horizontal scroll
    // The failed-option detail compression is a plain <details>, not a fixed-width element.
    expect(component).toContain("Why this doesn't work — full detail");
  });
  it('separates connection slack from final-arrival slack and shows the weakest point, never a single conflated "delay that breaks the plan" figure', () => {
    expect(component).toContain("['Connection slack',");
    expect(component).toContain("['Final-arrival slack',");
    expect(component).toContain('Weakest point');
    expect(component).not.toContain("['Additional delay that breaks the plan',");
  });
  it('a failed option shows plain already-misses wording, never the fragility warning box', () => {
    expect(component).toContain('alreadyMissesText');
    expect(component).toContain('This plan already misses your clock deadline by');
    expect(component).toContain('This plan already misses your required final buffer by');
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
    // PLAN FRAGILITY CORRECTION (Tester 2, 23 Sep 2026): zero minutes of
    // spare beyond the required minimum-plus-cushion allowance is exactly
    // what "TIGHT" exists to flag — the connection clears its required bar
    // with nothing left over, not comfortably. It was wrongly reported
    // COMFORTABLE before this fix purely because this connection happens to
    // pass a nonzero extraCushion; see door-to-door.ts's Connection doc.
    expect(b.connections.find(c => c.label === 'Test 13:45')).toMatchObject({ margin: 25, minimum: 25, extraCushion: 15, spare: 0, state: 'TIGHT' });
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

/**
 * PLAN FRAGILITY CORRECTION (Tester 2, 23 Sep 2026): Manchester -> Dubai ->
 * Abu Dhabi -> Yas Marina Circuit. A 4-hour final-deadline margin (13:00
 * arrival, 17:00 event) hid a coach connection with only ~10 minutes of
 * genuine delay tolerance, because COMFORTABLE was computed purely from
 * whether the connection cleared its required minimum-plus-cushion
 * allowance at all, not by how much. See door-to-door.ts's `Connection` and
 * `connection()` doc comments for the exact bug and fix.
 */
describe('plan fragility correction — large final margin must not mask a thin connection', () => {
  it('a large final-deadline margin does not mask a fragile intermediate connection (base scenario reproduces Tester 2 exactly)', () => {
    const b = scenario().options[1];
    expect(b.state).toBe('YES');
    expect(b.deadlineStatus).toBe('MEETS REQUIREMENT');
    expect(b.deadlineMargin).toBe(250); // a comfortable-looking 4h10m final margin
    expect(b.tightest).toMatchObject({ label: 'Test 13:45', spare: 10, state: 'TIGHT' });
    expect(b.confidence).toBe('FRAGILE');
  });
  it('identifies the critical connection as the tightest one, not merely the last one computed', () => {
    const b = scenario(i => { i.onward!.minimumBeforeDeparture = 10; }).options[1];
    expect(b.tightest?.label).toBe('Test 13:45');
    expect(b.connections.length).toBeGreaterThan(1); // the tightest is picked among several real connections, not the only one
  });
  it('reports the exact additional delay tolerance the critical connection has, never a rounded or invented figure', () => {
    const b = scenario().options[1];
    // ready 13:20, selected departs 13:45, required 0 + 15 cushion = 15 -> spare exactly 10.
    expect(b.tightest?.spare).toBe(10);
    expect(b.tightest?.margin).toBe(25);
    expect(b.tightest?.minimum).toBe(15);
  });
  it('never re-labels a genuinely comfortable connection as FRAGILE just because a cushion was entered', () => {
    const b = scenario(i => { i.flights[1].landing.time = '09:35'; }).options[1]; // ready 11:20 IST
    expect(b.state).toBe('YES');
    expect(b.onwardService).toBe('Test 13:25');
    const onwardConnection = b.connections.find((c) => c.label === 'Test 13:25');
    expect(onwardConnection).toMatchObject({ spare: 110, state: 'COMFORTABLE' });
  });
  it('a failed journey (state NO) carries no fragility grade — confidence is only meaningful for a working plan', () => {
    const b = scenario(i => { i.flights[1].landing.time = '18:00'; }).options[1];
    expect(b.state).toBe('NO');
    expect(b.confidence).toBeNull();
  });
  it('a plan with no scheduled connection at all (flexible-only chain) has nothing to be fragile against', () => {
    const b = run((i) => { i.onward = null; i.finalMile = { kind: 'flexible', mode: 'taxi', minutes: 45, buffer: 15 }; }).options[1];
    expect(b.state).toBe('YES');
    expect(b.connections.length).toBeGreaterThan(0); // pre-flight and gate connections still exist
    expect(b.confidence).toBe('ROBUST'); // none of them are TIGHT under the example's generous allowances
  });
});

describe('plan fragility correction — fallback onward service ("what if I miss it?")', () => {
  it('shows the next entered onward service and whether it still meets the deadline, when one exists', () => {
    const b = scenario().options[1]; // relies on Test 13:45; Test 15:10 departs next
    expect(b.fallbackOnward).toMatchObject({
      hasNextEntered: true,
      nextService: { id: 'Test 15:10' },
      meetsDeadline: true,
      meetsDeadlineWithBuffer: true,
    });
  });
  it('honestly reports when the next entered service would miss the deadline', () => {
    const b = scenario(i => { i.deadline = { ...i.deadline, time: '14:40' }; }).options[1]; // Test 13:45 -> 14:50 rickshaw still fits; Test 15:10 -> 16:12 would miss
    expect(b.fallbackOnward?.hasNextEntered).toBe(true);
    expect(b.fallbackOnward?.nextService?.id).toBe('Test 15:10');
    expect(b.fallbackOnward?.meetsDeadline).toBe(false);
  });
  it('says plainly that no fallback was entered, rather than implying none exists in reality', () => {
    const b = scenario(i => { i.onward!.services = i.onward!.services.slice(0, 2); }).options[1]; // only 13:25 and 13:45 entered
    expect(b.onwardService).toBe('Test 13:45');
    expect(b.fallbackOnward).toEqual({ hasNextEntered: false });
  });
  it('is not computed for a turn-up-and-go onward leg — that mode has no discrete "next service" to name', () => {
    const input: DoorJourney = exampleDoorJourney();
    input.onward = { kind: 'turn-up-and-go', mode: 'metro', from: { name: 'Airport metro', timeZone: 'Asia/Kolkata' }, to: { name: 'City metro', timeZone: 'Asia/Kolkata' },
      minimumBeforeDeparture: 5, operatingWindows: [{ days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], opens: '05:00', closes: '23:00', closesNextDay: false }],
      journeyMinutes: 20, journeyMinutesBasis: 'OFFICIAL', headwayMinutes: { min: 4, max: 6 }, plannedWaitMinutes: null };
    const b = planDoorJourney(input, NOW).options[1];
    expect(b.turnUpAndGo).toBeDefined();
    expect(b.fallbackOnward).toBeUndefined();
  });
});

/**
 * WHOLE-JOURNEY CONFIDENCE CORRECTION (24 Sep 2026, live test after Tester
 * 3). Reproduced exactly: Option A of the Preston -> Ahmedabad example with
 * flight A landing 15:05 instead of 15:55 selects "Example onward 17:35"
 * (17:10 becomes uncatchable, 17:35 is the first catchable+fitting
 * service) -- final arrival 18:47, clock deadline 19:00, required buffer
 * 10 min, so final-arrival slack is exactly 3 min, while the tightest
 * scheduled connection (the Preston pre-flight train) has 15 min of spare.
 * The old model called this ROBUST and reported "15 min" as the delay
 * that breaks the plan; both were wrong -- 3 min at the final arrival is
 * the real limit.
 */
describe('whole-journey confidence correction — final-arrival slack is as real a constraint as any connection', () => {
  it('reproduces the exact live-tested case: 15 min connection slack, 3 min final-arrival slack -> weakest point is the final arrival, not ROBUST', () => {
    const b = run((i) => { i.flights[0].landing.time = '15:05'; }).options[0];
    expect(b.state).toBe('YES');
    expect(b.finalArrival?.timeHHmm).toBe('18:47');
    expect(b.deadline.timeHHmm).toBe('19:00');
    expect(b.requiredFinalBuffer).toBe(10);
    expect(b.finalArrivalSlack).toBe(3);
    expect(b.tightest).toMatchObject({ spare: 15, state: 'COMFORTABLE' });
    expect(b.weakestConstraint).toMatchObject({ kind: 'final-arrival', spare: 3 });
    expect(b.confidence).toBe('FRAGILE'); // 3 min < the entered 15 min cushion
  });
  it('+4 minutes on the final leg correctly fails the required buffer, not just a smaller "delay tolerance"', () => {
    const b = run((i) => {
      i.flights[0].landing.time = '15:05';
      i.finalMile = { ...i.finalMile, minutes: (i.finalMile.minutes ?? 0) + 4 };
    }).options[0];
    expect(b.state).toBe('NO');
    expect(b.deadlineStatus).toBe('BEFORE DEADLINE, BUT BUFFER NOT MET');
    expect(b.alreadyMisses).toMatchObject({ kind: 'buffer' });
    expect(b.alreadyMisses!.minutes).toBeGreaterThan(0); // a plain positive shortfall, never a negative "delay that breaks the plan"
    expect(b.confidence).toBeNull(); // fragility is only meaningful for a plan that currently works
  });
  it('a comfortable final-arrival slack with a genuinely tight connection: the weakest point stays the connection, not the final arrival', () => {
    const b = run((i) => {
      i.flights[1].landing.time = '11:35'; i.onward!.minimumBeforeDeparture = 0; i.connectionCushion = 15;
      i.onward!.services = [['13:25', '14:00'], ['13:45', '14:30'], ['15:10', '16:02'], ['17:35', '18:27']].map(([departure, arrival]) => ({
        id: `Test ${departure}`, departure: { date: '2026-11-03', time: departure, timeZone: 'Asia/Kolkata' }, arrival: { date: '2026-11-03', time: arrival, timeZone: 'Asia/Kolkata' },
      }));
    }).options[1];
    // Base fixture: deadline 19:00, buffer 10 -> huge final-arrival slack; onward connection spare 10 < cushion 15.
    expect(b.state).toBe('YES');
    expect(b.finalArrivalSlack).toBeGreaterThan(100);
    expect(b.tightest).toMatchObject({ spare: 10, state: 'TIGHT' });
    expect(b.weakestConstraint).toMatchObject({ kind: 'connection', spare: 10 });
    expect(b.confidence).toBe('FRAGILE');
  });
  it('both margins comfortably large: ROBUST remains possible, unchanged from the original example', () => {
    const b = run().options[1];
    expect(b.state).toBe('YES');
    expect(b.finalArrivalSlack).toBe(28);
    expect(b.tightest).toMatchObject({ spare: 15, state: 'COMFORTABLE' });
    expect(b.weakestConstraint).toMatchObject({ spare: 15 });
    expect(b.confidence).toBe('ROBUST');
  });
  it('a genuine clock-deadline miss (not just a buffer miss) is reported with plain already-misses wording, never a negative delay-tolerance figure', () => {
    const b = run((i) => {
      i.flights[1].landing.time = '11:35'; i.onward!.minimumBeforeDeparture = 0; i.connectionCushion = 15;
      i.onward!.services = [{ id: 'Test 13:45', departure: { date: '2026-11-03', time: '13:45', timeZone: 'Asia/Kolkata' }, arrival: { date: '2026-11-03', time: '18:41', timeZone: 'Asia/Kolkata' } }];
    }).options[1];
    // Base fixture: deadline 19:00 (from exampleDoorJourney), finalMile 20 min -> finish 19:01, 1 min past the clock deadline.
    expect(b.state).toBe('NO');
    expect(b.deadlineStatus).toBe('MISSES DEADLINE');
    expect(b.deadlineMargin).toBe(-1);
    expect(b.alreadyMisses).toMatchObject({ kind: 'deadline', minutes: 1 });
    expect(b.confidence).toBeNull();
  });
  it('fallback behaviour is unaffected by the confidence-model correction', () => {
    const b = run().options[1];
    expect(b.fallbackOnward).toMatchObject({ hasNextEntered: true, meetsDeadline: true });
  });
  it('the EK22 no-qualifying-service fix from the previous correction is unaffected', () => {
    const b = run((i) => { i.flights[1].landing.time = '18:00'; }).options[1];
    expect(b.state).toBe('NO');
    expect(b.onwardService).toBeUndefined();
    expect(b.confidence).toBeNull();
  });
});
});

/**
 * POST-SIMULATION SAFETY CORRECTION (24 Sep 2026). Four controlled
 * simulations (not human-validation evidence) were run against the live
 * prototype to close truth/safety defects before further real-traveller
 * piloting.
 */
describe('connecting-flight safety — SIM-2 (Belfast -> Manchester -> Newquay -> taxi -> family near Truro)', () => {
  it('fails an option closed (CANNOT CONFIRM) when its flight declares an unmodelled internal connection, never a whole-journey verdict', () => {
    const input = exampleDoorJourney();
    input.flights[0].hasUnmodelledConnection = true;
    const b = planDoorJourney(input, NOW).options[0];
    expect(b.state).toBe('CANNOT CONFIRM');
    expect(b.unmodelledFlightConnection).toBe(true);
    expect(b.confidence).toBeNull();
    expect(b.reasons).toContain('This journey includes a flight connection that Arrive By has not checked. Connection time, terminal transfer, baggage/re-check requirements and ticket protection may affect whether it works.');
  });
  it('a flight NOT declaring an unmodelled connection is completely unaffected by the new field', () => {
    const b = run().options[1];
    expect(b.unmodelledFlightConnection).toBeUndefined();
    expect(b.state).toBe('YES');
  });
});

describe('fixed-timetable validation — SIM-4 (ordinary UK coach services)', () => {
  const NOW_UK = '2026-09-20T12:00:00Z';
  /** required arrival 17:00, no buffer -- an ordinary same-day UK coach + walk final leg. */
  function ukCoachJourney(change?: (input: DoorJourney) => void): DoorJourney {
    const input = blankDoorJourney();
    input.home = { name: 'Home', timeZone: 'Europe/London' };
    input.departureAirport = { name: 'Departure airport', timeZone: 'Europe/London' };
    input.arrivalAirport = { name: 'Newquay Airport', timeZone: 'Europe/London' };
    input.destination = { name: 'Venue near Truro', timeZone: 'Europe/London' };
    input.deadline = { date: '2026-11-17', time: '17:00', timeZone: 'Europe/London' };
    input.finalBuffer = 0; input.connectionCushion = 15;
    input.toAirport = { kind: 'flexible', mode: 'car', minutes: 20, buffer: 10 };
    input.departureProcess = { terminalTransfer: 5, checkIn: 20, security: 20, boarding: 15 };
    input.arrivalProcess = { disembark: 0, immigration: 0, baggage: 0, customs: 0, walkToTransport: 0 };
    input.onward = { kind: 'scheduled', mode: 'coach', from: { name: 'Newquay Airport coach stand', timeZone: 'Europe/London' }, to: { name: 'Parkside', timeZone: 'Europe/London' }, minimumBeforeDeparture: 10,
      services: [['09:25', '10:10'], ['16:25', '17:10'], ['20:25', '21:10']].map(([departure, arrival]) => ({
        id: `Coach ${departure}`, departure: { date: '2026-11-17', time: departure, timeZone: 'Europe/London' }, arrival: { date: '2026-11-17', time: arrival, timeZone: 'Europe/London' },
      })) };
    input.finalMile = { kind: 'flexible', mode: 'walk', minutes: 20, buffer: 5 };
    input.flights = [
      { label: 'Early flight', priceGBP: null, hasUnmodelledConnection: false, departure: { date: '2026-11-17', time: '07:30', timeZone: 'Europe/London' }, landing: { date: '2026-11-17', time: '08:15', timeZone: 'Europe/London' } },
      { label: 'Later flight', priceGBP: null, hasUnmodelledConnection: false, departure: { date: '2026-11-17', time: '14:20', timeZone: 'Europe/London' }, landing: { date: '2026-11-17', time: '15:05', timeZone: 'Europe/London' } },
    ];
    change?.(input);
    return input;
  }
  it('validates ordinary same-day, same-time-zone coach services without the previously reported validation error', () => {
    const result = planDoorJourney(ukCoachJourney(), NOW_UK);
    expect(result.errors).toEqual([]);
  });
  it('the early flight catches the 09:25 coach and arrives at the venue well before the required 17:00 arrival', () => {
    const b = planDoorJourney(ukCoachJourney(), NOW_UK).options[0];
    expect(b.state).toBe('YES');
    expect(b.onwardService).toBe('Coach 09:25');
    expect(b.finalArrival?.timeHHmm).toBe('10:35');
  });
  it('the later flight can only reach the 16:25 coach, which arrives after the required 17:00 buffer -- a genuine, honestly-reported failure', () => {
    const b = planDoorJourney(ukCoachJourney(), NOW_UK).options[1];
    expect(b.state).toBe('NO');
    expect(b.onwardService).toBeUndefined();
    expect(b.diagnosticOnwardService).toBe('Coach 16:25');
    expect(b.finalArrival?.timeHHmm).toBe('17:35');
    // finalBuffer is 0, so a miss past the clock deadline is a genuine deadline
    // miss, not a separate buffer shortfall -- there is no buffer window to fall short of.
    expect(b.alreadyMisses).toMatchObject({ kind: 'deadline' });
    // The fallback (20:25 coach) is even later, so it does not rescue this option either.
    expect(b.fallbackOnward).toMatchObject({ hasNextEntered: true, meetsDeadline: false });
  });
  it('a service departing before or exactly at its stated arrival is still correctly rejected -- the diagnostics are more specific, not weaker', () => {
    const result = planDoorJourney(ukCoachJourney((i) => {
      (i.onward as ScheduledTransport).services[0].arrival.time = '09:00'; // before its own 09:25 departure
    }), NOW_UK);
    expect(result.errors.join(' ')).toContain('the arrival must be after the departure');
  });
});

describe('start-blank state isolation — deadline reason and all journey-specific state', () => {
  const component = readFileSync('components/founder/arrive-by-door-to-door.tsx', 'utf8');
  it('both "Start blank" and "Load fictional example" reset the deadline reason, not just the journey', () => {
    const startBlank = component.match(/onClick=\{\(\) => \{ setJourney\(blankDoorJourney\(\)\); setExample\(false\); setResult\(null\); setDeadlineReason\(''\); \}\}/);
    const loadExample = component.match(/onClick=\{\(\) => \{ setJourney\(exampleDoorJourney\(\)\); setExample\(true\); setResult\(null\); setDeadlineReason\(''\); \}\}/);
    expect(startBlank).not.toBeNull();
    expect(loadExample).not.toBeNull();
  });
  it('"Start blank" fully replaces the journey object (never merges), so every journey-specific field -- deadline, buffer, flights, onward, turn-up-and-go entries, labels -- starts genuinely empty', () => {
    const blank = blankDoorJourney();
    expect(blank.deadline).toEqual({ date: '', time: '', timeZone: 'Asia/Kolkata' });
    expect(blank.finalBuffer).toBeNull();
    expect(blank.connectionCushion).toBeNull();
    expect(blank.onward).toBeNull();
    expect(blank.flights).toHaveLength(1);
    expect(blank.flights[0]).toMatchObject({ label: 'Option A', priceGBP: null, hasUnmodelledConnection: false });
    expect(blank.flights[0].departure).toEqual({ date: '', time: '', timeZone: 'Europe/London' });
  });
});

describe('stage-specific slack wording and operating-window as a weakest-constraint candidate — SIM-3', () => {
  const DUBAI = 'Asia/Dubai';
  function tramJourney(change?: (input: DoorJourney) => void): DoorJourney {
    const input = exampleDoorJourney() as DoorJourney;
    input.arrivalAirport = { name: 'Arrival airport', timeZone: DUBAI };
    input.destination = { name: 'City flat', timeZone: DUBAI };
    input.deadline = { date: '2026-11-11', time: '23:00', timeZone: DUBAI };
    input.onward = {
      kind: 'turn-up-and-go', mode: 'metro', from: { name: 'Airport metro', timeZone: DUBAI }, to: { name: 'City metro', timeZone: DUBAI },
      minimumBeforeDeparture: 5,
      // Ready ~22:25 (20:40 landing + the example's 105 min processing);
      // closing at 22:37 leaves 12 min of window spare (still enough for the
      // 5 min access + up to 6 min headway wait to complete before closing)
      // -- deliberately tighter than the pre-flight train connection's own
      // 15 min, so this is genuinely the weaker of the two candidates.
      operatingWindows: [{ days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], opens: '06:00', closes: '22:37', closesNextDay: false }],
      journeyMinutes: 20, journeyMinutesBasis: 'OFFICIAL', headwayMinutes: { min: 4, max: 6 }, plannedWaitMinutes: null,
    };
    input.finalMile = { kind: 'flexible', mode: 'walk', minutes: 10, buffer: 5 };
    input.flights = [{ label: 'Comfortable arrival', priceGBP: null, hasUnmodelledConnection: false, departure: { date: '2026-11-10', time: '09:50', timeZone: 'Europe/London' }, landing: { date: '2026-11-10', time: '20:40', timeZone: DUBAI } }];
    change?.(input);
    return input;
  }
  it('the operating-window closure becomes a weakest-constraint candidate, correctly identified over an unrelated, smaller-but-irrelevant pre-flight number', () => {
    const b = planDoorJourney(tramJourney(), NOW).options[0];
    expect(b.state).toBe('YES');
    expect(b.turnUpAndGo?.windowSpareMinutes).toBeDefined();
    expect(b.turnUpAndGo!.windowSpareMinutes!).toBeGreaterThan(0);
    // With the operating window closing at 23:00 and this traveller ready mid-evening,
    // the window spare is the smallest margin in this journey -- it, not gate/boarding, is the weakest point.
    expect(b.weakestConstraint?.kind).toBe('operating-window');
  });
  it('the connection slack, final-arrival slack and (when applicable) operating-window slack are always separately visible, never conflated into one unqualified number', () => {
    const component = readFileSync('components/founder/arrive-by-door-to-door.tsx', 'utf8');
    expect(component).toMatch(/\['Connection slack',/);
    expect(component).toMatch(/\['Final-arrival slack',/);
    expect(component).toMatch(/\['Operating-window slack',/);
  });
});

describe('primary plan fragility vs fallback resilience — SIM-1', () => {
  it('a tight primary connection with a fallback that comfortably meets the deadline stays FRAGILE, not silently promoted to ROBUST', () => {
    // Reproduces the proven Tester-2 fragility fixture (onward connection
    // spare 10 < cushion 15 -> TIGHT), which already has a later entered
    // service (15:10) that comfortably meets the deadline on its own.
    const b = run((i) => {
      i.flights[1].landing.time = '11:35'; i.onward!.minimumBeforeDeparture = 0; i.connectionCushion = 15;
      i.onward!.services = [['13:25', '14:00'], ['13:45', '14:30'], ['15:10', '16:02'], ['17:35', '18:27']].map(([departure, arrival]) => ({
        id: `Test ${departure}`, departure: { date: '2026-11-03', time: departure, timeZone: 'Asia/Kolkata' }, arrival: { date: '2026-11-03', time: arrival, timeZone: 'Asia/Kolkata' },
      }));
    }).options[1];
    expect(b.state).toBe('YES');
    expect(b.onwardService).toBe('Test 13:45');
    expect(b.confidence).toBe('FRAGILE'); // primary plan's own tightness is unchanged
    expect(b.fallbackOnward).toMatchObject({ hasNextEntered: true, nextService: { id: 'Test 15:10' }, meetsDeadline: true, meetsDeadlineWithBuffer: true });
  });
  it('the reassuring fallback sentence and the labelled fallback rows exist in the fragility warning, without altering confidence itself', () => {
    const component = readFileSync('components/founder/arrive-by-door-to-door.tsx', 'utf8');
    expect(component).toContain('Your planned connection is tight, but the next entered service still gets you there in time');
    expect(component).toContain('Fallback available:');
    expect(component).toContain('Fallback final arrival:');
    expect(component).toContain('Fallback meets required arrival:');
  });
});
