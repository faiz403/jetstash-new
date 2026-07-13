import { describe, it, expect } from 'vitest';
import { evaluateTravelReadiness } from '@/lib/travel-ready-check';

/**
 * Truth Reset (July 2026) Section 4 — the 11 required Travel Ready journeys,
 * each asserted against a fixed clock. This directly answers "does the live
 * form produce no visible result after valid input?" at the logic layer —
 * every supported journey below must return a definite verdict, never an
 * empty/no-op result, and every unsupported journey must return
 * 'not-enough-information' rather than guessing.
 */
const NOW = new Date('2026-07-12T12:00:00Z');

describe('Travel Ready Check — the 11 required journeys', () => {
  it('1. British passport, Pakistan, no NICOP, no visa held — needs a visa', () => {
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
    expect(result.verdict).not.toBe('not-enough-information');
    expect(['visa-or-entry-permission-needed', 'document-timing-may-affect-booking']).toContain(result.verdict);
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('2. British passport, Pakistan, valid NICOP — ready to continue', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'lahore',
        isBritishPassport: true,
        exemptionDocument: 'nicop-poc',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('3. British passport, India, no OCI, no visa held — needs a visa', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'delhi',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(['visa-or-entry-permission-needed', 'document-timing-may-affect-booking']).toContain(result.verdict);
  });

  it('4. British passport, India, valid OCI — ready to continue', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'delhi',
        isBritishPassport: true,
        exemptionDocument: 'oci',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('5. British passport, Saudi Arabia — produces a definite result, not a guess', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'jeddah',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).not.toBe('not-enough-information');
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('6. Non-British passport, no exemption document — unsupported, does not guess', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'lahore',
        isBritishPassport: false,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('not-enough-information');
    expect(result.engineSignal).toBeNull();
  });

  it('7. Passport expiring before the rule-required buffer — flagged, not silently passed', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'lahore',
        isBritishPassport: true,
        exemptionDocument: 'nicop-poc',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2027-04-01', // valid at return, but well short of the 6-month buffer from departure
      },
      NOW
    );
    expect(result.verdict).toBe('check-passport-validity');
  });

  it('8. Departure date after return date — a specific validation error, the rule engine never runs', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'lahore',
        isBritishPassport: true,
        exemptionDocument: 'nicop-poc',
        departureDate: '2027-03-20',
        returnDate: '2027-03-01', // before departure
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    // Founder correction: "a definite result" or "a non-empty headline" is
    // not sufficient — this must be its own named verdict, and the
    // passport/visa rule engine (checks[]) must never have run.
    expect(result.verdict).toBe('invalid-date-range');
    expect(result.checks).toHaveLength(0);
    expect(result.engineSignal).toBeNull();
    // Public wording shown to visitors — must name the actual problem, not
    // a generic "something's wrong" message.
    expect(result.headline).toBe('Your return date is before your departure date — check your dates before continuing.');
    expect(result.nextAction).toMatch(/re-enter your departure and return dates/i);
  });

  it('9. Departure date in the past relative to the fixed clock — a specific validation error, the rule engine never runs', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'lahore',
        isBritishPassport: true,
        exemptionDocument: 'nicop-poc',
        departureDate: '2026-01-01', // before NOW (2026-07-12)
        returnDate: '2026-01-15',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('invalid-departure-date');
    expect(result.checks).toHaveLength(0);
    expect(result.engineSignal).toBeNull();
    expect(result.headline).toBe('Your departure date is in the past — check your dates before continuing.');
    expect(result.nextAction).toMatch(/re-enter a departure date that hasn.t already passed/i);
  });

  it('8b. A same-day departure and return is valid (not an inverted range) and does reach the rule engine', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'lahore',
        isBritishPassport: true,
        exemptionDocument: 'nicop-poc',
        departureDate: '2027-03-20',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).not.toBe('invalid-date-range');
  });

  it('9b. Today\'s date as departure is valid (not "in the past") and does reach the rule engine', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'lahore',
        isBritishPassport: true,
        exemptionDocument: 'nicop-poc',
        departureDate: '2026-07-12', // same as NOW
        returnDate: '2026-07-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).not.toBe('invalid-departure-date');
  });

  it('10. Unsupported destination (outside the 7 V1 countries) — states unsupported plainly', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'barcelona',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('not-enough-information');
  });

  it('12. TR-016 regression: British passport, UAE (visa-on-arrival, zero processing days) — ready to continue, not a false "start your application" caution', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'dubai',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    // Found via live browser testing, not the original 11 journeys (none of
    // which covered a visa-on-arrival destination): typicalProcessingDays: 0
    // was being treated as "you haven't arranged this yet" instead of "there
    // is nothing to arrange in advance."
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('13. TR-016 regression: same check for Qatar (also visa-on-arrival, zero processing days)', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'doha',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('11. Unrecognised destination slug — states unsupported, never throws', () => {
    expect(() =>
      evaluateTravelReadiness(
        {
          destinationSlug: 'not-a-real-destination',
          isBritishPassport: true,
          exemptionDocument: 'none',
          departureDate: '2027-03-01',
          returnDate: '2027-03-20',
          passportExpiryDate: '2029-01-01',
        },
        NOW
      )
    ).not.toThrow();
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'not-a-real-destination',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('not-enough-information');
  });
});
