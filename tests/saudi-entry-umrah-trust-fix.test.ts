import { describe, expect, it } from 'vitest';
import { Fragment, isValidElement } from 'react';
import UmrahHubPage from '@/app/umrah/page';
import { getDestinationBySlug, SAUDI_ENTRY_NOTE } from '@/data/destinations';
import { getRule } from '@/data/travel-ready-rules';
import { evaluateTravelReadiness } from '@/lib/travel-ready-check';
import { getVisaLinkForCountry } from '@/lib/visa-links';

/**
 * Saudi entry and Umrah P1 trust fix (6 September 2026). Evidence rechecked
 * immediately before implementation against GOV.UK Saudi entry requirements,
 * GOV.UK pilgrimage guidance, Saudi Arabia's official tourist eVisa portal
 * and the official Nusuk Umrah platform. The sources distinguish general
 * Saudi entry, Umrah outside Hajj and Hajj; Nusuk itself lists visa-included,
 * without-visa and optional-visa packages.
 */

function collectOwnText(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
  } else if (Array.isArray(node)) {
    node.forEach((child) => collectOwnText(child, out));
  } else if (isValidElement(node) && (typeof node.type === 'string' || node.type === Fragment)) {
    const children = (node.props as { children?: unknown } | null)?.children;
    if (children !== undefined) collectOwnText(children, out);
  }
  return out;
}

const jeddah = getDestinationBySlug('jeddah')!;
const madinah = getDestinationBySlug('madinah')!;
const saudiRule = getRule('Saudi Arabia', 'british-passport', 'visa-requirement')!;
const umrahText = collectOwnText(UmrahHubPage()).join(' ');

const travelReadyResult = (destinationSlug: 'jeddah' | 'madinah') =>
  evaluateTravelReadiness(
    {
      destinationSlug,
      isBritishPassport: true,
      exemptionDocument: 'none',
      departureDate: '2026-11-10',
      arrivalDate: '2026-11-11',
      returnDate: '2026-11-20',
      passportExpiryDate: '2028-01-01',
    },
    new Date('2026-09-06T12:00:00Z')
  );

const forbiddenUniversalClaims = /dedicated umrah visa (?:is )?(?:always|universally) required|umrah visa (?:is )?required(?:[.;]|$)|all umrah visas|must be booked through nusuk|linked to confirmed hotel and transport|authorised uk travel provider/i;

describe('Saudi destination guidance', () => {
  it('Jeddah does not claim a dedicated Umrah visa is universally required or route everyone through a package', () => {
    expect(jeddah.visaNote).toBe(SAUDI_ENTRY_NOTE);
    expect(jeddah.visaNote).not.toMatch(forbiddenUniversalClaims);
  });

  it('Madinah does not claim a dedicated Umrah visa is universally required or route everyone through a package', () => {
    expect(madinah.visaNote).toBe(SAUDI_ENTRY_NOTE);
    expect(madinah.visaNote).not.toMatch(forbiddenUniversalClaims);
  });

  it('Jeddah and Madinah share the same core Saudi entry rule and preserve the three distinct contexts', () => {
    expect(jeddah.visaNote).toBe(madinah.visaNote);
    expect(SAUDI_ENTRY_NOTE).toMatch(/purpose and length/i);
    expect(SAUDI_ENTRY_NOTE).toMatch(/Umrah outside the Hajj season/i);
    expect(SAUDI_ENTRY_NOTE).toMatch(/Hajj requires a separate Hajj visa/i);
  });
});

describe('Saudi Travel Ready rule and evaluated output', () => {
  it('keeps electronic routes conditional and says missing purpose prevents an exact category decision', () => {
    const copy = `${saudiRule.requirement} ${saudiRule.caveat}`;
    expect(copy).toMatch(/right route depends on why you are travelling/i);
    expect(copy).toMatch(/where their conditions apply/i);
    expect(copy).toMatch(/does not collect trip purpose/i);
    expect(copy).toMatch(/cannot determine your exact permission category/i);
  });

  it('distinguishes Umrah outside Hajj from Hajj and does not mandate Nusuk or package linkage', () => {
    const copy = `${saudiRule.requirement} ${saudiRule.caveat}`;
    expect(copy).toMatch(/Umrah outside the Hajj season/i);
    expect(copy).toMatch(/Hajj requires a separate Hajj visa/i);
    expect(copy).not.toMatch(forbiddenUniversalClaims);
    expect(copy).not.toMatch(/Nusuk/i);
  });

  it.each(['jeddah', 'madinah'] as const)('%s produces the bounded Saudi rule in the real evaluator', (slug) => {
    const result = travelReadyResult(slug);
    const visaCheck = result.checks.find((check) => check.id === 'visa-requirement');
    expect(result.verdict).not.toBe('not-enough-information');
    expect(visaCheck?.label).toBe('Visa or entry permission');
    expect(visaCheck?.detail).toContain(saudiRule.requirement);
    expect(visaCheck?.detail).toContain(saudiRule.caveat);
    expect(visaCheck?.detail).not.toMatch(forbiddenUniversalClaims);
    expect(visaCheck?.officialSource?.url).toBe(
      'https://www.gov.uk/foreign-travel-advice/saudi-arabia/entry-requirements'
    );
  });

  it('retains visaRequired only as the evaluator flag for a required visa or entry permission, not literal public copy', () => {
    expect(saudiRule.visaRequired).toBe(true);
    for (const slug of ['jeddah', 'madinah'] as const) {
      const visaCheck = travelReadyResult(slug).checks.find((check) => check.id === 'visa-requirement');
      expect(visaCheck?.label).toBe('Visa or entry permission');
      expect(visaCheck?.detail).toMatch(/valid Saudi entry permission is required/i);
      expect(visaCheck?.detail).not.toMatch(/^visa required/i);
    }
  });

  it('records the 6 September official recheck and six-month review date', () => {
    expect(saudiRule.lastVerifiedDate).toBe('2026-09-06');
    expect(saudiRule.reviewDueDate).toBe('2027-03-06');
  });
});

describe('Saudi destination CTA and specialist Umrah control surface', () => {
  it('uses general official entry guidance instead of presenting Nusuk as the universal application route', () => {
    const link = getVisaLinkForCountry('Saudi Arabia')!;
    expect(link.linkType).toBe('info');
    expect(link.buttonLabel).toBe('Check current entry requirements');
    expect(link.href).toBe('https://www.gov.uk/foreign-travel-advice/saudi-arabia/entry-requirements');
    expect(link.sourceName).toMatch(/GOV\.UK.*Saudi Arabia entry requirements/i);
    expect(`${link.buttonLabel} ${link.sourceName}`).not.toMatch(/Nusuk|apply through/i);
  });

  it('keeps the corrected /umrah explanation and its legitimate specialist Nusuk route intact', () => {
    expect(umrahText).toMatch(/dedicated Umrah visa is not always required/i);
    expect(umrahText).toMatch(/tourist eVisa.{0,100}available to\s+UK passport holders/i);
    expect(umrahText).toMatch(/excluding Hajj/i);
    expect(umrahText).toMatch(/separate Hajj visa/i);
    expect(umrahText).toMatch(/arranged by the operator or directly through Nusuk/i);
    expect(umrahText).toMatch(/additional registration or permit requirements/i);
  });

  it('all four surfaces agree on the core rule without flattening the specialist Umrah explanation', () => {
    const travelReadyCopy = `${saudiRule.requirement} ${saudiRule.caveat}`;
    for (const copy of [jeddah.visaNote, madinah.visaNote, travelReadyCopy, umrahText]) {
      expect(copy).not.toMatch(forbiddenUniversalClaims);
      expect(copy).toMatch(/Umrah/i);
      expect(copy).toMatch(/Hajj/i);
    }
    expect(jeddah.visaNote).toMatch(/current official requirements/i);
    expect(madinah.visaNote).toMatch(/current official requirements/i);
    expect(travelReadyCopy).toMatch(/current official requirements/i);
    expect(umrahText).toMatch(/requirements change, so always confirm directly/i);
  });
});
