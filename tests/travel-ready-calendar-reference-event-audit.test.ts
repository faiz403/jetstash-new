import { describe, it, expect } from 'vitest';
import { evaluateTravelReadiness } from '@/lib/travel-ready-check';

/**
 * Calendar / reference-event integrity audit (5 September 2026) —
 * independently reproduced and fixed the remaining Astra-reported Travel
 * Ready defect: passport-validity rules stated by GOV.UK in calendar
 * months ("6 months after the date you arrive", "3 months after the date
 * you arrive") were being approximated as a fixed day count
 * (`minDaysValidityBeyondEntry: 182` / `91`), which silently diverges from
 * the true calendar-month boundary whenever the buffer spans months of
 * different lengths or a leap-year February.
 *
 * Confirmed live reproduction (Morocco): departure 1 October 2026, return
 * 10 October 2026, passport expiry 31 December 2026 returned READY under
 * the old fixed-91-day model (91 days from 1 October lands on 31 December
 * exactly). The true rule — 3 CALENDAR months after arrival — reaches
 * 1 January 2027, one day later than the old model's threshold. 31 December
 * should fail; the old code passed it.
 *
 * Root cause fix: `TravelReadyRule.validityRequirement` now carries an
 * explicit `{ unit: 'calendar-months' | 'days', value }` pair instead of a
 * single fixed day count, and `lib/travel-ready-check.ts`'s
 * `addCalendarMonths()` performs real calendar arithmetic (with explicit,
 * documented day-clamping for a target month that's shorter than the
 * source day — e.g. 31 January + 1 month = 28/29 February, never rolling
 * into March). Turkey's rule (stated in exact days, 150) is unaffected —
 * `unit: 'days'` is reserved for a genuinely day-stated rule, never used as
 * an unconverted stand-in for a month figure.
 */
const NOW = new Date('2026-07-12T12:00:00Z');

const passportCheck = (result: ReturnType<typeof evaluateTravelReadiness>) =>
  result.checks.find((c) => c.id === 'passport-validity');

describe('Calendar audit — Morocco reproduction (the exact founder-confirmed case)', () => {
  const base = {
    destinationSlug: 'marrakech',
    isBritishPassport: true,
    exemptionDocument: 'none' as const,
    departureDate: '2026-10-01',
    returnDate: '2026-10-10',
  };

  it('2026-12-31 expiry: FAILS under correct calendar-month arithmetic (was a false READY under the old fixed-91-day model)', () => {
    const result = evaluateTravelReadiness({ ...base, passportExpiryDate: '2026-12-31' }, NOW);
    expect(passportCheck(result)?.status).toBe('fail');
    expect(result.verdict).toBe('check-passport-validity');
  });

  it('2027-01-01 expiry: PASSES — exactly 3 calendar months after 1 October 2026', () => {
    const result = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-01-01' }, NOW);
    expect(passportCheck(result)?.status).toBe('pass');
  });

  it('2027-01-02 expiry: PASSES — comfortably beyond the 3-calendar-month threshold', () => {
    const result = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-01-02' }, NOW);
    expect(passportCheck(result)?.status).toBe('pass');
  });

  it('the passport-validity check discloses the departure-date-as-reference-event assumption', () => {
    const result = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-01-02' }, NOW);
    expect(passportCheck(result)?.detail).toMatch(/stand-in for the event the rule actually measures from/i);
  });
});

describe('Calendar audit — six-calendar-month boundary (Pakistan, India, Bangladesh, Saudi Arabia, UAE, Qatar all state "6 months")', () => {
  it('Pakistan: 1 September + 6 calendar months = 1 March — one day either side of the boundary', () => {
    const base = {
      destinationSlug: 'lahore',
      isBritishPassport: true,
      exemptionDocument: 'nicop-poc' as const,
      departureDate: '2026-09-01',
      returnDate: '2026-09-15',
    };
    const fail = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-02-28' }, NOW);
    const passExact = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-03-01' }, NOW);
    const passAfter = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-03-02' }, NOW);
    expect(passportCheck(fail)?.status).toBe('fail');
    expect(passportCheck(passExact)?.status).toBe('pass');
    expect(passportCheck(passAfter)?.status).toBe('pass');
  });

  it('India: end-of-month clamping — 31 August + 6 months = 28 February (non-leap year), not 3 March', () => {
    const base = {
      destinationSlug: 'delhi',
      isBritishPassport: true,
      exemptionDocument: 'none' as const,
      departureDate: '2026-08-31',
      returnDate: '2026-09-10',
    };
    // The true calendar-month threshold is 28 Feb 2027. The old fixed-
    // 182-day model computed 1 March 2027 instead — one day past the true
    // boundary, so it would have wrongly FAILED a passport expiring exactly
    // 28 Feb 2027, even though that genuinely satisfies "6 months after
    // arrival". This is the opposite-direction defect from Morocco's
    // false-pass: the same fixed-day-approximation bug produces a false
    // fail here and a false pass there, depending on which specific months
    // the buffer spans — proof this needed real calendar arithmetic, not a
    // "just add a safety day" patch.
    const belowBoundary = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-02-27' }, NOW);
    const atTrueCalendarBoundary = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-02-28' }, NOW);
    expect(passportCheck(belowBoundary)?.status).toBe('fail');
    expect(passportCheck(atTrueCalendarBoundary)?.status).toBe('pass');
  });

  it('Saudi Arabia: leap-year February — 29 August 2028 (leap year) + 6 months clamps to 29 February 2029 is impossible (2029 not leap), so lands on 28 February 2029', () => {
    const base = {
      destinationSlug: 'jeddah',
      isBritishPassport: true,
      exemptionDocument: 'none' as const,
      departureDate: '2028-08-29',
      returnDate: '2028-09-10',
    };
    const fail = evaluateTravelReadiness({ ...base, passportExpiryDate: '2029-02-27' }, NOW);
    const pass = evaluateTravelReadiness({ ...base, passportExpiryDate: '2029-02-28' }, NOW);
    expect(passportCheck(fail)?.status).toBe('fail');
    expect(passportCheck(pass)?.status).toBe('pass');
  });

  it('UAE: 29 February in a leap year departure — 29 Feb 2028 + 6 months = 29 August 2028 (August has 31 days, no clamping needed)', () => {
    const base = {
      destinationSlug: 'dubai',
      isBritishPassport: true,
      exemptionDocument: 'none' as const,
      departureDate: '2028-02-29',
      returnDate: '2028-03-10',
    };
    const fail = evaluateTravelReadiness({ ...base, passportExpiryDate: '2028-08-28' }, NOW);
    const pass = evaluateTravelReadiness({ ...base, passportExpiryDate: '2028-08-29' }, NOW);
    expect(passportCheck(fail)?.status).toBe('fail');
    expect(passportCheck(pass)?.status).toBe('pass');
  });

  it('Qatar: ordinary mid-length-month boundary (30 April + 6 months = 30 October, no clamping)', () => {
    const base = {
      destinationSlug: 'doha',
      isBritishPassport: true,
      exemptionDocument: 'none' as const,
      departureDate: '2027-04-30',
      returnDate: '2027-05-10',
    };
    const fail = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-10-29' }, NOW);
    const pass = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-10-30' }, NOW);
    expect(passportCheck(fail)?.status).toBe('fail');
    expect(passportCheck(pass)?.status).toBe('pass');
  });

  it('Bangladesh: 6-month boundary also applies (rule text references visa issue date, not travel date — see the reference-event disclosure test below)', () => {
    const base = {
      destinationSlug: 'dhaka',
      isBritishPassport: true,
      exemptionDocument: 'none' as const,
      departureDate: '2026-09-01',
      returnDate: '2026-09-15',
    };
    const fail = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-02-28' }, NOW);
    const pass = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-03-01' }, NOW);
    expect(passportCheck(fail)?.status).toBe('fail');
    expect(passportCheck(pass)?.status).toBe('pass');
  });
});

describe('Calendar audit — Turkey stays a pure fixed-day rule (150 days is the official unit itself, not a month approximation)', () => {
  it('150 days after departure, not calendar-month arithmetic', () => {
    const base = {
      destinationSlug: 'antalya',
      isBritishPassport: true,
      exemptionDocument: 'none' as const,
      departureDate: '2026-10-01',
      returnDate: '2026-10-10',
    };
    // 1 October 2026 + 150 days = 28 February 2027 (exact day count, not a
    // "5 months" calendar approximation, which would land on 1 March).
    const fail = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-02-27' }, NOW);
    const pass = evaluateTravelReadiness({ ...base, passportExpiryDate: '2027-02-28' }, NOW);
    expect(passportCheck(fail)?.status).toBe('fail');
    expect(passportCheck(pass)?.status).toBe('pass');
  });
});

describe('Calendar audit — reference-event disclosure', () => {
  it('Pakistan (visa-application-referenced rule): the disclosure names the application/issue-date distinction', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'lahore',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(passportCheck(result)?.detail).toMatch(/visa application or issue date/i);
  });

  it('an unaffected rule with no validityRequirement (there is none left in the current dataset) would show no caveat — sanity: every currently supported passport-validity rule DOES carry validityRequirement and DOES show the caveat', () => {
    for (const [slug, exemption] of [
      ['lahore', 'nicop-poc'],
      ['delhi', 'oci'],
      ['dhaka', 'nvr'],
      ['jeddah', 'none'],
      ['dubai', 'none'],
      ['doha', 'none'],
      ['antalya', 'none'],
      ['marrakech', 'none'],
    ] as const) {
      const result = evaluateTravelReadiness(
        {
          destinationSlug: slug,
          isBritishPassport: true,
          exemptionDocument: exemption,
          departureDate: '2027-03-01',
          returnDate: '2027-03-20',
          passportExpiryDate: '2035-01-01',
        },
        NOW
      );
      expect(passportCheck(result)?.detail, slug).toMatch(/stand-in for the event the rule actually measures from/i);
    }
  });
});

describe('Calendar audit — the fix does not regress the independent "expires during trip" check', () => {
  it('a passport that meets the calendar-month buffer but expires before the return date still fails (long-trip edge case)', () => {
    // Trip longer than the 3-month buffer itself: departure 1 Jan, return 1
    // May (4 months), passport expiry 1 April — meets neither the calendar
    // buffer (needs >= 1 April, exactly meets it) NOR survives past the
    // return date (1 May) — the independent expires-during-trip check must
    // still catch this.
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'marrakech',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-01-01',
        returnDate: '2027-05-01',
        passportExpiryDate: '2027-04-01',
      },
      NOW
    );
    expect(passportCheck(result)?.status).toBe('fail');
  });
});
