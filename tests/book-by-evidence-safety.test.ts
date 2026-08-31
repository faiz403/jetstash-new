import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  computeBookBySnapshot,
  bookByHeadline,
  buildBookByShareText,
  getBookByDateLabel,
  getBookByTopLabel,
  BOOK_BY_PRIORITY_ROUTE_SLUGS,
  type BookBySnapshot,
} from '@/lib/booking-intelligence';
import { getBookingWindowsByRoute } from '@/data/booking-windows';
import { getRouteBySlug } from '@/data/routes';
import { routeTimelineEvents } from '@/data/route-timeline';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';
import { getActiveWarningsByRoute } from '@/data/route-warnings';
import { getTripComRouteUrl } from '@/lib/booking-providers';

/**
 * Evidence-safety regression suite (Book-By Countdown truth-and-trust
 * correction, August 2026). Book-By is conservative planning guidance, not
 * fare-prediction — this locks that in so it can't quietly regress back to
 * asserting a route-specific price forecast the fare archive can't support.
 *
 * Fixed dates only, per this repo's existing testing convention — no
 * `new Date()`/live network access.
 */

const BANNED_PATTERNS: RegExp[] = [
  /\bsharp(ly)?\b/i,
  /\bguarantee[ds]?\b/i,
  /\bno risk\b/i,
  /\balways cheapest\b/i,
  /\bbest price\b/i,
  /\blowest fare\b/i,
  /\bsafest\b/i,
];

function assertNoBannedPhrases(label: string, text: string) {
  for (const pattern of BANNED_PATTERNS) {
    expect(text, `${label} matched banned pattern ${pattern} — text was: "${text}"`).not.toMatch(pattern);
  }
}

// A spread of fixed dates chosen to land in every BookByState at least once
// across the 5 priority routes, reusing the same fixture technique as
// tests/booking-intelligence.test.ts.
const FIXED_DATES = [
  '2026-01-01T12:00:00Z',
  '2026-06-01T12:00:00Z',
  '2026-06-22T12:00:00Z',
  '2026-07-12T12:00:00Z',
  '2026-07-20T12:00:00Z',
  '2026-08-01T12:00:00Z',
  '2026-08-05T12:00:00Z',
];

describe('Book-By copy never overclaims price prediction or absolute safety', () => {
  const snapshots: BookBySnapshot[] = [];
  for (const routeSlug of BOOK_BY_PRIORITY_ROUTE_SLUGS) {
    for (const iso of FIXED_DATES) {
      const snap = computeBookBySnapshot(routeSlug, new Date(iso));
      if (snap) snapshots.push(snap);
    }
  }

  it('sanity: the fixture dates actually produce snapshots to test (archive/verification currency permitting)', () => {
    expect(snapshots.length).toBeGreaterThan(0);
  });

  it('sanity: the fixture dates cover more than one BookByState, so the assertions below are not accidentally testing one branch only', () => {
    const states = new Set(snapshots.map((s) => s.state));
    expect(states.size).toBeGreaterThan(1);
  });

  it('bookByHeadline() never uses a banned phrase, across every state hit by the fixtures', () => {
    for (const snap of snapshots) {
      assertNoBannedPhrases(`bookByHeadline(${snap.routeSlug}, ${snap.state})`, bookByHeadline(snap));
    }
  });

  it('buildBookByShareText() (the WhatsApp share message) never uses a banned phrase', () => {
    for (const snap of snapshots) {
      assertNoBannedPhrases(`buildBookByShareText(${snap.routeSlug}, ${snap.state})`, buildBookByShareText(snap));
    }
  });

  it('buildBookByShareText() explicitly labels itself planning guidance, not a fare prediction', () => {
    for (const snap of snapshots) {
      expect(buildBookByShareText(snap)).toMatch(/planning guidance, not a fare prediction/i);
    }
  });

  it('getBookByDateLabel()/getBookByTopLabel() never use a banned phrase, across every state hit by the fixtures', () => {
    for (const snap of snapshots) {
      assertNoBannedPhrases(`getBookByDateLabel(${snap.routeSlug})`, getBookByDateLabel(snap));
      assertNoBannedPhrases(`getBookByTopLabel(${snap.routeSlug})`, getBookByTopLabel(snap));
    }
  });

  it('a past surge-avoidance bookByDate reads as a typical-pattern label, never "Sharp rise began"', () => {
    const label = getBookByDateLabel({
      bookByDate: '2026-06-22',
      bookByBasis: 'surge-avoidance',
      computedForDate: '2026-07-12',
    });
    expect(label).toBe('Typical rise window began 22 June 2026');
    expect(label).not.toMatch(/sharp/i);
  });

  it('planning guidance remains useful: every headline is non-empty, and (with one deliberate, founder-approved exception) names the event and gives an actionable date or instruction', () => {
    for (const snap of snapshots) {
      const headline = bookByHeadline(snap);
      expect(headline.length).toBeGreaterThan(10);
      // Stale-advice fix (31 Aug 2026): a RANGED occurrence already
      // 'inside-period' deliberately uses a generic sentence with no event
      // name (see bookByHeadline's own doc comment) — periodLabel has no
      // stored grammatical number, so a name-specific sentence can't agree
      // its verb for every label without a pluralisation system this fix
      // isn't building. The event/range stays visible right next to the
      // headline (eyebrow line, "Why this advice?" disclosure), so this is
      // the one approved exception to "names the event" — every other state
      // is unaffected and still must contain periodLabel.
      const isGenericRangedInsidePeriod = snap.state === 'inside-period' && Boolean(snap.event.endDate);
      if (!isGenericRangedInsidePeriod) {
        expect(headline).toContain(snap.event.periodLabel);
      }
    }
  });

  it('fare observations stay separate from planning guidance: the headline text never embeds the observed price figure', () => {
    for (const snap of snapshots) {
      if (!snap.latestObservation) continue;
      const priceString = String(snap.latestObservation.price);
      expect(bookByHeadline(snap)).not.toContain(priceString);
    }
  });

  it('countdown maths is untouched by the copy correction: TR-001 fixture date still resolves to the same surge-avoidance state and date', () => {
    // Same fixture as tests/booking-intelligence.test.ts's TR-001 regression —
    // locks in that only strings changed here, not the state machine.
    const snapshot = computeBookBySnapshot('manchester-lahore', new Date('2026-07-12T12:00:00Z'));
    expect(snapshot).not.toBeNull();
    expect(snapshot!.state).toBe('surge');
    expect(snapshot!.bookByDate).toBe('2026-06-22');
    expect(snapshot!.bookByBasis).toBe('surge-avoidance');
  });
});

describe('data/booking-windows.ts guidance strings never overclaim', () => {
  const allWindows = BOOK_BY_PRIORITY_ROUTE_SLUGS.flatMap((slug) => getBookingWindowsByRoute(slug))
    // Also cover the two non-priority routes carrying structured windows
    // (birmingham-islamabad, manchester-karachi) — inert today behind
    // canShowBookingGuidance, but the guidance strings must be safe
    // regardless, so they can't leak an unsafe claim if verification flips.
    .concat(getBookingWindowsByRoute('birmingham-islamabad'))
    .concat(getBookingWindowsByRoute('manchester-karachi'));

  it('sanity: there is real guidance data to check', () => {
    expect(allWindows.length).toBeGreaterThan(0);
  });

  it('no structured booking-window guidance string uses a banned phrase', () => {
    for (const w of allWindows) {
      assertNoBannedPhrases(`bookingWindows[${w.id}].guidance`, w.guidance);
    }
  });
});

describe('data/routes.ts bookingWindowNote and intro text for the 6 soft-launch + QA routes never overclaim', () => {
  const routeSlugs = [
    'manchester-lahore',
    'manchester-islamabad',
    'manchester-dubai',
    'manchester-doha',
    'manchester-madinah',
    'manchester-delhi',
    'manchester-mumbai',
    'manchester-amritsar',
    'birmingham-amritsar',
    'london-heathrow-delhi',
    'london-heathrow-jeddah',
  ];

  it('sanity: every route slug under test actually resolves to real route data', () => {
    for (const slug of routeSlugs) {
      expect(getRouteBySlug(slug), slug).toBeDefined();
    }
  });

  it('no bookingWindowNote or intro on these routes uses a banned phrase', () => {
    for (const slug of routeSlugs) {
      const route = getRouteBySlug(slug)!;
      assertNoBannedPhrases(`${slug}.intro`, route.intro);
      assertNoBannedPhrases(`${slug}.bookingWindowNote`, route.bookingWindowNote);
    }
  });

  it('the two "fastest option" route intros no longer claim market-wide certainty ("most consistently quoted" / "fastest realistic")', () => {
    expect(getRouteBySlug('manchester-amritsar')!.intro).not.toMatch(/most consistently quoted/i);
    expect(getRouteBySlug('manchester-madinah')!.intro).not.toMatch(/fastest realistic/i);
  });

  it('the Manchester–Lahore intro no longer makes an absolute "no risk" baggage claim', () => {
    expect(getRouteBySlug('manchester-lahore')!.intro).not.toMatch(/no risk of/i);
  });

  it('Stale-tense fix (31 Aug 2026): the Manchester–Mumbai intro no longer makes an unintended present-tense "remains the only non-stop link" claim about its July 2025 launch', () => {
    const intro = getRouteBySlug('manchester-mumbai')!.intro;
    expect(intro).not.toMatch(/remains the only non-stop link/i);
    expect(intro).toMatch(/at the time/i);
  });
});

describe('Stale-tense fix (31 Aug 2026): data/route-timeline.ts\'s Manchester–Mumbai launch entry', () => {
  it('no longer makes an unintended present-tense "remains" claim about a 2025 launch', () => {
    const entry = routeTimelineEvents.find((e) => e.id === 'man-bom-2025-launch')!;
    expect(entry).toBeDefined();
    expect(entry.description).not.toMatch(/remains the only non-stop link/i);
    expect(entry.description).toMatch(/at the time/i);
  });
});

describe('sitewide "peak demand periods" panel copy (app/routes/[slug]/page.tsx) never overclaims', () => {
  const pageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');

  it('the rendered peak-period disclaimer text is free of banned phrases and states planning guidance explicitly', () => {
    const match = pageSrc.match(/Demand — and often price[^<]*Planning guidance, not a fare prediction\./);
    expect(match, 'expected the softened peak-period disclaimer sentence to be present verbatim').not.toBeNull();
    if (match) assertNoBannedPhrases('peak-period panel copy', match[0]);
  });
});

describe('components/route/book-by-countdown.tsx and booking-moment-strip.tsx source text never overclaims', () => {
  const countdownSrc = readFileSync(join(process.cwd(), 'components/route/book-by-countdown.tsx'), 'utf8');
  const stripSrc = readFileSync(join(process.cwd(), 'components/sections/booking-moment-strip.tsx'), 'utf8');

  it('book-by-countdown.tsx contains no banned phrase anywhere in its rendered copy', () => {
    assertNoBannedPhrases('book-by-countdown.tsx', countdownSrc);
  });

  it('book-by-countdown.tsx footer disclaimer explicitly frames the panel as planning guidance, not a fare prediction', () => {
    expect(countdownSrc).toMatch(/Planning guidance, not a fare prediction/);
  });

  it('booking-moment-strip.tsx contains no banned phrase anywhere in its rendered copy', () => {
    assertNoBannedPhrases('booking-moment-strip.tsx', stripSrc);
  });

  it('Stale-urgency badge fix (31 Aug 2026, part 2): the panel still contains its urgency-badge suppression guard for a ranged occurrence already inside its own window — a structural safety net (no render harness in this project) so this can\'t silently regress', () => {
    expect(countdownSrc).toMatch(/suppressUrgencyBadge/);
    expect(countdownSrc).toMatch(/verdict && !suppressUrgencyBadge/);
  });
});

describe('app/business-class/page.tsx no longer makes an absolute "no risk" claim', () => {
  const src = readFileSync(join(process.cwd(), 'app/business-class/page.tsx'), 'utf8');

  it('the direct-sectors paragraph is free of banned phrases', () => {
    assertNoBannedPhrases('business-class/page.tsx', src);
  });
});

describe('unaffected surfaces: route warnings, verification states, Trip.com links and analytics event names are unchanged by this copy-only pass', () => {
  it('withdrawal/route warnings remain visible: Birmingham–Amritsar\'s reduced-frequency warning is still active', () => {
    const active = getActiveWarningsByRoute('birmingham-amritsar');
    expect(active.some((w) => w.id === 'bhx-atq-reduced-frequency')).toBe(true);
  });

  it('route verification/status presentation is untouched: Manchester–Lahore is still presented as verified-direct at a fixed pre-review date', () => {
    const route = getRouteBySlug('manchester-lahore')!;
    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, '2026-07-20');
    expect(presentation.status).toBe('direct');
    expect(presentation.canShowBookingGuidance).toBe(true);
  });

  it('Trip.com CTA links are untouched: Manchester–Lahore still resolves to a real Trip.com URL', () => {
    const url = getTripComRouteUrl('manchester-lahore');
    expect(url).toBeTruthy();
    expect(url).toMatch(/^https:\/\//);
  });

  it('analytics event names on the Book-By panel are untouched', () => {
    const countdownSrc = readFileSync(join(process.cwd(), 'components/route/book-by-countdown.tsx'), 'utf8');
    expect(countdownSrc).toContain("track('bookby_panel_view'");
    expect(countdownSrc).toContain("track('bookby_watch_click'");
    expect(countdownSrc).toContain("track('bookby_cta_click'");
  });
});
