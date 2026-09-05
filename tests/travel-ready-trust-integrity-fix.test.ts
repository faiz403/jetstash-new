import { describe, it, expect } from 'vitest';
import { evaluateTravelReadiness } from '@/lib/travel-ready-check';

/**
 * Trust Integrity fix (5 September 2026) — independently reproduced Astra
 * findings, confirmed by direct code inspection and live production
 * reproduction, fixed here. Two defects:
 *
 * 1. PASSPORT CONTRADICTION: a traveller who told Travel Ready Check their
 *    passport is NOT British, but who also selected a real exemption
 *    document (NICOP/POC, OCI, NVR), was shown British-passport-scoped
 *    passport-validity guidance as satisfied and could reach
 *    'ready-to-continue'. Every exemption rule we hold verified evidence
 *    for is itself framed by its own official source as a British-passport
 *    mechanism, so this overstated what JetStash actually knows. Fixed by
 *    failing closed to 'not-enough-information' instead.
 *
 * 2. STAY-LENGTH LIMIT NOT VALIDATED: the evaluator never compared trip
 *    length against a visa-free/visa-on-arrival rule's own stated stay
 *    limit (UAE, Qatar, Turkey, Morocco), so a trip far longer than the
 *    published allowance still returned 'ready-to-continue'. Fixed by
 *    `evaluateStayLimit()` in lib/travel-ready-check.ts, which also
 *    deliberately does NOT collapse a rolling-window rule (90 days in any
 *    180 days — UAE, Turkey) into "this trip alone is short enough,
 *    therefore pass": that can only be confirmed dishonestly without
 *    knowing the traveller's other visits in the window, which JetStash
 *    doesn't collect. A simple per-visit maximum (Qatar 30 days, Morocco 90
 *    days, both extendable in-country rather than framed as a rolling
 *    window by GOV.UK) has no such ambiguity — those get a definite pass or
 *    fail directly.
 */
const NOW = new Date('2026-07-12T12:00:00Z');

const SHORT_TRIP = { departureDate: '2027-03-01', returnDate: '2027-03-20', passportExpiryDate: '2029-01-01' };

describe('Trust Integrity fix — passport contradiction (non-British passport + exemption document)', () => {
  it('Pakistan: non-British passport + NICOP/POC selected does not leak British-passport guidance and does not return ready', () => {
    const result = evaluateTravelReadiness(
      { destinationSlug: 'lahore', isBritishPassport: false, exemptionDocument: 'nicop-poc', ...SHORT_TRIP },
      NOW
    );
    expect(result.verdict).toBe('not-enough-information');
    expect(result.verdict).not.toBe('ready-to-continue');
    expect(result.engineSignal).toBeNull();
    // Must not present the British-passport-scoped passport-validity rule
    // as satisfied — that check should never even be run.
    expect(result.checks.find((c) => c.id === 'passport-validity')).toBeUndefined();
    expect(result.headline).not.toMatch(/ready/i);
    // Must never surface the British-passport-scoped passport-validity
    // rule's own requirement text (e.g. Pakistan's "6 months after the date
    // of your visa application") as if it were validated for this traveller.
    for (const check of result.checks) {
      expect(check.detail).not.toMatch(/6 months after/i);
      expect(check.detail).not.toMatch(/entered expiry date appears to satisfy/i);
    }
    // Must clearly say it can't confirm the combination, without inferring
    // the traveller's actual nationality or inventing a rule for it.
    const exemptionCheck = result.checks.find((c) => c.id === 'visa-requirement');
    expect(exemptionCheck?.detail).toMatch(/isn't british|framed for a british passport holder/i);
    expect(exemptionCheck?.detail).toMatch(/check official guidance/i);
  });

  it('India: non-British passport + OCI selected fails closed the same way', () => {
    const result = evaluateTravelReadiness(
      { destinationSlug: 'delhi', isBritishPassport: false, exemptionDocument: 'oci', ...SHORT_TRIP },
      NOW
    );
    expect(result.verdict).toBe('not-enough-information');
    expect(result.checks.find((c) => c.id === 'passport-validity')).toBeUndefined();
    expect(result.engineSignal).toBeNull();
  });

  it('Bangladesh: non-British passport + NVR selected fails closed the same way', () => {
    const result = evaluateTravelReadiness(
      { destinationSlug: 'sylhet', isBritishPassport: false, exemptionDocument: 'nvr', ...SHORT_TRIP },
      NOW
    );
    expect(result.verdict).toBe('not-enough-information');
    expect(result.checks.find((c) => c.id === 'passport-validity')).toBeUndefined();
    expect(result.engineSignal).toBeNull();
  });

  it('non-British passport with no exemption document still gives the original, unchanged unsupported message', () => {
    const result = evaluateTravelReadiness(
      { destinationSlug: 'lahore', isBritishPassport: false, exemptionDocument: 'none', ...SHORT_TRIP },
      NOW
    );
    expect(result.verdict).toBe('not-enough-information');
    expect(result.checks).toHaveLength(0);
    expect(result.headline).toMatch(/British passport holders/);
  });

  it('legitimate British-passport exemption flows are preserved: Pakistan NICOP/POC still reaches ready-to-continue', () => {
    const result = evaluateTravelReadiness(
      { destinationSlug: 'lahore', isBritishPassport: true, exemptionDocument: 'nicop-poc', ...SHORT_TRIP },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('legitimate British-passport exemption flows are preserved: India OCI still reaches ready-to-continue', () => {
    const result = evaluateTravelReadiness(
      { destinationSlug: 'delhi', isBritishPassport: true, exemptionDocument: 'oci', ...SHORT_TRIP },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('legitimate British-passport exemption flows are preserved: Bangladesh NVR still reaches ready-to-continue', () => {
    const result = evaluateTravelReadiness(
      { destinationSlug: 'sylhet', isBritishPassport: true, exemptionDocument: 'nvr', ...SHORT_TRIP },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
  });
});

describe('Trust Integrity fix — visa-free/on-arrival stay-length limits', () => {
  it('Turkey (rolling 90/180): a trip that itself exceeds 90 days must not return ready', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'antalya',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2026-10-01',
        returnDate: '2027-03-01', // 152 days inclusive — reproduces the Astra/founder report
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).not.toBe('ready-to-continue');
    expect(result.verdict).toBe('visa-or-entry-permission-needed');
    const visaCheck = result.checks.find((c) => c.id === 'visa-requirement');
    expect(visaCheck?.status).toBe('fail');
    expect(visaCheck?.detail).toMatch(/152 days/);
    expect(visaCheck?.detail).toMatch(/90-day/);
  });

  it('Turkey (rolling 90/180): a trip within 90 days on its own is honestly unconfirmed, not a false ready', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'antalya',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-03-20', // 20 days — well within 90, but rolling-window compliance is still unproven
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('stay-length-unconfirmed');
    expect(result.verdict).not.toBe('ready-to-continue');
    const visaCheck = result.checks.find((c) => c.id === 'visa-requirement');
    expect(visaCheck?.status).toBe('caution');
    expect(visaCheck?.detail).toMatch(/rolling 180-day allowance/);
    expect(result.engineSignal?.severity).toBe('caution');
  });

  it('Turkey: an ordinary short trip does not regress — still reaches a definite, non-blocking result for the visa check', () => {
    // This is the same input shape as the "11 required journeys" suite uses
    // for other countries — proving the new stay-limit logic doesn't turn
    // every short Turkey trip into a false caution/fail.
    const result = evaluateTravelReadiness(
      { destinationSlug: 'antalya', isBritishPassport: true, exemptionDocument: 'none', ...SHORT_TRIP },
      NOW
    );
    expect(result.verdict).not.toBe('visa-or-entry-permission-needed');
  });

  it('Turkey boundary: 89 days inclusive is within the limit but still rolling-window-unconfirmed, not ready', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'antalya',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-01-01',
        returnDate: '2027-03-30', // 89 days inclusive
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    const visaCheck = result.checks.find((c) => c.id === 'visa-requirement');
    expect(visaCheck?.status).not.toBe('fail');
    expect(result.verdict).toBe('stay-length-unconfirmed');
  });

  it('Turkey boundary: exactly 90 days inclusive passes the stay-limit check (still rolling-window-unconfirmed, not a fail)', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'antalya',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-01-01',
        returnDate: '2027-03-31', // exactly 90 days inclusive of both ends
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    const visaCheck = result.checks.find((c) => c.id === 'visa-requirement');
    expect(visaCheck?.status).not.toBe('fail');
    expect(result.verdict).toBe('stay-length-unconfirmed');
  });

  it('Turkey boundary: 91 days inclusive fails', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'antalya',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-01-01',
        returnDate: '2027-04-01', // 91 days inclusive
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    const visaCheck = result.checks.find((c) => c.id === 'visa-requirement');
    expect(visaCheck?.status).toBe('fail');
    expect(result.verdict).toBe('visa-or-entry-permission-needed');
  });

  it('UAE (rolling 90/180, visa-on-arrival): an over-limit trip fails rather than passing as "nothing to arrange"', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'dubai',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2026-10-01',
        returnDate: '2027-03-01',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('visa-or-entry-permission-needed');
    expect(result.checks.find((c) => c.id === 'visa-requirement')?.status).toBe('fail');
  });

  it('UAE: an ordinary short trip is honestly unconfirmed (rolling window), not a false ready — and does NOT reintroduce the TR-016 "start your application" false-friction bug', () => {
    // UAE is a rolling-window rule like Turkey, so — per the founder's own
    // instruction — even a short trip can never be proven compliant without
    // the traveller's other visits in the window; it must not collapse to a
    // flat "ready". This is a deliberate, correct change from the original
    // TR-016 regression test's expectation (see the updated assertion in
    // tests/travel-ready-check.test.ts for the same input): the ORIGINAL
    // TR-016 bug — treating zero processing days as unfiled-application
    // friction — must still not reappear; it doesn't, because this is a
    // different, honestly-worded caution about stay length, not a
    // resurrected "start your application" document-timing message.
    const result = evaluateTravelReadiness(
      { destinationSlug: 'dubai', isBritishPassport: true, exemptionDocument: 'none', ...SHORT_TRIP },
      NOW
    );
    expect(result.verdict).toBe('stay-length-unconfirmed');
    expect(result.nextAction).not.toMatch(/start your application/i);
    expect(result.checks.find((c) => c.id === 'visa-requirement')?.detail).not.toMatch(/start your application|haven.t told us you hold one/i);
  });

  it('Qatar (simple 30-day maximum, no rolling window): an over-limit trip fails', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'doha',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-04-15', // 46 days inclusive
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('visa-or-entry-permission-needed');
    expect(result.checks.find((c) => c.id === 'visa-requirement')?.status).toBe('fail');
  });

  it('Qatar boundary: 29 days inclusive is a genuine, unconditional pass', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'doha',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-03-29', // 29 days inclusive
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
    expect(result.checks.find((c) => c.id === 'visa-requirement')?.status).toBe('pass');
  });

  it('Qatar boundary: exactly 30 days inclusive is a genuine, unconditional pass (simple maximum, no rolling-window caveat)', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'doha',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-03-30', // 30 days inclusive
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
    expect(result.checks.find((c) => c.id === 'visa-requirement')?.status).toBe('pass');
  });

  it('Qatar boundary: 31 days inclusive fails', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'doha',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        returnDate: '2027-03-31', // 31 days inclusive
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('visa-or-entry-permission-needed');
  });

  it('Qatar: an ordinary short trip still reaches ready-to-continue (TR-016 regression preserved)', () => {
    const result = evaluateTravelReadiness(
      { destinationSlug: 'doha', isBritishPassport: true, exemptionDocument: 'none', ...SHORT_TRIP },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('Morocco (simple 90-day maximum, no rolling window): an over-limit trip fails', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'marrakech',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2026-10-01',
        returnDate: '2027-03-01', // 152 days inclusive
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('visa-or-entry-permission-needed');
    expect(result.checks.find((c) => c.id === 'visa-requirement')?.status).toBe('fail');
  });

  it('Morocco boundary: 89 days inclusive is a genuine, unconditional pass', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'marrakech',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-01-01',
        returnDate: '2027-03-30', // 89 days inclusive
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
    expect(result.checks.find((c) => c.id === 'visa-requirement')?.status).toBe('pass');
  });

  it('Morocco boundary: exactly 90 days inclusive is a genuine, unconditional pass', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'marrakech',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-01-01',
        returnDate: '2027-03-31', // exactly 90 days inclusive
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
    expect(result.checks.find((c) => c.id === 'visa-requirement')?.status).toBe('pass');
  });

  it('Morocco boundary: 91 days inclusive fails', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'marrakech',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-01-01',
        returnDate: '2027-04-01', // 91 days inclusive
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('visa-or-entry-permission-needed');
  });

  it('Morocco: an ordinary short trip still reaches ready-to-continue', () => {
    const result = evaluateTravelReadiness(
      { destinationSlug: 'marrakech', isBritishPassport: true, exemptionDocument: 'none', ...SHORT_TRIP },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('Boundary check follow-up (PR #228, 5 September 2026): every stay-limit-driven result discloses JetStash\'s own day-counting assumption, since no official source (re-checked live) states one', () => {
    const exceeds = evaluateTravelReadiness(
      { destinationSlug: 'antalya', isBritishPassport: true, exemptionDocument: 'none', departureDate: '2026-10-01', returnDate: '2027-03-01', passportExpiryDate: '2029-01-01' },
      NOW
    );
    const windowUnconfirmed = evaluateTravelReadiness(
      { destinationSlug: 'antalya', isBritishPassport: true, exemptionDocument: 'none', ...SHORT_TRIP },
      NOW
    );
    const simplePass = evaluateTravelReadiness(
      { destinationSlug: 'doha', isBritishPassport: true, exemptionDocument: 'none', departureDate: '2027-03-01', returnDate: '2027-03-30', passportExpiryDate: '2029-01-01' },
      NOW
    );
    for (const result of [exceeds, windowUnconfirmed, simplePass]) {
      const detail = result.checks.find((c) => c.id === 'visa-requirement')?.detail;
      expect(detail).toMatch(/counts both your departure and return dates as full days present/i);
      expect(detail).toMatch(/doesn't publish an exact day-counting rule/i);
    }
    // A country with no stay-limit rule at all (e.g. Saudi Arabia's advance-
    // visa requirement) has nothing to disclose — the caveat must not leak
    // into unrelated visa-requirement messaging.
    const noStayLimit = evaluateTravelReadiness(
      { destinationSlug: 'jeddah', isBritishPassport: true, exemptionDocument: 'none', ...SHORT_TRIP },
      NOW
    );
    expect(noStayLimit.checks.find((c) => c.id === 'visa-requirement')?.detail).not.toMatch(/day-counting/i);
  });

  it('Saudi Arabia (no stay-limit rule at all) is entirely unaffected by this fix', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'jeddah',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2026-10-01',
        returnDate: '2027-03-01', // a long trip, but Saudi Arabia's rule always required an arranged visa regardless of length
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).not.toBe('ready-to-continue');
    expect(result.checks.find((c) => c.id === 'visa-requirement')?.detail).not.toMatch(/day visa-free allowance|rolling.*allowance/);
  });
});
