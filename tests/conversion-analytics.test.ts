import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Conversion-event analytics for Contact, Quote Request and Newsletter —
 * fired only after the server confirms success, never on submit-click,
 * validation failure, provider error, or a silently-accepted honeypot
 * (bot) submission. Each form is a 'use client' component with hooks, so —
 * matching this repo's established pattern (see
 * tests/quote-request-trip-type.test.ts, tests/public-form-hardening.test.ts)
 * — these are source-text regression assertions on the real component, not
 * a rendered/mocked one.
 */

const contactSrc = readFileSync(join(process.cwd(), 'components/sections/contact-form.tsx'), 'utf8');
const quoteRequestSrc = readFileSync(join(process.cwd(), 'components/sections/quote-request-form.tsx'), 'utf8');
const newsletterSrc = readFileSync(join(process.cwd(), 'components/sections/newsletter-section.tsx'), 'utf8');

/** Returns the text of the try{}/catch{} block in a handleSubmit function, split at the catch boundary. */
function splitTryCatch(src: string): { tryBlock: string; catchBlock: string } {
  const tryStart = src.indexOf('try {');
  const catchStart = src.indexOf('} catch (err) {');
  const catchEnd = src.indexOf('\n  }', catchStart);
  return {
    tryBlock: src.slice(tryStart, catchStart),
    catchBlock: src.slice(catchStart, catchEnd),
  };
}

describe('Contact form — contact_submit_success', () => {
  const { tryBlock, catchBlock } = splitTryCatch(contactSrc);

  it('imports track from the shared analytics wrapper, not a vendor SDK directly', () => {
    expect(contactSrc).toContain("import { track } from '@/lib/analytics';");
    expect(contactSrc).not.toMatch(/@vercel\/analytics/);
  });

  it('fires exactly once, and only inside the success path (after setStatus success)', () => {
    const matches = contactSrc.match(/track\('contact_submit_success'\)/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(tryBlock).toContain("setStatus('success')");
    const successIndex = tryBlock.indexOf("setStatus('success')");
    const trackIndex = tryBlock.indexOf("track('contact_submit_success')");
    expect(trackIndex).toBeGreaterThan(successIndex);
  });

  it('never fires from the catch/error branch — a failed submission fires nothing', () => {
    expect(catchBlock).not.toMatch(/track\(/);
  });

  it('is gated behind the honeypot being empty, so a silently-accepted bot submission is never counted as a conversion', () => {
    expect(contactSrc).toContain("if (!honeypot) track('contact_submit_success');");
  });

  it('the event carries no properties at all — nothing to leak since name/email/message are the only fields, all excluded', () => {
    expect(contactSrc).toMatch(/track\('contact_submit_success'\);/);
  });

  it('does not send name, email or message anywhere near the track call', () => {
    const trackLine = contactSrc.split('\n').find((l) => l.includes("track('contact_submit_success')")) ?? '';
    expect(trackLine).not.toMatch(/form\.(name|email|message)/);
  });

  it('is not awaited and cannot block or delay the success UI', () => {
    expect(contactSrc).not.toMatch(/await track\(/);
  });

  it('existing success/error copy and states are unchanged', () => {
    expect(contactSrc).toContain('Thanks. We&apos;ve got your message and will reply soon.');
    expect(contactSrc).toContain("status === 'submitting' ? 'Sending…' : 'Send message'");
  });
});

describe('Quote Request form — quote_request_submit_success', () => {
  const { tryBlock, catchBlock } = splitTryCatch(quoteRequestSrc);

  it('imports track from the shared analytics wrapper', () => {
    expect(quoteRequestSrc).toContain("import { track } from '@/lib/analytics';");
  });

  it('fires exactly once, and only inside the success path', () => {
    const matches = quoteRequestSrc.match(/track\('quote_request_submit_success'/g) ?? [];
    expect(matches).toHaveLength(1);
    const successIndex = tryBlock.indexOf("setStatus('success')");
    const trackIndex = tryBlock.indexOf("track('quote_request_submit_success'");
    expect(trackIndex).toBeGreaterThan(successIndex);
  });

  it('never fires from the catch/error branch — a validation or provider failure fires nothing', () => {
    expect(catchBlock).not.toMatch(/track\(/);
  });

  it('is gated behind the honeypot being empty', () => {
    expect(quoteRequestSrc).toContain("if (!honeypot) track('quote_request_submit_success'");
  });

  it('only carries tripType and region — already-validated enum values, never free text', () => {
    const trackLine = quoteRequestSrc.split('\n').find((l) => l.includes("track('quote_request_submit_success'")) ?? '';
    expect(trackLine).toContain('tripType: form.tripType');
    expect(trackLine).toContain('region: form.region');
    // None of the free-text fields this form collects.
    for (const forbidden of ['form.name', 'form.email', 'form.phone', 'form.message', 'form.travelWindow', 'form.budgetNote', 'form.tripTypeOther', 'form.travellerCount']) {
      expect(trackLine).not.toContain(forbidden);
    }
  });

  it('is not awaited and cannot block or delay the success UI', () => {
    expect(quoteRequestSrc).not.toMatch(/await track\(/);
  });

  it('existing success/error copy and states are unchanged', () => {
    expect(quoteRequestSrc).toContain("Thanks. We've got your quote request");
    expect(quoteRequestSrc).toContain("status === 'submitting' ? 'Sending…' : 'Request a quote'");
  });
});

describe('Newsletter form — newsletter_subscribe_success', () => {
  const { tryBlock, catchBlock } = splitTryCatch(newsletterSrc);

  it('imports track from the shared analytics wrapper', () => {
    expect(newsletterSrc).toContain("import { track } from '@/lib/analytics';");
  });

  it('fires exactly once, and only inside the success path', () => {
    const matches = newsletterSrc.match(/track\('newsletter_subscribe_success'/g) ?? [];
    expect(matches).toHaveLength(1);
    const successIndex = tryBlock.indexOf("setStatus('success')");
    const trackIndex = tryBlock.indexOf("track('newsletter_subscribe_success'");
    expect(trackIndex).toBeGreaterThan(successIndex);
  });

  it('never fires from the catch/error branch', () => {
    expect(catchBlock).not.toMatch(/track\(/);
  });

  it('is gated behind the honeypot being empty', () => {
    expect(newsletterSrc).toMatch(/if \(!honeypot\) \{[\s\S]*?track\('newsletter_subscribe_success'/);
  });

  it('only includes nearestAirport/interest when actually provided, and never includes email', () => {
    const block = newsletterSrc.match(/if \(!honeypot\) \{[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(block).toContain('if (nearestAirport) properties.nearestAirport = nearestAirport;');
    expect(block).toContain('if (interest) properties.interest = interest;');
    expect(block).not.toContain('email');
  });

  it('is not awaited and cannot block or delay the success UI', () => {
    expect(newsletterSrc).not.toMatch(/await track\(/);
  });

  it('existing success copy is unchanged', () => {
    expect(newsletterSrc).toContain('You&apos;re on the list. Welcome to Travel Club.');
  });
});

describe('no PII anywhere in any conversion-event call across all three forms', () => {
  const FORBIDDEN_TOKENS = ['name', 'email', 'phone', 'message', 'passport', 'travelWindow', 'budgetNote'];

  for (const [label, src, eventName] of [
    ['contact', contactSrc, 'contact_submit_success'],
    ['quote-request', quoteRequestSrc, 'quote_request_submit_success'],
    ['newsletter', newsletterSrc, 'newsletter_subscribe_success'],
  ] as const) {
    it(`${label}'s ${eventName} call site contains none of: ${FORBIDDEN_TOKENS.join(', ')}`, () => {
      // Grabs the single statement/block containing the track() call, not
      // the whole file, so this stays a precise check on what's actually
      // sent rather than a blunt whole-file scan that would also (harmlessly)
      // flag the surrounding form's field names.
      const idx = src.indexOf(`track('${eventName}'`);
      expect(idx, `${eventName} not found in ${label}`).toBeGreaterThan(-1);
      const statementStart = src.lastIndexOf('\n', idx) + 1;
      const statementEnd = src.indexOf(';', idx) + 1;
      const statement = src.slice(statementStart, statementEnd);
      for (const token of FORBIDDEN_TOKENS) {
        expect(statement.toLowerCase(), `${label}: "${statement.trim()}" should not reference "${token}"`).not.toContain(
          token.toLowerCase()
        );
      }
    });
  }
});
