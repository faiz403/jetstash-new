import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { guides, getGuideBySlug, getRelatedGuides } from '@/data/guides';
import { generateMetadata } from '@/app/guides/[slug]/page';
import { DESCRIPTION_THRESHOLD, TITLE_THRESHOLD } from './metadata-audit.test';

/**
 * Direct-vs-Gulf-connecting-fares guide title + summary fix (Search Console
 * opportunity audit, 20 Aug 2026). This guide sat at 0% CTR despite real
 * page-1 impressions (position ~7.4); unlike the visa guide, a live SERP
 * check confirmed Google was already showing the old title and description
 * verbatim -- it hadn't rewritten toward a better alternative, so this fix
 * is our own editorial call, not one Google handed us.
 *
 * Deliberately BOTH title and summary changed, not summary alone (contrast
 * with tests/guide-metadata-visa-summary.test.ts, where only summary
 * changed). `guide.title` is triple-purpose -- it's the SEO <title>, the
 * guide's own <h1>, and the heading text on both the /guides hub card and
 * "More guides" related-card sections (see the grep-verified usage list in
 * the fix's own commit/PR description) -- so a "title fix" here means
 * changing the page's own headline, not just metadata. That was a
 * deliberate choice: the old title read poorly on the page itself, not
 * just in the SERP, and fixing only the SERP-facing copy while leaving
 * weaker wording on the page was explicitly rejected.
 *
 * `guide.summary` remains dual-purpose exactly as documented on the Guide
 * interface -- metadata description plus the visible teaser paragraph on
 * both card locations.
 *
 * Both changes were previewed live against production before landing
 * (client-side DOM injection, no repo change involved) on the /guides hub
 * card and a real "More guides" related-card, at 375px and 1280px: clean
 * at every check, matching sibling cards' existing line-count bands, zero
 * clipping.
 *
 * Scope: data/guides.ts title and summary text only, for this one guide.
 * guide.paragraphs (the body) is untouched -- checked explicitly below.
 */

const SLUG = 'direct-vs-gulf-connecting-fares';
const NEW_TITLE = 'Direct vs Gulf-Connecting Fares to Pakistan or India';
const NEW_SUMMARY =
  'Comparing direct and Gulf-connecting fares to Pakistan or India means weighing journey time and baggage transfers too, not just the headline price.';
const ORIGINAL_PARAGRAPHS = [
  'A one-stop fare via Dubai, Doha or Abu Dhabi is sometimes cheaper than a direct flight to Pakistan or India, but the comparison needs to include total journey time, connection risk, and whether checked luggage transfers automatically. For trips with young children or elderly relatives, a direct flight is often worth a moderate price premium.',
  'Compare like with like: total door-to-door time, not flight time. A connection adds the layover itself plus the slack you should build around it. A tight connection saves an hour on paper and costs a day when it goes wrong. Check whether both legs sit on a single ticket. One booking means the airline owns the problem if you misconnect and your bags are checked through; two separate cheap tickets stitched together means you own the problem, and that risk is rarely priced into the "saving".',
  'The connecting option earns its place in specific situations: when your dates are flexible enough to catch the better one-stop pricing, when the layover is long enough to be genuinely restful rather than stressful, or when you\'re comparing cabins. A one-stop business class fare via the Gulf sometimes prices below what you\'d expect against a direct fare in the same cabin. The mistake is treating the headline price as the whole comparison.',
];

function guide() {
  const g = getGuideBySlug(SLUG);
  if (!g) throw new Error(`expected guide ${SLUG} to exist`);
  return g;
}

describe('direct-vs-gulf-connecting-fares guide: exact title and summary', () => {
  it('title is the exact approved copy', () => {
    expect(guide().title).toBe(NEW_TITLE);
  });

  it('summary is the exact approved copy, 147 characters', () => {
    expect(guide().summary).toBe(NEW_SUMMARY);
    expect(guide().summary.length).toBe(147);
  });

  it('title fits the site-wide threshold with the " | JetStash" template suffix applied, no exception needed', () => {
    const rendered = `${guide().title} | JetStash`;
    expect(rendered.length).toBeLessThanOrEqual(TITLE_THRESHOLD);
  });

  it('summary fits the metadata description threshold with real headroom', () => {
    expect(guide().summary.length).toBeLessThan(DESCRIPTION_THRESHOLD);
  });

  it('title no longer ends on the awkward "properly", and reflects direct-vs-Gulf-connecting intent plus both named countries', () => {
    const title = guide().title;
    expect(title.toLowerCase()).not.toMatch(/properly$/);
    expect(title).toMatch(/direct/i);
    expect(title).toMatch(/gulf-connecting/i);
    expect(title).toContain('Pakistan');
    expect(title).toContain('India');
  });

  it('title makes no claim of live/guaranteed savings ("cheapest", "best", "save", "guaranteed")', () => {
    const title = guide().title.toLowerCase();
    expect(title).not.toMatch(/cheapest|\bbest\b|\bsave\b|guarantee/);
  });

  it('summary is grounded in facts the page body actually states', () => {
    const body = ORIGINAL_PARAGRAPHS.join(' ');
    expect(body).toMatch(/total journey time/);
    expect(body).toMatch(/checked luggage transfers/i);
    expect(body).toMatch(/headline price/i);
    expect(body).toContain('Pakistan');
    expect(body).toContain('India');
  });

  it('summary makes no invented-statistic or guaranteed-value claim ("cheapest", "best", "save", "guaranteed")', () => {
    const summary = guide().summary.toLowerCase();
    expect(summary).not.toMatch(/cheapest|\bbest\b|\bsave\b|guarantee/);
  });

  it('body paragraphs are completely unchanged by this fix', () => {
    expect(guide().paragraphs).toEqual(ORIGINAL_PARAGRAPHS);
  });
});

describe('generateMetadata() reflects the new title and summary end-to-end, not just at the data layer', () => {
  it('the guide page title and description match the approved copy exactly', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: SLUG }) });
    expect(meta.title).toBe(NEW_TITLE);
    expect(meta.description).toBe(NEW_SUMMARY);
  });
});

describe('every legitimate render site for guide.title and guide.summary reflects the new copy (or is proven unaffected)', () => {
  it('the breadcrumb JSON-LD and visible breadcrumb text both use the new title (both are built from guide.title, same as the <h1>)', () => {
    // app/guides/[slug]/page.tsx builds the breadcrumbSchema name and the
    // visible breadcrumb span from the exact same guide.title used for the
    // <h1> and metadata -- proving the data-layer value is correct proves
    // all three, since none of them transform it. This test exists so a
    // future refactor that splits those apart doesn't silently drift
    // without a failing test pointing at it.
    const pageSource = readFileSync(join(process.cwd(), 'app/guides/[slug]/page.tsx'), 'utf-8');
    expect(pageSource).toContain('{ name: guide.title, href: `/guides/${guide.slug}` }');
    expect(pageSource).toContain('<span className="truncate text-ink-200">{guide.title}</span>');
    expect(pageSource).toMatch(/<h1[^>]*>\{guide\.title\}<\/h1>/);
  });

  it('at least one real guide currently surfaces this guide as a "More guides" related card, so the card render sites are real, not hypothetical', () => {
    const relatedFrom = guides.find((g) => getRelatedGuides(g.slug).some((r) => r.slug === SLUG));
    expect(relatedFrom, 'expected at least one guide to list this guide as related').toBeTruthy();
  });

  it('neither app/guides/page.tsx (hub card) nor app/guides/[slug]/page.tsx ("More guides" card) applies a line-clamp/truncate utility to the title or summary paragraph', () => {
    const hubSource = readFileSync(join(process.cwd(), 'app/guides/page.tsx'), 'utf-8');
    const slugSource = readFileSync(join(process.cwd(), 'app/guides/[slug]/page.tsx'), 'utf-8');
    for (const [label, source] of [
      ['app/guides/page.tsx', hubSource],
      ['app/guides/[slug]/page.tsx', slugSource],
    ] as const) {
      const titleMatch = source.match(/<h[23] className="([^"]*)">\{g(?:uide)?\.title\}<\/h[23]>/);
      const summaryMatch = source.match(/<p className="([^"]*)">\{g(?:uide)?\.summary\}<\/p>/);
      expect(titleMatch, `${label}: expected to find the title-rendering heading with the current markup shape`).toBeTruthy();
      expect(summaryMatch, `${label}: expected to find the summary-rendering <p> with the current markup shape`).toBeTruthy();
      expect(titleMatch![1], `${label}: title heading className`).not.toMatch(/line-clamp|truncate/);
      expect(summaryMatch![1], `${label}: summary paragraph className`).not.toMatch(/line-clamp|truncate/);
    }
  });
});
