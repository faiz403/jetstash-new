import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Destinations page — the "Explore JetStash by region" coverage cards
 * (added by the international-brand-positioning work) must land somewhere
 * that actually represents the region named on the card. Two were wrong:
 * "South Asia" (Pakistan and India) linked only to #india, and "Gulf &
 * Saudi" (Dubai, Doha, Jeddah, Madinah) linked only to #umrah — a visitor
 * clicking either card would land on a heading for just one of the two
 * countries the card itself names.
 */

const pageSrc = readFileSync(join(process.cwd(), 'app/destinations/page.tsx'), 'utf8');

describe('coverage cards link to accurate combined-region anchors, not a single country', () => {
  it('the South Asia card no longer points at #india alone', () => {
    const southAsiaBlock = pageSrc.match(/title: 'South Asia'[\s\S]*?\n\s{2}\},/)?.[0] ?? '';
    expect(southAsiaBlock).toContain("href: '#south-asia'");
    expect(southAsiaBlock).not.toContain("href: '#india'");
  });

  it('the Gulf & Saudi card no longer points at #umrah alone', () => {
    const gulfBlock = pageSrc.match(/title: 'Gulf & Saudi'[\s\S]*?\n\s{2}\},/)?.[0] ?? '';
    expect(gulfBlock).toContain("href: '#gulf-saudi'");
    expect(gulfBlock).not.toContain("href: '#umrah'");
  });

  it('the unchanged single-region cards still point at their own real section anchor', () => {
    const medBlock = pageSrc.match(/title: 'Mediterranean & Southern Europe'[\s\S]*?\n\s{2}\},/)?.[0] ?? '';
    const naBlock = pageSrc.match(/title: 'North Africa'[\s\S]*?\n\s{2}\},/)?.[0] ?? '';
    expect(medBlock).toContain("href: '#mediterranean'");
    expect(naBlock).toContain("href: '#northAfrica'");
  });
});

describe('the new #south-asia and #gulf-saudi anchor targets actually exist, in the right place', () => {
  it('#south-asia sits immediately before the India section (India renders first, Pakistan directly after)', () => {
    const anchorIndex = pageSrc.indexOf('id="south-asia"');
    const indiaSectionIndex = pageSrc.indexOf('<section id={key}');
    expect(anchorIndex).toBeGreaterThan(-1);
    expect(anchorIndex).toBeLessThan(indiaSectionIndex);
    // The anchor is conditional on key === 'india', so it only ever renders once, right there.
    const conditionIndex = pageSrc.lastIndexOf("key === 'india'", anchorIndex + 30);
    expect(conditionIndex).toBeGreaterThan(-1);
  });

  it('#gulf-saudi is gated on the umrah section (Umrah renders immediately before Gulf in groupOrder, so both are reachable from this one anchor)', () => {
    expect(pageSrc).toMatch(/key === 'umrah' && <div id="gulf-saudi"/);
    const groupOrderMatch = pageSrc.match(/const groupOrder[^;]+;/)?.[0] ?? '';
    const umrahIndex = groupOrderMatch.indexOf("'umrah'");
    const gulfIndex = groupOrderMatch.indexOf("'gulf'");
    expect(umrahIndex).toBeGreaterThan(-1);
    expect(gulfIndex).toBeGreaterThan(umrahIndex); // umrah must come first for this anchor to reach both
  });

  it('both new anchors use the same scroll-margin convention as every other in-page anchor target on the site', () => {
    expect(pageSrc).toMatch(/id="south-asia" className="scroll-mt-24"/);
    expect(pageSrc).toMatch(/id="gulf-saudi" className="scroll-mt-24"/);
  });

  it('every existing per-country anchor is untouched — india, pakistan, umrah and gulf still each resolve to their own section', () => {
    expect(pageSrc).toContain('<section id={key}');
    const groupOrderMatch = pageSrc.match(/const groupOrder[^;]+;/)?.[0] ?? '';
    for (const region of ['india', 'pakistan', 'umrah', 'gulf', 'mediterranean', 'northAfrica']) {
      expect(groupOrderMatch).toContain(`'${region}'`);
    }
  });
});
