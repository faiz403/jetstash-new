import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Privacy notice completion (31 July 2026): source-based checks against the
 * founder-approved public identity ("Faiz Ahmed, trading as JetStash", never
 * the full legal name) and the real data flows audited for the PR. Matches
 * this repo's existing pattern for copy/content regressions
 * (tests/not-found-page-title.test.ts, tests/jetstash-email-addresses.test.ts)
 * rather than a full render.
 */

const read = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

const privacyPage = read('app/privacy-policy/page.tsx');
// JSX source encodes apostrophes as &apos; — normalise for prose assertions
// (structural checks like href/className still use the raw source above).
const privacyProse = privacyPage
  .replace(/&apos;/g, "'")
  .replace(/&rsquo;/g, "'")
  .replace(/&lsquo;/g, "'")
  .replace(/\s+/g, ' '); // JSX text wraps across source lines — collapse for phrase matching

// A broad sweep of every public-facing page/component source, so "does the
// forbidden full legal name appear anywhere publicly" isn't scoped only to
// the privacy page itself.
const publicSourceGlobRoots = ['app', 'components', 'lib', 'data'];
function readAllSourceFiles(): { path: string; src: string }[] {
  const files: { path: string; src: string }[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts')) {
        files.push({ path: full, src: readFileSync(full, 'utf8') });
      }
    }
  }
  for (const root of publicSourceGlobRoots) walk(join(process.cwd(), root));
  return files;
}
const allSourceFiles = readAllSourceFiles();

describe('operator identity uses only the founder-approved public name', () => {
  it('the privacy notice identifies "Faiz Ahmed, trading as JetStash"', () => {
    expect(privacyPage).toMatch(/Faiz Ahmed, trading as JetStash/);
  });

  it('the full legal name "Faiz Ahmed Patel" does not appear anywhere in app, components, lib or data', () => {
    for (const { path, src } of allSourceFiles) {
      expect(src, `${path} contains the full legal name, which must never be published`).not.toMatch(
        /Faiz Ahmed Patel/i
      );
    }
  });
});

describe('privacy contact is present and correctly linked', () => {
  it('has at least one working mailto link to privacy@jetstash.co.uk', () => {
    expect(privacyPage).toMatch(/href="mailto:privacy@jetstash\.co\.uk"/);
  });
});

describe('no personal Gmail address or invented postal address appears', () => {
  it('does not contain a gmail.com address', () => {
    expect(privacyPage).not.toMatch(/@gmail\.com/i);
  });

  it('does not contain common postal-address markers (invented address)', () => {
    // Deliberately loose: catches obvious fabrication like a street/postcode
    // pattern or "registered office" wording without false-positiving on
    // unrelated prose.
    expect(privacyPage).not.toMatch(/registered office/i);
    expect(privacyPage).not.toMatch(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/); // UK postcode shape
  });
});

describe('no fake company/registration wording appears', () => {
  it('does not claim limited-company status or a company number', () => {
    expect(privacyPage).not.toMatch(/JetStash Ltd/i);
    expect(privacyPage).not.toMatch(/company (registration )?number/i);
    expect(privacyPage).not.toMatch(/companies house/i);
  });
});

describe('real data flows are represented, and only where supported', () => {
  it('mentions the contact form and quote request', () => {
    expect(privacyPage).toMatch(/[Cc]ontact form/);
    expect(privacyPage).toMatch(/[Qq]uote request/);
  });

  it('mentions Travel Club and Route Watch (Brevo-backed sign-up flows)', () => {
    expect(privacyPage).toMatch(/Travel Club/);
    expect(privacyPage).toMatch(/Route Watch/);
  });

  it('names Vercel, Resend, Brevo and the Microsoft 365 mailbox as processors', () => {
    expect(privacyPage).toMatch(/Vercel/);
    expect(privacyPage).toMatch(/Resend/);
    expect(privacyPage).toMatch(/Brevo/);
    expect(privacyPage).toMatch(/Microsoft 365/);
  });

  it('does not claim a payment processor, since JetStash takes no payments', () => {
    expect(privacyPage).not.toMatch(/stripe|paypal|payment processor/i);
  });
});

describe('Travel Ready Check is described as client-side only', () => {
  it('states the tool runs in the browser and nothing entered is sent or stored', () => {
    expect(privacyProse).toMatch(/Travel Ready Check/);
    expect(privacyProse).toMatch(/browser/i);
    expect(privacyProse).toMatch(/none of it is sent/i);
  });
});

describe('individual rights and ICO complaint information are present', () => {
  it('lists access, correction, deletion, restriction, objection and withdrawal of consent', () => {
    expect(privacyPage).toMatch(/access/i);
    expect(privacyPage).toMatch(/correct/i);
    expect(privacyPage).toMatch(/delet/i);
    expect(privacyPage).toMatch(/restrict/i);
    expect(privacyPage).toMatch(/object/i);
    expect(privacyPage).toMatch(/withdraw consent/i);
  });

  it('names the ICO and links to ico.org.uk', () => {
    expect(privacyPage).toMatch(/Information Commissioner/);
    expect(privacyPage).toMatch(/href="https:\/\/ico\.org\.uk"/);
  });
});

describe('no unsupported or overreaching claims', () => {
  it('does not claim JetStash sells personal data (states the opposite)', () => {
    expect(privacyProse).toMatch(/don't sell|do not sell/i);
    // Guard against a future edit accidentally introducing "we sell" language.
    expect(privacyProse).not.toMatch(/\bwe sell\b/i);
  });

  it('does not claim absolute security or specific certifications', () => {
    expect(privacyPage).not.toMatch(/ISO ?27001|Cyber Essentials/i);
    expect(privacyProse).toMatch(/no website can guarantee to be completely secure/i);
  });

  it('does not invent a precise retention period (a number of days/months/years)', () => {
    expect(privacyPage).not.toMatch(/\b\d+\s*(day|month|year)s?\b/i);
  });
});

describe('last-updated date is present', () => {
  it('shows a specific "Last updated" date', () => {
    expect(privacyPage).toMatch(/Last updated:\s*\d{1,2}\s+\w+\s+\d{4}/);
  });
});

describe('no secret or environment-variable value is exposed', () => {
  it('does not reference a raw API key, secret, or process.env value', () => {
    expect(privacyPage).not.toMatch(/process\.env/);
    expect(privacyPage).not.toMatch(/RESEND_API_KEY|BREVO_API_KEY|CRON_SECRET|CONTACT_TO_EMAIL/);
  });
});
