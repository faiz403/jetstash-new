import { describe, it, expect } from 'vitest';
import { evaluateTravelReadiness } from '@/lib/travel-ready-check';

/**
 * Calendar / reference-event integrity audit (5 September 2026) —
 * independently reproduced and fixed two related Astra-reported Travel
 * Ready defects, in two rounds:
 *
 * ROUND 1 (calendar-month arithmetic): passport-validity rules stated by
 * GOV.UK in calendar months ("6 months after the date you arrive", "3
 * months after the date you arrive") were being approximated as a fixed
 * day count (`minDaysValidityBeyondEntry: 182` / `91`), which silently
 * diverges from the true calendar-month boundary whenever the buffer spans
 * months of different lengths or a leap-year February. Fixed with real
 * calendar arithmetic (`addCalendarMonths()`), reference date still
 * departureDate at that point (disclosed as a proxy).
 *
 * ROUND 2 (this file, founder correction to Round 1): a disclosed
 * departureDate proxy was not actually sufficient. A traveller whose real
 * destination arrival lands on a LATER calendar date than UK departure
 * could still see a false pass on an arrival-anchored rule — disclosure
 * doesn't change the underlying arithmetic. `TravelReadyCheckInput` now
 * collects a genuine `arrivalDate`, and every `'arrival'`-anchored rule
 * (India, Saudi Arabia, UAE, Qatar, Turkey, Morocco passport-validity, plus
 * every stay-limit day count) uses it directly. `'departure-conservative-
 * proxy'` rules (Pakistan, Bangladesh) deliberately still use departureDate
 * — proven below to never produce a false positive, since visa
 * application/issue always happens on or before departure.
 */
const NOW = new Date('2026-07-12T12:00:00Z');

const passportCheck = (result: ReturnType<typeof evaluateTravelReadiness>) =>
  result.checks.find((c) => c.id === 'passport-validity');
const visaCheck = (result: ReturnType<typeof evaluateTravelReadiness>) =>
  result.checks.find((c) => c.id === 'visa-requirement');

describe('Reference-event correction — the founder-confirmed false-positive scenario (Morocco, departure ≠ arrival)', () => {
  const base = {
    destinationSlug: 'marrakech',
    isBritishPassport: true,
    exemptionDocument: 'none' as const,
    departureDate: '2026-10-01',
    returnDate: '2026-10-10',
  };

  it('arrival one day after departure: expiry exactly 3 calendar months after DEPARTURE (not arrival) must FAIL — this is the exact false-positive the founder identified', () => {
    const result = evaluateTravelReadiness({ ...base, arrivalDate: '2026-10-02', passportExpiryDate: '2027-01-01' }, NOW);
    expect(passportCheck(result)?.status).toBe('fail');
    expect(result.verdict).toBe('check-passport-validity');
  });

  it('arrival one day after departure: expiry exactly 3 calendar months after the REAL arrival date PASSES', () => {
    const result = evaluateTravelReadiness({ ...base, arrivalDate: '2026-10-02', passportExpiryDate: '2027-01-02' }, NOW);
    expect(passportCheck(result)?.status).toBe('pass');
  });

  it('same-day arrival and departure: behaves exactly as the original Morocco reproduction (2026-12-31 fails, 2027-01-01 passes)', () => {
    const sameDayFail = evaluateTravelReadiness({ ...base, arrivalDate: '2026-10-01', passportExpiryDate: '2026-12-31' }, NOW);
    const sameDayPass = evaluateTravelReadiness({ ...base, arrivalDate: '2026-10-01', passportExpiryDate: '2027-01-01' }, NOW);
    expect(passportCheck(sameDayFail)?.status).toBe('fail');
    expect(passportCheck(sameDayPass)?.status).toBe('pass');
  });

  it('a multi-day connection (arrival several days after departure) is not accidentally built around a +1-day assumption', () => {
    // Departure 1 Oct, arrival 5 Oct (a genuinely long connection) — the
    // buffer must measure from the real arrival date, however many days
    // after departure it falls.
    const result = evaluateTravelReadiness(
      { ...base, arrivalDate: '2026-10-05', passportExpiryDate: '2027-01-04' },
      NOW
    );
    // 3 calendar months after 5 Oct 2026 = 5 Jan 2027 — 4 Jan is one day short.
    expect(passportCheck(result)?.status).toBe('fail');
    const passResult = evaluateTravelReadiness(
      { ...base, arrivalDate: '2026-10-05', passportExpiryDate: '2027-01-05' },
      NOW
    );
    expect(passportCheck(passResult)?.status).toBe('pass');
  });

  it('the passport-validity detail no longer discloses a departure-date proxy for this arrival-anchored rule — it states the requirement plainly, since the real arrival date is now used', () => {
    const result = evaluateTravelReadiness({ ...base, arrivalDate: '2026-10-02', passportExpiryDate: '2027-01-02' }, NOW);
    expect(passportCheck(result)?.detail).not.toMatch(/stand-in for the event/i);
  });
});

describe('Reference-event correction — six-calendar-month arrival-anchored countries (India, Saudi Arabia, UAE, Qatar)', () => {
  it('India: arrival one day after departure shifts the true boundary by exactly one day', () => {
    const base = {
      destinationSlug: 'delhi',
      isBritishPassport: true,
      exemptionDocument: 'none' as const,
      departureDate: '2026-09-01',
      arrivalDate: '2026-09-02',
      returnDate: '2026-09-15',
    };
    // 6 calendar months after arrival (2 Sept) = 2 March 2027.
    const fail = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-03-01' }, NOW);
    const pass = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-03-02' }, NOW);
    expect(passportCheck(fail)?.status).toBe('fail');
    expect(passportCheck(pass)?.status).toBe('pass');
  });

  it('Saudi Arabia: same-day arrival still uses exact calendar-month arithmetic from arrival', () => {
    const base = {
      destinationSlug: 'jeddah',
      isBritishPassport: true,
      exemptionDocument: 'none' as const,
      departureDate: '2028-08-29',
      arrivalDate: '2028-08-29',
      returnDate: '2028-09-10',
    };
    const fail = evaluateTravelReadiness({ ...base, passportExpiryDate: '2029-02-27' }, NOW);
    const pass = evaluateTravelReadiness({ ...base, passportExpiryDate: '2029-02-28' }, NOW);
    expect(passportCheck(fail)?.status).toBe('fail');
    expect(passportCheck(pass)?.status).toBe('pass');
  });

  it('UAE: arrival crossing a leap-year 29 February changes the boundary from what departure alone would have given', () => {
    // Departure 28 Feb 2028 (not a leap day), arrival 29 Feb 2028 (the
    // leap day itself, one day later) — the true buffer must anchor to the
    // 29th, not the 28th.
    const base = {
      destinationSlug: 'dubai',
      isBritishPassport: true,
      exemptionDocument: 'none' as const,
      departureDate: '2028-02-28',
      arrivalDate: '2028-02-29',
      returnDate: '2028-03-10',
    };
    // 6 months after 29 Feb 2028 = 29 Aug 2028.
    const fail = evaluateTravelReadiness({ ...base, passportExpiryDate: '2028-08-28' }, NOW);
    const pass = evaluateTravelReadiness({ ...base, passportExpiryDate: '2028-08-29' }, NOW);
    expect(passportCheck(fail)?.status).toBe('fail');
    expect(passportCheck(pass)?.status).toBe('pass');
  });

  it('Qatar: ordinary mid-length-month boundary, arrival same day as departure', () => {
    const base = {
      destinationSlug: 'doha',
      isBritishPassport: true,
      exemptionDocument: 'none' as const,
      departureDate: '2027-04-30',
      arrivalDate: '2027-04-30',
      returnDate: '2027-05-10',
    };
    const fail = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-10-29' }, NOW);
    const pass = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-10-30' }, NOW);
    expect(passportCheck(fail)?.status).toBe('fail');
    expect(passportCheck(pass)?.status).toBe('pass');
  });
});

describe('Reference-event correction — Turkey (150-day arrival-anchored rule, an exact day count, not a month approximation)', () => {
  it('arrival one day after departure shifts the 150-day threshold by exactly one day', () => {
    const base = {
      destinationSlug: 'antalya',
      isBritishPassport: true,
      exemptionDocument: 'none' as const,
      departureDate: '2026-10-01',
      arrivalDate: '2026-10-02',
      returnDate: '2026-10-10',
    };
    // 150 days after arrival (2 Oct) = 1 March 2027.
    const fail = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-02-28' }, NOW);
    const pass = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-03-01' }, NOW);
    expect(passportCheck(fail)?.status).toBe('fail');
    expect(passportCheck(pass)?.status).toBe('pass');
  });
});

describe('Reference-event correction — Pakistan and Bangladesh (departure-conservative-proxy, arrival must NOT affect the result)', () => {
  it('Pakistan: changing arrivalDate while keeping departureDate fixed does not change the passport-validity verdict — the rule genuinely still measures from departure, proven never to produce a false positive since visa application always precedes it', () => {
    const sameDay = evaluateTravelReadiness(
      {
        destinationSlug: 'lahore',
        isBritishPassport: true,
        exemptionDocument: 'nicop-poc',
        departureDate: '2026-09-01',
        arrivalDate: '2026-09-01',
        returnDate: '2026-09-15',
        passportExpiryDate: '2027-03-01',
      },
      NOW
    );
    const arrivalFiveDaysLater = evaluateTravelReadiness(
      {
        destinationSlug: 'lahore',
        isBritishPassport: true,
        exemptionDocument: 'nicop-poc',
        departureDate: '2026-09-01',
        arrivalDate: '2026-09-06',
        returnDate: '2026-09-15',
        passportExpiryDate: '2027-03-01',
      },
      NOW
    );
    // Both must produce the exact same passport-validity outcome — arrival
    // is irrelevant to this specific rule.
    expect(passportCheck(sameDay)?.status).toBe(passportCheck(arrivalFiveDaysLater)?.status);
    expect(passportCheck(sameDay)?.status).toBe('pass');
  });

  it('Pakistan: the conservative-proxy caveat explains the reasoning honestly, without claiming the actual application date was evaluated', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'lahore',
        isBritishPassport: true,
        exemptionDocument: 'nicop-poc',
        departureDate: '2027-03-01',
        arrivalDate: '2027-03-02',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(passportCheck(result)?.detail).toMatch(/visa application or issue date/i);
    expect(passportCheck(result)?.detail).toMatch(/can only make this check stricter/i);
  });

  it('Bangladesh: changing arrivalDate while keeping departureDate fixed does not change the passport-validity verdict', () => {
    const sameDay = evaluateTravelReadiness(
      {
        destinationSlug: 'dhaka',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2026-09-01',
        arrivalDate: '2026-09-01',
        returnDate: '2026-09-15',
        passportExpiryDate: '2027-03-01',
      },
      NOW
    );
    const arrivalLater = evaluateTravelReadiness(
      {
        destinationSlug: 'dhaka',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2026-09-01',
        arrivalDate: '2026-09-06',
        returnDate: '2026-09-15',
        passportExpiryDate: '2027-03-01',
      },
      NOW
    );
    expect(passportCheck(sameDay)?.status).toBe(passportCheck(arrivalLater)?.status);
    expect(passportCheck(sameDay)?.status).toBe('pass');
  });
});

describe('Reference-event correction — stay-limit day counting now starts from arrival, not UK departure', () => {
  it('Morocco: a trip that only exceeds the 90-day stay limit when counted from departure (not arrival) must not be falsely rejected', () => {
    // Departure 1 Jan, arrival 2 Jan (one day later), return 1 Apr.
    // From departure: 1 Jan -> 1 Apr inclusive = 91 days (would exceed 90).
    // From arrival:   2 Jan -> 1 Apr inclusive = 90 days (exactly at the limit, still allowed).
    // The correct behaviour counts real days present in Morocco, from
    // arrival — not UK-to-Morocco travel time.
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'marrakech',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-01-01',
        arrivalDate: '2027-01-02',
        returnDate: '2027-04-01',
        passportExpiryDate: '2035-01-01',
      },
      NOW
    );
    expect(visaCheck(result)?.status).not.toBe('fail');
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('Morocco: the same trip genuinely exceeding 90 days even counted from arrival is still correctly rejected', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'marrakech',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-01-01',
        arrivalDate: '2027-01-02',
        returnDate: '2027-04-02', // 91 days from arrival
        passportExpiryDate: '2035-01-01',
      },
      NOW
    );
    expect(visaCheck(result)?.status).toBe('fail');
  });

  it('Turkey rolling window: stay-limit day count also anchors to arrival, not departure', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'antalya',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-01-01',
        arrivalDate: '2027-01-02',
        returnDate: '2027-03-31', // 89 days from arrival, not 90
        passportExpiryDate: '2035-01-01',
      },
      NOW
    );
    // 89 days from arrival is within the 90-day headline figure — still
    // rolling-window-unconfirmed, not a fail.
    expect(visaCheck(result)?.status).not.toBe('fail');
    expect(result.verdict).toBe('stay-length-unconfirmed');
  });
});

describe('Reference-event correction — arrival-date input validation (never reaches the rule engine)', () => {
  it('arrival before departure is rejected with its own specific verdict', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'marrakech',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-10',
        arrivalDate: '2027-03-09', // before departure — impossible
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('invalid-arrival-date');
    expect(result.checks).toHaveLength(0);
    expect(result.engineSignal).toBeNull();
    expect(result.headline).toMatch(/arrival date is before your departure date/i);
  });

  it('arrival after the return date is rejected with the same verdict', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'marrakech',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        arrivalDate: '2027-03-25', // after return — impossible
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('invalid-arrival-date');
    expect(result.checks).toHaveLength(0);
    expect(result.headline).toMatch(/arrival date is after your return date/i);
  });

  it('arrival exactly equal to departure is valid (same-day arrival) and reaches the rule engine', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'marrakech',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        arrivalDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).not.toBe('invalid-arrival-date');
  });

  it('arrival exactly equal to the return date is valid (a same-day round trip) and reaches the rule engine', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'marrakech',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        arrivalDate: '2027-03-20',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).not.toBe('invalid-arrival-date');
  });
});

describe('Calendar audit — reviewDueDate and canonical baseline checks are unaffected', () => {
  it('PR #228 protections remain intact: non-British passport + exemption document still fails closed', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'lahore',
        isBritishPassport: false,
        exemptionDocument: 'nicop-poc',
        departureDate: '2027-03-01',
        arrivalDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('not-enough-information');
    expect(passportCheck(result)).toBeUndefined();
  });
});
