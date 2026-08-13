import { describe, expect, it } from 'vitest';

import { getFounderSnapshot } from '@/lib/founder-insights';

describe('affiliate-status founder guidance', () => {
  it('reports Trip.com as the sole active provider, with honest route coverage numbers', () => {
    const snapshot = getFounderSnapshot(new Date('2026-08-04T12:00:00.000Z'));
    const affiliate = snapshot.grouped.revenue.find((section) => section.id === 'affiliate');

    expect(affiliate).toBeDefined();
    expect(affiliate?.status).toBe('ok');
    expect(affiliate?.headline).toContain('Trip.com is the sole active provider');
    // 45 of 88, not 45 of 80/82 — the count is live-computed in lib/founder-insights.ts;
    // the denominator moved after the Final Route-Guide Completion batch's two evidence passes.
    expect(affiliate?.headline).toContain('45 of 88');
    expect(affiliate?.headline).not.toMatch(/TravelUp is/i);
    expect(affiliate?.action).not.toContain('travelup.com');
  });
});
