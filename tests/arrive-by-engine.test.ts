import { describe, it, expect } from 'vitest';
import { planArriveBy } from '@/lib/arrive-by/engine';
import { toZonedDateTime } from '@/lib/arrive-by/timezones';
import type { ArriveByInput, ArriveByPlan } from '@/lib/arrive-by/types';

const NOW = '2026-08-01T00:00:00.000Z';

function baseInput(overrides: Partial<ArriveByInput> = {}): ArriveByInput {
  return {
    originAirportSlug: 'manchester',
    destinationSlug: 'lahore',
    requiredArrivalDateLocal: '2026-09-14',
    requiredArrivalTimeLocal: '14:00',
    deadlineStrictness: 'flexible',
    baggage: 'hand-luggage-only',
    ...overrides,
  };
}

function asPlan(result: ReturnType<typeof planArriveBy>): ArriveByPlan {
  if (result.state !== 'ready_for_planning' && result.state !== 'limited_confidence') {
    throw new Error(`expected a plan, got state=${result.state}`);
  }
  return result;
}

describe('req 1: direct route with flexible deadline', () => {
  it('returns a ready_for_planning result with a full backward-planning window', () => {
    const result = planArriveBy(baseInput({ deadlineStrictness: 'flexible' }), NOW);
    expect(result.state).toBe('ready_for_planning');
    const plan = asPlan(result);
    expect(plan.journeyType).toBe('direct');
    expect(plan.confidence).toBe('normal');
    expect(plan.recommendedLatestLandingLocal.timeZone).toBe('Asia/Karachi');
    expect(plan.indicativeUkDepartureWindow.latest.timeZone).toBe('Europe/London');
  });
});

describe('req 2: direct route with strict deadline', () => {
  it('produces an earlier recommended landing time than a flexible deadline, for the same requested arrival', () => {
    const flexible = asPlan(planArriveBy(baseInput({ deadlineStrictness: 'flexible' }), NOW));
    const strict = asPlan(planArriveBy(baseInput({ deadlineStrictness: 'strict' }), NOW));
    expect(new Date(strict.recommendedLatestLandingLocal.utcIso).getTime()).toBeLessThan(
      new Date(flexible.recommendedLatestLandingLocal.utcIso).getTime()
    );
    // Exactly the 40-minute difference between the strict (60min) and flexible (20min) schedule-risk buffers.
    const diffMinutes =
      (new Date(flexible.recommendedLatestLandingLocal.utcIso).getTime() - new Date(strict.recommendedLatestLandingLocal.utcIso).getTime()) / 60000;
    expect(diffMinutes).toBe(40);
  });
});

describe('req 3: checked baggage increases the destination buffer', () => {
  it('recommends landing 35 minutes earlier for checked baggage than hand luggage only', () => {
    const handLuggage = asPlan(planArriveBy(baseInput({ baggage: 'hand-luggage-only' }), NOW));
    const checked = asPlan(planArriveBy(baseInput({ baggage: 'checked-baggage' }), NOW));
    const diffMinutes =
      (new Date(handLuggage.recommendedLatestLandingLocal.utcIso).getTime() - new Date(checked.recommendedLatestLandingLocal.utcIso).getTime()) / 60000;
    expect(diffMinutes).toBe(35);
  });
});

describe('req 4: checked baggage changes the UK planning window', () => {
  it('recommends reaching the UK airport earlier for checked baggage (extra prep time, on top of the destination-side shift)', () => {
    const handLuggage = asPlan(planArriveBy(baseInput({ baggage: 'hand-luggage-only' }), NOW));
    const checked = asPlan(planArriveBy(baseInput({ baggage: 'checked-baggage' }), NOW));
    expect(new Date(checked.recommendedOriginAirportArrivalLocal.utcIso).getTime()).toBeLessThan(
      new Date(handLuggage.recommendedOriginAirportArrivalLocal.utcIso).getTime()
    );
    // 35 min (destination buffer) + 60 min (180 - 120 UK prep) = 95 minutes earlier overall.
    const diffMinutes =
      (new Date(handLuggage.recommendedOriginAirportArrivalLocal.utcIso).getTime() - new Date(checked.recommendedOriginAirportArrivalLocal.utcIso).getTime()) /
      60000;
    expect(diffMinutes).toBe(95);
  });
});

describe('req 5: a connecting route requires leaving earlier (relative to landing) than a direct route', () => {
  it('the gap between recommended latest landing and the recommended UK departure is larger for a connecting journey', () => {
    // No same-destination direct/connecting pair exists in the supported set,
    // so this compares the gap-before-landing each journey type implies —
    // exactly the property requirement 5 is about — rather than two routes
    // to the same place.
    const direct = asPlan(planArriveBy(baseInput({ originAirportSlug: 'manchester', destinationSlug: 'lahore' }), NOW));
    const connecting = asPlan(
      planArriveBy(baseInput({ originAirportSlug: 'manchester', destinationSlug: 'dhaka', requiredArrivalDateLocal: '2026-09-20' }), NOW)
    );
    expect(connecting.journeyType).toBe('connecting');
    const directGapMinutes =
      (new Date(direct.recommendedLatestLandingLocal.utcIso).getTime() - new Date(direct.indicativeUkDepartureWindow.latest.utcIso).getTime()) / 60000;
    const connectingGapMinutes =
      (new Date(connecting.recommendedLatestLandingLocal.utcIso).getTime() - new Date(connecting.indicativeUkDepartureWindow.latest.utcIso).getTime()) /
      60000;
    expect(connectingGapMinutes).toBeGreaterThan(directGapMinutes);
  });
});

describe('req 6: cautious connection preference adds protection', () => {
  it('recommends departing 60 minutes earlier (150 - 90) than the standard preference', () => {
    const standard = asPlan(
      planArriveBy(baseInput({ destinationSlug: 'dhaka', requiredArrivalDateLocal: '2026-09-20', connectionRiskPreference: 'standard' }), NOW)
    );
    const cautious = asPlan(
      planArriveBy(baseInput({ destinationSlug: 'dhaka', requiredArrivalDateLocal: '2026-09-20', connectionRiskPreference: 'cautious' }), NOW)
    );
    const diffMinutes =
      (new Date(standard.indicativeUkDepartureWindow.latest.utcIso).getTime() - new Date(cautious.indicativeUkDepartureWindow.latest.utcIso).getTime()) /
      60000;
    expect(diffMinutes).toBe(60);
  });
});

describe('req 7: arrival deadline crossing midnight', () => {
  it('recommends a latest landing time on the calendar day BEFORE the arrival date when the deadline is in the early hours', () => {
    const result = asPlan(planArriveBy(baseInput({ requiredArrivalDateLocal: '2026-09-15', requiredArrivalTimeLocal: '00:30' }), NOW));
    expect(result.requiredArrivalLocal.dateIso).toBe('2026-09-15');
    expect(result.recommendedLatestLandingLocal.dateIso).toBe('2026-09-14');
  });
});

describe('req 8: UK and destination on different calendar dates', () => {
  it('the same required-arrival instant falls on different local calendar dates in Karachi vs the UK', () => {
    const result = asPlan(planArriveBy(baseInput({ requiredArrivalDateLocal: '2026-09-15', requiredArrivalTimeLocal: '00:30' }), NOW));
    expect(result.requiredArrivalLocal.timeZone).toBe('Asia/Karachi');
    expect(result.requiredArrivalLocal.dateIso).toBe('2026-09-15');
    const ukEquivalent = toZonedDateTime(result.requiredArrivalLocal.utcIso, 'Europe/London');
    expect(ukEquivalent.dateIso).toBe('2026-09-14');
    expect(ukEquivalent.dateIso).not.toBe(result.requiredArrivalLocal.dateIso);
  });
});

describe('req 9: daylight-saving transition handling (engine level)', () => {
  it('produces a consistent, non-throwing result whether the deadline falls in UK winter or UK summer', () => {
    const winter = planArriveBy(baseInput({ requiredArrivalDateLocal: '2026-01-20', requiredArrivalTimeLocal: '14:00' }), '2025-12-01T00:00:00.000Z');
    const summer = planArriveBy(baseInput({ requiredArrivalDateLocal: '2026-09-20', requiredArrivalTimeLocal: '14:00' }), NOW);
    expect(winter.state).toBe('ready_for_planning');
    expect(summer.state).toBe('ready_for_planning');
  });
});

describe('req 10: same-day departure recommendation', () => {
  it('Manchester-Lahore, arrival 22:00 local, recommends leaving the UK the same day', () => {
    const result = asPlan(planArriveBy(baseInput({ requiredArrivalTimeLocal: '22:00' }), NOW));
    expect(result.departureTiming).toBe('same_day');
  });
});

describe('req 11: previous-evening recommendation', () => {
  it('Manchester-Lahore, arrival 12:00 local, recommends leaving the UK the previous evening', () => {
    const result = asPlan(planArriveBy(baseInput({ requiredArrivalTimeLocal: '12:00' }), NOW));
    expect(result.departureTiming).toBe('previous_evening');
  });
});

describe('req 12: previous-day recommendation', () => {
  it('Manchester-Lahore, arrival 08:00 local, recommends leaving the UK the previous day', () => {
    const result = asPlan(planArriveBy(baseInput({ requiredArrivalTimeLocal: '08:00' }), NOW));
    expect(result.departureTiming).toBe('previous_day');
  });
});

describe('req 13: more-than-one-day-earlier recommendation', () => {
  it('Manchester-Dhaka, strict + checked baggage + cautious + an early arrival time, recommends leaving more than a day earlier', () => {
    const result = asPlan(
      planArriveBy(
        {
          originAirportSlug: 'manchester',
          destinationSlug: 'dhaka',
          requiredArrivalDateLocal: '2026-09-14',
          requiredArrivalTimeLocal: '05:00',
          deadlineStrictness: 'strict',
          baggage: 'checked-baggage',
          connectionRiskPreference: 'cautious',
        },
        NOW
      )
    );
    expect(result.departureTiming).toBe('more_than_one_day_earlier');
  });
});

describe('req 14: past deadline rejected', () => {
  it('rejects a required arrival that has already passed relative to now', () => {
    const result = planArriveBy(baseInput({ requiredArrivalDateLocal: '2026-01-01', requiredArrivalTimeLocal: '10:00' }), NOW);
    expect(result.state).toBe('invalid_deadline');
  });
});

describe('req 15: malformed date rejected', () => {
  it('rejects an impossible calendar date', () => {
    expect(planArriveBy(baseInput({ requiredArrivalDateLocal: '2026-02-30' }), NOW).state).toBe('invalid_deadline');
  });
  it('rejects a non-date string', () => {
    expect(planArriveBy(baseInput({ requiredArrivalDateLocal: 'not-a-date' }), NOW).state).toBe('invalid_deadline');
  });
  it('rejects a missing time', () => {
    expect(planArriveBy(baseInput({ requiredArrivalTimeLocal: '' }), NOW).state).toBe('invalid_deadline');
  });
  it('rejects a malformed time', () => {
    expect(planArriveBy(baseInput({ requiredArrivalTimeLocal: '25:99' }), NOW).state).toBe('invalid_deadline');
  });
  it('rejects a deadline so close no sensible planning window remains', () => {
    const almostNow = new Date(new Date(NOW).getTime() + 30 * 60000).toISOString(); // 30 minutes from now
    const dateIso = almostNow.slice(0, 10);
    const timeHHmm = almostNow.slice(11, 16);
    const result = planArriveBy(baseInput({ requiredArrivalDateLocal: dateIso, requiredArrivalTimeLocal: timeHHmm }), NOW);
    expect(result.state).toBe('invalid_deadline');
  });
});

describe('req 16: unsupported route rejected', () => {
  it('rejects a destination Arrive By does not support at all', () => {
    const result = planArriveBy(baseInput({ destinationSlug: 'istanbul' }), NOW);
    expect(result.state).toBe('unsupported_route');
  });
  it('rejects a supported destination requested from an unsupported origin', () => {
    const result = planArriveBy(baseInput({ originAirportSlug: 'birmingham', destinationSlug: 'lahore' }), NOW);
    expect(result.state).toBe('unsupported_route');
  });
});

describe('req 18: Verification Pending route returns a limited result', () => {
  it('Manchester-Lahore after its verification review date has lapsed returns route_verification_required, with no fabricated numbers', () => {
    // Manchester-Dhaka is modelled as isDirect: false ("connecting" is a
    // recorded shape decision, not a staleness-gated claim — see
    // getDisplayDirectness's own doc comment in data/routes.ts), so it can
    // never itself degrade to pending this way. Manchester-Lahore
    // (isDirect: true, reviewDueDate 2026-08-13) is the real case this
    // mechanism protects.
    const laterNow = '2026-09-05T00:00:00.000Z'; // after Lahore's 2026-08-13 reviewDueDate
    const result = planArriveBy(baseInput({ requiredArrivalDateLocal: '2026-10-01' }), laterNow);
    expect(result.state).toBe('route_verification_required');
    if (result.state === 'route_verification_required') {
      expect(result.journeyType).toBe('verification-pending');
      expect(result.routeWarning.length).toBeGreaterThan(0);
    }
  });
});

describe('req 19: withdrawal before requested travel date blocks a normal recommendation', () => {
  it('Manchester-Mumbai, travel date on/after the 2026-08-31 announced withdrawal, returns route_verification_required', () => {
    const result = planArriveBy(baseInput({ destinationSlug: 'mumbai', requiredArrivalDateLocal: '2026-09-05', requiredArrivalTimeLocal: '10:00' }), NOW);
    expect(result.state).toBe('route_verification_required');
  });
});

describe('req 20: travel before a withdrawal date preserves the warning', () => {
  it('Manchester-Mumbai, travel date before the announced withdrawal, still plans normally but with a preserved warning and limited confidence', () => {
    const result = planArriveBy(baseInput({ destinationSlug: 'mumbai', requiredArrivalDateLocal: '2026-08-20', requiredArrivalTimeLocal: '10:00' }), NOW);
    expect(result.state).toBe('limited_confidence');
    const plan = asPlan(result);
    expect(plan.confidence).toBe('limited');
    expect(plan.routeWarning).not.toBeNull();
    // A real plan is still returned — reduced confidence, not a blocked result.
    expect(plan.recommendedLatestLandingLocal).toBeDefined();
  });
});

describe('req 21: initial route data is derived from existing JetStash sources', () => {
  it('the route identity and flight-time text trace back to the real data/routes.ts record, never invented', () => {
    const result = asPlan(planArriveBy(baseInput(), NOW));
    expect(result.routeIdentity.routeSlug).toBe('manchester-lahore');
    expect(result.sourceProvenance.some((s) => s.includes('manchester-lahore'))).toBe(true);
  });
});

describe('req 22: no fake flight number or exact timetable is generated', () => {
  it('the result never contains a flight-number-shaped token or a claim of a specific timetable', () => {
    const result = asPlan(planArriveBy(baseInput(), NOW));
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/\b[A-Z]{2}\d{2,4}\b/); // e.g. "BA123", "6E0031"
    expect(json.toLowerCase()).not.toContain('flight number');
    expect(json.toLowerCase()).not.toContain('seat available');
  });
});

describe('req 23: assumptions are returned and explainable', () => {
  it('every plan includes a non-empty, named, rationale-carrying assumptions list', () => {
    const result = asPlan(planArriveBy(baseInput(), NOW));
    expect(result.assumptionsUsed.length).toBeGreaterThan(0);
    for (const a of result.assumptionsUsed) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.value.length).toBeGreaterThan(0);
      expect(a.rationale.length).toBeGreaterThan(0);
    }
  });
});

describe('req 24: results are deterministic', () => {
  it('the same input and the same now produce byte-identical results', () => {
    const a = planArriveBy(baseInput(), NOW);
    const b = planArriveBy(baseInput(), NOW);
    expect(a).toEqual(b);
  });
});

describe('req 25: no personal data is accepted or returned', () => {
  it('the result contains no passport, visa, nationality, or date-of-birth-shaped data', () => {
    const result = planArriveBy(baseInput(), NOW);
    const json = JSON.stringify(result).toLowerCase();
    for (const term of ['passport', 'visa', 'nationality', 'dob', 'dateofbirth', 'date_of_birth']) {
      expect(json).not.toContain(term);
    }
  });
});

describe('req 29: every supported result includes the non-live-schedule disclaimer', () => {
  const scenarios: [string, ArriveByInput][] = [
    ['ready_for_planning', baseInput()],
    ['route_verification_required', baseInput({ destinationSlug: 'mumbai', requiredArrivalDateLocal: '2026-09-05' })],
    ['unsupported_route', baseInput({ destinationSlug: 'istanbul' })],
    ['invalid_deadline', baseInput({ requiredArrivalDateLocal: '2020-01-01' })],
  ];
  for (const [label, input] of scenarios) {
    it(`${label} includes the disclaimer`, () => {
      const result = planArriveBy(input, NOW);
      expect(result.disclaimer.length).toBeGreaterThan(0);
      expect(result.disclaimer.toLowerCase()).toContain('not a live schedule search');
    });
  }
});
