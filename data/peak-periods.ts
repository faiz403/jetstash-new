export type PeakPeriodCategory = 'religious' | 'festival' | 'uk-school-holiday' | 'wedding-season';

export interface PeakPeriod {
  id: string;
  label: string;
  category: PeakPeriodCategory;
  typicalMonths: string;
  description: string;
}

/**
 * Canonical list of demand periods referenced by slug from data/routes.ts
 * (Route.peakPeriodIds) and data/destinations.ts (FamilyVisitContent.peakPeriodIds)
 * instead of retyping free-text labels per route/destination. Add new periods
 * here rather than inlining a new string elsewhere — that duplication is what
 * this file replaces.
 */
export const peakPeriods: PeakPeriod[] = [
  {
    id: 'eid-al-fitr',
    label: 'Eid al-Fitr',
    category: 'religious',
    typicalMonths: 'Date shifts yearly (Islamic calendar)',
    description: 'The single sharpest demand spike on Pakistan and wider South Asia routes. Fares rise fastest within 3 to 4 weeks of the date.',
  },
  {
    id: 'eid-al-adha',
    label: 'Eid al-Adha',
    category: 'religious',
    typicalMonths: 'Date shifts yearly (Islamic calendar)',
    description: 'A second major Pakistan/South Asia demand spike each year, alongside Eid al-Fitr.',
  },
  {
    id: 'ramadan',
    label: 'Ramadan',
    category: 'religious',
    typicalMonths: 'Date shifts yearly (Islamic calendar)',
    description: 'Drives Umrah demand hard on Jeddah and Madinah routes specifically, with pricing rising sharply in the weeks around it.',
  },
  {
    id: 'pre-hajj',
    label: 'Pre-Hajj season',
    category: 'religious',
    typicalMonths: 'Weeks before Hajj (Islamic calendar, shifts yearly)',
    description: 'The weeks immediately preceding Hajj carry the sharpest price increases on any Jeddah/Madinah route.',
  },
  {
    id: 'diwali',
    label: 'Diwali',
    category: 'festival',
    typicalMonths: 'Oct–Nov',
    description: 'The single sharpest demand spike on India routes.',
  },
  {
    id: 'navratri',
    label: 'Navratri',
    category: 'festival',
    typicalMonths: 'Sep–Oct',
    description: 'A major nine-night festival specific to Gujarati and wider Hindu communities, driving demand on Ahmedabad services particularly hard.',
  },
  {
    id: 'baisakhi',
    label: 'Baisakhi',
    category: 'festival',
    typicalMonths: 'April',
    description: 'The Sikh harvest festival, and the clearest annual demand spike on Amritsar routes alongside Diwali.',
  },
  {
    id: 'wedding-season',
    label: 'Wedding season',
    category: 'wedding-season',
    typicalMonths: 'Nov–Feb',
    description: 'The South Asian wedding season, bringing extended family travel and higher-than-usual baggage and booking volume across Pakistan and India routes.',
  },
  {
    id: 'uk-summer-holidays',
    label: 'UK summer holidays',
    category: 'uk-school-holiday',
    typicalMonths: 'Jul–Aug',
    description: 'UK school summer break, and the most consistent demand spike across every region this site covers, not just South Asia.',
  },
  {
    id: 'christmas-new-year',
    label: 'Christmas–New Year',
    category: 'uk-school-holiday',
    typicalMonths: 'Late Dec–early Jan',
    description: 'UK Christmas and New Year school holidays, driving both outbound Gulf leisure travel and India/Pakistan family-visit travel timed around the break.',
  },
  {
    id: 'february-half-term',
    label: 'February half-term',
    category: 'uk-school-holiday',
    typicalMonths: 'Mid-February',
    description: 'UK February half-term, a shorter but real premium window, especially on Gulf routes.',
  },
  {
    id: 'easter-holidays',
    label: 'Easter holidays',
    category: 'uk-school-holiday',
    typicalMonths: 'Late March–April',
    description: 'UK Easter school holidays, a further UK-holiday demand spike alongside summer and Christmas.',
  },
  {
    id: 'school-half-terms-umrah',
    label: 'School half-terms (family Umrah trips)',
    category: 'uk-school-holiday',
    typicalMonths: 'Varies by term dates',
    description: 'UK school half-terms specifically as they affect family Umrah trip timing, distinct from the Ramadan/pre-Hajj religious calendar spikes.',
  },
];

const peakPeriodsById = new Map(peakPeriods.map((p) => [p.id, p]));

export function getPeakPeriodById(id: string) {
  return peakPeriodsById.get(id);
}

export function getPeakPeriodsByIds(ids: string[]) {
  return ids.map((id) => getPeakPeriodById(id)).filter((p): p is PeakPeriod => Boolean(p));
}
