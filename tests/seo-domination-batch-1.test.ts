import { describe, it, expect } from 'vitest';
import { routes, getRouteBySlug, getRoutePresentation } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { fareObservations, isPubliclyPublishable } from '@/data/fare-observations';

/**
 * SEO Domination Batch 1 (22 August 2026) — the first implementation wave
 * from the SEO Domination Shortlist audit. Originally shipped with two
 * evidence-ready Tier A business-class opportunities (Lahore, Doha) and one
 * Tier B direct-flight evidence opportunity (Manchester-Mumbai). Founder
 * review (same day, before merge) found the Business Class Lahore/Doha
 * titles crossed the project's own evidence gate: none of the three routes
 * show any Business-cabin content on the live page, and the only
 * Business-cabin observations that exist for them are either not publicly
 * publishable or don't exist at all. Those three overrides were removed —
 * see the "EVIDENCE REQUIRED BEFORE SEO OPTIMISATION" comments in
 * data/routes.ts on manchester-lahore, london-heathrow-lahore and
 * london-heathrow-doha — leaving Manchester-Mumbai (plus the architecturally
 * shared Manchester-Delhi fix) as the batch's actual final scope. Karachi
 * remains deliberately excluded — no Business-cabin evidence exists for it
 * either. Business Fare Evidence Batch 1 (queued, not yet started) is the
 * follow-up that would make the Business overrides legitimate again.
 */

const NOW_ISO = '2026-08-22';

describe('Target 1 & 2 removed: Business Class Lahore/Doha overrides failed the evidence gate', () => {
  const formerTargets = ['manchester-lahore', 'london-heathrow-lahore', 'london-heathrow-doha'] as const;

  it('none of the three formerly-targeted routes carry a seoTitle/seoDescription override any more', () => {
    for (const slug of formerTargets) {
      const route = getRouteBySlug(slug)!;
      expect(route.seoTitle, slug).toBeUndefined();
      expect(route.seoDescription, slug).toBeUndefined();
    }
  });

  it('each falls back to the plain default metadataTitle/metadataDescription template — no weaker replacement wording was substituted', () => {
    for (const slug of formerTargets) {
      const route = getRouteBySlug(slug)!;
      const presentation = getRoutePresentation(route, NOW_ISO);
      expect(presentation.metadataTitle, slug).not.toContain('Business Class');
      expect(presentation.metadataTitle, slug).not.toMatch(/£\d/);
      expect(presentation.metadataDescription, slug).not.toMatch(/£\d/);
    }
  });

  it('confirms the real reason: the only Business-cabin observation on each route (where one exists) is not publicly publishable, or none exists at all', () => {
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

  it('the getRoutePresentation() default template is untouched for every route — no route in the network carries a seoTitle/seoDescription override', () => {
    const overridden = routes.filter((r) => r.seoTitle || r.seoDescription).map((r) => r.slug).sort();
    expect(overridden).toEqual([]);
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
