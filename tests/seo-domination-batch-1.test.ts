import { describe, it, expect } from 'vitest';
import { routes, getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { fareObservations, isPubliclyPublishable } from '@/data/fare-observations';

/**
 * SEO Domination Batch 1 (22 August 2026) — the first implementation wave
 * from the SEO Domination Shortlist audit. Originally attempted two
 * evidence-ready Tier A business-class opportunities (Lahore, Doha) and one
 * Tier B direct-flight evidence opportunity (Manchester-Mumbai), via a new
 * opt-in `Route.seoTitle`/`seoDescription` override mechanism. Founder
 * review (same day, before merge) found the Business Class Lahore/Doha
 * titles crossed the project's own evidence gate: none of the three routes
 * showed any Business-cabin content on the live page, and the only
 * Business-cabin observations that existed for them were either not
 * publicly publishable or didn't exist at all. Those three overrides were
 * removed, and — with no route left using it — a second founder pass
 * removed the seoTitle/seoDescription mechanism itself as dead speculative
 * infrastructure, leaving Manchester-Mumbai plus the architecturally shared
 * Manchester-Delhi fix as that batch's actual final scope. The
 * "Business Class Lahore/Doha SEO push" describe block below is kept as
 * this decision's historical record (the legacy, non-publishable
 * observations that made the original titles premature).
 *
 * SEO Domination Batch 1B (23 August 2026) re-opened exactly that decision
 * once the evidence gate was genuinely closed: Business Fare Evidence Batch
 * 1 (PR #166) logged real, current, publishable Business observations for
 * all three routes, and the Fare Signal cabin-safety fix (PR #167) ensured
 * the generic route-page Fare Signal still leads with Economy regardless.
 * seoTitle/seoDescription were reintroduced (same shape as before — see
 * data/routes.ts's own doc comment) and applied to manchester-lahore and
 * london-heathrow-doha only; london-heathrow-lahore deliberately stays on
 * its default metadata to avoid cannibalising manchester-lahore's "business
 * class to lahore" targeting within the Lahore cluster. See
 * tests/seo-domination-batch-1b.test.ts for full coverage of the new
 * titles, the Business clarity panel and the FAQ content.
 */

const NOW_ISO = '2026-08-22';

describe('Business Class Lahore/Doha SEO push (22 Aug): historical record of why the original attempt was premature', () => {
  it('the legacy Business-cabin observation each route had at the time (where one existed) was not publicly publishable — the reason the 22 Aug titles were withdrawn', () => {
    // london-heathrow-lahore had zero Business observations logged at all;
    // manchester-lahore and london-heathrow-doha each had exactly one, both
    // legacy records missing departureDate/returnDate/currency. Business
    // Fare Evidence Batch 1 (same day, later) closed this evidence gap for
    // all three routes with genuine, current, publishable observations —
    // see data/fare-observations.ts's "Business Fare Evidence Batch 1"
    // block — and SEO Domination Batch 1B (23 Aug) then acted on that new
    // evidence for manchester-lahore and london-heathrow-doha. The
    // historical record below (why these specific legacy observations
    // could never have supported the original 22 Aug titles) still stands
    // regardless.
    const legacyBusinessObs = ['obs-man-lhe-business-1', 'obs-lhr-doh-business-1'];
    for (const id of legacyBusinessObs) {
      const obs = fareObservations.find((o) => o.id === id)!;
      expect(obs, id).toBeTruthy();
      expect(obs.cabin, id).toBe('Business');
      expect(isPubliclyPublishable(obs), id).toBe(false);
    }
  });

  it('the legacy non-publishable observations above are still in the archive (append-only, never overwritten) alongside the newer genuine ones — proves this historical record was never silently deleted when the evidence gap was later closed', () => {
    const legacyBusinessObs = ['obs-man-lhe-business-1', 'obs-lhr-doh-business-1'];
    for (const id of legacyBusinessObs) {
      expect(fareObservations.some((o) => o.id === id), id).toBe(true);
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

  // IndiGo Manchester post-withdrawal verification (2 Sep 2026): a real,
  // freshly-verified 'service-ended' route-status event now exists for
  // this route (data/route-status-events.ts), so 2026-09-05 correctly
  // resolves to 'service-ended', not the automatic-fail-closed
  // 'unverified' state this test originally documented before that
  // evidence existed. The self-correcting, no-redeploy-required design
  // goal this test exists to lock in is still real and still true — see
  // the sibling test directly below, which exercises the exact same code
  // path at a date before this verification was ever added.
  it('the fix self-corrects once the withdrawal effective date passes and is freshly verified — no redeploy required, matching the Route Status V1 design goal', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, '2026-09-05');
    expect(presentation.status).toBe('service-ended');
    expect(presentation.metadataTitle).not.toContain('Direct Flight Status Update');
    expect(presentation.metadataTitle).toBe('Manchester to Mumbai: Route Guide');
  });

  it('before fresh verification existed, the same boundary correctly self-corrected to the automatic fail-closed "unverified" state — still true today for any route in that position', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    const withdrawalOnly = routeStatusEvents.filter((e) => e.routeSlug !== 'manchester-mumbai' || e.type !== 'service-ended');
    const presentation = getEffectiveRoutePresentation(route, withdrawalOnly, '2026-09-05');
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
