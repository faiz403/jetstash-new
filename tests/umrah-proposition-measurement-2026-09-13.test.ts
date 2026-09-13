import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Astra Big Job #4 closure PR (13 Sept 2026, founder-approved). Closes two
 * findings from the full Umrah end-to-end review:
 *
 * P2-1 — the /umrah H1 ("Umrah packages, compared properly") promised a
 * package-comparison capability the page doesn't deliver (the same page
 * says plainly "JetStash has not tracked package prices for these cards").
 * Fixed by naming only what's genuinely true: flight/routing intelligence
 * and package-comparison guidance/a checklist, never live package inventory
 * or a comparison engine.
 *
 * P3 measurement gap — the quote-request funnel had no start/abandonment
 * signal and no way to isolate Umrah-specific interest in analytics. Fixed
 * with a new 'quote_request_started' event, firing once per form session on
 * the visitor's first genuine field change (never on page load), carrying
 * the same already-validated tripType/region pair 'quote_request_submit_success'
 * already sends.
 *
 * This PR does NOT attempt to prove or create an Umrah operator/commission
 * relationship — that gap (P2-2 in the full audit) is a real-market-evidence
 * question, not a code defect, and stays explicitly out of scope here.
 */

const umrahPageSrc = readFileSync(join(process.cwd(), 'app/umrah/page.tsx'), 'utf8');
const analyticsSrc = readFileSync(join(process.cwd(), 'lib/analytics.ts'), 'utf8');
const formSrc = readFileSync(join(process.cwd(), 'components/sections/quote-request-form.tsx'), 'utf8');

describe('A/B. The /umrah H1 no longer overstates package-comparison capability', () => {
  it('the old overclaiming H1 text is gone', () => {
    expect(umrahPageSrc).not.toContain('Umrah packages, compared properly');
  });

  it('the new H1 names flight and package CHOICES, never a comparison engine or live inventory', () => {
    expect(umrahPageSrc).toContain('Plan your Umrah journey with clearer flight and package choices');
  });

  it('the new H1 does not claim JetStash sells, books, or holds package inventory', () => {
    const h1Match = umrahPageSrc.match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/);
    expect(h1Match).not.toBeNull();
    const h1Text = h1Match![1];
    expect(h1Text.toLowerCase()).not.toMatch(/\bbook\b/);
    expect(h1Text.toLowerCase()).not.toMatch(/\bsale\b|\bsell\b/);
    expect(h1Text.toLowerCase()).not.toMatch(/\bcompared\b/); // the specific overclaim being removed
  });

  it('the honest "not tracked package prices" disclosure directly below the hero is untouched', () => {
    expect(umrahPageSrc).toContain('JetStash has not tracked package prices for these cards');
  });

  it('the quote-request CTA and Travel Ready CTA are both still present on the hub', () => {
    expect(umrahPageSrc).toContain("href=\"/quote-request?tripType=umrah&region=gulf\"");
    expect(umrahPageSrc).toContain("href=\"/travel-ready-check\"");
  });
});

describe('C/D/E. quote_request_started exists and carries safe trip-type/region categorisation', () => {
  it('quote_request_started is a typed, allowed analytics event', () => {
    expect(analyticsSrc).toMatch(/\|\s*'quote_request_started'/);
  });

  it('the form fires it once per session, on genuine field change, never on mount/page load', () => {
    expect(formSrc).toMatch(/const startedRef = useRef\(false\)/);
    expect(formSrc).toMatch(/function markStarted\(\)/);
    const markStartedBody = formSrc.slice(formSrc.indexOf('function markStarted'), formSrc.indexOf('async function handleSubmit'));
    expect(markStartedBody).toMatch(/if \(startedRef\.current\) return;/);
    expect(markStartedBody).toMatch(/startedRef\.current = true;/);
    // Wired to the form's own onChange (fires on genuine interaction,
    // never merely because the component mounted) — not to a useEffect
    // that would fire on page load.
    expect(formSrc).toMatch(/<form onSubmit=\{handleSubmit\} onChange=\{markStarted\}/);
    expect(formSrc).not.toMatch(/useEffect[\s\S]{0,80}markStarted/);
  });

  it('quote_request_started sends exactly the tripType/region pair, matching quote_request_submit_success\'s existing shape', () => {
    const startedCall = formSrc.match(/track\('quote_request_started',\s*\{([\s\S]*?)\}\);/);
    expect(startedCall).not.toBeNull();
    const body = startedCall![1];
    expect(body).toMatch(/tripType:/);
    expect(body).toMatch(/region:/);
    // Exactly two top-level properties (the Vercel Pro ceiling) — count commas
    // at depth 0 within the captured body plus one.
    const propCount = body.split(',').filter((s) => s.trim().length > 0).length;
    expect(propCount).toBe(2);
  });
});

describe('F. No PII is added to analytics by this change', () => {
  it('the new call site never references name/email/phone/message/dates', () => {
    const startedCall = formSrc.match(/track\('quote_request_started',\s*\{[\s\S]*?\}\);/)?.[0] ?? '';
    expect(startedCall).not.toMatch(/\bname\b/i);
    expect(startedCall).not.toMatch(/\bemail\b/i);
    expect(startedCall).not.toMatch(/\bphone\b/i);
    expect(startedCall).not.toMatch(/\bmessage\b/i);
    expect(startedCall).not.toMatch(/travelWindow|budgetNote/);
  });

  it('only already-validated enum values (tripType, region) are sent — same category as the existing submit_success event', () => {
    const startedCall = formSrc.match(/track\('quote_request_started',\s*\{([\s\S]*?)\}\);/)?.[1] ?? '';
    expect(startedCall).toMatch(/form\.tripType/);
    expect(startedCall).toMatch(/form\.region/);
  });
});

describe('G. The existing analytics property-limit test remains satisfied by this new call site', () => {
  it('the call site matches the property-limit scanner\'s expected track() shape exactly', () => {
    expect(formSrc).toMatch(/track\(\s*'quote_request_started'\s*,\s*\{/);
  });
});

describe('H. Existing fulfilment-truth boundary is untouched by this PR', () => {
  it('the quote-request success message still states the same non-booking, non-payment boundary', () => {
    expect(formSrc).toContain("any booking is completed directly with the provider, not through JetStash");
  });

  it('no operator name, ATOL/ABTA claim, commission claim or guaranteed response time was added', () => {
    expect(formSrc.toLowerCase()).not.toMatch(/\batol\b|\babta\b/);
    expect(formSrc.toLowerCase()).not.toMatch(/guarantee(d)? response/);
    expect(umrahPageSrc.toLowerCase()).not.toMatch(/\bpartner operator\b|\bour operator\b/);
  });

  it('the Umrah hub still tells the visitor to confirm ATOL themselves — advice to the user, not a claim about JetStash', () => {
    expect(umrahPageSrc).toContain('Use an ATOL-protected operator');
    expect(umrahPageSrc).toContain('confirm ATOL protection before');
  });
});
