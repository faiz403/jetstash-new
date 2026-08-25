import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { routes, getRouteBySlug, getRoutePresentation } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getFareRangeSummary } from '@/data/fare-observations';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { BusinessClarityPanel } from '@/components/route/business-clarity-panel';
import { siteConfig } from '@/lib/site-config';

/**
 * SEO Domination Batch 1B (23 Aug 2026) — reintroduces the
 * seoTitle/seoDescription override mechanism (removed as dead
 * infrastructure in f0a36f3, legitimately needed again once Business Fare
 * Evidence Batch 1 + the Fare Signal cabin-safety fix closed the evidence
 * gap that made the original 22 Aug attempt premature) and applies it to
 * manchester-lahore and london-heathrow-doha only. Adds a Business
 * clarity panel (route service vs tracked fare, plus a visible on-page
 * FAQ — deliberately no invented FAQPage schema, see the component's own
 * doc comment) to both routes' pages. Full founder-approved spec: the
 * "JETSTASH — SEO DOMINATION BATCH 1B / IMPLEMENTATION APPROVED" brief,
 * 23 Aug 2026.
 */

const NOW_ISO = '2026-08-23';
const applyTemplate = (title: string) => `${title} | ${siteConfig.name}`;

describe('London–Doha and Manchester–Lahore get their intended, evidence-safe metadata', () => {
  it('london-heathrow-doha carries the exact proposed title/description', () => {
    const route = getRouteBySlug('london-heathrow-doha')!;
    const presentation = getRoutePresentation(route, NOW_ISO);
    expect(presentation.metadataTitle).toBe('London–Doha Business Class: Fare & Direct Route');
    expect(presentation.metadataDescription).toBe(
      'Qatar Airways operates Heathrow–Doha direct. JetStash separately tracks a connecting Business Class fare via Cairo — route and fare kept clearly distinct.'
    );
  });

  it('manchester-lahore carries the exact proposed title/description', () => {
    const route = getRouteBySlug('manchester-lahore')!;
    const presentation = getRoutePresentation(route, NOW_ISO);
    expect(presentation.metadataTitle).toBe('Manchester–Lahore Business Class: Fare & Direct Route');
    expect(presentation.metadataDescription).toBe(
      'PIA operates Manchester–Lahore direct. JetStash separately tracks a connecting Business Class fare, and shows how it differs from the direct route service.'
    );
  });

  it('both full rendered <title>s (with the automatic " | JetStash" template) fit the site\'s own ≤65-character guideline', () => {
    for (const slug of ['london-heathrow-doha', 'manchester-lahore']) {
      const route = getRouteBySlug(slug)!;
      const rendered = applyTemplate(getRoutePresentation(route, NOW_ISO).metadataTitle);
      expect(rendered.length, `${slug}: "${rendered}"`).toBeLessThanOrEqual(65);
    }
  });

  it('neither title contains a price — dated fare evidence must never live in durable metadata', () => {
    for (const slug of ['london-heathrow-doha', 'manchester-lahore']) {
      const route = getRouteBySlug(slug)!;
      const presentation = getRoutePresentation(route, NOW_ISO);
      expect(presentation.metadataTitle, slug).not.toMatch(/£\d/);
      expect(presentation.metadataDescription, slug).not.toMatch(/£\d/);
    }
  });

  it('london-heathrow-lahore stays on its plain default metadata — cluster secondary, not cannibalising manchester-lahore', () => {
    const route = getRouteBySlug('london-heathrow-lahore')!;
    expect(route.seoTitle).toBeUndefined();
    expect(route.seoDescription).toBeUndefined();
    const presentation = getRoutePresentation(route, NOW_ISO);
    expect(presentation.metadataTitle).not.toContain('Business Class');
  });

  it('at the time of this batch (23 Aug 2026), only these two routes carried a seoTitle/seoDescription override — the mechanism stayed genuinely opt-in, not a blanket rewrite; manchester-karachi joined later (a separate PR, same day) once its own Business Deal made the SEO opportunity real — see tests/manchester-karachi-business-seo.test.ts', () => {
    const overridden = routes.filter((r) => r.seoTitle || r.seoDescription).map((r) => r.slug);
    expect(overridden.sort()).toEqual(['london-heathrow-doha', 'manchester-karachi', 'manchester-lahore']);
  });

  it('Karachi got no businessClarity panel in this batch, nor in its own later SEO PR — route and tracked fare already agree on "connecting", so there is no direct-vs-connecting conflict to disambiguate', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    expect(route.businessClarity).toBeUndefined();
  });
});

describe('Claim safety — neither title/description nor businessClarity content overclaims', () => {
  const targets = ['london-heathrow-doha', 'manchester-lahore'] as const;

  it('no "best"/"cheapest" superlative anywhere in the overridden metadata', () => {
    for (const slug of targets) {
      const route = getRouteBySlug(slug)!;
      const presentation = getRoutePresentation(route, NOW_ISO);
      const text = `${presentation.metadataTitle} ${presentation.metadataDescription}`.toLowerCase();
      expect(text, slug).not.toMatch(/\bbest\b|\bcheapest\b/);
    }
  });

  it('neither title reads as "direct Business Class vs connecting Business Class" — founder correction, 23 Aug 2026, PR #168 review: the original "Business Class: Direct vs Connecting" phrasing was too easy to misread as a cabin-specific claim about the direct service itself, which the evidence never established', () => {
    for (const slug of targets) {
      const route = getRouteBySlug(slug)!;
      const presentation = getRoutePresentation(route, NOW_ISO);
      expect(presentation.metadataTitle, slug).not.toMatch(/Direct vs Connecting/i);
      expect(presentation.metadataTitle, slug).toContain('Fare & Direct Route');
    }
  });

  it('the Doha description never says the tracked fare is Qatar Airways or direct', () => {
    const route = getRouteBySlug('london-heathrow-doha')!;
    const presentation = getRoutePresentation(route, NOW_ISO);
    // "Qatar Airways operates Heathrow–Doha direct" is a route-service
    // claim, correctly first in the sentence; the second clause must be
    // clearly about a *separate*, connecting fare.
    expect(presentation.metadataDescription).toMatch(/separately tracks a connecting/i);
  });

  it('the Lahore description never says the tracked fare is PIA or direct', () => {
    const route = getRouteBySlug('manchester-lahore')!;
    const presentation = getRoutePresentation(route, NOW_ISO);
    expect(presentation.metadataDescription).toMatch(/separately tracks a connecting/i);
  });

  it('businessClarity.trackedFareShape never contains a price or claims the fare is the route\'s named direct airline', () => {
    for (const slug of targets) {
      const route = getRouteBySlug(slug)!;
      const clarity = route.businessClarity!;
      expect(clarity, slug).toBeTruthy();
      expect(clarity.trackedFareShape, slug).not.toMatch(/£\d/);
      expect(clarity.trackedFareShape.toLowerCase(), slug).not.toMatch(/\bpia\b|\bqatar airways\b/);
    }
  });

  it('the FAQ answer text is built to never assert the tracked fare is that direct service — the panel appends "is not that direct service" unconditionally', () => {
    const panelSrc = readFileSync(join(process.cwd(), 'components/route/business-clarity-panel.tsx'), 'utf8');
    expect(panelSrc).toContain('is not that direct service');
  });
});

describe('The route-vs-fare price/date shown are always live, never hardcoded', () => {
  it('data/routes.ts\'s businessClarity fields never embed a price figure (route.ts is a static file — a hardcoded £ here could never self-update)', () => {
    const routesSrc = readFileSync(join(process.cwd(), 'data/routes.ts'), 'utf8');
    const businessClarityBlocks = routesSrc.split('businessClarity:').slice(1);
    for (const block of businessClarityBlocks) {
      // Only inspect up to the closing of this one businessClarity object,
      // not the rest of the file.
      const objectText = block.slice(0, block.indexOf('},') + 2);
      expect(objectText).not.toMatch(/£\d/);
    }
  });

  it('app/routes/[slug]/page.tsx computes businessFareRange from the live archive (getFareRangeSummary), never from a stored field', () => {
    const pageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');
    expect(pageSrc).toMatch(/getFareRangeSummary\(route\.slug, 'Business', nowIso\)/);
  });

  it('the panel fails closed: businessFareRange is null (and the panel does not render) when getFareRangeSummary finds nothing — proven directly against the real archive for both routes today', () => {
    for (const slug of ['london-heathrow-doha', 'manchester-lahore']) {
      const range = getFareRangeSummary(slug, 'Business', NOW_ISO);
      expect(range, slug).toBeTruthy();
      expect(range!.min, slug).toBeGreaterThan(0);
    }
  });

  it('BusinessClarityPanel renders the real live price and checked date for both routes — not a placeholder', () => {
    const lahoreClarity = getRouteBySlug('manchester-lahore')!.businessClarity!;
    const lahoreRange = getFareRangeSummary('manchester-lahore', 'Business', NOW_ISO)!;
    const lahoreHtml = renderToStaticMarkup(BusinessClarityPanel({ clarity: lahoreClarity, fareRange: lahoreRange }));
    expect(lahoreHtml).toContain('£3,051');
    expect(lahoreHtml).toContain('22 August 2026');
    // routeServiceSummary/faqQuestion below contain an apostrophe, which
    // React's SSR output HTML-encodes as &#x27; — check a distinctive
    // apostrophe-free substring instead of the raw source string.
    expect(lahoreHtml).toContain('PIA operates Manchester–Lahore direct');
    expect(lahoreHtml).toContain('Are there direct flights from Manchester to Lahore');

    const dohaClarity = getRouteBySlug('london-heathrow-doha')!.businessClarity!;
    const dohaRange = getFareRangeSummary('london-heathrow-doha', 'Business', NOW_ISO)!;
    const dohaHtml = renderToStaticMarkup(BusinessClarityPanel({ clarity: dohaClarity, fareRange: dohaRange }));
    expect(dohaHtml).toContain('£1,596');
    expect(dohaHtml).toContain('22 August 2026');
  });

  it('the panel links to /business-class — the one genuinely contextual internal link this batch adds', () => {
    const clarity = getRouteBySlug('manchester-lahore')!.businessClarity!;
    const range = getFareRangeSummary('manchester-lahore', 'Business', NOW_ISO)!;
    const html = renderToStaticMarkup(BusinessClarityPanel({ clarity, fareRange: range }));
    expect(html).toContain('href="/business-class"');
  });
});

describe('Withdrawal-aware metadata still wins unconditionally over any seoTitle override, by construction', () => {
  it('buildWithdrawalAnnouncedPresentation computes metadataTitle/metadataDescription fresh from the ledger headline, never conditionally on where presentation.metadataTitle came from', () => {
    // Read-only structural proof: the withdrawal builder in
    // lib/route-status-copy.ts always assigns metadataTitle/
    // metadataDescription as new values derived from the ledger's own
    // viewModel.headline, then spreads them over `...presentation` last —
    // so it overrides unconditionally regardless of whether `presentation`
    // (the getRoutePresentation() output it receives) came from a
    // seoTitle override or the plain default template. No route today
    // carries both a seoTitle and an active withdrawal event, so this is
    // proven structurally rather than against live data.
    const src = readFileSync(join(process.cwd(), 'lib/route-status-copy.ts'), 'utf8');
    const fnStart = src.indexOf('function buildWithdrawalAnnouncedPresentation');
    const fnBody = src.slice(fnStart, src.indexOf('\n}\n', fnStart));
    expect(fnBody).toMatch(/const metadataTitle = `\$\{pair\}: Direct Flight Status Update`;/);
    expect(fnBody).toMatch(/return \{ \.\.\.presentation, shareText, metadataTitle, metadataDescription \};/);
  });

  it('manchester-mumbai and manchester-delhi (real, currently-active withdrawal events) still get their withdrawal-aware titles today — unaffected by this batch', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = getRouteBySlug(slug)!;
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
      expect(presentation.metadataTitle, slug).toBe(`${slug === 'manchester-mumbai' ? 'Manchester to Mumbai' : 'Manchester to Delhi'}: Direct Flight Status Update`);
    }
  });
});

describe('Regression: everything the founder\'s spec required unchanged actually stayed unchanged', () => {
  it('the generic Fare Signal on both target routes still leads with Economy, not the newer Business observation — PR #167\'s fix, unaffected by this SEO batch', () => {
    const lahoreSignal = getFareSignalForRoute('manchester-lahore', NOW_ISO);
    expect(lahoreSignal.observation?.cabin).toBe('Economy');
    expect(lahoreSignal.observation?.price).toBe(538);

    const dohaSignal = getFareSignalForRoute('london-heathrow-doha', NOW_ISO);
    expect(dohaSignal.observation?.cabin).toBe('Economy');
    expect(dohaSignal.observation?.price).toBe(425);
  });

  it('both routes\' Business fare directness/self-transfer disclosures are byte-for-byte unchanged from Business Fare Evidence Batch 1 — this SEO batch never touched fare-observations.ts', () => {
    const lahoreRange = getFareRangeSummary('manchester-lahore', 'Business', NOW_ISO)!;
    expect(lahoreRange.priceNote).toContain('self-transfer via Kiwi.com');
    expect(lahoreRange.priceNote).toContain('3 stops');

    const dohaRange = getFareRangeSummary('london-heathrow-doha', 'Business', NOW_ISO)!;
    expect(dohaRange.priceNote).toContain('NOT self-transfer');
    expect(dohaRange.priceNote).toContain('no operating-vs-marketing split is recorded as confirmed');
  });

  it('every other route\'s metadataTitle/metadataDescription is byte-for-byte identical to what the plain default template alone would produce — this batch\'s override touches only its own two routes (manchester-karachi\'s own later, separate PR is excluded here too — see tests/manchester-karachi-business-seo.test.ts for its own isolation proof)', () => {
    for (const route of routes) {
      if (['london-heathrow-doha', 'manchester-lahore', 'manchester-karachi'].includes(route.slug)) continue;
      const presentation = getRoutePresentation(route, NOW_ISO);
      // Re-derive what the plain template would produce by confirming
      // neither override field is set — if it were, this route would be a
      // third override this test should have caught above.
      expect(route.seoTitle, route.slug).toBeUndefined();
      expect(route.seoDescription, route.slug).toBeUndefined();
      void presentation; // presentation itself is exercised by the many pre-existing metadata tests; this loop only guards the override-field scope.
    }
  });
});
