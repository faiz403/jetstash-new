import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { getBaggageAffiliateUrl, hasBaggageAffiliateLink, BAGGAGE_PROVIDER_REL } from '@/lib/baggage-affiliate-link';

/**
 * CJ baggage affiliate CTA on Travel Ready Check (August 2026).
 *
 * The smallest legitimate monetised addition to Travel Ready Check: a
 * single "Shop suitcases & luggage" handoff to the existing, CJ-approved
 * Travel Luggage & Cabin Bags programme (advertiser 7218698), using the
 * exact URL CJ's own Links & Products "Get Code" tool generated. Mirrors
 * tests/antalya-hotel-affiliate-mvp.test.ts's approach: source-level
 * assertions against the actual files, not a rendering harness, matching
 * this repo's existing (node-environment, no DOM) Vitest setup.
 */

const componentSrc = readFileSync(join(process.cwd(), 'components', 'travel-ready', 'travel-ready-check.tsx'), 'utf8');
const linkLibSrc = readFileSync(join(process.cwd(), 'lib', 'baggage-affiliate-link.ts'), 'utf8');

const APPROVED_CJ_URL = 'https://www.dpbolvw.net/click-101818709-17045640';

describe('The approved CJ URL is preserved exactly', () => {
  it('getBaggageAffiliateUrl() returns the exact CJ-generated Click URL, character for character', () => {
    expect(getBaggageAffiliateUrl()).toBe(APPROVED_CJ_URL);
  });

  it('hasBaggageAffiliateLink() reports true while the URL is configured', () => {
    expect(hasBaggageAffiliateLink()).toBe(true);
  });

  it('the source literal is not built from a template string or any string concatenation', () => {
    expect(linkLibSrc).not.toMatch(/\$\{/);
    expect(linkLibSrc).not.toMatch(/dpbolvw\.net.*\+/);
  });
});

describe('Publisher and link identifiers on the URL are exactly right', () => {
  it('carries JetStash\'s registered CJ publisher property id (101818709)', () => {
    const url = getBaggageAffiliateUrl()!;
    expect(url).toContain('101818709');
  });

  it('carries the approved "Shop for Suitcases at TLCB" link id (17045640), not any other link', () => {
    const url = getBaggageAffiliateUrl()!;
    expect(url).toContain('17045640');
  });

  it('uses CJ\'s own tracking domain, not a hand-built travelluggagecabinbags.com URL', () => {
    const url = getBaggageAffiliateUrl()!;
    expect(url).toMatch(/^https:\/\/www\.dpbolvw\.net\/click-/);
  });
});

describe('Commission is stated accurately wherever it appears in source', () => {
  it('never states 5% as the commission (the account\'s signed term is 3%) — the provenance comment\'s own "not 5%" warning is exempted', () => {
    expect(linkLibSrc).not.toMatch(/\b5% commission\b/i);
    expect(linkLibSrc).not.toMatch(/commission is 5%/i);
    expect(linkLibSrc).not.toMatch(/is up to 5%/i);
    expect(componentSrc).not.toMatch(/5%/);
  });

  it('documents the actual signed 3% commission in the provenance comment', () => {
    expect(linkLibSrc).toContain('3.00%');
  });
});

describe('The CTA uses the correct outbound link safety attributes', () => {
  it('BAGGAGE_PROVIDER_REL matches the existing partner-link rel value used elsewhere in the app', () => {
    expect(BAGGAGE_PROVIDER_REL).toBe('nofollow sponsored noopener noreferrer');
  });

  it('the component opens the CTA in a new tab with the safe rel attribute', () => {
    expect(componentSrc).toContain('target="_blank"');
    expect(componentSrc).toContain('rel={BAGGAGE_PROVIDER_REL}');
  });

  it('the CTA label is exactly "Shop suitcases & luggage"', () => {
    expect(componentSrc).toContain('Shop suitcases &amp; luggage');
  });

  it('carries the required partner-link disclosure sentence', () => {
    expect(componentSrc).toContain('Partner link, opens Travel Luggage &amp; Cabin Bags in a new tab.');
  });
});

describe('No price, rating, review, discount or recommendation claims', () => {
  // Scoped to the new baggage CTA block only — the rest of the component
  // legitimately uses words like "review" for unrelated Travel Ready Check
  // content (e.g. a visa rule's `reviewDueDate`), which is not this CTA's
  // concern to police.
  const ctaBlock = componentSrc.slice(componentSrc.indexOf('{baggageAffiliateUrl && ('), componentSrc.lastIndexOf('</section>'));

  it('the baggage CTA block exists and was actually isolated for these checks', () => {
    expect(ctaBlock.length).toBeGreaterThan(0);
    expect(ctaBlock).toContain('Shop suitcases');
  });

  it('the baggage CTA block never states a price figure', () => {
    expect(ctaBlock).not.toMatch(/£\d/);
  });

  it('the baggage CTA block never uses rating/review/discount/coupon language', () => {
    expect(ctaBlock).not.toMatch(/\brating\b/i);
    expect(ctaBlock).not.toMatch(/\breview[s]?\b/i);
    expect(ctaBlock).not.toMatch(/\bdiscount\b/i);
    expect(ctaBlock).not.toMatch(/\bcoupon\b/i);
    expect(ctaBlock).not.toMatch(/promo\s?code/i);
  });

  it('the baggage CTA block never claims "best", "cheapest" or "recommended" luggage', () => {
    expect(ctaBlock.toLowerCase()).not.toMatch(/best|cheapest|recommended|top pick|\brank\b/);
  });
});

describe('The CTA is fail-closed and structurally independent of Travel Ready logic', () => {
  it('the component only renders the CTA inside a `baggageAffiliateUrl &&` guard — never unconditionally', () => {
    expect(componentSrc).toContain('{baggageAffiliateUrl && (');
    expect(componentSrc).toContain('href={baggageAffiliateUrl}');
  });

  it('baggageAffiliateUrl is derived from lib/baggage-affiliate-link.ts, not computed from readiness state', () => {
    expect(componentSrc).toContain('const baggageAffiliateUrl = getBaggageAffiliateUrl();');
  });

  it('the CTA block sits outside the `{!result ? (...) : (...)}` readiness conditional, after both branches close', () => {
    const resultBranchEnd = componentSrc.indexOf('{result.verdict !== \'ready-to-continue\'');
    const ctaBlockStart = componentSrc.indexOf('{baggageAffiliateUrl && (');
    expect(resultBranchEnd).toBeGreaterThan(-1);
    expect(ctaBlockStart).toBeGreaterThan(resultBranchEnd);
  });

  it('ready_check_baggage_cta_click fires exactly once per real click — a single onClick handler, no useEffect/mount-time firing, no duplicate call site', () => {
    const occurrences = (componentSrc.match(/ready_check_baggage_cta_click/g) ?? []).length;
    // Exactly 2: the AnalyticsEvent-adjacent onClick call, plus this file's
    // own data-analytics="ready-check-baggage-cta" markup is a different,
    // hyphenated string and doesn't count — so 2 covers only the one event
    // name occurrence in the onClick plus nothing else.
    expect(occurrences).toBe(1);
    expect(componentSrc).not.toMatch(/useEffect\([^]*?ready_check_baggage_cta_click/);
  });

  it('the click handler passes no properties — no PII, no CJ URL, nothing beyond the bare event name', () => {
    expect(componentSrc).toContain("onClick={() => track('ready_check_baggage_cta_click')}");
  });

  it('the click handler never calls preventDefault/stopPropagation — navigation to CJ is never blocked', () => {
    const ctaBlock = componentSrc.slice(componentSrc.indexOf('{baggageAffiliateUrl && ('), componentSrc.lastIndexOf('</section>'));
    expect(ctaBlock).not.toContain('preventDefault');
    expect(ctaBlock).not.toContain('stopPropagation');
  });

  it('the CTA click handler only fires its own analytics event, never touches readiness/engine state', () => {
    const ctaBlock = componentSrc.slice(componentSrc.indexOf('{baggageAffiliateUrl && ('));
    expect(ctaBlock).toContain("track('ready_check_baggage_cta_click')");
    expect(ctaBlock).not.toContain('setResult');
    expect(ctaBlock).not.toContain('onResult');
    expect(ctaBlock).not.toContain('setDestinationSlug');
  });
});

describe('lib/baggage-affiliate-link.ts fails closed when unset', () => {
  it('getBaggageAffiliateUrl() and hasBaggageAffiliateLink() are backed by the same private constant, not two independent sources of truth', () => {
    expect(linkLibSrc).toMatch(/const BAGGAGE_AFFILIATE_URL: string \| null = /);
    expect(linkLibSrc).toContain('return BAGGAGE_AFFILIATE_URL;');
    expect(linkLibSrc).toContain('return BAGGAGE_AFFILIATE_URL !== null;');
  });

  it('the module never falls back to a generic travelluggagecabinbags.com URL or any other provider if unset', () => {
    expect(linkLibSrc).not.toMatch(/\?\?\s*['"]https:\/\/(www\.)?travelluggagecabinbags\.com/);
    expect(linkLibSrc).not.toContain('||');
  });
});

describe('Travel Ready verdict/content and route evidence are unaffected', () => {
  it('the readiness evaluation call site is untouched — still calls evaluateTravelReadiness with only travel-ready-check.ts inputs', () => {
    expect(componentSrc).toContain('evaluateTravelReadiness(');
    expect(componentSrc).toContain("evaluateTravelReadiness,");
    expect(componentSrc).toContain("from '@/lib/travel-ready-check'");
  });

  it('lib/baggage-affiliate-link.ts is never imported by the readiness logic or route/destination data modules', () => {
    const guarded = [
      join('lib', 'travel-ready-check.ts'),
      join('lib', 'travel-intelligence-engine.ts'),
      join('data', 'travel-ready-rules.ts'),
      join('data', 'routes.ts'),
      join('data', 'destinations.ts'),
    ];
    for (const relPath of guarded) {
      const src = readFileSync(join(process.cwd(), relPath), 'utf8');
      expect(src, relPath).not.toContain('baggage-affiliate-link');
    }
  });
});

describe('No unrelated page or component receives the CTA', () => {
  it('lib/baggage-affiliate-link.ts is imported from exactly one component: travel-ready-check.tsx', () => {
    // git grep always emits POSIX-style ("/") paths regardless of OS, so the
    // expected list below is hardcoded with forward slashes rather than
    // built with path.join (which would emit "\" on Windows and never
    // match). The lib file itself never contains its own filename string,
    // so it's excluded from this "who imports it" search on purpose.
    const grep = execSync(
      'git grep -l "baggage-affiliate-link" -- "*.ts" "*.tsx"',
      { cwd: process.cwd(), encoding: 'utf8' }
    )
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((file) => !file.startsWith('tests/') && file !== 'lib/baggage-affiliate-link.ts');

    expect(grep.sort()).toEqual(['components/travel-ready/travel-ready-check.tsx']);
  });

  it('TravelReadyCheck itself is still the only place that renders "Travel Ready Check" — the CTA rides inside its one existing section, not a new one', () => {
    const sectionCount = (componentSrc.match(/<section\b/g) ?? []).length;
    expect(sectionCount).toBe(1);
  });
});
