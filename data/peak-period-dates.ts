/**
 * Dated occurrences of the demand periods in data/peak-periods.ts — the
 * calendar half of the Book-By Countdown feature (see JETSTASH_PRINCIPLES.md
 * §14). peak-periods.ts deliberately only says "date shifts yearly"; this
 * file holds the actual verified dates per year, so countdown/booking-window
 * maths never guesses.
 *
 * Content rules, same standard as route claims (README "Verified route and
 * airport claims"):
 *  - Every entry was checked against a real source before being added — the
 *    sourceNote says which. Never add a date from memory.
 *  - Islamic dates (Eid, Ramadan) are ASTRONOMICAL ESTIMATES: the real date
 *    is confirmed by moon sighting only days beforehand and can shift by a
 *    day or two. Those entries carry precision 'estimated-lunar' and every
 *    surface rendering them must keep the uncertainty visible.
 *  - Seasonal ranges (school holidays, wedding season) are approximations of
 *    a period, not events — precision 'approximate-seasonal'. UK term dates
 *    vary by school and local authority.
 *  - Pre-Hajj is derived (the weeks before Eid al-Adha, which falls on
 *    10 Dhu al-Hijjah, i.e. during Hajj) rather than separately sourced —
 *    its dateNote says so.
 *
 * Add next year's occurrences before the current ones run out — the Founder
 * dashboard's Book-By cadence section flags routes whose periods have no
 * upcoming dated occurrence.
 */

export type PeakDatePrecision = 'confirmed' | 'estimated-lunar' | 'approximate-seasonal';

export interface PeakPeriodOccurrence {
  id: string;
  /** References data/peak-periods.ts */
  peakPeriodId: string;
  /** ISO date the period begins (for one-day festivals, the day itself). */
  startDate: string;
  /** ISO date the period ends — omitted for one-day festivals. */
  endDate?: string;
  precision: PeakDatePrecision;
  /** Plain-language uncertainty note, shown wherever the date is rendered. */
  dateNote: string;
  /** Where this date was verified — for maintainers, not rendered. */
  sourceNote: string;
}

const LUNAR_NOTE =
  'Expected date from astronomical calculation — the final date depends on moon sighting and can shift by a day or two.';
const SEASONAL_NOTE = 'Approximate — exact dates vary.';

export const peakPeriodOccurrences: PeakPeriodOccurrence[] = [
  // ── Diwali (Lakshmi Puja day) ─────────────────────────────────────────
  {
    id: 'diwali-2026',
    peakPeriodId: 'diwali',
    startDate: '2026-11-08',
    precision: 'confirmed',
    dateNote: 'Lakshmi Puja falls on 8 November 2026; the five-day festival runs 6–10 November.',
    sourceNote: 'Verified July 2026 via drikpanchang.com and diwali.info (Kartika Amavasya).',
  },
  {
    id: 'diwali-2027',
    peakPeriodId: 'diwali',
    startDate: '2027-10-29',
    precision: 'confirmed',
    dateNote: 'Lakshmi Puja falls on 29 October 2027.',
    sourceNote: 'Verified July 2026 via drikpanchang.com and diwali.info.',
  },
  {
    id: 'diwali-2028',
    peakPeriodId: 'diwali',
    startDate: '2028-10-17',
    precision: 'confirmed',
    dateNote: 'Lakshmi Puja falls on 17 October 2028.',
    sourceNote: 'Verified July 2026 via diwali.info (festival runs 15–19 October 2028).',
  },

  // ── Ramadan (start–end; Umrah demand rises into and through the month) ─
  {
    id: 'ramadan-2027',
    peakPeriodId: 'ramadan',
    startDate: '2027-02-08',
    endDate: '2027-03-09',
    precision: 'estimated-lunar',
    dateNote: LUNAR_NOTE,
    sourceNote: 'Verified July 2026 via moonsighting.com / Fiqh Council calendar (1 Ramadan 1448 expected 8 Feb 2027).',
  },
  {
    id: 'ramadan-2028',
    peakPeriodId: 'ramadan',
    startDate: '2028-01-28',
    endDate: '2028-02-27',
    precision: 'estimated-lunar',
    dateNote: LUNAR_NOTE,
    sourceNote: 'Verified July 2026 via al-habib.info global Hijri calendar (1 Ramadan 1449 expected 28 Jan 2028).',
  },

  // ── Eid al-Fitr ────────────────────────────────────────────────────────
  {
    id: 'eid-al-fitr-2027',
    peakPeriodId: 'eid-al-fitr',
    startDate: '2027-03-10',
    precision: 'estimated-lunar',
    dateNote: LUNAR_NOTE,
    sourceNote: 'Verified July 2026 via moonsighting.com / Fiqh Council calendar (1 Shawwal 1448 expected 10 Mar 2027).',
  },
  {
    id: 'eid-al-fitr-2028',
    peakPeriodId: 'eid-al-fitr',
    startDate: '2028-02-28',
    precision: 'estimated-lunar',
    dateNote: LUNAR_NOTE,
    sourceNote: 'Verified July 2026 via al-habib.info global Hijri calendar (1 Shawwal 1449 expected 28 Feb 2028).',
  },

  // ── Eid al-Adha ────────────────────────────────────────────────────────
  {
    id: 'eid-al-adha-2027',
    peakPeriodId: 'eid-al-adha',
    startDate: '2027-05-16',
    precision: 'estimated-lunar',
    dateNote: LUNAR_NOTE,
    sourceNote: 'Verified July 2026 via when-is.com / Hijri calendars (10 Dhu al-Hijjah 1448 expected 16 May 2027).',
  },
  {
    id: 'eid-al-adha-2028',
    peakPeriodId: 'eid-al-adha',
    startDate: '2028-05-05',
    precision: 'estimated-lunar',
    dateNote: LUNAR_NOTE,
    sourceNote: 'Verified July 2026 via al-habib.info global Hijri calendar (10 Dhu al-Hijjah 1449 expected 5 May 2028).',
  },

  // ── Pre-Hajj (derived: the ~4 weeks before Eid al-Adha / Hajj) ─────────
  {
    id: 'pre-hajj-2027',
    peakPeriodId: 'pre-hajj',
    startDate: '2027-04-18',
    endDate: '2027-05-16',
    precision: 'estimated-lunar',
    dateNote: `Derived from the expected Eid al-Adha date (Hajj falls in the same week). ${LUNAR_NOTE}`,
    sourceNote: 'Derived: 4 weeks before eid-al-adha-2027 above; not separately sourced.',
  },
  {
    id: 'pre-hajj-2028',
    peakPeriodId: 'pre-hajj',
    startDate: '2028-04-07',
    endDate: '2028-05-05',
    precision: 'estimated-lunar',
    dateNote: `Derived from the expected Eid al-Adha date (Hajj falls in the same week). ${LUNAR_NOTE}`,
    sourceNote: 'Derived: 4 weeks before eid-al-adha-2028 above; not separately sourced.',
  },

  // ── Vaisakhi (solar — fixed to 13/14 April) ───────────────────────────
  {
    id: 'baisakhi-2027',
    peakPeriodId: 'baisakhi',
    startDate: '2027-04-14',
    precision: 'confirmed',
    dateNote: 'Vaisakhi 2027 falls on 14 April.',
    sourceNote: 'Verified July 2026 via drikpanchang.com (solar calendar festival, 13/14 April each year).',
  },
  {
    id: 'baisakhi-2028',
    peakPeriodId: 'baisakhi',
    startDate: '2028-04-13',
    precision: 'confirmed',
    dateNote: 'Vaisakhi 2028 falls on 13 April.',
    sourceNote: 'Verified July 2026 via publicholidays.in / drikpanchang.com.',
  },

  // ── UK school summer holidays (approximate; varies by local authority) ─
  {
    id: 'uk-summer-2026',
    peakPeriodId: 'uk-summer-holidays',
    startDate: '2026-07-20',
    endDate: '2026-09-01',
    precision: 'approximate-seasonal',
    dateNote: `${SEASONAL_NOTE} English state-school term dates are set by each local authority; most break up in the third week of July.`,
    sourceNote: 'Approximate range; term dates are set per local authority (gov.uk school term dates).',
  },
  {
    id: 'uk-summer-2027',
    peakPeriodId: 'uk-summer-holidays',
    startDate: '2027-07-19',
    endDate: '2027-09-01',
    precision: 'approximate-seasonal',
    dateNote: `${SEASONAL_NOTE} English state-school term dates are set by each local authority; most break up in the third week of July.`,
    sourceNote: 'Approximate range; term dates are set per local authority (gov.uk school term dates).',
  },
  {
    id: 'uk-summer-2028',
    peakPeriodId: 'uk-summer-holidays',
    startDate: '2028-07-24',
    endDate: '2028-09-01',
    precision: 'approximate-seasonal',
    dateNote: `${SEASONAL_NOTE} English state-school term dates are set by each local authority; most break up in the third week of July.`,
    sourceNote: 'Approximate range; term dates are set per local authority (gov.uk school term dates).',
  },

  // ── Christmas–New Year school break (approximate) ─────────────────────
  {
    id: 'christmas-2026',
    peakPeriodId: 'christmas-new-year',
    startDate: '2026-12-19',
    endDate: '2027-01-04',
    precision: 'approximate-seasonal',
    dateNote: `${SEASONAL_NOTE} UK school Christmas breaks vary by a few days either side.`,
    sourceNote: 'Approximate range around the fixed Christmas/New Year dates.',
  },
  {
    id: 'christmas-2027',
    peakPeriodId: 'christmas-new-year',
    startDate: '2027-12-18',
    endDate: '2028-01-04',
    precision: 'approximate-seasonal',
    dateNote: `${SEASONAL_NOTE} UK school Christmas breaks vary by a few days either side.`,
    sourceNote: 'Approximate range around the fixed Christmas/New Year dates.',
  },

  // ── South Asian wedding season (approximate seasonal range) ────────────
  {
    id: 'wedding-season-2026-27',
    peakPeriodId: 'wedding-season',
    startDate: '2026-11-01',
    endDate: '2027-02-28',
    precision: 'approximate-seasonal',
    dateNote: `${SEASONAL_NOTE} A season, not an event — peak months per data/peak-periods.ts (Nov–Feb).`,
    sourceNote: 'Seasonal range matching peak-periods.ts typicalMonths (Nov–Feb).',
  },
  {
    id: 'wedding-season-2027-28',
    peakPeriodId: 'wedding-season',
    startDate: '2027-11-01',
    endDate: '2028-02-29',
    precision: 'approximate-seasonal',
    dateNote: `${SEASONAL_NOTE} A season, not an event — peak months per data/peak-periods.ts (Nov–Feb).`,
    sourceNote: 'Seasonal range matching peak-periods.ts typicalMonths (Nov–Feb).',
  },
];

/**
 * Occurrences for the given periods whose anchor (startDate) is still ahead
 * of `nowIso`, soonest first. An occurrence whose start has passed but whose
 * end hasn't is included too — it's a period we're currently inside.
 */
export function getUpcomingOccurrences(peakPeriodIds: string[], nowIso: string): PeakPeriodOccurrence[] {
  return peakPeriodOccurrences
    .filter((o) => peakPeriodIds.includes(o.peakPeriodId))
    .filter((o) => (o.endDate ?? o.startDate) >= nowIso)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
