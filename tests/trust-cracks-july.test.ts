import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

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

  it('uses neutral airport-specific guidance and points to route guides for verified service', () => {
    expect(pageSrc).not.toContain('{dest.flightTimeFromUK}');
    expect(pageSrc).toMatch(/vary by UK departure airport/i);
    expect(pageSrc).toMatch(/route guides/i);
  });
});
