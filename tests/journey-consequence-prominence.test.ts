import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRouteBySlug, routes } from '@/data/routes';
import { airports } from '@/data/airports';
import { deals } from '@/data/deals';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getTripComRouteUrl } from '@/lib/booking-providers';
import { FareSignal } from '@/components/route/fare-signal';
import { DealCard } from '@/components/ui/deal-card';
import { TrackedFaresExplorer } from '@/components/sections/tracked-fares-explorer';
import { buildTrackedFareAirportGroups } from '@/lib/tracked-fare-groups';

/**
 * Bad-fare prominence / journey-consequence fix (5 Sept 2026, independently
 * reproduced Astra findings). Protects the exact rendered output on all
 * three surfaces the brief named (Fare Signal on the route page, the
 * Tracked Fares Explorer card, and DealCard -- explicitly the "lower card"
 * Astra's own review quoted directly) for the four confirmed live examples,
 * plus controls proving a normal fare's card gains zero extra density and
 * PR #229's asymmetric-stop formatting (5 Sept 2026) is untouched.
 *
 * A fixed evaluation date is used throughout -- real observedDates are
 * 2026-08-22 (MAN-LHE Business) and 2026-09-01 (MAN-IST/AGA/DXB), all well
 * inside the 60-day fresh window, so nothing here is time-bomb-fragile the
 * way a `new Date()` call would be.
 */
const EVAL_ISO = '2026-09-05';

function renderFareSignalForRoute(slug: string): string {
  const route = getRouteBySlug(slug)!;
  const signal = getFareSignalForRoute(route.slug, EVAL_ISO);
  const html = renderToStaticMarkup(
    FareSignal({
      signal,
      tripComUrl: getTripComRouteUrl(route.slug),
      routeSlug: route.slug,
    })
  );
  return html.replace(/\s+/g, ' ');
}

function renderDealCardById(dealId: string): string {
  const deal = deals.find((d) => d.id === dealId);
  if (!deal) throw new Error(`fixture deal not found: ${dealId}`);
  const html = renderToStaticMarkup(DealCard({ deal, nowIso: EVAL_ISO }));
  return html.replace(/\s+/g, ' ');
}

/**
 * Strips every href="..." attribute value before an itinerary-mislabelling
 * scan -- the Trip.com CTA legitimately carries the destination's real
 * airport-search code in its own URL (e.g. "...tickets-MAN-DXB?...acity=
 * DXB..." for Manchester-Dubai), which is Trip.com URL construction
 * (explicitly untouched by this fix), not a claim about the itinerary
 * itself. Only the visible, customer-facing text is what "never mislabels
 * the arrival airport" is actually about.
 */
function withoutHrefValues(html: string): string {
  return html.replace(/href="[^"]*"/g, 'href="#"');
}

const trackedFaresHtml = renderToStaticMarkup(
  createElement(TrackedFaresExplorer, { airportGroups: buildTrackedFareAirportGroups(routes, airports, EVAL_ISO) })
).replace(/\s+/g, ' ');

describe('Manchester-Istanbul (£153 self-transfer, Barcelona airport change) — Fare Signal', () => {
  const html = renderFareSignalForRoute('manchester-istanbul');

  it('shows the price and the decisive consequence together, before the CTA — PR #232: BOTH legs are independently decisive (each states its own long layover), so both durations now appear', () => {
    const priceIdx = html.indexOf('£153');
    const consequenceIdx = html.indexOf('Self-transfer · Barcelona airport change · Outbound: 27h 55m · Return: 26h');
    const ctaIdx = html.indexOf('Check current price');
    expect(priceIdx).toBeGreaterThan(-1);
    expect(consequenceIdx).toBeGreaterThan(priceIdx);
    expect(consequenceIdx).toBeLessThan(ctaIdx);
  });
});

describe('Manchester-Agadir (£72, Milan airport change on the RETURN) — Fare Signal', () => {
  // PR #232 decisive-duration correction (founder review): the original
  // submission surfaced "Outbound: 3h 50m" -- the short, ordinary leg --
  // while omitting the actually-decisive "Return: 20h 55m", the leg the
  // airport change and long layover both belong to. Fixed: duration
  // display is now gated per leg, tied to which leg's own text states the
  // reason.
  const html = renderFareSignalForRoute('manchester-agadir');

  it('shows the price and the DECISIVE consequence together — the long return, never the short outbound', () => {
    const priceIdx = html.indexOf('£72');
    const consequenceIdx = html.indexOf('Self-transfer · Milan airport change · Return: 20h 55m');
    expect(priceIdx).toBeGreaterThan(-1);
    expect(consequenceIdx).toBeGreaterThan(priceIdx);
    expect(html).not.toContain('Outbound: 3h 50m');
  });

  it('still states both real, independent stop counts (PR #229, 5 Sept 2026) — the new consequence line adds to this, never replaces it', () => {
    expect(html).toContain('0 stops outbound, 1 stop return');
  });
});

describe('Manchester-Dubai (£336, arrives at Sharjah not Dubai) — Fare Signal', () => {
  const html = renderFareSignalForRoute('manchester-dubai');

  it('leads the consequence line with the arrival-airport mismatch, before the CTA', () => {
    const priceIdx = html.indexOf('£336');
    const mismatchIdx = html.indexOf('Arrives at SHJ');
    const ctaIdx = html.indexOf('Check current price');
    expect(priceIdx).toBeGreaterThan(-1);
    expect(mismatchIdx).toBeGreaterThan(priceIdx);
    expect(mismatchIdx).toBeLessThan(ctaIdx);
  });

  it('never mislabels the mismatch as DXB in the itinerary evidence itself (the Trip.com CTA link legitimately targets the DXB airport-search code — that is a search parameter, not an itinerary claim, and is untouched by this fix)', () => {
    expect(withoutHrefValues(html)).not.toMatch(/\bDXB\b/);
  });
});

describe('Manchester-Lahore — Fare Signal (pre-existing suppression, untouched by this fix)', () => {
  // Both of manchester-lahore's current-cabin candidates (the £453 Economy
  // and the £3,051 Business observation) are self-transfer with 3+ stops on
  // at least one leg -- isPoorItinerarySuitability() (lib/fare-signal.ts,
  // 31 Aug 2026) already suppresses BOTH, so the route page's own generic
  // Fare Signal shows no price at all here, in either cabin, and never did.
  // This is the exact suppression this fix must never weaken -- see this
  // file's DealCard describe block below for where the £3,051 Business
  // example genuinely IS newly made prominent (DealCard's own
  // getFareRangeSummary bypasses this suppression entirely, which is
  // exactly the display-prominence gap this fix targets).
  const html = renderFareSignalForRoute('manchester-lahore');

  it('shows no price and no fabricated consequence claim — the existing "Recent fares checked" suppression explanation renders instead', () => {
    expect(html).toContain('Recent fares checked');
    expect(html).not.toContain('£453');
    expect(html).not.toContain('£3,051');
    expect(html).not.toContain('Self-transfer ·');
  });
});

describe('Controls (Fare Signal) — a normal fare gains zero extra density', () => {
  it('a direct route with no self-transfer, airport change or arrival mismatch shows no journey-consequence line at all', () => {
    const html = renderFareSignalForRoute('glasgow-bodrum');
    expect(html).not.toContain('Self-transfer');
    expect(html).not.toContain('airport change');
    expect(html).not.toContain('long layover');
    expect(html).not.toContain('Arrives at');
  });
});

describe('Tracked Fares Explorer — the same four examples, the same shared summary text', () => {
  it('Manchester-Istanbul card shows both decisive durations', () => {
    expect(trackedFaresHtml).toContain('Self-transfer · Barcelona airport change · Outbound: 27h 55m · Return: 26h');
  });

  it('Manchester-Agadir card shows the DECISIVE return duration, never the short outbound one, and preserves the asymmetric stop count', () => {
    expect(trackedFaresHtml).toContain('Self-transfer · Milan airport change · Return: 20h 55m');
    expect(trackedFaresHtml).not.toContain('Outbound: 3h 50m');
    expect(trackedFaresHtml).toContain('0 stops outbound, 1 stop return');
  });

  it('Manchester-Dubai card leads with the arrival-airport mismatch and never mislabels it DXB', () => {
    expect(trackedFaresHtml).toContain('Arrives at SHJ');
    expect(trackedFaresHtml).not.toContain('Arrives at DXB');
  });

  it('Manchester-Lahore never appears at all — reuses the exact same getFareSignalForRoute() suppression as the Fare Signal describe block above, since Tracked Fares only ever lists routes whose state is "current"', () => {
    expect(trackedFaresHtml).not.toContain('£453');
    expect(trackedFaresHtml).not.toContain('£3,051');
  });
});

describe('DealCard — the specific "lower card" Astra\'s own review quoted directly', () => {
  it('man-lhe-business (the exact £3,051 Business example named in the brief) shows the consequence directly beneath the price, before the CTA', () => {
    const html = renderDealCardById('man-lhe-business');
    const priceIdx = html.indexOf('£3,051');
    const consequenceIdx = html.indexOf('Self-transfer · Outbound: 34h 50m · Return: 43h 20m');
    const ctaIdx = html.indexOf('Compare flights on Trip.com');
    expect(priceIdx).toBeGreaterThan(-1);
    expect(consequenceIdx).toBeGreaterThan(priceIdx);
    expect(consequenceIdx).toBeLessThan(ctaIdx);
  });

  it('man-dxb-economy (whose most recent Economy check is the £336 Sharjah-mismatch example) leads with the arrival-airport mismatch, before the CTA, and never mislabels it DXB in the itinerary evidence itself (the Trip.com CTA link legitimately targets the DXB airport-search code, untouched by this fix)', () => {
    const html = renderDealCardById('man-dxb-economy');
    // This route/cabin has 4 publishable Economy checks in range, so the
    // card's own headline price is the honest range across all of them
    // (£314-£480, per getFareRangeSummary) -- but journeyConsequences is
    // always computed from the SAME most-recent observation range.priceNote
    // itself is taken from (the £336 Sept 1 check, whose real routing
    // arrives at SHJ), so the mismatch still correctly appears.
    const priceIdx = html.indexOf('£314');
    const mismatchIdx = html.indexOf('Arrives at SHJ');
    const ctaIdx = html.indexOf('Compare flights on Trip.com');
    expect(priceIdx).toBeGreaterThan(-1);
    expect(mismatchIdx).toBeGreaterThan(priceIdx);
    expect(mismatchIdx).toBeLessThan(ctaIdx);
    expect(withoutHrefValues(html)).not.toMatch(/\bDXB\b/);
  });

  it('control: a genuinely clean direct fare (Glasgow-Bodrum, nonstop both ways) shows no journey-consequence line at all — the new line adds zero density to an ordinary card', () => {
    // glasgow-bodrum has no curated Deal in data/deals.ts -- a synthetic
    // fixture pointed at the real route/destination slugs, matching the
    // real obs-gla-bod-economy-20260814-8w-v1 observation (Jet2, nonstop
    // both ways, no self-transfer, no long layover, ordinary 4h30m/4h35m
    // durations), exercises the exact same getFareRangeSummary code path
    // the real curated cards above use.
    const cleanDeal = {
      id: 'fixture-clean-direct',
      category: 'flight' as const,
      cabin: 'Economy' as const,
      fromAirportSlug: 'glasgow',
      toDestinationSlug: 'bodrum',
      fromCity: 'Glasgow',
      toCity: 'Bodrum',
      toCountry: 'Turkey',
      airline: 'Jet2',
    };
    const html = renderToStaticMarkup(DealCard({ deal: cleanDeal, nowIso: EVAL_ISO })).replace(/\s+/g, ' ');
    expect(html).toContain('£618');
    expect(html).not.toContain('Self-transfer');
    expect(html).not.toContain('airport change');
    expect(html).not.toContain('long layover');
    expect(html).not.toContain('Arrives at');
  });
});
