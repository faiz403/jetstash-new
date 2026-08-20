import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { guides, getGuideBySlug, getRelatedGuides } from '@/data/guides';
import { generateMetadata } from '@/app/guides/[slug]/page';
import { DESCRIPTION_THRESHOLD } from './metadata-audit.test';

/**
 * Visa guide description fix (Search Console opportunity audit, 20 Aug
 * 2026). This guide sat at 0% CTR despite real page-1 impressions
 * (position ~7.1); a live SERP check showed Google already rewriting the
 * old, more abstract `guide.summary` with concrete facts pulled from the
 * body text rather than using it verbatim. `guide.summary` is dual-purpose
 * -- it's both the metadata description (app/guides/[slug]/page.tsx's
 * generateMetadata) and the visible teaser paragraph on the /guides hub
 * card and on "More guides" related-card sections elsewhere (see the doc
 * comment on Guide.summary in data/guides.ts).
 *
 * The new copy was previewed live against production (client-side DOM
 * injection, no repo change involved) on both the /guides hub card and a
 * "More guides" related-card, at 375px and 1280px: 4 lines mobile, 3 lines
 * desktop, matching sibling cards exactly, zero clipping. This file can't
 * re-run that visual check automatically (this repo has no rendering
 * precedent for a full page.tsx import in Vitest, and neither
 * app/guides/page.tsx nor app/guides/[slug]/page.tsx export their card
 * markup as an isolated, importable component) -- so instead it guards the
 * two things that matter for that visual result to keep holding: the exact
 * copy length, and that neither card location has since grown a
 * line-clamp/truncate class that would silently cut it off.
 *
 * Scope: data/guides.ts summary text only. guide.title and guide.paragraphs
 * (the page's own <h1> and body) are untouched -- checked explicitly below.
 */

const SLUG = 'visa-processing-booking-date';
const NEW_SUMMARY =
  "Pakistan and India e-Visas often take 4 to 7 days, with delays possible. Build 2 to 3 weeks of buffer before booking, including for Saudi Arabia trips.";

function guide() {
  const g = getGuideBySlug(SLUG);
  if (!g) throw new Error(`expected guide ${SLUG} to exist`);
  return g;
}

describe('visa-processing-booking-date guide summary', () => {
  it('is the exact previewed 151-character copy', () => {
    expect(guide().summary).toBe(NEW_SUMMARY);
    expect(guide().summary.length).toBe(151);
  });

  it('fits the metadata description threshold with real headroom', () => {
    expect(guide().summary.length).toBeLessThan(DESCRIPTION_THRESHOLD);
  });

  it('is grounded in facts the page body actually states', () => {
    const body = guide().paragraphs.join(' ');
    expect(body).toMatch(/4 to 7 days/);
    expect(body).toMatch(/2 to 3 weeks/);
    expect(body).toContain('Pakistan');
    expect(body).toContain('India');
    expect(body).toContain('Saudi Arabia');
  });

  it('scopes the 4-to-7-day figure to Pakistan and India only, never claiming it for Saudi Arabia -- the page body never states a Saudi Arabia processing time', () => {
    const summary = guide().summary;
    const beforeDays = summary.split('e-Visas often take 4 to 7 days')[0];
    expect(beforeDays).toContain('Pakistan and India');
    expect(beforeDays).not.toContain('Saudi Arabia');
    // Saudi Arabia appears only in the buffer-guidance clause, after the
    // days figure, not attached to it.
    expect(summary.indexOf('Saudi Arabia')).toBeGreaterThan(summary.indexOf('4 to 7 days'));
  });

  it('makes no guarantee-language claim ("will"/"always"/"guaranteed") about visa timing', () => {
    const summary = guide().summary.toLowerCase();
    expect(summary).not.toMatch(/\bwill\b|\balways\b|\bguarantee/);
  });

  it('title and body paragraphs are completely unchanged by this fix', () => {
    expect(guide().title).toBe('How visa processing time should shape your booking date');
    expect(guide().paragraphs).toEqual([
      'For Pakistan, India and Saudi Arabia, visa processing is often the real constraint on how late you can book, not flight pricing. e-Visas for India and Pakistan are typically processed within 4 to 7 days, but delays happen, particularly during high-demand periods. Build at least 2 to 3 weeks of buffer before your travel date if you haven\'t applied yet, and treat "fastest possible visa turnaround" as a worst case, not a plan.',
      'The order of operations matters as much as the timing. The expensive mistake is booking a non-refundable fare first and applying for the visa second, because if the application is delayed past your departure date, the fare is lost. If your dates depend on a visa you don\'t yet hold, either apply before you commit to the flight, or choose a fare with a change policy you\'ve actually read rather than assumed.',
      'Two document checks catch people out beyond the visa itself. If you travel on a NICOP or OCI card instead of a visa, check its expiry when you start planning rather than at the airport, since renewals routinely take longer than people budget for. And check your passport\'s remaining validity: countries on these routes commonly require six months beyond your travel dates, which turns an "expires next spring" passport into a problem for a winter trip.',
    ]);
  });
});

describe('generateMetadata() reflects the new summary end-to-end, not just at the data layer', () => {
  it('the guide page description matches the new summary exactly', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: SLUG }) });
    expect(meta.description).toBe(NEW_SUMMARY);
    // Title untouched by this fix.
    expect(meta.title).toBe('How visa processing time should shape your booking date');
  });
});

describe('the two card locations this summary also renders in (hub + "More guides") have not grown a clamp/truncate class since the live preview', () => {
  it('at least one real guide currently surfaces the visa guide as a "More guides" related card, so the second render site is real, not hypothetical', () => {
    const relatedFrom = guides.find((g) => getRelatedGuides(g.slug).some((r) => r.slug === SLUG));
    expect(relatedFrom, 'expected at least one guide to list the visa guide as related').toBeTruthy();
  });

  it('neither app/guides/page.tsx (hub card) nor app/guides/[slug]/page.tsx ("More guides" card) applies a line-clamp/truncate utility to the summary paragraph', () => {
    const hubSource = readFileSync(join(process.cwd(), 'app/guides/page.tsx'), 'utf-8');
    const slugSource = readFileSync(join(process.cwd(), 'app/guides/[slug]/page.tsx'), 'utf-8');
    for (const [label, source] of [
      ['app/guides/page.tsx', hubSource],
      ['app/guides/[slug]/page.tsx', slugSource],
    ] as const) {
      // Both files render the summary as `{guide.summary}` / `{g.summary}` in
      // a single <p>; find that exact paragraph and check only it, not the
      // whole file, so an unrelated line-clamp elsewhere can't false-fail.
      const match = source.match(/<p className="([^"]*)">\{g(?:uide)?\.summary\}<\/p>/);
      expect(match, `${label}: expected to find the summary-rendering <p> with the current markup shape`).toBeTruthy();
      expect(match![1], `${label}: summary paragraph className`).not.toMatch(/line-clamp|truncate/);
    }
  });
});
