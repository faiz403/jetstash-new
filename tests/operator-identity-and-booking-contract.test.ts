import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteConfig } from '@/lib/site-config';

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
const footer = read('components', 'layout', 'footer.tsx');
const contact = read('app', 'contact', 'page.tsx');
const privacy = read('app', 'privacy-policy', 'page.tsx');
const affiliate = read('app', 'affiliate-disclosure', 'page.tsx');
const affiliateProse = affiliate.replace(/\s+/g, ' ');

describe('public operator statement', () => {
  it('uses the same public-safe identity as the Privacy Policy', () => {
    expect(siteConfig.operatorStatement).toBe('JetStash is operated by Faiz Ahmed, trading as JetStash.');
    expect(privacy).toMatch(/operated by Faiz Ahmed, trading as JetStash/);
  });

  it('is rendered in the footer and on /contact from the single source', () => {
    expect(footer).toContain('siteConfig.operatorStatement');
    expect(contact).toContain('siteConfig.operatorStatement');
  });

  it('never publishes the full legal name or an address in these files', () => {
    for (const src of [footer, contact, affiliate]) expect(src).not.toMatch(/Faiz Ahmed Patel/i);
  });
});

describe('affiliate disclosure states where the booking contract sits', () => {
  it('says JetStash does not sell flights, take payment or make bookings', () => {
    expect(affiliateProse).toMatch(/JetStash does not sell flights, take payment or make bookings/);
  });

  it('says the contract is with the third-party provider and names Trip.com as the current flight partner', () => {
    expect(affiliateProse).toMatch(/your contract is with that provider, not with JetStash/);
    expect(affiliateProse).toMatch(/Trip\.com is currently our flight-booking partner where a flight link is shown/);
  });

  it('does not bring ATOL, ABTA or Terms wording into this change', () => {
    expect(affiliate).not.toMatch(/ATOL|ABTA/);
  });
});
