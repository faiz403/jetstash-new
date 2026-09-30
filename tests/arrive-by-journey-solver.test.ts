import { describe, expect, it } from 'vitest';
import { clockOf, floorToMinutes, formatLocalDateTime, parseLocalDateTime, zoneOffsetMinutes } from '@/lib/arrive-by-journey/local-time';
import { describeBuffer, shortPlaceName, solveJourney, type SolverAirport, type SolverInput } from '@/lib/arrive-by-journey/solver';
import type { JourneyPlan, ResolvedLeg } from '@/lib/arrive-by-journey/types';

/**
 * Golden tests for the pure journey-chain solver. Every input is fixed, every
 * expected instant is derived by hand (shown in the comments) so a failure
 * points at the arithmetic, not at Google. No network, no clock.
 */

const MAN: SolverAirport = { code: 'MAN', name: 'Manchester Airport', timeZone: 'Europe/London' };
const EDI: SolverAirport = { code: 'EDI', name: 'Edinburgh Airport', timeZone: 'Europe/London' };
const LHR: SolverAirport = { code: 'LHR', name: 'London Heathrow Airport', timeZone: 'Europe/London' };
const ISB: SolverAirport = { code: 'ISB', name: 'Islamabad International Airport', timeZone: 'Asia/Karachi' };
const JNB: SolverAirport = { code: 'JNB', name: 'O. R. Tambo International Airport', timeZone: 'Africa/Johannesburg' };
const JFK: SolverAirport = { code: 'JFK', name: 'John F. Kennedy International Airport', timeZone: 'America/New_York' };
const DXB: SolverAirport = { code: 'DXB', name: 'Dubai International Airport', timeZone: 'Asia/Dubai' };
const DEL: SolverAirport = { code: 'DEL', name: 'Indira Gandhi International Airport', timeZone: 'Asia/Kolkata' };
const KTM: SolverAirport = { code: 'KTM', name: 'Tribhuvan International Airport', timeZone: 'Asia/Kathmandu' };
const AKL: SolverAirport = { code: 'AKL', name: 'Auckland Airport', timeZone: 'Pacific/Auckland' };
const HNL: SolverAirport = { code: 'HNL', name: 'Daniel K. Inouye International Airport', timeZone: 'Pacific/Honolulu' };

const entered = (minutes: number): ResolvedLeg => ({ status: 'OK', expectedSeconds: minutes * 60, evidence: { kind: 'ENTERED', source: 'test origin leg' } });
const google = (minutes: number): ResolvedLeg => ({ status: 'OK', expectedSeconds: minutes * 60, staticSeconds: minutes * 60 - 120, evidence: { kind: 'GOOGLE_ROUTES', source: 'test Google leg', checkedAt: '2026-10-01T09:00:00.000Z' } });
const missing = (reason: 'ORIGIN_LEG_MISSING' | 'ARRIVAL_ROUTE_UNAVAILABLE'): ResolvedLeg => ({ status: 'NOT_EVIDENCED', reason });

function solve(overrides: Partial<SolverInput> & Pick<SolverInput, 'departureAirport' | 'arrivalAirport' | 'flight'>): JourneyPlan {
  return solveJourney({
    startLabel: 'Preston, Lancashire',
    destinationLabel: 'Mirpur, Azad Kashmir',
    preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60, pickupWaitMinutes: 15 },
    originLeg: entered(55),
    arrivalLeg: google(170),
    ...overrides,
  });
}

const iso = (plan: JourneyPlan) => ({ leave: plan.leaveBy?.iso, arriveBy: plan.airportArriveBy?.iso, final: plan.finalArrival?.iso });

describe('GOLDEN: Preston → MAN → ISB → Mirpur', () => {
  // Flight departs 11:00 London (GMT = 11:00Z), lands 23:30 Karachi (+5 = 18:30Z): 450 min.
  const flight = { departsLocal: '2027-01-15T11:00', arrivesLocal: '2027-01-15T23:30', label: 'PK 702' };
  const plan = solve({ departureAirport: MAN, arrivalAirport: ISB, flight });

  it('leave-by: 11:00Z - 120 min buffer = 09:00Z at the airport; - 55 min drive = 08:05Z', () => {
    expect(plan.airportArriveBy).toMatchObject({ iso: '2027-01-15T09:00:00.000Z', clock: '09:00', bufferMinutes: 120, zone: 'Europe/London' });
    expect(plan.leaveBy).toMatchObject({ iso: '2027-01-15T08:05:00.000Z', clock: '08:05', roundedDownToFive: true });
  });

  it('final arrival: landing 18:30Z + 60 exit + 15 pickup = 19:45Z road departure; + 170 min = 22:35Z = 03:35 next day in Karachi', () => {
    expect(plan.flight).toMatchObject({ departsIso: '2027-01-15T11:00:00.000Z', arrivesIso: '2027-01-15T18:30:00.000Z', elapsedMinutes: 450 });
    expect(plan.finalArrival).toMatchObject({ iso: '2027-01-15T22:35:00.000Z', clock: '03:35', zone: 'Asia/Karachi' });
  });

  it("uses the founder's headline copy, leave-by first", () => {
    expect(plan.headline).toEqual({
      leave: 'Leave Preston by around 08:05',
      airport: 'You should reach Manchester Airport with your chosen 2-hour buffer.',
      arrival: 'Expected final arrival: Mirpur around 03:35',
    });
  });

  it('without a deadline it is an ESTIMATE_ONLY, not a verdict', () => {
    expect(plan.state).toBe('ESTIMATE_ONLY');
    expect(plan.reasons[0]).toMatch(/No deadline/);
  });

  it('the timeline is a contiguous chain, each leg carrying its evidence', () => {
    expect(plan.timeline.map((leg) => leg.kind)).toEqual(['ORIGIN_ACCESS', 'DEPARTURE_BUFFER', 'FLIGHT', 'ARRIVAL_EXIT', 'PICKUP_WAIT', 'ONWARD']);
    for (let i = 1; i < plan.timeline.length; i += 1) expect(plan.timeline[i].startIso, plan.timeline[i].kind).toBe(plan.timeline[i - 1].endIso);
    expect(plan.timeline[0].evidence).toMatchObject({ kind: 'ENTERED' });
    expect(plan.timeline[2].evidence).toMatchObject({ kind: 'ENTERED', source: 'Flight times entered by you' });
    expect(plan.timeline[5].evidence).toMatchObject({ kind: 'GOOGLE_ROUTES', checkedAt: '2026-10-01T09:00:00.000Z' });
    expect(plan.timeline[0].startIso).toBe(plan.leaveBy?.iso);
    expect(plan.timeline[5].endIso).toBe(plan.finalArrival?.iso);
  });

  it('a deadline is read in the ARRIVAL zone: 06:00 Karachi = 01:00Z, less 30 min readiness = 00:30Z, margin 115 min → POSSIBLE WITH MARGIN', () => {
    const judged = solve({ departureAirport: MAN, arrivalAirport: ISB, flight, preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60, pickupWaitMinutes: 15, finalDeadlineLocal: '2027-01-16T06:00', destinationReadinessMinutes: 30 } });
    expect(judged.deadline).toEqual({ iso: '2027-01-16T01:00:00.000Z', latestAcceptableIso: '2027-01-16T00:30:00.000Z', marginMinutes: 115 });
    expect(judged.state).toBe('POSSIBLE_WITH_MARGIN');
    expect(judged.timeline.at(-1)?.kind).toBe('DESTINATION_READINESS');
  });

  it('leaving 57 minutes for the drive rounds the leave-by DOWN to 08:00 (earlier is safe) and the buffer leg absorbs the slack', () => {
    const rounded = solve({ departureAirport: MAN, arrivalAirport: ISB, flight, originLeg: entered(57) });
    // exact: 09:00Z - 57 min = 08:03Z -> floor to 5 min = 08:00Z; reaches airport 08:57Z; 123 min before departure
    expect(rounded.leaveBy?.iso).toBe('2027-01-15T08:00:00.000Z');
    expect(rounded.timeline[1]).toMatchObject({ kind: 'DEPARTURE_BUFFER', minutes: 123, startIso: '2027-01-15T08:57:00.000Z' });
  });
});

describe('GOLDEN: UK start → flight → MAN → Sheffield', () => {
  // Edinburgh 09:00 → Manchester 10:10 (both GMT): 70 min.
  const plan = solve({
    startLabel: 'Edinburgh',
    destinationLabel: 'Sheffield',
    departureAirport: EDI,
    arrivalAirport: MAN,
    flight: { departsLocal: '2027-02-10T09:00', arrivesLocal: '2027-02-10T10:10' },
    preferences: { departureAirportBufferMinutes: 90, arrivalExitMinutes: 20 },
    originLeg: entered(40),
    arrivalLeg: google(70),
  });

  it('arithmetic: 09:00 - 90 = 07:30 at the airport; - 40 = 06:50 leave; landing 10:10 + 20 = 10:30; + 70 = 11:40', () => {
    expect(iso(plan)).toEqual({ leave: '2027-02-10T06:50:00.000Z', arriveBy: '2027-02-10T07:30:00.000Z', final: '2027-02-10T11:40:00.000Z' });
    expect(plan.flight?.elapsedMinutes).toBe(70);
  });

  it('copy reads naturally for a non-round buffer and a one-word place', () => {
    expect(plan.headline?.leave).toBe('Leave Edinburgh by around 06:50');
    expect(plan.headline?.airport).toBe('You should reach Edinburgh Airport with your chosen 1 hour 30 minute buffer.');
    expect(plan.headline?.arrival).toBe('Expected final arrival: Sheffield around 11:40');
  });

  it('no pickup wait means no pickup leg in the timeline', () => {
    expect(plan.timeline.map((leg) => leg.kind)).toEqual(['ORIGIN_ACCESS', 'DEPARTURE_BUFFER', 'FLIGHT', 'ARRIVAL_EXIT', 'ONWARD']);
  });
});

describe('GOLDEN: overnight flight (date rolls over)', () => {
  // LHR 21:30 GMT = 21:30Z → JNB next day 09:45 SAST (+2) = 07:45Z: 615 min.
  const plan = solve({
    departureAirport: LHR, arrivalAirport: JNB,
    flight: { departsLocal: '2027-01-10T21:30', arrivesLocal: '2027-01-11T09:45' },
    preferences: { departureAirportBufferMinutes: 180, arrivalExitMinutes: 45 },
    originLeg: entered(75), arrivalLeg: google(40),
  });

  it('elapsed time is real time (615 min), not the difference of the two clock readings', () => {
    expect(plan.flight?.elapsedMinutes).toBe(615);
  });

  it('leave-by is on the previous evening; final arrival is on the next calendar day in the arrival zone', () => {
    // 21:30Z - 180 = 18:30Z; - 75 = 17:15Z leave. Landing 07:45Z + 45 = 08:30Z; + 40 = 09:10Z = 11:10 SAST.
    expect(iso(plan)).toEqual({ leave: '2027-01-10T17:15:00.000Z', arriveBy: '2027-01-10T18:30:00.000Z', final: '2027-01-11T09:10:00.000Z' });
    expect(plan.finalArrival?.clock).toBe('11:10');
    expect(formatLocalDateTime(Date.parse(plan.finalArrival!.iso), 'Africa/Johannesburg').slice(0, 10)).toBe('2027-01-11');
  });
});

describe('GOLDEN: DST transitions', () => {
  it('a ground leg that crosses New York spring-forward (2027-03-14 07:00Z) uses the offset at each instant', () => {
    // LHR 22:00 GMT on 13 Mar = 22:00Z → JFK 01:30 EST on 14 Mar = 06:30Z (510 min). +60 exit = 07:30Z = 03:30 EDT (clocks jumped at 07:00Z).
    const plan = solve({
      departureAirport: LHR, arrivalAirport: JFK,
      flight: { departsLocal: '2027-03-13T22:00', arrivesLocal: '2027-03-14T01:30' },
      preferences: { departureAirportBufferMinutes: 180, arrivalExitMinutes: 60 },
      originLeg: entered(60), arrivalLeg: google(60),
    });
    expect(plan.flight).toMatchObject({ arrivesIso: '2027-03-14T06:30:00.000Z', elapsedMinutes: 510 });
    const exit = plan.timeline.find((leg) => leg.kind === 'ARRIVAL_EXIT')!;
    expect(exit.endIso).toBe('2027-03-14T07:30:00.000Z');
    expect(clockOf(Date.parse(exit.endIso), 'America/New_York')).toBe('03:30'); // a fixed -05:00 would read 02:30
    expect(plan.finalArrival).toMatchObject({ iso: '2027-03-14T08:30:00.000Z', clock: '04:30' }); // EDT, not 03:30
  });

  it('a departure on the UK clock-change day is converted with BST: 06:00 BST = 05:00Z', () => {
    // 2027-03-28: UK clocks go forward at 01:00Z. DXB landing 16:00 (+4) = 12:00Z: 420 min.
    const plan = solve({
      departureAirport: LHR, arrivalAirport: DXB,
      flight: { departsLocal: '2027-03-28T06:00', arrivesLocal: '2027-03-28T16:00' },
      preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60 },
      originLeg: entered(60), arrivalLeg: google(30),
    });
    expect(plan.flight).toMatchObject({ departsIso: '2027-03-28T05:00:00.000Z', arrivesIso: '2027-03-28T12:00:00.000Z', elapsedMinutes: 420 });
    // 05:00Z - 120 = 03:00Z at the airport (04:00 BST); - 60 = 02:00Z = 03:00 BST
    expect(plan.leaveBy).toMatchObject({ iso: '2027-03-28T02:00:00.000Z', clock: '03:00' });
  });

  it('a local time inside the spring-forward gap does not exist and is rejected, not guessed', () => {
    const plan = solve({ departureAirport: LHR, arrivalAirport: DXB, flight: { departsLocal: '2027-03-28T01:30', arrivesLocal: '2027-03-28T12:00' } });
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.notEvidenced?.reason).toBe('INVALID_INPUT');
    expect(plan.reasons[0]).toMatch(/does not exist/);
  });

  it('a local time repeated by fall-back is ambiguous and is rejected, not guessed', () => {
    const plan = solve({ departureAirport: LHR, arrivalAirport: DXB, flight: { departsLocal: '2027-10-31T01:30', arrivesLocal: '2027-10-31T14:00' } });
    expect(plan.notEvidenced?.reason).toBe('INVALID_INPUT');
    expect(plan.reasons[0]).toMatch(/happens twice/);
  });

  it('a fall-back day flight with an unambiguous time is fine and elapsed time counts the extra hour', () => {
    // 2027-10-31: UK back to GMT at 01:00Z. 03:00 London = 03:00Z. DXB 13:00 (+4) = 09:00Z: 360 min.
    const plan = solve({ departureAirport: LHR, arrivalAirport: DXB, flight: { departsLocal: '2027-10-31T03:00', arrivesLocal: '2027-10-31T13:00' } });
    expect(plan.flight?.departsIso).toBe('2027-10-31T03:00:00.000Z');
    expect(plan.flight?.elapsedMinutes).toBe(360);
  });
});

describe('GOLDEN: half-hour and quarter-hour time zones', () => {
  it('Delhi (+5:30): 14:30 IST = 09:00Z, and the final clock is read back in +5:30', () => {
    // LHR 02:00 GMT = 02:00Z; DEL 14:30 IST = 09:00Z: 420 min. exit 60 → 10:00Z (15:30 IST); + 45 → 10:45Z = 16:15 IST.
    const plan = solve({
      departureAirport: LHR, arrivalAirport: DEL,
      flight: { departsLocal: '2027-01-20T02:00', arrivesLocal: '2027-01-20T14:30' },
      preferences: { departureAirportBufferMinutes: 180, arrivalExitMinutes: 60 },
      originLeg: entered(60), arrivalLeg: google(45),
    });
    expect(plan.flight).toMatchObject({ arrivesIso: '2027-01-20T09:00:00.000Z', elapsedMinutes: 420 });
    expect(plan.finalArrival).toMatchObject({ iso: '2027-01-20T10:45:00.000Z', clock: '16:15' });
  });

  it('Kathmandu (+5:45): 15:15 NPT = 09:30Z; final clock 16:15 needs the 45-minute offset', () => {
    // exit 30 → 10:00Z (15:45 NPT); + 30 → 10:30Z = 16:15 NPT.
    const plan = solve({
      departureAirport: LHR, arrivalAirport: KTM,
      flight: { departsLocal: '2027-01-20T02:00', arrivesLocal: '2027-01-20T15:15' },
      preferences: { departureAirportBufferMinutes: 180, arrivalExitMinutes: 30 },
      originLeg: entered(60), arrivalLeg: google(30),
    });
    expect(plan.flight).toMatchObject({ arrivesIso: '2027-01-20T09:30:00.000Z', elapsedMinutes: 450 });
    expect(plan.finalArrival?.clock).toBe('16:15');
    expect(zoneOffsetMinutes('Asia/Kathmandu', Date.parse('2027-01-20T09:30:00Z'))).toBe(345);
  });

  it('rounding of the final clock works on a quarter-hour zone (nearest 5, not nearest hour)', () => {
    const plan = solve({
      departureAirport: LHR, arrivalAirport: KTM,
      flight: { departsLocal: '2027-01-20T02:00', arrivesLocal: '2027-01-20T15:15' },
      preferences: { departureAirportBufferMinutes: 180, arrivalExitMinutes: 33 }, // 15:48 → drive 31 → 16:19 → nearest 5 = 16:20
      originLeg: entered(60), arrivalLeg: google(31),
    });
    expect(plan.finalArrival?.clock).toBe('16:20');
  });
});

describe('GOLDEN: international date line', () => {
  it('east across the line: LHR → Auckland lands two calendar days later but only 25.5 hours passed', () => {
    // LHR 2027-01-10 21:00 GMT = 21:00Z → AKL 2027-01-12 11:30 NZDT (+13) = 2027-01-11 22:30Z: 1530 min.
    const plan = solve({
      departureAirport: LHR, arrivalAirport: AKL,
      flight: { departsLocal: '2027-01-10T21:00', arrivesLocal: '2027-01-12T11:30' },
      preferences: { departureAirportBufferMinutes: 180, arrivalExitMinutes: 60 },
      originLeg: entered(90), arrivalLeg: google(60),
    });
    expect(plan.flight).toMatchObject({ arrivesIso: '2027-01-11T22:30:00.000Z', elapsedMinutes: 1530 });
    // exit 60 → 23:30Z; + 60 → 2027-01-12T00:30Z = 13:30 NZDT on the 12th.
    expect(plan.finalArrival).toMatchObject({ iso: '2027-01-12T00:30:00.000Z', clock: '13:30' });
  });

  it('west toward Hawaii: local clocks say the same day, real elapsed time is 14 hours', () => {
    // LHR 2027-01-10 11:00 GMT = 11:00Z → HNL 2027-01-10 15:00 HST (-10) = 2027-01-11 01:00Z: 840 min.
    const plan = solve({
      departureAirport: LHR, arrivalAirport: HNL,
      flight: { departsLocal: '2027-01-10T11:00', arrivesLocal: '2027-01-10T15:00' },
      preferences: { departureAirportBufferMinutes: 180, arrivalExitMinutes: 60 },
      originLeg: entered(60), arrivalLeg: google(30),
    });
    expect(plan.flight).toMatchObject({ arrivesIso: '2027-01-11T01:00:00.000Z', elapsedMinutes: 840 });
    // + 60 = 02:00Z; + 30 = 02:30Z = 16:30 HST on 10 Jan.
    expect(plan.finalArrival).toMatchObject({ iso: '2027-01-11T02:30:00.000Z', clock: '16:30' });
  });

  it('a landing that is "later" on the clock but earlier in real time is rejected', () => {
    // HNL 00:30 on the 10th = 10:30Z, which is BEFORE the 11:00Z departure.
    const plan = solve({ departureAirport: LHR, arrivalAirport: HNL, flight: { departsLocal: '2027-01-10T11:00', arrivesLocal: '2027-01-10T00:30' } });
    expect(plan.notEvidenced?.reason).toBe('INVALID_INPUT');
    expect(plan.reasons[0]).toMatch(/after the departure/);
  });

  it('an implausibly long entry (wrong date) is rejected rather than planned', () => {
    const plan = solve({ departureAirport: LHR, arrivalAirport: AKL, flight: { departsLocal: '2027-01-10T21:00', arrivesLocal: '2027-01-14T11:30' } });
    expect(plan.notEvidenced?.reason).toBe('INVALID_INPUT');
    expect(plan.reasons[0]).toMatch(/36 hours/);
  });
});

describe('airport-buffer arithmetic', () => {
  const flight = { departsLocal: '2027-01-15T11:00', arrivesLocal: '2027-01-15T23:30' };
  const withBuffer = (departureAirportBufferMinutes: number, origin = 60) => solve({ departureAirport: MAN, arrivalAirport: ISB, flight, preferences: { departureAirportBufferMinutes, arrivalExitMinutes: 60 }, originLeg: entered(origin) });

  it('the airport arrive-by time is exactly departure minus the chosen buffer, for any buffer', () => {
    for (const minutes of [0, 30, 90, 120, 150, 240, 480]) {
      const plan = withBuffer(minutes);
      expect(Date.parse('2027-01-15T11:00:00Z') - Date.parse(plan.airportArriveBy!.iso), `buffer ${minutes}`).toBe(minutes * 60000);
      expect(plan.airportArriveBy?.bufferMinutes).toBe(minutes);
    }
  });

  it('a zero buffer puts the traveller at the airport at departure, and leave-by is the drive before that', () => {
    const plan = withBuffer(0, 60);
    expect(plan.airportArriveBy?.iso).toBe('2027-01-15T11:00:00.000Z');
    expect(plan.leaveBy?.iso).toBe('2027-01-15T10:00:00.000Z');
  });

  it('a longer buffer moves leave-by earlier, minute for minute (multiples of 5)', () => {
    const a = withBuffer(120).leaveBy!.iso;
    const b = withBuffer(180).leaveBy!.iso;
    expect(Date.parse(a) - Date.parse(b)).toBe(60 * 60000);
  });

  it('the buffer the traveller chose is what the copy states', () => {
    expect(withBuffer(150).headline?.airport).toBe('You should reach Manchester Airport with your chosen 2 hour 30 minute buffer.');
    expect(describeBuffer(45)).toBe('45-minute');
    expect(describeBuffer(180)).toBe('3-hour');
  });

  it('buffers outside 0..480 whole minutes are rejected, never clamped', () => {
    for (const bad of [-1, 481, 1.5, Number.NaN]) {
      const plan = withBuffer(bad as number);
      expect(plan.state, String(bad)).toBe('CANNOT_CONFIRM');
      expect(plan.notEvidenced?.reason).toBe('INVALID_INPUT');
    }
  });

  it('floorToMinutes rounds down (never later) and is exact on multiples', () => {
    expect(new Date(floorToMinutes(Date.parse('2027-01-15T08:04:59Z'))).toISOString()).toBe('2027-01-15T08:00:00.000Z');
    expect(new Date(floorToMinutes(Date.parse('2027-01-15T08:05:00Z'))).toISOString()).toBe('2027-01-15T08:05:00.000Z');
  });
});

describe('final-deadline arithmetic', () => {
  // Baseline final arrival is 22:35Z on 15 Jan = 03:35 on 16 Jan in Karachi.
  const flight = { departsLocal: '2027-01-15T11:00', arrivesLocal: '2027-01-15T23:30' };
  const judged = (deadlineLocal: string, readiness = 0) => solve({
    departureAirport: MAN, arrivalAirport: ISB, flight,
    preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60, pickupWaitMinutes: 15, finalDeadlineLocal: deadlineLocal, destinationReadinessMinutes: readiness },
  });

  it('margin 21 minutes is POSSIBLE WITH MARGIN; margin 20 is POSSIBLE BUT TIGHT (the threshold is inclusive); margin -1 is NOT FEASIBLE', () => {
    expect(judged('2027-01-16T03:56').deadline?.marginMinutes).toBe(21);
    expect(judged('2027-01-16T03:56').state).toBe('POSSIBLE_WITH_MARGIN');
    expect(judged('2027-01-16T03:55').deadline?.marginMinutes).toBe(20);
    expect(judged('2027-01-16T03:55').state).toBe('POSSIBLE_BUT_TIGHT');
    expect(judged('2027-01-16T03:34').deadline?.marginMinutes).toBe(-1);
    expect(judged('2027-01-16T03:34').state).toBe('NOT_FEASIBLE');
  });

  it('a margin of exactly zero is tight, not a miss', () => {
    expect(judged('2027-01-16T03:35').deadline?.marginMinutes).toBe(0);
    expect(judged('2027-01-16T03:35').state).toBe('POSSIBLE_BUT_TIGHT');
  });

  it('the readiness time is subtracted from the deadline before comparing', () => {
    // 04:35 deadline with 60 min readiness = latest 03:35 = arrival → margin 0.
    const plan = judged('2027-01-16T04:35', 60);
    expect(plan.deadline?.latestAcceptableIso).toBe('2027-01-15T22:35:00.000Z');
    expect(plan.deadline?.marginMinutes).toBe(0);
  });

  it('the margin is exact arithmetic even though the displayed arrival is rounded to 5 minutes', () => {
    const plan = solve({
      departureAirport: MAN, arrivalAirport: ISB, flight,
      preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 63, pickupWaitMinutes: 15, finalDeadlineLocal: '2027-01-16T04:00' },
      arrivalLeg: { status: 'OK', expectedSeconds: 170 * 60 + 40, evidence: { kind: 'GOOGLE_ROUTES', source: 'test' } },
    });
    // final = 18:30Z + 78 min + 170 min 40 s = 22:38:40Z; deadline 23:00Z → margin = 21.33 → 21 min
    expect(plan.finalArrival?.iso).toBe('2027-01-15T22:38:40.000Z');
    expect(plan.finalArrival?.clock).toBe('03:40');
    expect(plan.deadline?.marginMinutes).toBe(21);
  });

  it('a deadline before landing is rejected; a deadline in the wrong zone would give a different (wrong) answer', () => {
    expect(judged('2027-01-15T22:00').notEvidenced?.reason).toBe('INVALID_INPUT');
    // 03:56 read in London instead of Karachi would be 03:56Z, hours after the 22:35Z arrival: proof the zone is applied.
    expect(judged('2027-01-16T03:56').deadline?.iso).toBe('2027-01-15T22:56:00.000Z');
  });

  it('a leave-by time that has already passed is NOT FEASIBLE, whatever the margin', () => {
    const plan = solve({ departureAirport: MAN, arrivalAirport: ISB, flight, nowIso: '2027-01-15T08:30:00.000Z' });
    expect(plan.state).toBe('NOT_FEASIBLE');
    expect(plan.reasons[0]).toMatch(/already passed/);
  });
});

describe('fail-closed states never yield a verdict', () => {
  const flight = { departsLocal: '2027-01-15T11:00', arrivesLocal: '2027-01-15T23:30' };

  it('a missing origin leg is CANNOT CONFIRM, still showing the evidenced arrival side but no leave-by', () => {
    const plan = solve({ departureAirport: MAN, arrivalAirport: ISB, flight, originLeg: missing('ORIGIN_LEG_MISSING') });
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.leaveBy).toBeUndefined();
    expect(plan.finalArrival?.clock).toBe('03:35');
    expect(plan.headline).toBeUndefined();
  });

  it('an unproven arrival leg is CANNOT CONFIRM, still showing when to leave but no final arrival', () => {
    const plan = solve({ departureAirport: MAN, arrivalAirport: ISB, flight, arrivalLeg: missing('ARRIVAL_ROUTE_UNAVAILABLE') });
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.leaveBy?.clock).toBe('08:05');
    expect(plan.finalArrival).toBeUndefined();
    expect(plan.deadline).toBeUndefined();
  });

  it('a deadline with no arrival leg is never judged', () => {
    const plan = solve({ departureAirport: MAN, arrivalAirport: ISB, flight, arrivalLeg: missing('ARRIVAL_ROUTE_UNAVAILABLE'), preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60, finalDeadlineLocal: '2027-01-16T12:00' } });
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.deadline).toBeUndefined();
  });

  it('a flight entry that declares a connection is CANNOT CONFIRM (connections are not modelled in V1)', () => {
    const plan = solve({ departureAirport: MAN, arrivalAirport: ISB, flight: { ...flight, declaredConnections: 1 } });
    expect(plan.state).toBe('CANNOT_CONFIRM');
    expect(plan.notEvidenced?.reason).toBe('CONNECTION_NOT_MODELLED');
  });

  it('malformed local times are rejected', () => {
    for (const bad of ['', '2027-01-15 11:00', '2027-02-30T10:00', '2027-01-15T25:00', 'tomorrow']) {
      const plan = solve({ departureAirport: MAN, arrivalAirport: ISB, flight: { departsLocal: bad, arrivesLocal: '2027-01-15T23:30' } });
      expect(plan.notEvidenced?.reason, bad).toBe('INVALID_INPUT');
    }
  });
});

describe('local-time helpers', () => {
  it('parse and format round-trip for unambiguous times in several zones', () => {
    for (const [zone, value] of [['Europe/London', '2027-07-01T12:00'], ['Asia/Kolkata', '2027-01-20T14:30'], ['Asia/Kathmandu', '2027-01-20T15:15'], ['Pacific/Auckland', '2027-01-12T11:30'], ['Pacific/Honolulu', '2027-01-10T15:00']] as const) {
      const parsed = parseLocalDateTime(value, zone);
      expect(parsed.ok, `${zone} ${value}`).toBe(true);
      if (parsed.ok) expect(formatLocalDateTime(parsed.ms, zone)).toBe(value);
    }
  });

  it('an unknown zone is an error, not a silent UTC', () => {
    expect(parseLocalDateTime('2027-01-15T11:00', 'Mars/Olympus')).toEqual({ ok: false, reason: 'INVALID_ZONE' });
  });

  it('shortPlaceName keeps the first comma-separated part', () => {
    expect(shortPlaceName('Preston, Lancashire')).toBe('Preston');
    expect(shortPlaceName('  Mirpur ')).toBe('Mirpur');
  });
});
