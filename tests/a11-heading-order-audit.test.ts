import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Two heading-hierarchy skips (WCAG 1.3.1) found in the 6 September 2026
 * public launch QA audit, both reproduced live in production before this fix:
 *
 *  1. /airports — the page's only H1 (inside PageHero) was followed
 *     directly by an <h3> for every airport-card title, with no <h2>
 *     anywhere on the page. Fixed by promoting the card title to <h2> —
 *     each airport card is its own top-level entry directly under the
 *     page's H1, matching the page's actual structure (a flat grid with no
 *     other section heading), rather than inventing a visible section
 *     heading the page doesn't otherwise need.
 *  2. BookingWindowPanel (rendered on the route page under whichever H2 the
 *     parent renders — "The evidence behind that guidance" or "When to book
 *     this route") rendered each scenario card's title as <h4>, skipping
 *     <h3>. Fixed by changing it to <h3>. This component also renders on
 *     manchester-islamabad's route page (one of the five
 *     BOOK_BY_PRIORITY_ROUTE_SLUGS) — this is a shared-component semantic
 *     fix only, not a Journey Choice/Fare Signal/Standout Fare change.
 *
 * Both source files are plain functions with no hooks, but this repo has no
 * testing-library/jsdom setup, so — matching the established convention
 * (tests/a11-atlas-corrections.test.ts) — these are source-text regression
 * assertions on the real component files, not a rendered DOM.
 */

const airportsPageSrc = readFileSync(join(process.cwd(), 'app/airports/page.tsx'), 'utf8');
const bookingWindowPanelSrc = readFileSync(join(process.cwd(), 'components/route/booking-window-panel.tsx'), 'utf8');

describe('1. /airports — no H1 -> H3 skip', () => {
  it('the airport-card title is now h2, not h3', () => {
    expect(airportsPageSrc).toMatch(/<h2 className="font-display text-2xl text-ink-900">\{airport\.name\}<\/h2>/);
    expect(airportsPageSrc).not.toMatch(/<h3[^>]*>\{airport\.name\}<\/h3>/);
  });

  it('the page still has exactly one heading level between the hero H1 and the card grid (h2 only, no orphaned h3/h4/etc. introduced)', () => {
    const headingTags = [...airportsPageSrc.matchAll(/<h([1-6])[ >]/g)].map((m) => m[1]);
    // PageHero renders the page's own <h1> internally (not in this file's
    // source), so this file's own heading tags should be h2 only.
    expect(new Set(headingTags)).toEqual(new Set(['2']));
  });

  it('no copy, class, or layout changed alongside the heading-tag fix', () => {
    expect(airportsPageSrc).toContain('className="font-display text-2xl text-ink-900"');
    expect(airportsPageSrc).toContain('View routes');
    expect(airportsPageSrc).toContain('Direct long-haul');
  });
});

describe('2. BookingWindowPanel — child headings are h3 beneath the section h2, not h4', () => {
  it('the scenario-card title is now h3, not h4', () => {
    expect(bookingWindowPanelSrc).toMatch(/<h3 className="mt-2 font-display text-base text-ink-900">\{window\.label\}<\/h3>/);
    expect(bookingWindowPanelSrc).not.toMatch(/<h4[^>]*>\{window\.label\}<\/h4>/);
  });

  it('no other heading level was introduced in this file', () => {
    const headingTags = [...bookingWindowPanelSrc.matchAll(/<h([1-6])[ >]/g)].map((m) => m[1]);
    expect(new Set(headingTags)).toEqual(new Set(['3']));
  });

  it('no copy, class, styling, or the empty-windows early return changed alongside the heading-tag fix', () => {
    expect(bookingWindowPanelSrc).toContain('className="mt-2 font-display text-base text-ink-900"');
    expect(bookingWindowPanelSrc).toContain('if (windows.length === 0) return null;');
    expect(bookingWindowPanelSrc).toContain('{window.guidance}');
    expect(bookingWindowPanelSrc).toContain('{formatWeeks(window.weeksBeforeDeparture)}');
  });

  it('renders on manchester-islamabad\'s route page only as shared semantic HTML — no experiment-specific logic exists in this file', () => {
    expect(bookingWindowPanelSrc).not.toMatch(/manchester-islamabad|journeyChoice|fareSignal|standoutFare|tripcom|trip\.com/i);
  });
});
