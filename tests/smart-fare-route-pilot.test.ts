import { describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SmartFareComparison, SmartFareOptionCard } from '@/components/route/smart-fare-comparison';
import { getSmartFareComparisonForRoute } from '@/lib/smart-fare-route-adapter';

function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectStrings(child, out));
    return out;
  }
  if (isValidElement(node)) {
    const children = (node.props as { children?: unknown } | null)?.children;
    if (children !== undefined) collectStrings(children, out);
  }
  return out;
}

const routePageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');

describe('Smart Fare Comparison Manchester–Islamabad pilot', () => {
  const comparison = getSmartFareComparisonForRoute('manchester-islamabad', '2026-08-11')!;

  it('selects only the two explicitly current Turkish observations', () => {
    expect(comparison.options).toHaveLength(2);
    expect(comparison.options.map((option) => option.id)).toEqual([
      'obs-man-isb-economy-20260810-tk-621-v1',
      'obs-man-isb-economy-20260810-tk-626-v1',
    ]);
    expect(comparison.options.map((option) => option.price)).toEqual([621, 626]);
    expect(comparison.options.every((option) => option.id.includes('tk-'))).toBe(true);
    expect(comparison.totalCostComparisonReady).toBe(false);
  });

  it('renders factual journey differences and keeps baggage unknown', () => {
    const text = collectStrings([
      SmartFareComparison({
      comparison,
      routeLabel: 'Manchester to Islamabad',
      }),
      ...comparison.options.map((option) => SmartFareOptionCard({ option })),
    ]).join(' ').replace(/\s+/g, ' ');

    expect(text).toMatch(/£\s*621/);
    expect(text).toMatch(/£\s*626/);
    expect(text).toContain('24h 10m total journey');
    expect(text).toContain('21h 25m total journey');
    expect(text).toContain('1 stop each way');
    expect(text).toContain('Via Istanbul Airport (IST) and Istanbul (IST)');
    expect(text).toContain('Checked baggage: extra charge, amount not shown');
    expect(text).toContain('£5 more saves 2h 45m of total journey time.');
    expect(text).toContain('Checked-baggage pricing was not disclosed, so this is not a complete trip-cost comparison.');
    expect(text).not.toMatch(/£0/);
    expect(text).not.toMatch(/\b(best|cheapest|better value|worth it|recommended|savings)\b/i);
  });

  it('keeps True Trip Cost out of the pilot route page when evidence is insufficient', () => {
    const fareSectionIndex = routePageSrc.indexOf('{fareSectionCopy.heading}');
    const smartIndex = routePageSrc.indexOf('<SmartFareComparison');
    const historyIndex = routePageSrc.indexOf('<FareHistoryPanel');
    expect(smartIndex).toBeGreaterThan(fareSectionIndex);
    expect(smartIndex).toBeLessThan(historyIndex);
    expect(routePageSrc).toContain('getSmartFareComparisonForRoute(route.slug, nowIso)');
    expect(routePageSrc).not.toContain('deriveTripValueVerdict');
    expect(routePageSrc).not.toContain('True Trip Cost');
    expect(routePageSrc).not.toContain('Value Verdict');
  });

  it('returns no pilot comparison for routes without explicitly current option metadata', () => {
    expect(getSmartFareComparisonForRoute('manchester-lahore', '2026-08-11')).toBeNull();
  });
});
