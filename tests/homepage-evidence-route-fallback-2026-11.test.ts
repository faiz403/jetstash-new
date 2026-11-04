import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

/**
 * Homepage example: the route-finding fallback (3 November 2026). With real data the 3 November sweep now replaces the expired
 * Manchester-Islamabad fare the same day, so no real date exercises the "verified route, no fare" card any more. This suite isolates
 * that state by stubbing the Fare Signal to "none", so the fallback stays tested whatever fares are later appended.
 */
vi.mock('@/lib/fare-signal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/fare-signal')>();
  return {
    ...actual,
    getFareSignalForRoute: () => ({ state: 'none', observation: null, freshness: null, strongerSignal: null, noneReason: null }),
  };
});

const { getHomepageEvidenceExample } = await import('@/lib/homepage-evidence');
const { HomepageEvidenceCard } = await import('@/components/homepage-v2/homepage-evidence-card');

describe('homepage example without a current fare', () => {
  it('falls back to the verified direct route finding, with its own check date and no price', () => {
    const example = getHomepageEvidenceExample('2026-11-03');
    expect(example?.kind).toBe('route');
    if (example?.kind !== 'route') return;
    expect(example.route.routeIsDirect).toBe(true);
    expect(example.route.verifiedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const html = renderToStaticMarkup(createElement(HomepageEvidenceCard, { example }));
    expect(html).not.toContain('£');
    expect(html).toContain('service checked');
  });

  it('shows nothing once the route\'s own verification has lapsed, rather than a stale finding', () => {
    expect(getHomepageEvidenceExample('2026-12-04')).toBeNull();
  });
});
