import { describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import { FareHistoryPanel } from '@/components/route/fare-history-panel';
import { fareObservations } from '@/data/fare-observations';

function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectStrings(child, out);
    return out;
  }
  if (isValidElement(node)) {
    const children = (node.props as { children?: unknown } | null)?.children;
    if (children !== undefined) collectStrings(children, out);
  }
  return out;
}

describe('FARE-001 fare-history travel-date transparency', () => {
  const observation = fareObservations.find((entry) => entry.id === 'obs-man-lhe-economy-20260811-8w-v1')!;

  it('shows the exact outbound and return dates alongside the source and checked date', () => {
    const text = collectStrings(FareHistoryPanel({ observations: [observation] })).join(' ').replace(/\s+/g, ' ');

    expect(text).toContain('Economy');
    expect(text).toContain('Etihad');
    expect(text).toContain('Checked 11 August 2026');
    expect(text).toContain('Travel dates: 6 October 2026 – 20 October 2026');
  });

  it('still refuses to render an incomplete historic observation', () => {
    const incomplete = fareObservations.find((entry) => entry.id === 'obs-lhr-bom-economy-1')!;
    expect(FareHistoryPanel({ observations: [incomplete] })).toBeNull();
  });
});
