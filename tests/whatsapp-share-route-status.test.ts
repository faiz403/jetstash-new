import { describe, it, expect } from 'vitest';
import { getRouteBySlug } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';
import { siteConfig } from '@/lib/site-config';

/**
 * Trust-leak fix — the live Manchester → Mumbai route page warns that
 * IndiGo has announced withdrawal of the direct service, but the WhatsApp
 * share button (built from `presentation.shareText`) used to ship an
 * unqualified "has a direct option" message with no mention of that
 * withdrawal, because getEffectiveRoutePresentation() fell through to the
 * legacy, ledger-agnostic getRoutePresentation() unchanged for the
 * 'withdrawal-announced' viewModel kind. See buildWithdrawalAnnouncedPresentation
 * in lib/route-status-copy.ts for the fix. These tests exercise the exact
 * function every route page's WhatsApp button is built from
 * (app/routes/[slug]/page.tsx passes `presentation.shareText` straight into
 * WhatsAppShareButton), reconstructing the same `https://wa.me/?text=...`
 * URL WhatsAppShareButton itself builds, so a regression here is a
 * regression in the real button.
 */

const FIXED_TODAY = '2026-07-30';

/** Mirrors WhatsAppShareButton's own message/href construction exactly. */
function buildWhatsAppHref(text: string, url: string): { message: string; href: string } {
  const message = `${text}\n\nFull route guide: ${url}`;
  return { message, href: `https://wa.me/?text=${encodeURIComponent(message)}` };
}

describe('WhatsApp share text stays synchronised with Route Status — Manchester to Mumbai withdrawal', () => {
  it('1. includes the withdrawal warning, attributed to the real airline and sourced from the same headline the Route Status panel renders', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, FIXED_TODAY);
    expect(presentation.shareText).toMatch(/IndiGo/);
    expect(presentation.shareText).toMatch(/withdrawal announced/i);
    expect(presentation.shareText).toMatch(/31 August 2026/);
  });

  it('2. does not merely say "has a direct option" without qualification — the withdrawal sentence follows it in the same message', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, FIXED_TODAY);
    expect(presentation.shareText).toMatch(/currently has a direct option\./);
    // The old, buggy message ended right after the direct-option clause
    // (plus a generic "compare prices" sentence) with no withdrawal
    // mention anywhere — assert the withdrawal sentence is genuinely
    // present alongside it, not just that some text follows.
    const directIndex = presentation.shareText.indexOf('currently has a direct option.');
    const withdrawalIndex = presentation.shareText.search(/withdrawal announced/i);
    expect(directIndex).toBeGreaterThanOrEqual(0);
    expect(withdrawalIndex).toBeGreaterThan(directIndex);
  });

  it('3. the route URL used to build the share link is correct for this route', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    const url = `${siteConfig.url}/routes/${route.slug}`;
    expect(url).toBe('https://jetstash.co.uk/routes/manchester-mumbai');
  });

  it('4. a normal verified direct route (no ledger event) still gets a concise, unaffected share message', () => {
    const route = getRouteBySlug('manchester-lahore')!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, FIXED_TODAY);
    expect(presentation.shareText).toBe(
      'Manchester to Lahore has a direct option — 8h. Compare current prices, confirm the exact schedule and check ticket conditions before booking.'
    );
    expect(presentation.shareText).not.toMatch(/withdraw/i);
  });

  it('5. a Verification Pending route keeps its short, claim-free uncertainty message — untouched by this fix', () => {
    // manchester-karachi was this fixture until COV-001 (21 August 2026)
    // reclassified it to verified-connecting — see
    // docs/project-control/ROUTE_VERIFICATION_CADENCE_POLICY.md, Batch 3.
    const route = getRouteBySlug('birmingham-ahmedabad')!;
    expect(route.verification?.status).toBe('unverified');
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, FIXED_TODAY);
    expect(presentation.status).toBe('unverified');
    expect(presentation.shareText).toMatch(/verification in progress/i);
    expect(presentation.shareText.length).toBeLessThan(120);
    expect(presentation.shareText).not.toMatch(/direct option/);
  });

  it('6. no HTML, internal source metadata or raw technical status codes leak into the message', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi', 'manchester-lahore', 'manchester-karachi']) {
      const route = getRouteBySlug(slug)!;
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, FIXED_TODAY);
      expect(presentation.shareText).not.toMatch(/[<>]/); // no HTML tags
      expect(presentation.shareText).not.toMatch(/https?:\/\//); // no embedded source/citation URLs
      expect(presentation.shareText).not.toContain('withdrawal-announced'); // raw enum form
      expect(presentation.shareText).not.toContain('verification-pending');
      expect(presentation.shareText).not.toContain('service-ended');
      expect(presentation.shareText).not.toMatch(/\bsourceUrl\b|\bverifiedDate\b|\breviewDueDate\b/);
    }
  });

  it('7. URL encoding for the WhatsApp share link remains correct — decodes back to the exact intended message', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, FIXED_TODAY);
    const url = `${siteConfig.url}/routes/${route.slug}`;
    const { message, href } = buildWhatsAppHref(presentation.shareText, url);
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    const decoded = decodeURIComponent(href.split('?text=')[1]);
    expect(decoded).toBe(message);
    expect(decoded).toContain('Full route guide: https://jetstash.co.uk/routes/manchester-mumbai');
    expect(decoded).toMatch(/IndiGo/);
    expect(decoded).toMatch(/withdrawal announced/i);
  });

  it('the second withdrawal-managed corridor (manchester-delhi) gets the same reusable treatment — this is not a one-off Manchester-Mumbai sentence', () => {
    const route = getRouteBySlug('manchester-delhi')!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, FIXED_TODAY);
    expect(presentation.shareText).toMatch(/IndiGo/);
    expect(presentation.shareText).toMatch(/withdrawal announced/i);
    expect(presentation.shareText).toMatch(/currently has a direct option\./);
  });

  it('a connecting route\'s share text is completely unaffected by this fix', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, FIXED_TODAY);
    expect(presentation.shareText).toBe(
      'Birmingham to Mumbai is a connecting route — no confirmed direct service currently exists. Compare total journey time, schedules and ticket conditions before booking.'
    );
  });
});
