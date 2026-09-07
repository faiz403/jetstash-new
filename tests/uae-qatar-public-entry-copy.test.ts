import { describe, expect, it } from 'vitest';
import GulfHubPage from '@/app/gulf/page';
import { destinations, getDestinationBySlug } from '@/data/destinations';
import { getRouteBySlug } from '@/data/routes';
import { getRule } from '@/data/travel-ready-rules';

/**
 * UAE + Qatar public-entry P1 trust fix (7 September 2026).
 *
 * The old Dubai destination note and /gulf page flattened the UAE into a
 * 30-day rule. Current GOV.UK guidance for a full British Citizen passport
 * instead gives the UAE a 90-day allowance within a 180-day period, usable
 * continuously or across multiple visits. Qatar remains a separate,
 * tourism-only 30-day initial arrangement with an extension boundary.
 */

const dubai = getDestinationBySlug('dubai')!;
const doha = getDestinationBySlug('doha')!;
const uaeRule = getRule('United Arab Emirates', 'british-passport', 'visa-requirement')!;
const qatarRule = getRule('Qatar', 'british-passport', 'visa-requirement')!;
const gulfEntryCopy = (GulfHubPage().props as { visaNote: string }).visaNote;

describe('Dubai public entry guidance', () => {
  it('replaces the stale 30-day UAE claim with the correctly scoped 90-in-180 rule', () => {
    expect(dubai.visaNote).toMatch(/full British Citizen passport/i);
    expect(dubai.visaNote).toMatch(/free on arrival/i);
    expect(dubai.visaNote).toMatch(/90 days within a 180-day period/i);
    expect(dubai.visaNote).toMatch(/continuous or split across multiple visits/i);
    expect(dubai.visaNote).not.toMatch(/stays up to 30 days/i);
  });
});

describe('Doha public entry guidance', () => {
  it('retains Qatar\'s accurate initial limit while scoping it to tourism and the verified passport category', () => {
    expect(doha.visaNote).toMatch(/For tourism/i);
    expect(doha.visaNote).toMatch(/full British Citizen passport/i);
    expect(doha.visaNote).toMatch(/free.*on arrival/i);
    expect(doha.visaNote).toMatch(/30 days initially/i);
    expect(doha.visaNote).toMatch(/extension before expiry/i);
  });
});

describe('/gulf public entry guidance', () => {
  it('states distinct UAE and Qatar rules rather than a shared 30-day allowance', () => {
    expect(gulfEntryCopy).toMatch(/UAE:/);
    expect(gulfEntryCopy).toMatch(/90 days within a 180-day period/i);
    expect(gulfEntryCopy).toMatch(/continuous or split across multiple visits/i);
    expect(gulfEntryCopy).toMatch(/Qatar:/);
    expect(gulfEntryCopy).toMatch(/30 days initially/i);
    expect(gulfEntryCopy).toMatch(/extension through Qatar's Ministry of Interior before expiry/i);
    expect(gulfEntryCopy).not.toMatch(/both the UAE and Qatar, typically valid for 30 days/i);
  });
});

describe('Canonical Travel Ready and LGW-to-DOH data remain aligned', () => {
  it('leaves the verified UAE and Qatar Travel Ready rules untouched', () => {
    expect(uaeRule.requirement).toBe(
      'A visitor visa is issued free of charge on arrival for up to 90 days within a 180-day period — no advance application is needed.'
    );
    expect(uaeRule.stayLimit).toEqual({ maxDays: 90, windowDays: 180 });
    expect(qatarRule.requirement).toBe(
      'A tourist visa is issued on arrival, free, for up to 30 days, for full British Citizen passport holders travelling for tourism.'
    );
    expect(qatarRule.stayLimit).toEqual({ maxDays: 30 });
  });

  it('preserves Claude\'s verified direct London Gatwick-to-Doha route and Doha airport coverage', () => {
    const lgwDoha = getRouteBySlug('london-gatwick-doha')!;
    expect(lgwDoha.isDirect).toBe(true);
    expect(lgwDoha.verification?.status).toBe('verified');
    expect(lgwDoha.airlineSlugs).toEqual(['qatar-airways']);
    expect(doha.ukAirports).toContain('london-gatwick');
  });

  it('does not spread the corrected UAE or Qatar wording to unrelated destination notes', () => {
    const specificallyScoped = destinations
      .filter((destination) => destination.visaNote.includes('full British Citizen passport'))
      .map((destination) => destination.slug);
    expect(specificallyScoped).toEqual(['dubai', 'doha']);
  });
});
