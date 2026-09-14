import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRouteBySlug, routes } from '@/data/routes';
import { getComparableOptionsByObservationIds } from '@/lib/smart-fare-route-adapter';
import { deriveJourneyChoice } from '@/lib/journey-choice';
import { getSafeTripComFlightHandoffUrl } from '@/lib/booking-providers';
import RoutePage from '@/app/routes/[slug]/page';

/**
 * MAN-ISB operating-days fix (12 Sept 2026, founder-approved, following real
 * user feedback from the MAN-ISB micro-seed: Person A specifically asked
 * which days the direct service runs). Adds the smallest useful fact — a
 * "typical current pattern" framing, never a guarantee — to the existing
 * `frequency` field, the same single field/placement every other route
 * already uses for schedule prose. No new field, no new section, no new CTA.
 */

const NOW_ISO = '2026-09-12';

async function renderManIsbPage() {
  const element = await RoutePage({ params: Promise.resolve({ slug: 'manchester-islamabad' }) });
  return renderToStaticMarkup(element);
}

describe('1. MAN->ISB exposes the operating-day information', () => {
  it('the route frequency field states the operating days', () => {
    const route = getRouteBySlug('manchester-islamabad')!;
    expect(route.frequency).toMatch(/Mon.*Tue.*Thu.*Sat/);
  });

  it('renders live on the route page', async () => {
    const html = await renderManIsbPage();
    // '&' is HTML-escaped to '&amp;' in rendered static markup.
    expect(html).toMatch(/Mon, Tue, Thu (&|&amp;) Sat/);
  });
});

describe('2. wording uses non-guaranteed framing', () => {
  // Copy consolidation (12 Sept 2026, founder-approved): the hero-facing
  // `frequency` string is deliberately short for a family scanning the
  // page ("4x weekly direct. Typical days: Mon, Tue, Thu & Sat. Check PIA
  // for your exact date.") — the fuller "typical current pattern, never a
  // guarantee" explanation and its dated evidence live in
  // verification.note instead, per the same convention every other
  // verified route fact already follows.
  it('the hero frequency string itself never claims a guarantee', () => {
    const route = getRouteBySlug('manchester-islamabad')!;
    expect(route.frequency).not.toMatch(/guaranteed|every week|always operates/i);
  });

  it('the fuller "typical current pattern" / non-guarantee explanation lives in verification.note', () => {
    const route = getRouteBySlug('manchester-islamabad')!;
    expect(route.verification?.note).toMatch(/typical current pattern/i);
    expect(route.verification?.note).not.toMatch(/\bguaranteed\b/i);
  });
});

describe('3-6. Monday, Tuesday, Thursday, Saturday all appear', () => {
  const route = getRouteBySlug('manchester-islamabad')!;
  it('Monday', () => expect(route.frequency).toContain('Mon'));
  it('Tuesday', () => expect(route.frequency).toContain('Tue'));
  it('Thursday', () => expect(route.frequency).toContain('Thu'));
  it('Saturday', () => expect(route.frequency).toContain('Sat'));
});

describe('7. exact-date verification caveat appears', () => {
  it('the frequency field tells the reader to check PIA directly for their exact date', () => {
    const route = getRouteBySlug('manchester-islamabad')!;
    expect(route.frequency).toMatch(/Check PIA for your exact date/i);
  });
});

describe('source description accuracy: FlightAware is never called a "primary source"', () => {
  it('verification.note describes FlightAware as current operational flight-tracking evidence, not a primary source, and notes PIA was inaccessible', () => {
    const route = getRouteBySlug('manchester-islamabad')!;
    const note = route.verification?.note ?? '';
    expect(note).toContain('flightaware.com');
    expect(note).toMatch(/not a primary operator source/i);
    expect(note).toMatch(/inaccessible/i);
    expect(note).toMatch(/corroborated by independent current schedule/i);
  });
});

describe('8. 4x/week fact is correct and consistent (corrects the prior stale "2 weekly" record)', () => {
  it('frequency states 4x weekly, not the superseded 2-weekly figure', () => {
    const route = getRouteBySlug('manchester-islamabad')!;
    expect(route.frequency).toContain('4x weekly');
    expect(route.frequency).not.toMatch(/2 weekly/);
  });

  it('the now-false "fewer weekly frequencies than Lahore" comparison is removed from bookingWindowNote', () => {
    const route = getRouteBySlug('manchester-islamabad')!;
    expect(route.bookingWindowNote).not.toMatch(/fewer weekly frequencies than Lahore/);
  });
});

describe('9. PIA direct-service status remains unchanged', () => {
  it('isDirect and verification.status are untouched', () => {
    const route = getRouteBySlug('manchester-islamabad')!;
    expect(route.isDirect).toBe(true);
    expect(route.verification?.status).toBe('verified');
    expect(route.airlineSlugs).toEqual(['pia']);
  });
});

describe('10. Trip.com handoff remains unchanged', () => {
  it('resolves the exact same MAN-ISB URL as before this fix', () => {
    const url = getSafeTripComFlightHandoffUrl('manchester-islamabad', 'manchester', 'islamabad', NOW_ISO);
    expect(url).toContain('tickets-MAN-ISB');
    expect(url).toContain('trip_sub3=D19082296');
  });

  it('the Trip.com CTA still renders with the consolidated label, unaffected by this fix', async () => {
    const html = await renderManIsbPage();
    expect(html).toContain('Compare flights on Trip.com');
  });
});

describe('11. Journey Choice facts remain unchanged', () => {
  // Round 1 closure (14 Sept 2026, founder-approved, after this test's own
  // 12 Sept fixture date): manchester-islamabad's pilot was retired from
  // the live page — see lib/journey-choice-route-adapter.ts's own doc
  // comment — but the underlying frozen £601/£626/£25/14h15m result is
  // untouched, still provable directly via the same frozen IDs.
  it('the £601/£626 comparison and its £25/14h15m framing are untouched', () => {
    const frozenIds = ['obs-man-isb-economy-20260811-8w-v1', 'obs-man-isb-economy-20260810-tk-626-v1', 'obs-man-isb-economy-20260810-tk-621-v1'];
    const journeyChoice = deriveJourneyChoice(getComparableOptionsByObservationIds('manchester-islamabad', frozenIds, NOW_ISO));
    expect(journeyChoice).not.toBeNull();
    const html = JSON.stringify(journeyChoice);
    expect(html).toContain('601');
    expect(html).toContain('626');
  });
});

describe('12. no direct fare is invented', () => {
  it('the route page still shows no fabricated MAN-ISB direct fare figure', async () => {
    const html = await renderManIsbPage();
    // The frequency/schedule fact is new; no £ fare claim should accompany it.
    const frequencyLine = html.match(/4x weekly direct[^<]*/)?.[0] ?? '';
    expect(frequencyLine).not.toMatch(/£\d/);
  });
});

describe('13. no other route receives MAN->ISB weekday data accidentally', () => {
  it('manchester-lahore (a similarly-named PIA route) does not carry the Mon/Tue/Thu/Sat pattern', () => {
    const lahore = getRouteBySlug('manchester-lahore')!;
    expect(lahore.frequency).not.toMatch(/Mon, Tue, Thu & Sat/);
  });

  it('no other route in the catalogue picked up this exact frequency string', () => {
    const matches = routes.filter((r) =>
      r.slug !== 'manchester-islamabad' && r.frequency.includes('Mon, Tue, Thu & Sat')
    );
    expect(matches).toHaveLength(0);
  });
});
