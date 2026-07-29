import { describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import { WhyJetStash } from '@/components/homepage-v2/homepage-sections';

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

describe('Homepage why JetStash story', () => {
  it('explains the product difference without promising a generic comparison site', () => {
    const text = collectStrings(WhyJetStash()).join(' ');
    expect(text).toContain('A fare is not the whole journey.');
    expect(text).toMatch(/A booking journey often starts with a price/i);
    expect(text).toMatch(/what is running, what has changed/i);
    expect(text).toMatch(/Travel intelligence first\. Booking second\./i);
  });

  it('keeps the three product beats concrete and trust-led', () => {
    const text = collectStrings(WhyJetStash()).join(' ');
    expect(text).toMatch(/Route first/);
    expect(text).toMatch(/Timing with context/);
    expect(text).toMatch(/Booking last/);
    expect(text).toMatch(/Checked, dated and honest/i);
    expect(text).not.toMatch(/cheapest|guaranteed|always the best|live price/i);
  });

  it('links the story to the real route guides', () => {
    expect(collectHrefs(WhyJetStash())).toContain('/routes');
  });
});
