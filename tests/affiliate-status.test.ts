import { describe, expect, it } from 'vitest';

import { getFounderSnapshot } from '@/lib/founder-insights';

describe('affiliate-status founder guidance', () => {
  it('reports the enabled TravelUp deep-link configuration without asking the founder to enable it again', () => {
    const snapshot = getFounderSnapshot(new Date('2026-07-24T12:00:00.000Z'));
    const affiliate = snapshot.grouped.revenue.find((section) => section.id === 'affiliate');

    expect(affiliate).toBeDefined();
    expect(affiliate?.status).toBe('ok');
    expect(affiliate?.headline).toContain('tracked and deep-linking to manually verified destination pages');
    expect(affiliate?.action).toContain('Maintain the verified TravelUp destination map');
    expect(affiliate?.action).not.toContain('flip supportsDeepLink to true');
  });
});
