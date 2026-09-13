import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { evaluateTravelReadiness } from '@/lib/travel-ready-check';
import { getRule } from '@/data/travel-ready-rules';

/**
 * Pakistan NICOP/POC validity fix (13 Sept 2026, founder-approved). Task 11's
 * dedicated focused coverage — see PR description for the full brief.
 * Founder's explicit safety instruction this whole fix exists to satisfy:
 * "an expired card should not get another green 'ready' result based only on
 * the landing-permit procedure. It should fail closed into a 'confirm before
 * booking' state." Every assertion below is written to prove that, not just
 * that a new field exists.
 *
 * This project has no jsdom/@testing-library dependency (see
 * tests/journey-choice-measurement.test.ts's own header comment and
 * tests/travel-ready-check-recovery-path-fix.test.ts's Fix 1b), so the
 * interactive reveal-on-select and form-submission behaviour is proven the
 * same established way this codebase already uses elsewhere: the pure
 * decision function for logic, and structural inspection of the component's
 * own source for behaviour a jsdom-free suite can't exercise directly.
 */

const NOW = new Date('2026-09-13T12:00:00Z');

const componentSrc = readFileSync(
  join(process.cwd(), 'components', 'travel-ready', 'travel-ready-check.tsx'),
  'utf8'
);

const VALID_TRIP = {
  destinationSlug: 'islamabad',
  isBritishPassport: true,
  exemptionDocument: 'nicop-poc' as const,
  departureDate: '2027-01-15',
  arrivalDate: '2027-01-15',
  returnDate: '2027-01-29',
  passportExpiryDate: '2029-01-01',
};

describe('1-2. Selecting NICOP/POC reveals the validity question, and it becomes required once selected', () => {
  it('the validity fieldset is only rendered when exemptionDocument === "nicop-poc"', () => {
    expect(componentSrc).toMatch(/exemptionDocument === 'nicop-poc' &&\s*\(\s*<fieldset>/);
    expect(componentSrc).toContain('Is your NICOP or POC currently valid?');
  });

  it('the validity question offers exactly the two founder-specified options, no extra fields', () => {
    expect(componentSrc).toContain("{ value: 'valid', label: 'Yes, it is valid' }");
    expect(componentSrc).toContain("{ value: 'expired-lost-renewing', label: 'No, it is expired, lost or being renewed' }");
  });

  it('the required-field guard only demands the validity answer once NICOP/POC is selected — every other exemption skips it', () => {
    const handleSubmitSrc = componentSrc.slice(
      componentSrc.indexOf('function handleSubmit'),
      componentSrc.indexOf('function handleReset')
    );
    expect(handleSubmitSrc).toContain("exemptionDocument !== 'nicop-poc' || Boolean(documentValidity)");
  });
});

describe('3-4. Valid NICOP reaches the valid exemption path; POC wording is explicitly covered', () => {
  it('a valid NICOP produces ready-to-continue', () => {
    const result = evaluateTravelReadiness({ ...VALID_TRIP, documentValidity: 'valid' }, NOW);
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('the exemption rule requirement text explicitly names both NICOP and POC, not just NICOP/SNICOP', () => {
    const rule = getRule('Pakistan', 'nicop-poc-holder', 'document-exemption');
    expect(rule?.requirement).toMatch(/NICOP/);
    expect(rule?.requirement).toMatch(/Pakistan Origin Card \(POC\)/);
  });

  it('the valid-document check item carries the POC-inclusive wording through to the result', () => {
    const result = evaluateTravelReadiness({ ...VALID_TRIP, documentValidity: 'valid' }, NOW);
    const check = result.checks.find((c) => c.id === 'visa-requirement');
    expect(check?.detail).toMatch(/Pakistan Origin Card \(POC\)/);
  });
});

describe('5-7. Expired/lost/renewing NICOP/POC does not receive a green pass, and never claims unlimited stay or unqualified no-visa-needed', () => {
  it('does not reach ready-to-continue — reaches the dedicated document-validity-not-confirmed verdict instead', () => {
    const result = evaluateTravelReadiness({ ...VALID_TRIP, documentValidity: 'expired-lost-renewing' }, NOW);
    expect(result.verdict).not.toBe('ready-to-continue');
    expect(result.verdict).toBe('document-validity-not-confirmed');
  });

  it('an unanswered validity (undefined) is treated the same as expired — never silently assumed valid', () => {
    const result = evaluateTravelReadiness({ ...VALID_TRIP, documentValidity: undefined }, NOW);
    expect(result.verdict).toBe('document-validity-not-confirmed');
  });

  it('the expired-branch headline and next action never say "unlimited stay"', () => {
    const result = evaluateTravelReadiness({ ...VALID_TRIP, documentValidity: 'expired-lost-renewing' }, NOW);
    expect(result.headline).not.toMatch(/unlimited stay/i);
    expect(result.nextAction).not.toMatch(/unlimited stay/i);
    const check = result.checks.find((c) => c.id === 'visa-requirement');
    expect(check?.detail).not.toMatch(/unlimited stay/i);
  });

  it('the expired-branch text never gives an unqualified "no visa needed" and never claims guaranteed entry/boarding or a ready-to-continue phrase', () => {
    const result = evaluateTravelReadiness({ ...VALID_TRIP, documentValidity: 'expired-lost-renewing' }, NOW);
    const allText = `${result.headline} ${result.nextAction} ${result.checks.map((c) => c.detail).join(' ')}`;
    expect(allText).not.toMatch(/no visa needed/i);
    expect(allText).not.toMatch(/guaranteed entry/i);
    expect(allText).not.toMatch(/guaranteed boarding/i);
    expect(allText).not.toMatch(/ready to continue/i);
  });

  it('the expired-branch check status is caution, never a pass', () => {
    const result = evaluateTravelReadiness({ ...VALID_TRIP, documentValidity: 'expired-lost-renewing' }, NOW);
    const check = result.checks.find((c) => c.id === 'visa-requirement');
    expect(check?.status).toBe('caution');
    expect(check?.status).not.toBe('pass');
  });
});

describe('8-9. Renewal-slip and 72-hour FIA landing-permit guidance appear, appropriately qualified', () => {
  it('renewal-slip guidance appears', () => {
    const result = evaluateTravelReadiness({ ...VALID_TRIP, documentValidity: 'expired-lost-renewing' }, NOW);
    const check = result.checks.find((c) => c.id === 'visa-requirement');
    expect(check?.detail).toMatch(/renewal slip/i);
  });

  it('the 72-hour landing-permit guidance appears, framed as informational/caution, never as a readiness pass', () => {
    const result = evaluateTravelReadiness({ ...VALID_TRIP, documentValidity: 'expired-lost-renewing' }, NOW);
    const check = result.checks.find((c) => c.id === 'visa-requirement');
    expect(check?.detail).toMatch(/72 hours/i);
    const rule = getRule('Pakistan', 'nicop-poc-holder', 'expired-document-guidance');
    expect(rule?.caveat).toMatch(/informational, not a JetStash readiness pass/i);
  });
});

describe('10-11. Official sources: FIA source attached to the expired branch, valid-branch source unchanged', () => {
  it('the expired/lost/renewing check carries the FIA official source', () => {
    const result = evaluateTravelReadiness({ ...VALID_TRIP, documentValidity: 'expired-lost-renewing' }, NOW);
    const check = result.checks.find((c) => c.id === 'visa-requirement');
    expect(check?.officialSource?.url).toBe('https://www.fia.gov.pk/immigration_w');
  });

  it('the valid-document check still carries its existing official source', () => {
    const result = evaluateTravelReadiness({ ...VALID_TRIP, documentValidity: 'valid' }, NOW);
    const check = result.checks.find((c) => c.id === 'visa-requirement');
    expect(check?.officialSource).toBeTruthy();
    expect(check?.officialSource?.url).toContain('gov.uk');
  });
});

describe('12. Valid result still works for the Person C profile (British passport, MAN→ISB, NICOP/POC, January travel, valid document)', () => {
  it('reproduces the exact Person C profile end-to-end and still reaches ready-to-continue', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'islamabad',
        isBritishPassport: true,
        exemptionDocument: 'nicop-poc',
        documentValidity: 'valid',
        departureDate: '2027-01-10',
        arrivalDate: '2027-01-10',
        returnDate: '2027-01-24',
        passportExpiryDate: '2029-06-01',
      },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
    expect(result.engineSignal).toBeNull();
  });
});

describe('13-16. No regression for unrelated document scopes/countries', () => {
  it('British passport + no exemption document (Pakistan) is unaffected', () => {
    const result = evaluateTravelReadiness(
      { ...VALID_TRIP, exemptionDocument: 'none', documentValidity: undefined },
      NOW
    );
    // No exemption held and no visa held: falls into the ordinary
    // visa-required branch (caution/fail depending on lead time) — this
    // fix must not divert it into the new NICOP-only verdict.
    expect(['visa-or-entry-permission-needed', 'document-timing-may-affect-booking']).toContain(result.verdict);
    expect(result.verdict).not.toBe('document-validity-not-confirmed');
  });

  it('India OCI is unaffected', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'delhi',
        isBritishPassport: true,
        exemptionDocument: 'oci',
        departureDate: '2027-03-01',
        arrivalDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('Bangladesh NVR is unaffected', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'dhaka',
        isBritishPassport: true,
        exemptionDocument: 'nvr',
        departureDate: '2027-03-01',
        arrivalDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      NOW
    );
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('other supported countries (Saudi Arabia, UAE, Qatar, Turkey, Morocco) are unaffected', () => {
    const slugs = ['jeddah', 'dubai', 'doha', 'istanbul', 'marrakech'];
    for (const slug of slugs) {
      const result = evaluateTravelReadiness(
        {
          destinationSlug: slug,
          isBritishPassport: true,
          exemptionDocument: 'none',
          departureDate: '2027-03-01',
          arrivalDate: '2027-03-01',
          returnDate: '2027-03-20',
          passportExpiryDate: '2029-01-01',
        },
        NOW
      );
      expect(result.verdict).not.toBe('not-enough-information');
      expect(result.verdict).not.toBe('document-validity-not-confirmed');
    }
  });
});

describe('17. Missing validity answer triggers the existing form-error behaviour', () => {
  it('the same visible submissionError guard (never a silent return) also covers the new validity field, using the existing message and focus/scroll pattern', () => {
    const handleSubmitSrc = componentSrc.slice(
      componentSrc.indexOf('function handleSubmit'),
      componentSrc.indexOf('function handleReset')
    );
    // The new required-field entry sits in the same array, guarded by the
    // same firstMissing/setSubmissionError/focus/scrollIntoView logic that
    // every other required field already uses — no separate, bespoke error
    // path was introduced for this one field.
    expect(handleSubmitSrc).toContain('documentValidityYesRadioRef');
    expect(handleSubmitSrc).toMatch(/setSubmissionError\('Please complete all the questions above\.'\)/);
    expect(handleSubmitSrc).toContain('firstMissing.ref.current?.focus()');
    expect(handleSubmitSrc).toContain('scrollIntoView');
  });

  it('a stale validity selection is cleared when the destination or exemption document changes, never carried over silently', () => {
    const destinationOnChangeSrc = componentSrc.slice(
      componentSrc.indexOf('id="ready-destination"'),
      componentSrc.indexOf('</select>', componentSrc.indexOf('id="ready-destination"'))
    );
    expect(destinationOnChangeSrc).toContain("setDocumentValidity('')");
    const exemptionOnChangeSrc = componentSrc.slice(
      componentSrc.indexOf('id="ready-exemption"'),
      componentSrc.indexOf('</select>', componentSrc.indexOf('id="ready-exemption"'))
    );
    expect(exemptionOnChangeSrc).toContain("setDocumentValidity('')");
  });
});

describe('18. No Trip.com/CTA changes', () => {
  it('the booking-CTA/Trip.com handoff block of the component is untouched by this fix', () => {
    expect(componentSrc).toContain('getTripComFlightHandoff(matchedRoute.slug, airportSlugForCta, destinationSlug)');
    expect(componentSrc).toContain('SERVICE_ENDED_CTA_LABEL');
    expect(componentSrc).toContain('TRIPCOM_DEFAULT_CTA_LABEL');
  });
});

describe('19-20. No unrelated Travel Ready policy changes', () => {
  it('the Pakistan passport-validity and visa-requirement rules for british-passport scope are untouched', () => {
    const passportRule = getRule('Pakistan', 'british-passport', 'passport-validity');
    const visaRule = getRule('Pakistan', 'british-passport', 'visa-requirement');
    expect(passportRule?.requirement).toMatch(/6 months/);
    expect(visaRule?.requirement).toMatch(/Pakistan Online Visa System/);
  });

  it('the new expired-document-guidance ruleType is scoped to Pakistan/nicop-poc-holder only — no other (country, scope) pair carries it', () => {
    const otherScopePairs: Array<[string, 'oci-holder' | 'nvr-holder' | 'british-passport']> = [
      ['India', 'oci-holder'],
      ['Bangladesh', 'nvr-holder'],
      ['Pakistan', 'british-passport'],
    ];
    for (const [country, scope] of otherScopePairs) {
      expect(getRule(country, scope, 'expired-document-guidance' as never)).toBeUndefined();
    }
  });
});
