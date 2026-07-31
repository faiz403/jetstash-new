import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * JetStash email integration: hello@jetstash.co.uk is the primary Microsoft
 * 365 mailbox, with contact@/support@/privacy@/partners@/media@/legal@ as
 * aliases delivering into the same inbox. This is a source-based check,
 * matching this repo's existing pattern for copy/content regressions
 * (tests/not-found-page-title.test.ts, tests/trust-cracks-july.test.ts)
 * rather than a full render.
 *
 * partners@, media@ and legal@ have no existing page or section they belong
 * in without fabricating one (no partnership-enquiry, press/media or
 * terms/legal page exists) — see the founder-facing PR report. They are not
 * asserted here because there is nowhere on the live site they should
 * currently appear.
 */

const read = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

const siteConfig = read('lib/site-config.ts');
const footer = read('components/layout/footer.tsx');
const contactPage = read('app/contact/page.tsx');
const aboutPage = read('app/about/page.tsx');
const privacyPage = read('app/privacy-policy/page.tsx');
const contactApi = read('app/api/contact/route.ts');
const quoteRequestApi = read('app/api/quote-request/route.ts');
const emailLib = read('lib/email.ts');

const PUBLIC_FILES = { siteConfig, footer, contactPage, aboutPage, privacyPage };

describe('no personal or placeholder public contact email remains', () => {
  it('does not contain the old personal Gmail address anywhere in source', () => {
    const repoWideGrepTargets = [siteConfig, footer, contactPage, aboutPage, privacyPage, contactApi, quoteRequestApi, emailLib];
    for (const src of repoWideGrepTargets) {
      expect(src).not.toMatch(/faiz24485@gmail\.com/);
    }
    expect(siteConfig).not.toMatch(/@gmail\.com/);
  });

  it('does not use a placeholder domain as a real contact address in siteConfig', () => {
    expect(siteConfig).not.toMatch(/contactEmail:\s*'[^']*@(example|test|placeholder)\.[a-z]+'/i);
  });
});

describe('siteConfig.contactEmail is the JetStash contact alias', () => {
  it("sets contactEmail to 'contact@jetstash.co.uk'", () => {
    expect(siteConfig).toMatch(/contactEmail:\s*'contact@jetstash\.co\.uk'/);
  });
});

describe('footer uses hello@jetstash.co.uk as the one general contact address', () => {
  it('has a working mailto link to hello@jetstash.co.uk', () => {
    expect(footer).toMatch(/href="mailto:hello@jetstash\.co\.uk"/);
  });

  it('does not list every alias as a directory — only the one general address appears', () => {
    const aliasCount = ['contact@', 'support@', 'privacy@', 'partners@', 'media@', 'legal@'].filter((a) =>
      footer.includes(a)
    ).length;
    expect(aliasCount).toBe(0);
  });
});

describe('contact page offers a direct contact@jetstash.co.uk mailto link', () => {
  it('has a working mailto link to contact@jetstash.co.uk', () => {
    expect(contactPage).toMatch(/href="mailto:contact@jetstash\.co\.uk"/);
  });
});

describe('about page references support@jetstash.co.uk for problem reports', () => {
  it('has a working mailto link to support@jetstash.co.uk', () => {
    expect(aboutPage).toMatch(/href="mailto:support@jetstash\.co\.uk"/);
  });
});

describe('privacy policy offers privacy@jetstash.co.uk for data requests', () => {
  it('has a working mailto link to privacy@jetstash.co.uk', () => {
    expect(privacyPage).toMatch(/href="mailto:privacy@jetstash\.co\.uk"/);
  });
});

describe('every visible JetStash email address is a real mailto link, not plain text', () => {
  it('every jetstash.co.uk address that appears is immediately preceded by mailto: in the same href', () => {
    for (const [name, src] of Object.entries(PUBLIC_FILES)) {
      const bareAddressMatches = src.match(/>[^<]*[a-z]+@jetstash\.co\.uk[^<]*</g) ?? [];
      for (const snippet of bareAddressMatches) {
        // The visible text node itself is fine (that's the link label) — what
        // matters is that somewhere nearby in the same file there's a matching
        // mailto href for that exact address.
        const address = snippet.match(/([a-z]+@jetstash\.co\.uk)/)?.[1];
        expect(src, `${name} shows ${address} without a matching mailto: href`).toContain(`mailto:${address}`);
      }
    }
  });
});

describe('no jetstash.co.uk address is duplicated unnecessarily within a single file', () => {
  // The privacy notice is a genuine exception: it's a long, multi-section
  // reference document (operator identity, retention, rights, complaints,
  // children), and repeating privacy@ in each section that names it is
  // deliberate for scannability, not accidental duplication — see
  // tests/privacy-notice-completion.test.ts for that page's own checks.
  const SKIP_STRICT_DEDUPE = new Set(['privacyPage']);

  it('each address appears as a mailto href at most once per file (outside the privacy notice)', () => {
    for (const [name, src] of Object.entries(PUBLIC_FILES)) {
      if (SKIP_STRICT_DEDUPE.has(name)) continue;
      const hrefs = src.match(/mailto:[a-z]+@jetstash\.co\.uk/g) ?? [];
      const counts = new Map<string, number>();
      for (const href of hrefs) counts.set(href, (counts.get(href) ?? 0) + 1);
      for (const [href, count] of counts) {
        expect(count, `${name} repeats ${href} ${count} times`).toBe(1);
      }
    }
  });
});

describe('form routing and provider behaviour are unchanged by this PR', () => {
  it('contact form still falls back to CONTACT_TO_EMAIL then siteConfig.contactEmail', () => {
    expect(contactApi).toMatch(/process\.env\.CONTACT_TO_EMAIL\s*\?\?\s*siteConfig\.contactEmail/);
  });

  it('quote request form still falls back to CONTACT_TO_EMAIL then siteConfig.contactEmail', () => {
    expect(quoteRequestApi).toMatch(/process\.env\.CONTACT_TO_EMAIL\s*\?\?\s*siteConfig\.contactEmail/);
  });

  it('Resend transactional sender is untouched (forms@jetstash.co.uk, not the new mailbox)', () => {
    expect(emailLib).toMatch(/from:\s*'JetStash <forms@jetstash\.co\.uk>'/);
  });
});
