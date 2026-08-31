import { describe, it, expect } from 'vitest';
import { getActiveWarningsByRoute, getWarningsByRoute } from '@/data/route-warnings';
import { getRouteBySlug } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';

/**
 * Route-warning truth alignment (31 Aug 2026, User 4 real-user validation
 * follow-up). Three "Runs 3 times a week, not daily" warnings
 * (bhx-atq-reduced-frequency, lgw-atq-reduced-frequency,
 * lgw-amd-reduced-frequency) asserted a specific numeric frequency with no
 * source, predating a later route-truth correction that deliberately
 * hedged each route's own frequency field (or, for LGW-AMD, marked the
 * route outright unverified). Marked resolved rather than deleted, per
 * data/route-warnings.ts's own "never delete a resolved warning" rule — see
 * that file's own comment for the full reasoning.
 *
 * Fixed reference date used throughout: today's real date, since these are
 * live-data structural checks (route/warning records), not a
 * historical-fact test — matches this suite's existing convention.
 */
const NOW_ISO = new Date().toISOString().slice(0, 10);

describe('Route-warning truth alignment: the three unsourced "3 times a week" warnings no longer publicly render', () => {
  it('1. Birmingham–Amritsar no longer exposes bhx-atq-reduced-frequency as an active warning', () => {
    const active = getActiveWarningsByRoute('birmingham-amritsar');
    expect(active.some((w) => w.id === 'bhx-atq-reduced-frequency')).toBe(false);
    // Preserved as history, per this file's own append-only rule.
    const all = getWarningsByRoute('birmingham-amritsar');
    const resolved = all.find((w) => w.id === 'bhx-atq-reduced-frequency');
    expect(resolved).toBeDefined();
    expect(resolved!.status).toBe('resolved');
  });

  it('2. London Gatwick–Amritsar no longer exposes lgw-atq-reduced-frequency as an active warning', () => {
    const active = getActiveWarningsByRoute('london-gatwick-amritsar');
    expect(active.some((w) => w.id === 'lgw-atq-reduced-frequency')).toBe(false);
    const resolved = getWarningsByRoute('london-gatwick-amritsar').find((w) => w.id === 'lgw-atq-reduced-frequency');
    expect(resolved).toBeDefined();
    expect(resolved!.status).toBe('resolved');
  });

  it('3. London Gatwick–Ahmedabad no longer exposes lgw-amd-reduced-frequency as an active warning', () => {
    const active = getActiveWarningsByRoute('london-gatwick-ahmedabad');
    expect(active.some((w) => w.id === 'lgw-amd-reduced-frequency')).toBe(false);
    const resolved = getWarningsByRoute('london-gatwick-ahmedabad').find((w) => w.id === 'lgw-amd-reduced-frequency');
    expect(resolved).toBeDefined();
    expect(resolved!.status).toBe('resolved');
  });

  it('4a. Birmingham–Amritsar\'s supported route presentation (hedged frequency, connecting status) is completely unchanged', () => {
    const route = getRouteBySlug('birmingham-amritsar')!;
    expect(route.frequency).toBe('Connection options available; exact schedule varies');
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
    expect(presentation.status).toBe('connecting');
  });

  it('4b. London Gatwick–Amritsar\'s supported route presentation (hedged frequency, direct status) is completely unchanged', () => {
    const route = getRouteBySlug('london-gatwick-amritsar')!;
    expect(route.frequency).toBe('Non-stop service shown by Air India; exact operating days vary');
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
    expect(presentation.status).toBe('direct');
  });

  it('4c. London Gatwick–Ahmedabad\'s supported route presentation (unverified/disputed) is completely unchanged — no replacement frequency claim was invented', () => {
    const route = getRouteBySlug('london-gatwick-ahmedabad')!;
    expect(route.verification?.status).toBe('unverified');
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
    expect(presentation.status).toBe('unverified');
    expect(presentation.flightTime).toBeNull();
    expect(presentation.frequency).toBeNull();
  });

  it('5. unrelated route warnings are completely unaffected — Leeds Bradford–Islamabad\'s unrelated critical warning still renders normally', () => {
    const active = getActiveWarningsByRoute('leeds-bradford-islamabad');
    expect(active.some((w) => w.id === 'lba-isb-unstable-direct-claims')).toBe(true);
  });

  it('no replacement factual frequency claim was invented for any of the three resolved warnings', () => {
    for (const id of ['bhx-atq-reduced-frequency', 'lgw-atq-reduced-frequency', 'lgw-amd-reduced-frequency']) {
      const warning = [
        ...getWarningsByRoute('birmingham-amritsar'),
        ...getWarningsByRoute('london-gatwick-amritsar'),
        ...getWarningsByRoute('london-gatwick-ahmedabad'),
      ].find((w) => w.id === id)!;
      // The original wording is preserved verbatim (history, not rewritten)
      // — it just no longer counts as active/public.
      expect(warning.title).toBe('Runs 3 times a week, not daily');
    }
  });
});
