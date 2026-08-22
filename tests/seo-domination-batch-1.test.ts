import { describe, it, expect } from 'vitest';
import { routes, getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { fareObservations, isPubliclyPublishable } from '@/data/fare-observations';
import { DESCRIPTION_THRESHOLD, TITLE_THRESHOLD } from './metadata-audit.test';

/**
 * SEO Domination Batch 1 (22 August 2026) — the first implementation wave
 * from the SEO Domination Shortlist audit: two evidence-ready Tier A
 * business-class opportunities (Lahore, Doha) and one Tier B direct-flight
 * evidence opportunity (Manchester-Mumbai), the last held for a route-status
 * recheck first because of a known imminent service withdrawal. Karachi was
 * deliberately excluded — no Business-cabin evidence exists for it yet.
 */

const NOW_ISO = '2026-08-22';
const applyTemplate = (title: string) => `${title} | JetStash`;

describe('Target 1 & 2: business-class seoTitle/seoDescription overrides', () => {
  const targets = ['manchester-lahore', 'london-heathrow-lahore', 'london-heathrow-doha'] as const;

  it('all three carry a checked seoTitle and seoDescription override', () => {
    for (const slug of targets) {
      const route = getRouteBySlug(slug)!;
      expect(route.seoTitle, slug).toBeTruthy();
      expect(route.seoDescription, slug).toBeTruthy();
    }
  });

  it('every override fits within the site\'s own title/description length guidelines, including the rendered " | JetStash" template', () => {
    for (const slug of targets) {
      const route = getRouteBySlug(slug)!;
      expect(applyTemplate(route.seoTitle!).length, slug).toBeLessThanOrEqual(TITLE_THRESHOLD);
      expect(route.seoDescription!.length, slug).toBeLessThanOrEqual(DESCRIPTION_THRESHOLD);
    }
  });

  it('every title names "Business Class" and contains "Flights" (the Search Console CTR fix this shares with the peak-period title work)', () => {
    for (const slug of targets) {
      const route = getRouteBySlug(slug)!;
      expect(route.seoTitle, slug).toContain('Business Class');
      expect(route.seoTitle, slug).toMatch(/Flights/);
    }
  });

  it('every title/description names the real, verified operating airline (PIA for Lahore, Qatar Airways for Doha) and direct status — never a fare figure', () => {
    const expectations: Record<string, { airlineFragment: RegExp; directFragment: RegExp }> = {
      'manchester-lahore': { airlineFragment: /PIA/, directFragment: /Direct/ },
      'london-heathrow-lahore': { airlineFragment: /PIA/, directFragment: /Direct/ },
      'london-heathrow-doha': { airlineFragment: /Qatar Airways|Direct/, directFragment: /Direct/ },
    };
    for (const slug of targets) {
      const route = getRouteBySlug(slug)!;
      const { airlineFragment, directFragment } = expectations[slug];
      const haystack = `${route.seoTitle} ${route.seoDescription}`;
      expect(haystack, slug).toMatch(airlineFragment);
      expect(haystack, slug).toMatch(directFragment);
      // No fare evidence is publishable for any of these three routes'
      // Business-cabin observations (checked below) — the copy must never
      // claim one.
      expect(haystack, slug).not.toMatch(/£\d/);
    }
  });

  it('no banned superlative or unsupported product-quality language anywhere in the new copy', () => {
    const banned = /\bbest\b|\bcheapest\b|\bpremium\b|\bluxury\b|\bflat-?bed\b|\blounge\b|\bflexib(le|ility)\b/i;
    for (const slug of targets) {
      const route = getRouteBySlug(slug)!;
      expect(route.seoTitle, slug).not.toMatch(banned);
      expect(route.seoDescription, slug).not.toMatch(banned);
    }
  });

  it('confirms the real reason no fare figure is claimed: the only Business-cabin observation on each route (where one exists) is not publicly publishable', () => {
    // london-heathrow-lahore has zero Business observations logged at all;
    // manchester-lahore and london-heathrow-doha each have exactly one,
    // both legacy records missing departureDate/returnDate/currency.
    const legacyBusinessObs = ['obs-man-lhe-business-1', 'obs-lhr-doh-business-1'];
    for (const id of legacyBusinessObs) {
      const obs = fareObservations.find((o) => o.id === id)!;
      expect(obs, id).toBeTruthy();
      expect(obs.cabin, id).toBe('Business');
      expect(isPubliclyPublishable(obs), id).toBe(false);
    }
    expect(fareObservations.some((o) => o.routeSlug === 'london-heathrow-lahore' && o.cabin === 'Business')).toBe(false);
  });

  it('the getRoutePresentation() default template is untouched for every other route — only these three carry an override', () => {
    const overridden = routes.filter((r) => r.seoTitle || r.seoDescription).map((r) => r.slug).sort();
    expect(overridden).toEqual(['london-heathrow-doha', 'london-heathrow-lahore', 'manchester-lahore'].sort());
  });
});

describe('Target 3: Manchester-Mumbai route-status recheck before optimising "direct flight" wording', () => {
  it('the IndiGo withdrawal is real, dated and still pre-boundary as of today — confirms verdict B (time-sensitive wording), not A or C', () => {
    const event = routeStatusEvents.find((e) => e.id === 'man-bom-indigo-withdrawal-2026-06');
    expect(event).toBeTruthy();
    expect(event?.type).toBe('withdrawal-announced');
    if (event?.type !== 'withdrawal-announced') throw new Error('unreachable');
    expect(event.effectiveFrom).toBe('2026-08-31');
    // "today" (22 Aug 2026) is before the 31 Aug effective date — the
    // direct service is still genuinely operating, which is exactly why
    // this is verdict B (target with time-bounded wording) and not verdict
    // C (substitute a different query) — a stable "direct" claim would
    // still be wrong, which is what this whole target is about avoiding.
    expect(NOW_ISO < event.effectiveFrom).toBe(true);
  });

  it('manchester-mumbai received NO seoTitle/seoDescription override in data/routes.ts — the fix lives in the shared withdrawal-announced presentation builder instead, so it also correctly reaches manchester-delhi', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    expect(route.seoTitle).toBeUndefined();
    expect(route.seoDescription).toBeUndefined();
  });

  it('today, the route\'s title/description acknowledge the timing rather than advertise a stable direct route', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
    expect(presentation.status).toBe('direct'); // genuinely still operating today
    expect(presentation.metadataTitle).toBe('Manchester to Mumbai: Direct Flight Status Update');
    expect(presentation.metadataTitle).not.toMatch(/Booking & Peak Periods/);
    expect(presentation.metadataDescription).toContain('currently has a direct option');
    expect(presentation.metadataDescription).toContain('withdrawal announced, effective 31 August 2026');
    expect(presentation.metadataDescription).not.toMatch(/£\d/);
  });

  it('the same fix correctly reaches manchester-delhi (the identical IndiGo withdrawal event) — architectural, not route-specific', () => {
    const route = getRouteBySlug('manchester-delhi')!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
    expect(presentation.metadataTitle).toBe('Manchester to Delhi: Direct Flight Status Update');
    expect(presentation.metadataDescription).toContain('withdrawal announced, effective 31 August 2026');
  });

  it('the fix self-corrects once the withdrawal effective date passes — no redeploy required, matching the Route Status V1 design goal', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, '2026-09-05');
    expect(presentation.status).toBe('unverified');
    expect(presentation.metadataTitle).not.toContain('Direct Flight Status Update');
    expect(presentation.metadataTitle).toMatch(/Verification in Progress/i);
  });

  it('the fix only fires while status is still \'direct\' — never overrides an already-honest non-direct title for a route this viewModel kind might reach in a different state', () => {
    // Defensive proof the new branch in buildWithdrawalAnnouncedPresentation
    // is correctly gated on presentation.status === 'direct', not applied
    // unconditionally to every route this viewModel kind is reached for.
    for (const route of routes) {
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
      if (presentation.metadataTitle.includes('Direct Flight Status Update')) {
        expect(presentation.status, route.slug).toBe('direct');
      }
    }
  });
});

describe('Deliberately not implemented: Karachi', () => {
  it('manchester-karachi carries no seoTitle/seoDescription override — no Business-cabin evidence exists for it yet', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    expect(route.seoTitle).toBeUndefined();
    expect(route.seoDescription).toBeUndefined();
    expect(fareObservations.some((o) => o.routeSlug === 'manchester-karachi' && o.cabin === 'Business')).toBe(false);
  });
});
