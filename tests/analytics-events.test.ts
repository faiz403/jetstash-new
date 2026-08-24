import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Direct unit coverage for lib/analytics.ts's track() — the one function
 * every analytics event in this codebase goes through — plus a regression
 * guard that the typed AnalyticsEvent union stays exactly in sync with
 * every event name actually fired anywhere in the app. See
 * tests/conversion-analytics.test.ts and
 * tests/atlas-journey-check-analytics.test.ts for the new call sites this
 * PR wires up.
 */

const mocks = vi.hoisted(() => ({ vercelTrack: vi.fn() }));

vi.mock('@vercel/analytics', () => ({ track: mocks.vercelTrack }));

import { track } from '@/lib/analytics';

describe('track()', () => {
  afterEach(() => {
    mocks.vercelTrack.mockReset();
  });

  it('passes the event name straight through to Vercel Web Analytics, with no properties', () => {
    track('contact_submit_success');
    expect(mocks.vercelTrack).toHaveBeenCalledOnce();
    expect(mocks.vercelTrack).toHaveBeenCalledWith('contact_submit_success', undefined);
  });

  it('passes properties through unchanged', () => {
    track('atlas_origin_selected', { airport: 'manchester' });
    expect(mocks.vercelTrack).toHaveBeenCalledWith('atlas_origin_selected', { airport: 'manchester' });
  });

  it('never throws, even when the vendor call itself throws (must never break the page it measures)', () => {
    mocks.vercelTrack.mockImplementationOnce(() => {
      throw new Error('vendor blew up');
    });
    expect(() => track('contact_submit_success')).not.toThrow();
  });

  it('produces no unhandled promise rejection and no console noise when the vendor call throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.vercelTrack.mockImplementationOnce(() => {
      throw new Error('vendor blew up');
    });
    track('contact_submit_success');
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('is a synchronous void call — nothing in the caller has to await it or handle a rejected promise', () => {
    const result = track('contact_submit_success');
    expect(result).toBeUndefined();
  });
});

describe('AnalyticsEvent vocabulary — every event this repo actually fires is typed, nothing stale', () => {
  const analyticsSrc = readFileSync(join(process.cwd(), 'lib/analytics.ts'), 'utf8');

  // Pre-existing events (unchanged by this PR — confirmed via repo-wide grep
  // before any edit was made).
  const EXISTING_EVENTS = [
    'bookby_panel_view',
    'bookby_cta_click',
    'bookby_watch_click',
    'whatsapp_share_click',
    'travel_ready_check_started',
    'travel_ready_check_completed',
    'travel_ready_check_verdict',
    'ready_check_source_click',
    'ready_check_book_cta_click',
    'ready_check_watch_click',
    'route_watch_signup',
    'journey_brief_started',
    'journey_brief_live_price_click',
    'tripcom_click',
  ];

  // New in this PR — the 3 conversion events + 6 engagement events from the brief.
  const NEW_EVENTS = [
    'contact_submit_success',
    'quote_request_submit_success',
    'newsletter_subscribe_success',
    'atlas_origin_selected',
    'atlas_destination_selected',
    'atlas_route_opened',
    'journey_check_started',
    'journey_check_completed',
    'journey_check_route_opened',
  ];

  // Added later, by the CJ baggage affiliate CTA on Travel Ready Check
  // (August 2026) — kept in its own list rather than folded into
  // NEW_EVENTS above so that array's "brief" provenance comment stays
  // accurate.
  const BAGGAGE_CTA_EVENTS = ['ready_check_baggage_cta_click'];

  // Added later still, by Google Ads conversion tracking (August 2026):
  // the missing Trip.com hotel-click event, wired on the Antalya Holiday
  // Intelligence hotel CTAs (components/destination/antalya-holiday-intelligence.tsx)
  // to keep it distinct from tripcom_click's flight handoffs.
  const GOOGLE_ADS_TRACKING_EVENTS = ['tripcom_hotel_click'];

  // Added later still, by the generic Journey Decision Brief founder-only
  // MVP (August 2026, lib/journey-decision-brief.ts +
  // components/journey-brief/journey-decision-brief.tsx) — deliberately
  // separate from journey_brief_started/journey_brief_live_price_click
  // above, which belong to the older Manchester-Mumbai route-specific
  // prototype this MVP does not build on.
  const JOURNEY_DECISION_BRIEF_EVENTS = ['journey_decision_brief_started', 'journey_decision_brief_completed'];

  // Added later still, by Journey Choice — the one-route MVP pilot
  // (manchester-islamabad only, 24 Aug 2026, PR #173): the evidence
  // disclosure open and the Trip.com CTA click, both scoped to
  // components/route/journey-choice.tsx.
  const JOURNEY_CHOICE_EVENTS = ['journey_choice_evidence_opened', 'journey_choice_cta_click'];

  it.each([...EXISTING_EVENTS, ...NEW_EVENTS, ...BAGGAGE_CTA_EVENTS, ...GOOGLE_ADS_TRACKING_EVENTS, ...JOURNEY_DECISION_BRIEF_EVENTS, ...JOURNEY_CHOICE_EVENTS])('%s is part of the typed AnalyticsEvent union', (eventName) => {
    expect(analyticsSrc).toMatch(new RegExp(`\\| '${eventName}'`));
  });

  it('has exactly one union member per real event — no stragglers, nothing forgotten', () => {
    const matches = analyticsSrc.match(/\n\s*\| '[a-z_]+'/g) ?? [];
    expect(matches).toHaveLength(
      EXISTING_EVENTS.length + NEW_EVENTS.length + BAGGAGE_CTA_EVENTS.length + GOOGLE_ADS_TRACKING_EVENTS.length + JOURNEY_DECISION_BRIEF_EVENTS.length + JOURNEY_CHOICE_EVENTS.length,
    );
  });

  it("track()'s event parameter is typed as AnalyticsEvent, not a bare string — a typo at any call site is a compile error, not a silently-dropped event", () => {
    expect(analyticsSrc).toMatch(/export function track\(event: AnalyticsEvent,/);
    expect(analyticsSrc).not.toMatch(/export function track\(event: string,/);
  });

  it('TrackedOutboundLink also uses the typed vocabulary, not a bare string', () => {
    const src = readFileSync(join(process.cwd(), 'components/ui/tracked-outbound-link.tsx'), 'utf8');
    expect(src).toContain("import { track, type AnalyticsEvent } from '@/lib/analytics'");
    expect(src).toMatch(/event: AnalyticsEvent;/);
  });
});
