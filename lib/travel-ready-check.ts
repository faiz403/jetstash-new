import { getDestinationBySlug } from '@/data/destinations';
import {
  getRule,
  isRuleStale,
  type TravelReadyNationalityScope,
  type TravelReadyRule,
} from '@/data/travel-ready-rules';
import type { TravelReadySignal } from '@/lib/travel-intelligence-engine';

/**
 * Travel Ready Check's decision engine — answers "can I actually travel on
 * these dates with the documents I have?", the connected-but-different
 * question to Book-By Countdown's "when should I book?" (JETSTASH_PRINCIPLES.md
 * §14.2, §14.3). Pure function of (input, now), same style as
 * lib/booking-intelligence.ts: nothing here is a class, nothing has side
 * effects, nothing is stored — see the privacy note on
 * `TravelReadyCheckInput` below.
 *
 * One verdict from an ordered decision tree, never a blended score (§9,
 * §14.2's "worst true signal wins"). Every check that was actually
 * evaluated stays individually visible in `checks`, regardless of which one
 * decided the top-line verdict.
 */

/** The only destinations this ships supporting in V1 — see data/travel-ready-rules.ts for why. */
export const TRAVEL_READY_SUPPORTED_COUNTRIES: readonly string[] = [
  'Pakistan',
  'India',
  'Bangladesh',
  'Saudi Arabia',
  'United Arab Emirates',
  'Qatar',
  'Turkey',
  'Morocco',
];

export type TravelReadyVerdict =
  | 'ready-to-continue'
  | 'check-passport-validity'
  | 'visa-or-entry-permission-needed'
  | 'document-timing-may-affect-booking'
  | 'official-confirmation-required'
  | 'not-enough-information'
  /** Return date is before the departure date — an input error, not a travel-readiness judgement. Never reaches the rule engine. */
  | 'invalid-date-range'
  /** Departure date is in the past relative to `now` — an input error, not a travel-readiness judgement. Never reaches the rule engine. */
  | 'invalid-departure-date'
  /**
   * The entered trip is within a rolling-window stay limit's stated maximum
   * on its own (e.g. under Turkey/UAE's 90-day figure), but JetStash doesn't
   * collect the traveller's other visits within that window, so full
   * compliance with the rolling window can't be confirmed from this trip
   * alone — a distinct state from `ready-to-continue`, never collapsed into
   * it (Trust Integrity fix, 5 September 2026). See `evaluateStayLimit()`.
   */
  | 'stay-length-unconfirmed';

/** What the traveller told us they already hold, if anything. */
export type ExemptionDocument = 'nicop-poc' | 'oci' | 'nvr' | 'visa-or-permit' | 'none';

/**
 * Every field here is either a plain enum/boolean or a date — deliberately
 * nothing that identifies a specific document (no passport number, no date
 * of birth). Nothing in this module persists this input anywhere; it lives
 * only in the calling component's local state.
 */
export interface TravelReadyCheckInput {
  destinationSlug: string;
  isBritishPassport: boolean;
  exemptionDocument: ExemptionDocument;
  /** ISO date. */
  departureDate: string;
  /** ISO date. */
  returnDate: string;
  /** ISO date. */
  passportExpiryDate: string;
}

export interface TravelReadyCheckItem {
  id: 'passport-validity' | 'visa-requirement';
  label: string;
  status: 'pass' | 'fail' | 'caution' | 'unknown';
  detail: string;
  officialSource?: { title: string; url: string };
  lastVerifiedDate?: string;
  /** The rule's own reviewDueDate, unmodified — never a newly invented interval. */
  reviewDueDate?: string;
  stale?: boolean;
}

export interface TravelReadyResult {
  verdict: TravelReadyVerdict;
  headline: string;
  checks: TravelReadyCheckItem[];
  nextAction: string;
  disclaimer: string;
  /** What (if anything) this feeds into the Travel Intelligence Engine. */
  engineSignal: TravelReadySignal | null;
}

const DISCLAIMER =
  'Guidance based on official sources checked on the date shown for each item, not a legal guarantee of entry — always confirm directly with the official source before booking a non-refundable fare.';

const DAY_MS = 86_400_000;
function toUtcNoon(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getTime();
}
function daysBetweenIso(fromIso: string, toIso: string): number {
  return Math.round((toUtcNoon(toIso) - toUtcNoon(fromIso)) / DAY_MS);
}

/**
 * Trip length for stay-limit purposes. No official source we hold (GOV.UK)
 * specifies entry/exit-day counting convention, so this is JetStash's own
 * documented, conservative assumption: both the day of arrival and the day
 * of departure count as days present in the country, i.e. inclusive of both
 * endpoints. This can only ever overstate a trip's length relative to the
 * official rule, never understate it — the safe direction for a limit check
 * (Trust Integrity fix, 5 September 2026).
 */
function tripLengthDaysInclusive(departureIso: string, returnIso: string): number {
  return daysBetweenIso(departureIso, returnIso) + 1;
}

/**
 * Evaluates a visa-requirement rule's own `stayLimit` (only set on rules
 * that grant visa-free/on-arrival entry up to a stated stay length — UAE,
 * Qatar, Turkey, Morocco as of this fix) against the traveller's entered
 * dates. Returns `null` when the rule has no stay limit, or when the trip is
 * safely within a simple (non-rolling-window) limit.
 *
 * A rolling-window rule (`windowDays` set, e.g. "90 days in any 180-day
 * period") is deliberately never simplified to "this trip alone is under
 * the limit, therefore pass" — a single itinerary cannot prove compliance
 * with a window that depends on the traveller's other visits within it,
 * which JetStash does not collect. `'window-unconfirmed'` is the honest
 * result for that case; only a trip that exceeds `maxDays` outright (which
 * by definition also breaches any rolling window built on top of it) is a
 * definite `'exceeds'`.
 */
function evaluateStayLimit(
  visaRule: TravelReadyRule,
  input: TravelReadyCheckInput
): { status: 'exceeds' | 'window-unconfirmed'; tripLengthDays: number } | null {
  if (!visaRule.stayLimit) return null;
  const tripLengthDays = tripLengthDaysInclusive(input.departureDate, input.returnDate);
  if (tripLengthDays > visaRule.stayLimit.maxDays) return { status: 'exceeds', tripLengthDays };
  if (visaRule.stayLimit.windowDays) return { status: 'window-unconfirmed', tripLengthDays };
  return null;
}

/**
 * Founder correction (5 September 2026, PR #228 boundary check): re-checked
 * GOV.UK's own live pages for UAE, Qatar, Turkey and Morocco specifically
 * for an explicit day-counting rule — none states one. JetStash must not
 * pretend to know the precise legal boundary, so every stay-limit-driven
 * result says plainly how *we* counted the days, rather than presenting
 * `tripLengthDaysInclusive`'s figure as if it were an official count.
 */
const STAY_LIMIT_COUNTING_CAVEAT =
  "JetStash counts both your departure and return dates as full days present — the official source doesn't publish an exact day-counting rule, so treat this as a careful estimate and check your exact dates against the source below if you're close to the limit.";

/**
 * JetStash's own conservative planning buffer, used only when a destination's
 * official visa process publishes no guaranteed processing time (Pakistan,
 * Saudi Arabia) — explicitly presented in copy as our general advice, never
 * as an official rule, to avoid the fabricated-precision mistake §9 exists
 * to prevent.
 */
const GENERIC_DOCUMENT_SAFETY_DAYS = 42;

function notEnoughInformation(reason: string): TravelReadyResult {
  return {
    verdict: 'not-enough-information',
    headline: reason,
    checks: [],
    nextAction: 'Check official government guidance directly for your specific nationality and destination.',
    disclaimer: DISCLAIMER,
    engineSignal: null,
  };
}

/**
 * Founder correction: an invalid date entry (return before departure, or a
 * departure date already in the past) must produce its own specific
 * validation verdict and must NEVER reach the passport/visa rule engine
 * below — "a definite result" or "a non-empty headline" alone isn't
 * sufficient; the wording must name the actual problem.
 */
function invalidDateResult(verdict: 'invalid-date-range' | 'invalid-departure-date', headline: string, nextAction: string): TravelReadyResult {
  return {
    verdict,
    headline,
    checks: [],
    nextAction,
    disclaimer: DISCLAIMER,
    engineSignal: null,
  };
}

export function evaluateTravelReadiness(input: TravelReadyCheckInput, now: Date): TravelReadyResult {
  const destination = getDestinationBySlug(input.destinationSlug);
  if (!destination) return notEnoughInformation('We don’t recognise that destination.');

  const country = destination.country;
  if (!TRAVEL_READY_SUPPORTED_COUNTRIES.includes(country)) {
    return notEnoughInformation(
      `Travel Ready Check doesn’t cover ${country} yet — we’d rather say that plainly than guess.`
    );
  }

  const nowIso = now.toISOString().slice(0, 10);

  // ── Date validation — gates the rule engine entirely, never blended with
  // a passport/visa judgement ─────────────────────────────────────────────
  if (input.departureDate && input.returnDate && input.returnDate < input.departureDate) {
    return invalidDateResult(
      'invalid-date-range',
      'Your return date is before your departure date — check your dates before continuing.',
      'Re-enter your departure and return dates so the return date falls on or after the departure date, then check again.'
    );
  }
  if (input.departureDate && input.departureDate < nowIso) {
    return invalidDateResult(
      'invalid-departure-date',
      'Your departure date is in the past — check your dates before continuing.',
      'Re-enter a departure date that hasn’t already passed, then check again.'
    );
  }

  const exemptionScope: TravelReadyNationalityScope | null =
    input.exemptionDocument === 'nicop-poc'
      ? 'nicop-poc-holder'
      : input.exemptionDocument === 'oci'
        ? 'oci-holder'
        : input.exemptionDocument === 'nvr'
          ? 'nvr-holder'
          : null;
  // A stale-state exemptionDocument left over from a previous destination
  // (e.g. NICOP still selected after switching from Pakistan to India) must
  // not silently grant an exemption that doesn't exist for this country —
  // only trust it once a real rule confirms it applies here.
  const exemptionRule = exemptionScope ? getRule(country, exemptionScope, 'document-exemption') : undefined;

  if (!input.isBritishPassport) {
    if (!exemptionRule) {
      return notEnoughInformation(
        'Travel Ready Check currently supports British passport holders, plus NICOP/POC document holders for Pakistan, OCI document holders for India, and NVR document holders for Bangladesh. We don’t yet have verified guidance for other passports.'
      );
    }
    // Trust Integrity fix, 5 September 2026: a real exemption document alone
    // is not enough to proceed. Every exemption rule we hold verified
    // evidence for (NICOP/POC, OCI, NVR) is itself framed by its own
    // official source as a British-passport-holder mechanism — see each
    // rule's own `requirement`/`caveat` text in data/travel-ready-rules.ts
    // ("used together with your valid British passport", "an endorsement IN
    // YOUR BRITISH PASSPORT"). None of that establishes anything about a
    // traveller who has told us their passport isn't British. Previously
    // this fell through and applied the British-passport passport-validity
    // rule anyway, producing a confirmed "READY TO CONTINUE" while showing
    // British-passport-specific guidance to a traveller who said they don't
    // hold one. This must fail closed instead: no British-passport guidance
    // leaks in, no "ready", no guess at the traveller's actual nationality.
    return {
      verdict: 'not-enough-information',
      headline: `JetStash can't confirm passport or entry requirements for your document combination — our verified guidance for this document is specifically for British passport holders.`,
      checks: [
        {
          id: 'visa-requirement',
          label: 'Document exemption',
          status: 'unknown',
          detail: `${exemptionRule.requirement} This exemption is specifically framed for a British passport holder. You've told us your passport isn't British, so JetStash can't confirm this exemption — or your passport's own entry requirements — apply to you. Check official guidance for your specific passport's nationality before booking.`,
          officialSource: exemptionRule.officialSource,
          lastVerifiedDate: exemptionRule.lastVerifiedDate,
          reviewDueDate: exemptionRule.reviewDueDate,
        },
      ],
      nextAction: 'Check official government guidance directly for your specific passport nationality and destination — JetStash only holds verified rules for British passport holders.',
      disclaimer: DISCLAIMER,
      engineSignal: null,
    };
  }

  const checks: TravelReadyCheckItem[] = [];

  // ── 1. Passport validity ────────────────────────────────────────────────
  const passportRule = getRule(country, 'british-passport', 'passport-validity');
  let passportOutcome: 'pass' | 'fail' | 'stale' | 'unknown' = 'unknown';

  if (!passportRule) {
    checks.push({
      id: 'passport-validity',
      label: 'Passport validity',
      status: 'unknown',
      detail: 'No passport-validity rule is recorded for this destination — official confirmation required.',
    });
  } else if (isRuleStale(passportRule, nowIso)) {
    passportOutcome = 'stale';
    checks.push({
      id: 'passport-validity',
      label: 'Passport validity',
      status: 'unknown',
      detail: 'This rule is due for re-verification — official confirmation required rather than relying on our last check.',
      officialSource: passportRule.officialSource,
      lastVerifiedDate: passportRule.lastVerifiedDate,
      reviewDueDate: passportRule.reviewDueDate,
      stale: true,
    });
  } else {
    const expiresDuringTrip = input.passportExpiryDate <= input.returnDate;
    const validityDays = daysBetweenIso(input.departureDate, input.passportExpiryDate);
    const meetsBuffer = passportRule.minDaysValidityBeyondEntry === undefined || validityDays >= passportRule.minDaysValidityBeyondEntry;
    const pass = !expiresDuringTrip && meetsBuffer;
    passportOutcome = pass ? 'pass' : 'fail';
    checks.push({
      id: 'passport-validity',
      label: 'Passport validity',
      status: pass ? 'pass' : 'fail',
      detail: pass
        ? `${passportRule.requirement} Your entered expiry date appears to satisfy this.`
        : `${passportRule.requirement} Your entered expiry date does not appear to satisfy this — check before booking.`,
      officialSource: passportRule.officialSource,
      lastVerifiedDate: passportRule.lastVerifiedDate,
      reviewDueDate: passportRule.reviewDueDate,
    });
  }

  // ── 2. Visa / entry permission, or a held exemption document ────────────
  // 'stay-limit-caution' is distinct from the generic 'caution' below (which
  // means "a document you haven't arranged yet") — it means "your stay is
  // within a rolling window's headline number on its own, but JetStash can't
  // confirm the window without your other visits," a different reason that
  // needs its own honest verdict/copy rather than reusing mismatched text.
  let visaOutcome: 'pass' | 'fail' | 'caution' | 'stale' | 'unknown' | 'stay-limit-caution' = 'unknown';

  if (exemptionRule) {
    if (isRuleStale(exemptionRule, nowIso)) {
      visaOutcome = 'stale';
      checks.push({
        id: 'visa-requirement',
        label: 'Document exemption',
        status: 'unknown',
        detail: 'This exemption rule is due for re-verification — official confirmation required.',
        officialSource: exemptionRule.officialSource,
        lastVerifiedDate: exemptionRule.lastVerifiedDate,
        reviewDueDate: exemptionRule.reviewDueDate,
        stale: true,
      });
    } else {
      visaOutcome = 'pass';
      checks.push({
        id: 'visa-requirement',
        label: 'Document exemption',
        status: 'pass',
        detail: exemptionRule.requirement,
        officialSource: exemptionRule.officialSource,
        lastVerifiedDate: exemptionRule.lastVerifiedDate,
        reviewDueDate: exemptionRule.reviewDueDate,
      });
    }
  } else {
    const visaRule = getRule(country, 'british-passport', 'visa-requirement');
    if (!visaRule) {
      checks.push({
        id: 'visa-requirement',
        label: 'Visa or entry permission',
        status: 'unknown',
        detail: 'No visa-requirement rule is recorded for this destination — official confirmation required.',
      });
    } else if (isRuleStale(visaRule, nowIso)) {
      visaOutcome = 'stale';
      checks.push({
        id: 'visa-requirement',
        label: 'Visa or entry permission',
        status: 'unknown',
        detail: 'This rule is due for re-verification — official confirmation required rather than relying on our last check.',
        officialSource: visaRule.officialSource,
        lastVerifiedDate: visaRule.lastVerifiedDate,
        reviewDueDate: visaRule.reviewDueDate,
        stale: true,
      });
    } else if (!visaRule.visaRequired) {
      const stayLimitResult = evaluateStayLimit(visaRule, input);
      if (stayLimitResult?.status === 'exceeds') {
        visaOutcome = 'fail';
        checks.push({
          id: 'visa-requirement',
          label: 'Visa or entry permission',
          status: 'fail',
          detail: `${visaRule.requirement} Your entered dates are ${stayLimitResult.tripLengthDays} days — longer than the ${visaRule.stayLimit!.maxDays}-day visa-free allowance${visaRule.stayLimit!.windowDays ? ` within any ${visaRule.stayLimit!.windowDays}-day period` : ''}. You'll need to arrange a visa or check current entry requirements before booking. ${STAY_LIMIT_COUNTING_CAVEAT}`,
          officialSource: visaRule.officialSource,
          lastVerifiedDate: visaRule.lastVerifiedDate,
          reviewDueDate: visaRule.reviewDueDate,
        });
      } else if (stayLimitResult?.status === 'window-unconfirmed') {
        visaOutcome = 'stay-limit-caution';
        checks.push({
          id: 'visa-requirement',
          label: 'Visa or entry permission',
          status: 'caution',
          detail: `${visaRule.requirement} Your entered dates are ${stayLimitResult.tripLengthDays} days, within the ${visaRule.stayLimit!.maxDays}-day limit on their own — but that's a rolling ${visaRule.stayLimit!.windowDays}-day allowance, and JetStash doesn't know about any other visits you've made within that window. We can't confirm you're within the allowance from this trip alone — check your own recent travel history against the official rule before booking. ${STAY_LIMIT_COUNTING_CAVEAT}`,
          officialSource: visaRule.officialSource,
          lastVerifiedDate: visaRule.lastVerifiedDate,
          reviewDueDate: visaRule.reviewDueDate,
        });
      } else {
        visaOutcome = 'pass';
        checks.push({
          id: 'visa-requirement',
          label: 'Visa or entry permission',
          status: 'pass',
          detail: `${visaRule.requirement}${visaRule.stayLimit ? ` ${STAY_LIMIT_COUNTING_CAVEAT}` : ''}`,
          officialSource: visaRule.officialSource,
          lastVerifiedDate: visaRule.lastVerifiedDate,
          reviewDueDate: visaRule.reviewDueDate,
        });
      }
    } else if (input.exemptionDocument === 'visa-or-permit') {
      visaOutcome = 'pass';
      checks.push({
        id: 'visa-requirement',
        label: 'Visa or entry permission',
        status: 'pass',
        detail: `${visaRule.requirement} You told us you already hold a visa or entry permit for this trip.`,
        officialSource: visaRule.officialSource,
        lastVerifiedDate: visaRule.lastVerifiedDate,
        reviewDueDate: visaRule.reviewDueDate,
      });
    } else if (visaRule.typicalProcessingDays === 0) {
      // Genuinely nothing to arrange in advance — issued automatically on
      // arrival (e.g. UAE/Qatar visitor visas). Treating this the same as
      // an unfiled advance-application visa (see the `caution`/`fail`
      // branch below) produced a confirmed false-friction bug: it told
      // travellers to "start your application now" for a visa that has no
      // application step at all. Zero processing days is a pass, not a
      // caution — but the visa-on-arrival's own stay limit (Trust Integrity
      // fix, 5 September 2026) is checked before defaulting to pass, same as
      // the visa-free branch above.
      const stayLimitResult = evaluateStayLimit(visaRule, input);
      if (stayLimitResult?.status === 'exceeds') {
        visaOutcome = 'fail';
        checks.push({
          id: 'visa-requirement',
          label: 'Visa or entry permission',
          status: 'fail',
          detail: `${visaRule.requirement}${visaRule.caveat ? ` ${visaRule.caveat}` : ''} Your entered dates are ${stayLimitResult.tripLengthDays} days — longer than the ${visaRule.stayLimit!.maxDays}-day allowance${visaRule.stayLimit!.windowDays ? ` within any ${visaRule.stayLimit!.windowDays}-day period` : ''}. You'll need to check current entry requirements before booking. ${STAY_LIMIT_COUNTING_CAVEAT}`,
          officialSource: visaRule.officialSource,
          lastVerifiedDate: visaRule.lastVerifiedDate,
          reviewDueDate: visaRule.reviewDueDate,
        });
      } else if (stayLimitResult?.status === 'window-unconfirmed') {
        visaOutcome = 'stay-limit-caution';
        checks.push({
          id: 'visa-requirement',
          label: 'Visa or entry permission',
          status: 'caution',
          detail: `${visaRule.requirement}${visaRule.caveat ? ` ${visaRule.caveat}` : ''} Your entered dates are ${stayLimitResult.tripLengthDays} days, within the ${visaRule.stayLimit!.maxDays}-day limit on their own — but that's a rolling ${visaRule.stayLimit!.windowDays}-day allowance, and JetStash doesn't know about any other visits you've made within that window. We can't confirm you're within the allowance from this trip alone — check your own recent travel history against the official rule before booking. ${STAY_LIMIT_COUNTING_CAVEAT}`,
          officialSource: visaRule.officialSource,
          lastVerifiedDate: visaRule.lastVerifiedDate,
          reviewDueDate: visaRule.reviewDueDate,
        });
      } else {
        visaOutcome = 'pass';
        checks.push({
          id: 'visa-requirement',
          label: 'Visa or entry permission',
          status: 'pass',
          detail: `${visaRule.requirement}${visaRule.caveat ? ` ${visaRule.caveat}` : ''}${visaRule.stayLimit ? ` ${STAY_LIMIT_COUNTING_CAVEAT}` : ''}`,
          officialSource: visaRule.officialSource,
          lastVerifiedDate: visaRule.lastVerifiedDate,
          reviewDueDate: visaRule.reviewDueDate,
        });
      }
    } else {
      const daysToDeparture = daysBetweenIso(nowIso, input.departureDate);
      if (visaRule.typicalProcessingDays !== undefined) {
        const tight = daysToDeparture < visaRule.typicalProcessingDays * 2;
        visaOutcome = tight ? 'fail' : 'caution';
        checks.push({
          id: 'visa-requirement',
          label: 'Visa or entry permission',
          status: tight ? 'fail' : 'caution',
          detail: `${visaRule.requirement}${visaRule.caveat ? ` ${visaRule.caveat}` : ''} You haven’t told us you hold one yet.`,
          officialSource: visaRule.officialSource,
          lastVerifiedDate: visaRule.lastVerifiedDate,
          reviewDueDate: visaRule.reviewDueDate,
        });
      } else {
        const tight = daysToDeparture < GENERIC_DOCUMENT_SAFETY_DAYS;
        visaOutcome = tight ? 'fail' : 'caution';
        checks.push({
          id: 'visa-requirement',
          label: 'Visa or entry permission',
          status: tight ? 'fail' : 'caution',
          detail: `${visaRule.requirement}${visaRule.caveat ? ` ${visaRule.caveat}` : ''} As general guidance (not an official rule), we’d suggest applying at least ${GENERIC_DOCUMENT_SAFETY_DAYS / 7} weeks before travel when no official processing time is published. You haven’t told us you hold one yet.`,
          officialSource: visaRule.officialSource,
          lastVerifiedDate: visaRule.lastVerifiedDate,
          reviewDueDate: visaRule.reviewDueDate,
        });
      }
    }
  }

  // ── Priority decision tree — worst true fact wins, never blended ───
  let verdict: TravelReadyVerdict;
  if (passportOutcome === 'fail') {
    verdict = 'check-passport-validity';
  } else if (visaOutcome === 'fail') {
    verdict = 'visa-or-entry-permission-needed';
  } else if (visaOutcome === 'stay-limit-caution') {
    verdict = 'stay-length-unconfirmed';
  } else if (visaOutcome === 'caution') {
    verdict = 'document-timing-may-affect-booking';
  } else if (passportOutcome === 'stale' || visaOutcome === 'stale' || passportOutcome === 'unknown' || visaOutcome === 'unknown') {
    verdict = 'official-confirmation-required';
  } else {
    verdict = 'ready-to-continue';
  }

  const HEADLINES: Record<TravelReadyVerdict, string> = {
    'ready-to-continue': 'You appear ready to continue — nothing in your entered details points to a document issue.',
    'check-passport-validity': 'Check your passport validity before booking.',
    'visa-or-entry-permission-needed': 'You need a visa or entry permission sorted before booking.',
    'document-timing-may-affect-booking': 'A document you still need to arrange may affect your timing — avoid a non-refundable fare for now.',
    'official-confirmation-required': 'One of our rules is due for a refresh — official confirmation is required before we can give you a clear answer.',
    'not-enough-information': 'Not enough information to assess this yet.',
    'invalid-date-range': 'Your return date is before your departure date — check your dates before continuing.',
    'invalid-departure-date': 'Your departure date is in the past — check your dates before continuing.',
    'stay-length-unconfirmed': 'Your trip length works on its own, but JetStash can’t confirm you’re within a rolling visa-free allowance without your other visits — check before booking.',
  };

  const NEXT_ACTIONS: Record<TravelReadyVerdict, string> = {
    'ready-to-continue': 'Go ahead and check live prices — keep an eye on this page for anything that changes before you travel.',
    'check-passport-validity': 'Renew or check your passport’s expiry date against the requirement above before booking anything.',
    'visa-or-entry-permission-needed': 'Start your visa or entry-permission application through the official source below before booking a non-refundable fare.',
    'document-timing-may-affect-booking': 'Start your application now. Consider a flexible or refundable fare until it’s confirmed.',
    'official-confirmation-required': 'Check the official source below directly — our last verification has aged past the point we’re confident relying on it.',
    'not-enough-information': 'Check official government guidance directly for your specific nationality and destination.',
    'invalid-date-range': 'Re-enter your departure and return dates so the return date falls on or after the departure date, then check again.',
    'invalid-departure-date': 'Re-enter a departure date that hasn’t already passed, then check again.',
    'stay-length-unconfirmed': 'Check the official source below for exactly how the rolling window is calculated, and count any other visits within that window before booking a non-refundable fare.',
  };

  const engineSignal: TravelReadySignal | null =
    verdict === 'check-passport-validity' || verdict === 'visa-or-entry-permission-needed'
      ? { severity: 'critical', label: HEADLINES[verdict], detail: NEXT_ACTIONS[verdict] }
      : verdict === 'document-timing-may-affect-booking' || verdict === 'official-confirmation-required' || verdict === 'stay-length-unconfirmed'
        ? { severity: 'caution', label: HEADLINES[verdict], detail: NEXT_ACTIONS[verdict] }
        : null;

  return {
    verdict,
    headline: HEADLINES[verdict],
    checks,
    nextAction: NEXT_ACTIONS[verdict],
    disclaimer: DISCLAIMER,
    engineSignal,
  };
}
