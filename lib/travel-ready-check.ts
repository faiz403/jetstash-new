import { getDestinationBySlug } from '@/data/destinations';
import {
  getRule,
  isRuleStale,
  type TravelReadyNationalityScope,
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
  | 'not-enough-information';

/** What the traveller told us they already hold, if anything. */
export type ExemptionDocument = 'nicop-poc' | 'oci' | 'visa-or-permit' | 'none';

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

  const exemptionScope: TravelReadyNationalityScope | null =
    input.exemptionDocument === 'nicop-poc'
      ? 'nicop-poc-holder'
      : input.exemptionDocument === 'oci'
        ? 'oci-holder'
        : null;
  // A stale-state exemptionDocument left over from a previous destination
  // (e.g. NICOP still selected after switching from Pakistan to India) must
  // not silently grant an exemption that doesn't exist for this country —
  // only trust it once a real rule confirms it applies here.
  const exemptionRule = exemptionScope ? getRule(country, exemptionScope, 'document-exemption') : undefined;

  if (!input.isBritishPassport && !exemptionRule) {
    return notEnoughInformation(
      'Travel Ready Check currently supports British passport holders, plus NICOP/POC and OCI document holders for Pakistan and India. We don’t yet have verified guidance for other passports.'
    );
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
    });
  }

  // ── 2. Visa / entry permission, or a held exemption document ────────────
  let visaOutcome: 'pass' | 'fail' | 'caution' | 'stale' | 'unknown' = 'unknown';

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
        stale: true,
      });
    } else if (!visaRule.visaRequired) {
      visaOutcome = 'pass';
      checks.push({
        id: 'visa-requirement',
        label: 'Visa or entry permission',
        status: 'pass',
        detail: visaRule.requirement,
        officialSource: visaRule.officialSource,
        lastVerifiedDate: visaRule.lastVerifiedDate,
      });
    } else if (input.exemptionDocument === 'visa-or-permit') {
      visaOutcome = 'pass';
      checks.push({
        id: 'visa-requirement',
        label: 'Visa or entry permission',
        status: 'pass',
        detail: `${visaRule.requirement} You told us you already hold a visa or entry permit for this trip.`,
        officialSource: visaRule.officialSource,
        lastVerifiedDate: visaRule.lastVerifiedDate,
      });
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
  };

  const NEXT_ACTIONS: Record<TravelReadyVerdict, string> = {
    'ready-to-continue': 'Go ahead and check live prices — keep an eye on this page for anything that changes before you travel.',
    'check-passport-validity': 'Renew or check your passport’s expiry date against the requirement above before booking anything.',
    'visa-or-entry-permission-needed': 'Start your visa or entry-permission application through the official source below before booking a non-refundable fare.',
    'document-timing-may-affect-booking': 'Start your application now. Consider a flexible or refundable fare until it’s confirmed.',
    'official-confirmation-required': 'Check the official source below directly — our last verification has aged past the point we’re confident relying on it.',
    'not-enough-information': 'Check official government guidance directly for your specific nationality and destination.',
  };

  const engineSignal: TravelReadySignal | null =
    verdict === 'check-passport-validity' || verdict === 'visa-or-entry-permission-needed'
      ? { severity: 'critical', label: HEADLINES[verdict], detail: NEXT_ACTIONS[verdict] }
      : verdict === 'document-timing-may-affect-booking' || verdict === 'official-confirmation-required'
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
