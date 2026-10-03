import { describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import { WhyJetStash } from '@/components/homepage-v2/homepage-sections';

/**
 * Density + hierarchy fix (August 2026): WhyJetStash now carries the merged
 * "why JetStash / what we check" story — see its own doc comment in
 * components/homepage-v2/homepage-sections.tsx for what was preserved from
 * each of the two original sections. This file replaces the pre-merge
 * WhyJetStash-only assertions; travel-ready-check discoverability through
 * this same component has its own dedicated coverage in
 * tests/travel-ready-discoverability.test.ts.
 */

function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((child) => collectStrings(child, out));
  else if (isValidElement(node)) collectStrings((node.props as { children?: unknown }).children, out);
  return out;
}

function collectHrefs(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((child) => collectHrefs(child, out));
  else if (isValidElement(node)) {
    const props = node.props as { href?: unknown; children?: unknown };
    if (typeof props.href === 'string') out.push(props.href);
    collectHrefs(props.children, out);
  }
  return out;
}

describe('Homepage why JetStash story (merged with the former WhatWeCheck)', () => {
  // Founder copy correction (August 2026): the section's old heading, "A fare
  // is not the whole journey.", was retired because it repeated the new hero
  // headline's exact proposition ("Check the whole journey, not just the
  // fare.") almost word for word — see tests/homepage-opening-hero.test.ts.
  it('has the corrected heading, not the old one that now duplicates the hero', () => {
    const text = collectStrings(WhyJetStash()).join(' ');
    expect(text).toContain('What you see before you book');
    expect(text).not.toContain('A fare is not the whole journey.');
  });

  it('explains the product difference without promising a generic comparison site', () => {
    const text = collectStrings(WhyJetStash()).join(' ');
    expect(text).toMatch(/The lowest fare isn.t automatically the best journey/i);
    expect(text).toMatch(/Checked, dated and honest/i);
  });

  it('keeps the four merged check items concrete and trust-led', () => {
    const text = collectStrings(WhyJetStash()).join(' ');
    expect(text).toMatch(/Is it direct, and has it changed\?/);
    expect(text).toMatch(/What fare did we last see\?/);
    expect(text).toMatch(/When to book/);
    expect(text).toMatch(/Can you travel\?/);
    expect(text).not.toMatch(/cheapest|guaranteed|always the best|live price/i);
  });

  it('states booking comes after the intelligence, never before', () => {
    const text = collectStrings(WhyJetStash()).join(' ');
    expect(text).toMatch(/before you go to a provider to check today.s price/i);
  });

  it('links the story to the real route guides, and Travel Ready stays discoverable', () => {
    const hrefs = collectHrefs(WhyJetStash());
    expect(hrefs).toContain('/routes');
    expect(hrefs).toContain('/travel-ready-check');
  });

  it('is one section, not two — exactly five plain-language items', () => {
    const text = collectStrings(WhyJetStash()).join(' ');
    const titles = ['Is it direct, and has it changed?', 'What fare did we last see?', 'When to book', 'Can you travel?', 'The flight is only part of the journey'];
    for (const title of titles) expect(text).toContain(title);
    // The old two-section total was 3 DIFFERENCE_POINTS + 5 CHECKS = 8 items.
    expect(titles).toHaveLength(5);
  });
});
