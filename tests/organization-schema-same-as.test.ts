import { describe, expect, it } from 'vitest';
import { organizationSchema, webSiteSchema } from '@/components/seo/json-ld';

/**
 * Regression test for the brand-search-visibility fix (2 Sep 2026): the
 * Organization schema's `sameAs` should point only at real, actively
 * maintained profiles that genuinely identify JetStash — never a
 * placeholder, an invented profile, or an inactive account.
 */
describe('organizationSchema sameAs', () => {
  it('lists only real, verified JetStash profiles', () => {
    const schema = organizationSchema();

    expect(schema.sameAs).toEqual(['https://www.reddit.com/user/quietlayover1/']);
  });

  it('does not fabricate additional profiles', () => {
    const schema = organizationSchema();

    expect(schema.sameAs).toHaveLength(1);
  });

  it('still carries the required Organization fields alongside sameAs', () => {
    const schema = organizationSchema();

    expect(schema['@type']).toBe('Organization');
    expect(schema.name).toBeTruthy();
    expect(schema.url).toBeTruthy();
  });

  it('webSiteSchema is unaffected by the sameAs addition', () => {
    const schema = webSiteSchema();

    expect(schema).not.toHaveProperty('sameAs');
    expect(schema['@type']).toBe('WebSite');
  });
});
