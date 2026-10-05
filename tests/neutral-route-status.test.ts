import { describe, expect, it } from 'vitest';
import { getRouteBySlug, getRoutePresentation, getDisplayDirectness } from '@/data/routes';
import { getFareRangeSummary } from '@/data/fare-observations';

const TODAY = '2026-10-05';

describe('neutral verified route status', () => {
  it('renders LHR–Dhaka as service confirmed without implying directness', () => {
    const route = getRouteBySlug('london-heathrow-dhaka')!;
    const presentation = getRoutePresentation(route, TODAY);
    expect(getDisplayDirectness(route, TODAY)).toBe('unspecified');
    expect(presentation.status).toBe('unspecified');
    expect(presentation.statusLabel).toBe('Service confirmed');
    expect(presentation.summary.toLowerCase()).not.toMatch(/nonstop|direct/);
    expect((presentation.frequency ?? '').toLowerCase()).not.toMatch(/daily|weekly/);
    expect(getFareRangeSummary(route.slug, 'Economy', TODAY)).not.toBeNull();
  });

  it('renders MAN–FCO as neutral route information and preserves exact-airport fare evidence', () => {
    const route = getRouteBySlug('manchester-rome')!;
    const presentation = getRoutePresentation(route, TODAY);
    expect(getDisplayDirectness(route, TODAY)).toBe('unspecified');
    expect(presentation.statusLabel).toBe('Service confirmed');
    expect(presentation.summary).toMatch(/Rome\/FCO/);
    expect(presentation.summary.toLowerCase()).not.toMatch(/cia|rom metropolitan|nonstop|direct/);
    expect(getFareRangeSummary(route.slug, 'Economy', TODAY)).not.toBeNull();
  });

  it('keeps legacy routes on their existing direct/connecting states', () => {
    expect(getDisplayDirectness(getRouteBySlug('manchester-islamabad')!, TODAY)).toBe('direct');
    expect(getDisplayDirectness(getRouteBySlug('manchester-karachi')!, TODAY)).toBe('connecting');
  });
});
