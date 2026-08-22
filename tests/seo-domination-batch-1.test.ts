import { describe, it, expect } from 'vitest';
import { routes, getRouteBySlug, getRoutePresentation } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { fareObservations, isPubliclyPublishable } from '@/data/fare-observations';

/**
 * SEO Domination Batch 1 (22 August 2026) — the first implementation wave
 * from the SEO Domination Shortlist audit. Originally shipped with two
 * evidence-ready Tier A business-class opportunities (Lahore, Doha) and one
 * Tier B direct-flight evidence opportunity (Manchester-Mumbai), via a new
 * opt-in `Route.seoTitle`/`seoDescription` override mechanism. Founder
 * review (same day, before merge) found the Business Class Lahore/Doha
 * titles crossed the project's own evidence gate: none of the three routes
 * show any Business-cabin content on the live page, and the only
 * Business-cabin observations that exist for them are either not publicly
 * publishable or don't exist at all. Those three overrides were removed —
 * see the "EVIDENCE REQUIRED BEFORE SEO OPTIMISATION" comments in
 * data/routes.ts on manchester-lahore, london-heathrow-lahore and
 * london-heathrow-doha. With no route left using it, a second founder pass
 * removed the seoTitle/seoDescription mechanism itself as dead speculative
 * infrastructure (it was never required by the Manchester-Mumbai/Delhi fix
 * below, which overrides metadataTitle/metadataDescription at the shared
 * withdrawal-announced presentation layer, not via a per-route field) —
 * leaving Manchester-Mumbai plus the architecturally shared Manchester-Delhi
 * fix as this batch's actual final scope. Karachi remains deliberately
 * excluded — no Business-cabin evidence exists for it either. Business Fare
 * Evidence Batch 1 (queued, not yet started) is the follow-up that would
 * make a future, real Business-class override legitimate again.
 */

const NOW_ISO = '2026-08-22';

describe('Business Class Lahore/Doha SEO push: considered and dropped, evidence gate not met', () => {
  const formerTargets = ['manchester-lahore', 'london-heathrow-lahore', 'london-heathrow-doha'] as const;

  it('each route\'s title/description is the plain default template — no Business Class wording and no fare figure', () => {
    for (const slug of formerTargets) {
      const route = getRouteBySlug(slug)!;
      const presentation = getRoutePresentation(route, NOW_ISO);
      expect(presentation.metadataTitle, slug).not.toContain('Business Class');
      expect(presentation.metadataTitle, slug).not.toMatch(/£\d/);
      expect(presentation.metadataDescription, slug).not.toMatch(/£\d/);
    }
  });

  it('at the time this decision was made (22 Aug 2026), the only Business-cabin observation on each route (where one existed) was not publicly publishable, or none existed at all', () => {
    // london-heathrow-lahore had zero Business observations logged at all;
    // manchester-lahore and london-heathrow-doha each had exactly one,
    // both legacy records missing departureDate/returnDate/currency. Business
    // Fare Evidence Batch 1 (same day, later) closed this evidence gap for
    // all three routes with genuine, current, publishable observations —
    // see data/fare-observations.ts's "Business Fare Evidence Batch 1"
    // block — but that batch was fare-evidence-only and deliberately did
    // not re-open the SEO decision this file documents, so the historical
    // record below (why the legacy Business observations specifically
    // could never have supported the original titles) still stands.
    const legacyBusinessObs = ['obs-man-lhe-business-1', 'obs-lhr-doh-business-1'];
    for (const id of legacyBusinessObs) {
      const obs = fareObservations.find((o) => o.id === id)!;
      expect(obs, id).toBeTruthy();
      expect(obs.cabin, id).toBe('Business');
      expect(isPubliclyPublishable(obs), id).toBe(false);
    }
  });

  it('Business Fare Evidence Batch 1 (22 Aug 2026) closed the evidence gap for all three routes, but the plain-default SEO title/description above was deliberately left unchanged — evidence and SEO readiness remain separate decisions', () => {
    for (const slug of formerTargets) {
      expect(fareObservations.some((o) => o.routeSlug === slug && o.cabin === 'Business' && isPubliclyPublishable(o)), slug).toBe(true);
      const route = getRouteBySlug(slug)!;
      const presentation = getRoutePresentation(route, NOW_ISO);
      expect(presentation.metadataTitle, slug).not.toContain('Business Class');
    }
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
  it('at the time of this decision (22 Aug 2026), manchester-karachi had no Business-cabin evidence logged yet — Business Fare Evidence Batch 1 (same day, later) closed that gap, but this batch never revisited a Karachi Business SEO decision', () => {
    // Confirmed no such evidence existed before this SEO audit's own cutoff:
    // no Business observation on this route predates Business Fare Evidence
    // Batch 1's own 22 Aug 2026 entry.
    const businessObs = fareObservations.filter((o) => o.routeSlug === 'manchester-karachi' && o.cabin === 'Business');
    expect(businessObs.every((o) => o.id === 'obs-man-khi-business-20260822-8w-v1')).toBe(true);
  });
});
