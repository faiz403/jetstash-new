import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { getDestinationBySlug } from '@/data/destinations';

/**
 * Three trust-crack fixes found during a July 2026 live-site audit:
 *  1. Several pages hand-appended "JetStash" in their own metadata title,
 *     doubling up with the root layout's "%s | JetStash" template (e.g.
 *     "Contact JetStash | JetStash").
 *  2. Deal cards without an exact verified Route could fall back to a
 *     destination-wide flightTimeFromUK summary that did not apply to the
 *     card's own departure airport (observed live: a London Heathrow ->
 *     Islamabad card reading "7h 45m direct from Manchester").
 *  3. Destination pages stated flightTimeFromUK as an unqualified fact,
 *     contradicting a same-destination route page that had genuinely not
 *     verified directness/frequency yet (Manchester-Dubai).
 */

function findPageFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) findPageFiles(full, out);
    else if (entry === 'page.tsx') out.push(full);
  }
  return out;
}

describe('no page metadata title hand-appends the brand name', () => {
  const pageFiles = findPageFiles(join(process.cwd(), 'app'));

  it('found more than a handful of page.tsx files (sanity check on the walk itself)', () => {
    expect(pageFiles.length).toBeGreaterThan(15);
  });

  it('every static "title: \'...\'" metadata value omits "JetStash" — the root layout template adds it', () => {
    const offenders: string[] = [];
    for (const file of pageFiles) {
      const src = readFileSync(file, 'utf8');
      const metadataBlock = src.match(/export const metadata:\s*Metadata\s*=\s*\{[\s\S]*?\n\};/)?.[0];
      if (!metadataBlock) continue;
      const titleMatch = metadataBlock.match(/\btitle:\s*'([^']*)'/);
      if (titleMatch && titleMatch[1].toLowerCase().includes('jetstash')) {
        offenders.push(`${file}: "${titleMatch[1]}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the four pages found doubling their title live now resolve correctly', () => {
    const cases: Array<[string, string]> = [
      ['app/contact/page.tsx', 'Contact'],
      ['app/travel-ready-check/page.tsx', 'Travel Ready Check'],
      ['app/travel-club/page.tsx', 'Travel Club'],
      ['app/about/page.tsx', 'How We Work'],
    ];
    for (const [file, expectedTitle] of cases) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      expect(src).toContain(`title: '${expectedTitle}'`);
    }
  });
});

describe('deal card only shows durations from an exact eligible route', () => {
  const dealCardSrc = readFileSync(join(process.cwd(), 'components/ui/deal-card.tsx'), 'utf8');

  it('never reads destination-level flightTimeFromUK as a card fallback', () => {
    expect(dealCardSrc).not.toMatch(/const flightTime = [^;]*flightTimeFromUK/);
  });

  it('uses the route-status presentation as its sole duration source', () => {
    expect(dealCardSrc).toContain('const flightTime = presentation?.flightTime;');
  });
});

describe('destination pages do not present generic durations as route facts', () => {
  const pageSrc = readFileSync(join(process.cwd(), 'app/destinations/[slug]/page.tsx'), 'utf8');

  it('no longer states the figure as a bare "Typical flight time" fact', () => {
    expect(pageSrc).not.toMatch(/>Typical flight time: \{dest\.flightTimeFromUK\}</);
  });

  it('uses destination-specific flight guidance and never falls back to a generic airport page', () => {
    expect(pageSrc).not.toContain('{dest.flightTimeFromUK}');
    expect(pageSrc).toContain('<DestinationFlightGuides');
    expect(pageSrc).not.toContain('View airport guide');
    expect(pageSrc).not.toContain('`/airports/${airport.slug}`');
  });
});

describe('Antalya positioning stays within its evidence boundary', () => {
  const antalya = getDestinationBySlug('antalya');

  it('keeps useful resort context without unsupported comparative wording', () => {
    expect(antalya?.tagline).toBe("Turkey's all-inclusive coastline");
    expect(antalya?.description).toBe(
      "Antalya anchors Turkey's Turquoise Coast, with established resort areas and all-inclusive stays.",
    );
    expect(antalya?.description.toLowerCase()).not.toMatch(/\b(most popular|leading|top|best)\b/);
    expect(antalya?.flightTimeFromUK).toBe('Published timings vary by airline and date; check the exact Manchester flight');
    expect(antalya?.description.toLowerCase()).not.toMatch(/\b(charter|direct)\b/);
  });
});

describe('Turkey leisure-route wording stays within its evidence boundary', () => {
  const antalya = getDestinationBySlug('antalya');
  const dalaman = getDestinationBySlug('dalaman');
  const bodrum = getDestinationBySlug('bodrum');
  const izmir = getDestinationBySlug('izmir');

  it('labels Dalaman as a published schedule duration, not a direct or typical-time claim', () => {
    expect(dalaman?.flightTimeFromUK).toBe('Scheduled flight time: 4h 30m from Manchester');
    expect(dalaman?.flightTimeFromUK?.toLowerCase()).not.toContain('direct');
    expect(dalaman?.description.toLowerCase()).not.toMatch(/\b(charter|direct)\b/);
  });

  it('uses the airport evidence for Bodrum summer availability without inventing a date range', () => {
    expect(bodrum?.description).toContain("Manchester Airport's destination guide lists flights as summer-only");
    expect(bodrum?.description.toLowerCase()).not.toContain('direct flights concentrated between may and october');
  });

  it('keeps Antalya and Izmir destination summaries aligned with their route-guide evidence', () => {
    expect(antalya?.flightTimeFromUK).toBe('Published timings vary by airline and date; check the exact Manchester flight');
    expect(izmir?.flightTimeFromUK).toBe('Published planning figure: 4h 20m from Manchester Airport; exact duration varies by flight');
    expect(izmir?.description.toLowerCase()).not.toContain('outside the summer schedule most itineraries connect via istanbul');
  });
});

describe('destination overview trust-fix batch 1 stays within its evidence boundary', () => {
  const batch = ['barcelona', 'dubai', 'istanbul', 'amritsar', 'ahmedabad', 'sylhet'];
  const banned = /\b(most popular|most direct|most accessible|most rewarding|leading|top resort|year-round direct|year-round flights|regional airports|great majority|overwhelmingly|high demand|current demand)\b/i;

  it('uses the approved factual overview wording for all six destinations', () => {
    expect(getDestinationBySlug('barcelona')?.description).toBe(
      'Barcelona combines Gaudí architecture, the Gothic Quarter, Mediterranean beaches and Catalan food. Check the airport, dates and local travel time for the part of the city or coast you plan to visit.',
    );
    expect(getDestinationBySlug('dubai')?.description).toBe(
      'Dubai combines beaches, older districts and a major international airport with a wide range of city-break and stopover options. Check the exact UK airport and dates rather than assuming every airport has the same service.',
    );
    expect(getDestinationBySlug('istanbul')?.description).toBe(
      'Istanbul spans Europe and Asia, with Hagia Sophia, the Grand Bazaar and the Bosphorus central to a city break. Direct service varies by UK airport and season, so check the exact origin and dates.',
    );
    expect(getDestinationBySlug('amritsar')?.description).toBe(
      'Amritsar is centred on the Harmandir Sahib, the Golden Temple, and is a destination for Punjabi family, heritage and religious travel. Check the exact airport and service for your dates before booking.',
    );
    expect(getDestinationBySlug('ahmedabad')?.description).toBe(
      'Ahmedabad combines Sabarmati Ashram, Gujarati heritage and a large urban centre. Travellers can compare direct and connecting options from the UK rather than assuming one airport is the best fit.',
    );
    expect(getDestinationBySlug('sylhet')?.description).toBe(
      'Sylhet is a tea-growing region in north-east Bangladesh with strong links to UK family travel. Family stays can also be combined with time in the city and surrounding tea-growing areas.',
    );
  });

  it('does not reintroduce unsupported comparative, service-certainty or demographic claims', () => {
    for (const slug of batch) {
      expect(getDestinationBySlug(slug)?.description).not.toMatch(banned);
    }
  });
});

describe('destination overview trust-fix batch 2 stays within its evidence boundary', () => {
  const batch = ['lahore', 'mumbai', 'dhaka', 'faro', 'jeddah', 'madinah', 'casablanca', 'tangier'];
  const banned = /\b(most important|most often|principal arrival point|increasingly|common stopover|most UK travellers|by far its largest|reliably mild|long flight season|reliable winter-sun|under four hours|more than a resort|natural connecting point|barely two hours|easy add-on|shed its rough-edged reputation)\b/i;

  it('uses neutral, destination-specific overview wording for all eight destinations', () => {
    expect(getDestinationBySlug('lahore')?.description).toBe(
      "Lahore holds centuries of Mughal architecture, with the Badshahi Mosque, Lahore Fort and the Shalimar Gardens at its heart, alongside a distinctive food culture. UK visitors may also be travelling to see family, so check the exact dates and route details before booking.",
    );
    expect(getDestinationBySlug('mumbai')?.description).toBe(
      "Mumbai brings together Bollywood, the Gateway of India and a major financial district on India's west coast. Check the exact UK airport, dates and routing before booking.",
    );
    expect(getDestinationBySlug('dhaka')?.description).toBe(
      "Dhaka is Bangladesh's capital on the Buriganga, with a dense mix of business, government and culture. It can also be a starting point for family travel elsewhere in the country, so check the onward journey as well as the flight.",
    );
    expect(getDestinationBySlug('faro')?.description).toBe(
      "Faro is the entry point for the Algarve's beaches and golf resorts. Check the exact airport, dates and local travel time for the part of the Algarve you plan to visit.",
    );
    expect(getDestinationBySlug('jeddah')?.description).toBe(
      'Jeddah is a gateway for journeys to Makkah and also has the restored Al-Balad old town and a Red Sea setting. Check the current entry and travel arrangements for your dates.',
    );
    expect(getDestinationBySlug('madinah')?.description).toBe(
      "Madinah is home to the Prophet's Mosque (Al-Masjid an-Nabawi) and is visited by pilgrims as part of Umrah journeys. Check the current entry and travel arrangements for your dates.",
    );
    expect(getDestinationBySlug('casablanca')?.description).toBe(
      'Casablanca combines the Hassan II Mosque, an art-deco city centre and a transport hub for travel within Morocco. Check the exact flight and any onward connection for your dates.',
    );
    expect(getDestinationBySlug('tangier')?.description).toBe(
      'Tangier sits near where the Mediterranean meets the Atlantic, with a whitewashed medina, a renewed seafront and a literary history. The Al Boraq high-speed train links Tangier with Casablanca; check current flight and train schedules for your dates.',
    );
  });

  it('does not reintroduce unsupported importance, popularity, demand or service claims', () => {
    for (const slug of batch) {
      expect(getDestinationBySlug(slug)?.description).not.toMatch(banned);
    }
  });
});
