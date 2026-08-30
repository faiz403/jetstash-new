import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { evaluateTravelReadiness } from '@/lib/travel-ready-check';

/**
 * Real-user validation, Stage A (30 Aug 2026) — Fix 1: Travel Ready
 * silent-submission recovery path.
 *
 * A real tester filled the form, pressed "Check my travel readiness", and
 * reported nothing visibly happened, repeatedly. Confirmed root cause:
 * handleSubmit's own required-field guard returned silently whenever a
 * field's React state wasn't set — no message, no focus, no loading state,
 * nothing. This suite guards the fix at two levels:
 *
 * 1. The decision logic itself (evaluateTravelReadiness) is untouched — a
 *    fully-completed submission still produces the same real verdict as
 *    before. This project has no jsdom/@testing-library dependency (see
 *    tests/journey-choice-measurement.test.ts's own header comment), so
 *    the interactive click-through can't be simulated directly; instead
 *    this locks in the one thing a UI fix must never change.
 * 2. The component's own source is inspected structurally (the same
 *    established pattern this codebase already uses elsewhere for
 *    behaviour a jsdom-free suite can't exercise directly, e.g.
 *    route-verification-review-visibility.test.ts's "G. No network/
 *    provider/Brevo dependency" checks) to prove the silent-return branch
 *    no longer exists, a visible human message replaces it, and the
 *    passport radio touch targets were enlarged.
 */

const componentSrc = readFileSync(
  join(process.cwd(), 'components', 'travel-ready', 'travel-ready-check.tsx'),
  'utf8'
);

describe('Fix 1a — a fully valid submission still produces the same real result (decision logic untouched)', () => {
  it('British passport, Mumbai, no exemption held — same verdict as the live production check', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'mumbai',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2026-11-01',
        returnDate: '2026-11-15',
        passportExpiryDate: '2030-01-01',
      },
      new Date('2026-08-30T12:00:00Z')
    );
    // Matches the exact verdict observed live on production during the
    // Stage A diagnostic (29 Aug 2026) for this same input shape.
    expect(result.verdict).toBe('document-timing-may-affect-booking');
    expect(result.checks.length).toBeGreaterThan(0);
    expect(result.headline).toBeTruthy();
  });

  it('the component still calls the same evaluateTravelReadiness signature — the fix never re-derives its own verdict', () => {
    expect(componentSrc).toContain('evaluateTravelReadiness(');
    expect(componentSrc).toMatch(/import \{\s*evaluateTravelReadiness,/);
  });
});

describe('Fix 1b — silent submission is now structurally impossible', () => {
  const handleSubmitSrc = componentSrc.slice(
    componentSrc.indexOf('function handleSubmit'),
    componentSrc.indexOf('function handleReset')
  );

  it('the required-field guard sets a visible message before returning — never a bare early return', () => {
    // The old defect was exactly this shape: `if (...) return;` with nothing
    // else. Assert the guard's return is now preceded by a state-setting
    // call, not a lone statement.
    expect(handleSubmitSrc).toMatch(/setSubmissionError\(/);
    expect(handleSubmitSrc).not.toMatch(/if \([^)]*\)\s*return;/);
  });

  it('the message is human and does not imply a technical failure', () => {
    const message = "'Please complete all the questions above.'";
    expect(componentSrc).toContain(message);
    // Checked against the literal message text itself, not the surrounding
    // source (which legitimately discusses "failure" in its own comments)
    // — the customer-facing string must never read as a technical error.
    const messageLower = message.toLowerCase();
    expect(messageLower).not.toMatch(/\berror\b|\bsomething went wrong\b|\bfailed\b/);
  });

  it('the message renders with role="alert" so assistive tech announces it — not a silently-styled div', () => {
    expect(componentSrc).toMatch(/role="alert"[\s\S]{0,120}submissionError|submissionError[\s\S]{0,200}role="alert"/);
  });

  it('the first missing field is focused and scrolled into view, not left for the visitor to hunt for', () => {
    expect(handleSubmitSrc).toContain('firstMissing.ref.current?.focus()');
    expect(handleSubmitSrc).toContain('scrollIntoView');
  });

  it('a stale message is cleared as soon as the visitor edits any field again', () => {
    expect(componentSrc).toContain('clearSubmissionError()');
    // Every editable control's onChange should reference the clearer —
    // guards against the fix being wired to only some of the five fields.
    const onChangeClearCount = (componentSrc.match(/clearSubmissionError\(\);/g) ?? []).length;
    expect(onChangeClearCount).toBeGreaterThanOrEqual(5);
  });
});

describe('Fix 1c — passport radio touch targets are comfortably touch-friendly', () => {
  it('the radio label uses the same 44px (h-11) minimum-height token every other control in this form already uses', () => {
    const fieldsetSrc = componentSrc.slice(
      componentSrc.indexOf('Are you travelling on a British passport?'),
      componentSrc.indexOf('</fieldset>')
    );
    expect(fieldsetSrc).toMatch(/min-h-11/);
  });
});
