import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AirportPage from '@/app/airports/[slug]/page';
import DestinationPage from '@/app/destinations/[slug]/page';
import { RouteCardFare } from '@/components/route/route-card-fare';
import { AirportRouteGrid, type AirportRouteItem } from '@/components/airport/airport-route-grid';
import { airportShortName, describeFareStops } from '@/lib/route-card-fare';
import type { FareSignalObservation } from '@/lib/fare-signal';

/**
 * Consumer clarity pass (3 Oct 2026). Pins the shared-template changes: airport pages lead with
 * route cards, destination pages lead with their flight cards, cards use exact airport names and a
 * fixed fare hierarchy, and nothing makes a live-price, cheapest or savings claim. Route pages,
 * fare selection and affiliate links are intentionally not exercised here (they were not changed).
 */

const norm = (html: string) => html.replace(/<!-- -->/g, "").replace(/&#x27;/g, "'").replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

async function airportHtml(slug: string) {
  return norm(renderToStaticMarkup(await AirportPage({ params: Promise.resolve({ slug }) })));
}
async function destinationHtml(slug: string) {
  return norm(renderToStaticMarkup(await DestinationPage({ params: Promise.resolve({ slug }) })));
}

const observation = (over: Partial<FareSignalObservation> = {}): FareSignalObservation => ({
  id: 'obs-test',
  cabin: 'Economy',
  airline: 'Pegasus',
  price: 380,
  currency: 'GBP',
  observedDate: '2026-09-22',
  departureDate: '2026-11-17',
  returnDate: '2026-12-01',
  directness: 'connecting',
  outboundStops: 1,
  returnStops: 1,
  connectionAirports: [],
  isSelfTransfer: false,
  journeyConsequences: [],
  ...over,
});

describe('exact airport names', () => {
  it('keeps Heathrow and Gatwick apart and drops only the trailing "Airport"', () => {
    expect(airportShortName('Manchester Airport')).toBe('Manchester');
    expect(airportShortName('London Heathrow')).toBe('London Heathrow');
    expect(airportShortName('London Gatwick')).toBe('London Gatwick');
    expect(airportShortName('Leeds Bradford Airport')).toBe('Leeds Bradford');
  });

  it('describes the journey shape in one phrase and says nothing when the observation does not', () => {
    expect(describeFareStops({ directness: 'direct', outboundStops: 0, returnStops: 0 })).toBe('Direct');
    expect(describeFareStops({ directness: 'connecting', outboundStops: 1, returnStops: 1 })).toBe('1 stop');
    expect(describeFareStops({ directness: 'connecting', outboundStops: 2, returnStops: 2 })).toBe('2 stops');
    expect(describeFareStops({ directness: 'connecting', outboundStops: 1, returnStops: 2 })).toBe('Connecting');
    expect(describeFareStops({ directness: null, outboundStops: null, returnStops: null })).toBeNull();
  });
});

describe('route card fare hierarchy', () => {
  it('shows the fare, who flies it and the stops, then the checked date, in that order, with no unsupported claim', () => {
    const html = norm(renderToStaticMarkup(createElement(RouteCardFare, { observation: observation(), state: 'current' })));
    expect(html.indexOf('£380')).toBeLessThan(html.indexOf('Pegasus'));
    expect(html.indexOf('Pegasus')).toBeLessThan(html.indexOf('1 stop'));
    expect(html.indexOf('1 stop')).toBeLessThan(html.indexOf('Checked 22 September 2026'));
    expect(html).not.toMatch(/\b(live|cheapest|lowest|from £|save|deal|best price)\b/i);
  });

  it('never hides a self-transfer, a decisive consequence or a previous-fare state', () => {
    const html = norm(
      renderToStaticMarkup(
        createElement(RouteCardFare, {
          observation: observation({ isSelfTransfer: true, journeyConsequences: ['19 hr 35 min layover at Edinburgh Airport'] }),
          state: 'recent',
        })
      )
    );
    expect(html).toContain('Self-transfer');
    expect(html).toContain('19 hr 35 min layover at Edinburgh Airport');
    expect(html).toContain('Previous fare, checked 22 September 2026');
  });

  it('keeps a cheaper self-transfer as a secondary, labelled line', () => {
    const html = norm(
      renderToStaticMarkup(
        createElement(RouteCardFare, { observation: observation(), state: 'current', lowerSelfTransfer: observation({ price: 327, isSelfTransfer: true }) })
      )
    );
    expect(html).toContain('A cheaper self-transfer was seen at £327 (separate tickets).');
  });
});

describe('airport route grid', () => {
  const items: AirportRouteItem[] = [
    { slug: 'manchester-istanbul', country: 'Turkey', title: 'Manchester → Istanbul', statusLabel: 'Direct', detail: 'Published timings vary', fare: null },
    { slug: 'manchester-dubai', country: 'United Arab Emirates', title: 'Manchester → Dubai', statusLabel: 'Direct', detail: null, fare: null },
    { slug: 'manchester-lahore', country: 'Pakistan', title: 'Manchester → Lahore', statusLabel: 'Direct', detail: null, fare: null },
  ];

  it('server-renders every route (nothing depends on JavaScript), with an honest empty fare line and the long prose behind Details', () => {
    const html = norm(renderToStaticMarkup(createElement(AirportRouteGrid, { items })));
    for (const item of items) expect(html).toContain(item.title);
    expect(html).toContain('No fare logged yet');
    expect(html).toContain('<summary');
    expect(html).toContain('Details');
    expect(html).toContain('Published timings vary');
    expect(html).toContain('aria-label="Filter routes by country"');
    expect(html).toContain('aria-pressed="true"');
  });

  it('shows no filter when there is little to filter', () => {
    const html = norm(renderToStaticMarkup(createElement(AirportRouteGrid, { items: items.slice(0, 2) })));
    expect(html).not.toContain('Filter routes by country');
  });
});

describe('airport pages lead with where you can fly', () => {
  it('Manchester: the route cards come before the "why this airport" essay, with exact names and dated fares', async () => {
    const html = await airportHtml('manchester');
    expect(html.indexOf('Routes from Manchester Airport')).toBeGreaterThan(-1);
    expect(html.indexOf('Routes from Manchester Airport')).toBeLessThan(html.indexOf('right airport for this route'));
    expect(html).toContain('Manchester → Istanbul');
    expect(html).toMatch(/£[\d,]+ <span[^>]*>return/);
    expect(html).toMatch(/Checked \d{1,2} \w+ \d{4}/);
    expect(html).toContain("where to check today's price");
    // the new route-card section itself makes no live-price or cheapest claim (other page copy is unchanged)
    const cardSection = html.slice(html.indexOf('Routes from Manchester Airport'), html.indexOf('right airport for this route'));
    expect(cardSection).not.toMatch(/\b(live price|cheapest|lowest fare)\b/i);
  });

  it('Heathrow and Gatwick name the exact airport, never a bare "London"', async () => {
    const heathrow = await airportHtml('london-heathrow');
    const gatwick = await airportHtml('london-gatwick');
    expect(heathrow).toContain('London Heathrow → Delhi');
    expect(gatwick).toContain('London Gatwick → Istanbul');
    for (const html of [heathrow, gatwick]) expect(html).not.toMatch(/\bLondon → /);
  });

  it('keeps the existing fare-evidence and route-guide links', async () => {
    const html = await airportHtml('manchester');
    expect(html).toContain('href="/routes/manchester-dubai"');
    expect(html).toContain("Fares we're tracking from Manchester Airport");
    expect(html).toContain('View route guide');
  });
});

describe('destination pages lead with how to get there', () => {
  it('Dubai: flight cards precede "About Dubai", and Heathrow and Gatwick are named exactly', async () => {
    const html = await destinationHtml('dubai');
    expect(html.indexOf('Flights to Dubai from the UK')).toBeGreaterThan(-1);
    expect(html.indexOf('Flights to Dubai from the UK')).toBeLessThan(html.indexOf('About Dubai'));
    expect(html).toContain('London Heathrow');
    expect(html).toContain('London Gatwick');
    expect(html).not.toMatch(/\bLondon\W+→\W+Dubai/);
  });

  it('Antalya: cards show the fare summary first and move the internal research label behind Details', async () => {
    const html = await destinationHtml('antalya');
    expect(html).toMatch(/£[\d,]+ <span[^>]*>return/);
    expect(html).toContain('View flight details');
    // the research label only appears inside a <details> disclosure now
    const labelIdx = html.indexOf('Useful route guidance available');
    expect(labelIdx).toBeGreaterThan(-1);
    expect(html.lastIndexOf('<details', labelIdx)).toBeGreaterThan(html.lastIndexOf('</details>', labelIdx));
  });

  it('Islamabad: still renders its flight guide block without error', async () => {
    const html = await destinationHtml('islamabad');
    expect(html).toContain('Flights to Islamabad from the UK');
  });
});

describe('what was not touched', () => {
  const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

  it('the route page and fare selection files are untouched by this pass', () => {
    // route page markers from PR 300 / 302 remain exactly where they were
    const routePage = read('app', 'routes', '[slug]', 'page.tsx');
    expect(routePage).toContain('<FareSignal');
    expect(routePage).not.toContain('route-card-fare');
    expect(read('lib', 'fare-signal.ts')).not.toContain('route-card-fare');
  });

  it('keeps the cookie banner and the Arrive By engine out of this change', () => {
    const touched = read('components', 'airport', 'airport-route-grid.tsx') + read('components', 'route', 'route-card-fare.tsx');
    expect(touched).not.toMatch(/consent|cookie|arrive-by/i);
  });
});
