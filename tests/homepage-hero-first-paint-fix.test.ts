import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { PageHero } from '@/components/sections/page-hero';

/**
 * Real-user validation, Stage A (30 Aug 2026) — Fix 3: homepage opening
 * hero first-paint visibility.
 *
 * A real mobile tester saw only the background and the eyebrow badge on
 * first load; the headline and primary CTAs stayed invisible (opacity:0,
 * via the shared "stagger-in stagger-N animate-fade-up" entrance
 * convention every PageHero already used) for roughly 0.75-0.95s and
 * interpreted the page as having failed to load — confirmed via the raw
 * server-rendered HTML (the content was always present; only its CSS
 * opacity was delayed) and the exact tailwind.config.js/globals.css timing
 * values (see the Stage A diagnostic, Issue 4).
 *
 * Fix: PageHero gained an optional `immediate` prop (default false — every
 * existing caller keeps the exact prior staggered entrance) that, when
 * true, renders the h1 and children (the primary headline and primary
 * action) without the stagger-in/animate-fade-up treatment. Only
 * HomepageOpeningHero sets it. Eyebrow, description and stats are
 * deliberately unchanged either way — this fix is scoped to exactly the
 * two elements the finding was about, not a site-wide animation change.
 */

const heroSrc = readFileSync(join(process.cwd(), 'components', 'homepage-v2', 'homepage-opening-hero.tsx'), 'utf8');

describe('PageHero `immediate` prop — rendered output', () => {
  it('by default (immediate omitted), h1 and the CTA wrapper both start hidden — every existing PageHero caller is unaffected', () => {
    const html = renderToStaticMarkup(
      PageHero({ title: 'Test headline', children: 'Test CTA' })
    );
    expect(html).toMatch(/<h1[^>]*class="[^"]*stagger-in[^"]*"[^>]*>Test headline<\/h1>/);
    expect(html).toMatch(/<h1[^>]*class="[^"]*animate-fade-up[^"]*"[^>]*>Test headline<\/h1>/);
    // The CTA wrapper div immediately precedes the closing tags; check the
    // whole document contains a stagger-4-tagged element wrapping the CTA text.
    expect(html).toMatch(/class="[^"]*stagger-in stagger-4 animate-fade-up[^"]*">Test CTA/);
  });

  it('with immediate=true, h1 and the CTA wrapper render with zero entrance-hiding classes', () => {
    const html = renderToStaticMarkup(
      PageHero({ title: 'Test headline', children: 'Test CTA', immediate: true })
    );
    const h1Match = html.match(/<h1[^>]*>Test headline<\/h1>/)?.[0] ?? '';
    expect(h1Match).not.toContain('stagger-in');
    expect(h1Match).not.toContain('animate-fade-up');
    expect(html).not.toMatch(/class="[^"]*stagger-in stagger-4 animate-fade-up[^"]*">Test CTA/);
    // The headline text itself is still genuinely present and unstyled-away
    // — this is a visibility fix, not content removed.
    expect(html).toContain('Test headline');
    expect(html).toContain('Test CTA');
  });

  it('immediate=true does not touch the eyebrow or description entrance treatment — scoped to headline + CTA only', () => {
    const html = renderToStaticMarkup(
      PageHero({ eyebrow: 'Test eyebrow', title: 'Test headline', description: 'Test description', immediate: true })
    );
    expect(html).toMatch(/class="stagger-in stagger-1 animate-fade-up">/); // eyebrow wrapper, unchanged
    expect(html).toMatch(/class="stagger-in stagger-3[^"]*"[^>]*>Test description/); // description, unchanged
  });

  it('immediate=true does not touch the stats entrance treatment — a secondary detail, not the primary headline/action', () => {
    const html = renderToStaticMarkup(
      PageHero({ title: 'Test headline', stats: [{ value: '1 of 1', label: 'Test stat' }], immediate: true })
    );
    expect(html).toMatch(/<dl class="stagger-in stagger-4 [^"]*"/);
  });
});

describe('HomepageOpeningHero opts into `immediate` — the one PageHero caller this fix targets', () => {
  it('passes the immediate prop to PageHero', () => {
    expect(heroSrc).toMatch(/\bimmediate\b/);
  });
});

describe('site-wide PageHero behaviour is otherwise unchanged', () => {
  it('every real PageHero caller except the homepage opening hero passes no `immediate` prop, so defaults to the exact prior staggered entrance', () => {
    // The complete, verified list of every file that renders <PageHero
    // (region hubs — app/pakistan, app/india etc. — use a separate,
    // unrelated hero in components/sections/region-hub-page.tsx and never
    // reach PageHero at all, so they're correctly not part of this list).
    const callers = [
      'app/about/page.tsx',
      'app/affiliate-disclosure/page.tsx',
      'app/airports/page.tsx',
      'app/contact/page.tsx',
      'app/deals/page.tsx',
      'app/destinations/page.tsx',
      'app/guides/page.tsx',
      'app/privacy-policy/page.tsx',
      'app/quote-request/page.tsx',
      'app/routes/page.tsx',
      'app/tracked-fares/page.tsx',
      'app/travel-club/page.tsx',
      'app/travel-ready-check/page.tsx',
    ];
    for (const relPath of callers) {
      const src = readFileSync(join(process.cwd(), relPath), 'utf8');
      expect(src, relPath).toContain('<PageHero');
      expect(src, relPath).not.toMatch(/<PageHero[\s\S]{0,400}\bimmediate\b/);
    }
  });

  it('region hubs (Pakistan, India, Gulf, Umrah, family holidays, business class) never reach PageHero at all — a separate hero this fix does not touch', () => {
    const src = readFileSync(join(process.cwd(), 'components', 'sections', 'region-hub-page.tsx'), 'utf8');
    expect(src).not.toContain('PageHero');
  });
});
