/**
 * Official visa/entry-requirement links, one entry per country. Keyed by
 * `country` to match `Destination.country` exactly — several destinations
 * share one country (e.g. Lahore/Islamabad/Karachi are all Pakistan), so
 * this is de-duplicated at the country level rather than repeated per
 * destination.
 *
 * Every URL here was verified by fetching the live page before being added
 * (see the implementation-plan discussion) — none are guessed or recalled
 * from memory. Two link types:
 *
 *   'apply' — a genuine official online visa application portal exists.
 *   'info'  — entry is visa-free or visa-on-arrival, so there is nothing to
 *             apply for; this links to the official UK government entry-
 *             requirements page for that country instead (gov.uk/foreign-
 *             travel-advice/<country>/entry-requirements), per the rule
 *             that an information page is the correct link when no
 *             application exists.
 *
 * JetStash is an independent travel guide, not a visa service — these links
 * exist to help visitors continue their own research on an official
 * government source, nothing more. Never add a commercial visa agency,
 * sponsored service, or unofficial site here.
 *
 * Add a new country only after fetching and confirming its URL directly.
 */

export type VisaLinkType = 'apply' | 'info';

export interface VisaLink {
  /** Must exactly match Destination.country in data/destinations.ts. */
  country: string;
  href: string;
  linkType: VisaLinkType;
  buttonLabel: string;
  /** Shown as small print under the button and used in the accessible label. */
  sourceName: string;
}

export const visaLinks: VisaLink[] = [
  {
    country: 'Pakistan',
    href: 'https://visa.nadra.gov.pk/',
    linkType: 'apply',
    buttonLabel: 'Apply through the official website',
    sourceName: 'Pakistan Online Visa System, Government of Pakistan',
  },
  {
    country: 'India',
    href: 'https://indianvisaonline.gov.in/evisa/',
    linkType: 'apply',
    buttonLabel: 'Apply through the official website',
    sourceName: 'Government of India e-Visa portal',
  },
  {
    country: 'Saudi Arabia',
    href: 'https://umrah.nusuk.sa/',
    linkType: 'apply',
    buttonLabel: 'Apply through the official website',
    sourceName: 'Nusuk, Saudi Ministry of Hajj and Umrah',
  },
  {
    country: 'United Arab Emirates',
    href: 'https://www.gov.uk/foreign-travel-advice/united-arab-emirates/entry-requirements',
    linkType: 'info',
    buttonLabel: 'Check official entry requirements',
    sourceName: 'GOV.UK foreign travel advice',
  },
  {
    country: 'Qatar',
    href: 'https://www.gov.uk/foreign-travel-advice/qatar/entry-requirements',
    linkType: 'info',
    buttonLabel: 'Check official entry requirements',
    sourceName: 'GOV.UK foreign travel advice',
  },
  {
    country: 'Turkey',
    href: 'https://www.gov.uk/foreign-travel-advice/turkey/entry-requirements',
    linkType: 'info',
    buttonLabel: 'Check official entry requirements',
    sourceName: 'GOV.UK foreign travel advice',
  },
  {
    country: 'Morocco',
    href: 'https://www.gov.uk/foreign-travel-advice/morocco/entry-requirements',
    linkType: 'info',
    buttonLabel: 'Check official entry requirements',
    sourceName: 'GOV.UK foreign travel advice',
  },
  {
    country: 'Spain',
    href: 'https://www.gov.uk/foreign-travel-advice/spain/entry-requirements',
    linkType: 'info',
    buttonLabel: 'Check official entry requirements',
    sourceName: 'GOV.UK foreign travel advice',
  },
  {
    country: 'Portugal',
    href: 'https://www.gov.uk/foreign-travel-advice/portugal/entry-requirements',
    linkType: 'info',
    buttonLabel: 'Check official entry requirements',
    sourceName: 'GOV.UK foreign travel advice',
  },
  {
    country: 'Greece',
    href: 'https://www.gov.uk/foreign-travel-advice/greece/entry-requirements',
    linkType: 'info',
    buttonLabel: 'Check official entry requirements',
    sourceName: 'GOV.UK foreign travel advice',
  },
  {
    country: 'Italy',
    href: 'https://www.gov.uk/foreign-travel-advice/italy/entry-requirements',
    linkType: 'info',
    buttonLabel: 'Check official entry requirements',
    sourceName: 'GOV.UK foreign travel advice',
  },
];

const visaLinksByCountry = new Map(visaLinks.map((v) => [v.country, v]));

export function getVisaLinkForCountry(country: string): VisaLink | undefined {
  return visaLinksByCountry.get(country);
}
