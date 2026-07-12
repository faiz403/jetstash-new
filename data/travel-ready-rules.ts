/**
 * Travel Ready Check's rules layer — the single source of truth for every
 * passport/visa fact used by `lib/travel-ready-check.ts` (JETSTASH_PRINCIPLES.md
 * §14.3). No visa or passport logic exists anywhere else in the codebase;
 * `lib/visa-links.ts` remains the plain "here's an official link" pointer
 * used by destination pages, and this file is the machine-readable rules
 * table the decision tree actually evaluates.
 *
 * V1 covers 7 countries and 3 nationality scopes only — British passport
 * holders everywhere, plus NICOP/POC (Pakistan) and OCI (India) document
 * holders where the exemption is officially documented. Every other
 * nationality/destination combination has no rules here, which is what
 * drives `evaluateTravelReadiness()`'s honest `not-enough-information`
 * verdict — there is deliberately no separate "unsupported" list to
 * maintain in two places.
 *
 * Every entry was checked against a live official source on the date below
 * (GOV.UK foreign travel advice, or the destination's own official visa
 * portal) — never a blog, forum, or travel agency page. Where an official
 * source doesn't publish a firm processing-time figure, `typicalProcessingDays`
 * is left unset rather than guessed; the `caveat` says so explicitly. This
 * is the same discipline `data/routes.ts`/`data/peak-period-dates.ts`
 * already apply to schedule and festival-date claims (CLAUDE.md, §9.3).
 *
 * `reviewDueDate` is 6 months after `lastVerifiedDate` for every rule here —
 * visa/passport rules change with little notice (Pakistan suspended its
 * visa-on-arrival programme for most nationalities on 1 January 2026, with
 * no advance public consultation). Once `reviewDueDate` passes,
 * `isRuleStale()` returns true and the UI must show "official confirmation
 * required" for that check rather than silently continuing to present it
 * as current — never edit `lastVerifiedDate` without re-checking the live
 * source first.
 */

export type TravelReadyRuleType = 'passport-validity' | 'visa-requirement' | 'document-exemption';
export type TravelReadyNationalityScope = 'british-passport' | 'nicop-poc-holder' | 'oci-holder';

export interface TravelReadyOfficialSource {
  title: string;
  url: string;
}

export interface TravelReadyRule {
  id: string;
  /** Matches Destination.country in data/destinations.ts and VisaLink.country in lib/visa-links.ts. */
  country: string;
  nationalityScope: TravelReadyNationalityScope;
  ruleType: TravelReadyRuleType;
  /** Plain-English explanation, rendered verbatim in the supporting-checks list. */
  requirement: string;
  /** Machine-readable condition for passport-validity rules — days of validity required beyond the arrival date. */
  minDaysValidityBeyondEntry?: number;
  /** Machine-readable condition for visa-requirement rules. */
  visaRequired?: boolean;
  /**
   * Only set where an official source states a firm figure (e.g. India's
   * e-Visa portal: "apply online minimum 4 days in advance"). Left unset —
   * never guessed — where no official source publishes one; see `caveat`.
   */
  typicalProcessingDays?: number;
  /** Uncertainty or scope note, always shown alongside the requirement. */
  caveat?: string;
  officialSource: TravelReadyOfficialSource;
  lastVerifiedDate: string;
  reviewDueDate: string;
}

const VERIFIED = '2026-07-12';
const REVIEW_DUE = '2027-01-12';

const GOVUK = (country: string, slug: string): TravelReadyOfficialSource => ({
  title: `GOV.UK foreign travel advice — ${country} entry requirements`,
  url: `https://www.gov.uk/foreign-travel-advice/${slug}/entry-requirements`,
});

const NADRA_POVS: TravelReadyOfficialSource = {
  title: 'Pakistan Online Visa System, Government of Pakistan',
  url: 'https://visa.nadra.gov.pk/',
};

const INDIA_EVISA: TravelReadyOfficialSource = {
  title: 'Government of India e-Visa portal',
  url: 'https://indianvisaonline.gov.in/evisa/',
};

const NUSUK: TravelReadyOfficialSource = {
  title: 'Nusuk, Saudi Ministry of Hajj and Umrah',
  url: 'https://umrah.nusuk.sa/',
};

export const travelReadyRules: TravelReadyRule[] = [
  // ── Pakistan ────────────────────────────────────────────────────────────
  {
    id: 'pk-passport-validity-british',
    country: 'Pakistan',
    nationalityScope: 'british-passport',
    ruleType: 'passport-validity',
    requirement: 'Your passport must have an expiry date at least 6 months after the date of your visa application.',
    minDaysValidityBeyondEntry: 182,
    officialSource: GOVUK('Pakistan', 'pakistan'),
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },
  {
    id: 'pk-visa-requirement-british',
    country: 'Pakistan',
    nationalityScope: 'british-passport',
    ruleType: 'visa-requirement',
    requirement: 'A visa is required and must be arranged in advance through the Pakistan Online Visa System — there is no visa-on-arrival for British passport holders.',
    visaRequired: true,
    caveat: 'NADRA does not publish a guaranteed processing time. Apply as early as you can and avoid a non-refundable fare until the visa is actually issued.',
    officialSource: NADRA_POVS,
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },
  {
    id: 'pk-nicop-poc-exemption',
    country: 'Pakistan',
    nationalityScope: 'nicop-poc-holder',
    ruleType: 'document-exemption',
    requirement: 'NICOP (National Identity Card for Overseas Pakistanis) and SNICOP holders are recognised as Pakistani citizens and can enter without a visa, for an unlimited stay.',
    visaRequired: false,
    caveat: 'This exemption applies to NICOP/SNICOP holders specifically, travelling alongside their British passport. Bring both documents.',
    officialSource: GOVUK('Pakistan', 'pakistan'),
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },

  // ── India ───────────────────────────────────────────────────────────────
  {
    id: 'in-passport-validity-british',
    country: 'India',
    nationalityScope: 'british-passport',
    ruleType: 'passport-validity',
    requirement: 'Your passport must have an expiry date at least 6 months after your arrival date, with at least 2 blank pages.',
    minDaysValidityBeyondEntry: 182,
    caveat: 'The 2-blank-page requirement can’t be checked by this tool — confirm it yourself before travelling.',
    officialSource: GOVUK('India', 'india'),
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },
  {
    id: 'in-visa-requirement-british',
    country: 'India',
    nationalityScope: 'british-passport',
    ruleType: 'visa-requirement',
    requirement: 'A visa is required unless you hold a valid OCI card. An e-Visa is available for British passport holders.',
    visaRequired: true,
    typicalProcessingDays: 4,
    caveat: 'The Indian e-Visa portal states a minimum of 4 days’ notice before arrival — treat this as the absolute floor, not a comfortable margin. Applicants of Pakistani origin should expect substantially longer processing, per GOV.UK.',
    officialSource: INDIA_EVISA,
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },
  {
    id: 'in-oci-exemption',
    country: 'India',
    nationalityScope: 'oci-holder',
    ruleType: 'document-exemption',
    requirement: 'A valid Overseas Citizen of India (OCI) card, used together with your valid British passport, means you do not need a visa.',
    visaRequired: false,
    officialSource: GOVUK('India', 'india'),
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },

  // ── Saudi Arabia ────────────────────────────────────────────────────────
  {
    id: 'sa-passport-validity-british',
    country: 'Saudi Arabia',
    nationalityScope: 'british-passport',
    ruleType: 'passport-validity',
    requirement: 'Your passport must have an expiry date at least 6 months after the date you arrive.',
    minDaysValidityBeyondEntry: 182,
    officialSource: GOVUK('Saudi Arabia', 'saudi-arabia'),
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },
  {
    id: 'sa-visa-requirement-british',
    country: 'Saudi Arabia',
    nationalityScope: 'british-passport',
    ruleType: 'visa-requirement',
    requirement: 'Tourist e-visas and Electronic Travel Authorisations are available and can often be issued quickly, sometimes on arrival. Umrah visas must be booked through Nusuk and linked to confirmed hotel and transport bookings, with seasonal cut-off dates.',
    visaRequired: true,
    caveat: 'Neither GOV.UK nor Nusuk publish a guaranteed processing time. For Umrah travel specifically, check Nusuk directly for the current season’s visa cut-off date before booking flights.',
    officialSource: NUSUK,
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },

  // ── United Arab Emirates ────────────────────────────────────────────────
  {
    id: 'ae-passport-validity-british',
    country: 'United Arab Emirates',
    nationalityScope: 'british-passport',
    ruleType: 'passport-validity',
    requirement: 'Your passport must have an expiry date at least 6 months after the date you arrive (3 months if you hold a UAE residence permit).',
    minDaysValidityBeyondEntry: 182,
    caveat: 'The shorter 3-month rule only applies if you already hold a UAE residence permit.',
    officialSource: GOVUK('United Arab Emirates', 'united-arab-emirates'),
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },
  {
    id: 'ae-visa-requirement-british',
    country: 'United Arab Emirates',
    nationalityScope: 'british-passport',
    ruleType: 'visa-requirement',
    requirement: 'A visitor visa is issued free of charge on arrival for up to 90 days within a 180-day period — no advance application is needed.',
    visaRequired: true,
    typicalProcessingDays: 0,
    officialSource: GOVUK('United Arab Emirates', 'united-arab-emirates'),
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },

  // ── Qatar ───────────────────────────────────────────────────────────────
  {
    id: 'qa-passport-validity-british',
    country: 'Qatar',
    nationalityScope: 'british-passport',
    ruleType: 'passport-validity',
    requirement: 'Your passport should be valid for at least 6 months from the date you arrive.',
    minDaysValidityBeyondEntry: 182,
    officialSource: GOVUK('Qatar', 'qatar'),
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },
  {
    id: 'qa-visa-requirement-british',
    country: 'Qatar',
    nationalityScope: 'british-passport',
    ruleType: 'visa-requirement',
    requirement: 'A tourist visa is issued on arrival, free, for up to 30 days, for full British Citizen passport holders travelling for tourism.',
    visaRequired: true,
    typicalProcessingDays: 0,
    caveat: 'This on-arrival visa only covers tourism — travelling for any other purpose requires a visa arranged in advance.',
    officialSource: GOVUK('Qatar', 'qatar'),
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },

  // ── Turkey ──────────────────────────────────────────────────────────────
  {
    id: 'tr-passport-validity-british',
    country: 'Turkey',
    nationalityScope: 'british-passport',
    ruleType: 'passport-validity',
    requirement: 'Your passport must have an expiry date at least 150 days after the date you arrive, and at least 1 blank page.',
    minDaysValidityBeyondEntry: 150,
    caveat: 'The blank-page requirement can’t be checked by this tool — confirm it yourself before travelling.',
    officialSource: GOVUK('Turkey', 'turkey'),
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },
  {
    id: 'tr-visa-requirement-british',
    country: 'Turkey',
    nationalityScope: 'british-passport',
    ruleType: 'visa-requirement',
    requirement: 'No visa is needed for business or tourism stays of up to 90 days in any 180-day period.',
    visaRequired: false,
    officialSource: GOVUK('Turkey', 'turkey'),
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },

  // ── Morocco ─────────────────────────────────────────────────────────────
  {
    id: 'ma-passport-validity-british',
    country: 'Morocco',
    nationalityScope: 'british-passport',
    ruleType: 'passport-validity',
    requirement: 'Your passport must have an expiry date at least 3 months after the date you arrive.',
    minDaysValidityBeyondEntry: 91,
    officialSource: GOVUK('Morocco', 'morocco'),
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },
  {
    id: 'ma-visa-requirement-british',
    country: 'Morocco',
    nationalityScope: 'british-passport',
    ruleType: 'visa-requirement',
    requirement: 'No visa is needed for tourism stays of up to 90 days.',
    visaRequired: false,
    officialSource: GOVUK('Morocco', 'morocco'),
    lastVerifiedDate: VERIFIED,
    reviewDueDate: REVIEW_DUE,
  },
];

export function getRulesForCountry(country: string): TravelReadyRule[] {
  return travelReadyRules.filter((r) => r.country === country);
}

export function getRule(
  country: string,
  nationalityScope: TravelReadyNationalityScope,
  ruleType: TravelReadyRuleType
): TravelReadyRule | undefined {
  return travelReadyRules.find(
    (r) => r.country === country && r.nationalityScope === nationalityScope && r.ruleType === ruleType
  );
}

export function isRuleStale(rule: TravelReadyRule, nowIso: string): boolean {
  return nowIso > rule.reviewDueDate;
}
