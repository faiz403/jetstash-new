import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ArriveByIntroduction } from '@/components/arrive-by-introduction';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Arrive By limited-beta discoverability', () => {
  it('explains the use cases with qualified planning guidance', () => {
    const html = renderToStaticMarkup(createElement(ArriveByIntroduction));
    for (const copy of ['Need to be there on time?', 'Can I make it on time?', 'Funeral', 'Wedding', 'Concert or match', 'Important family journey', 'ESTIMATE ONLY', 'CANNOT CONFIRM', 'not a guarantee', 'not live flight tracking']) expect(html).toContain(copy);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain('href="#arrive-by-planner"');
    expect(html).toContain('Check my journey');
  });

  it('provides a focusable planner target before the existing form', () => {
    const planner = read('components/arrive-by-full-journey.tsx');
    expect(planner).toContain('id="arrive-by-planner" tabIndex={-1}');
    expect(planner.indexOf('id="arrive-by-planner"')).toBeLessThan(planner.indexOf('<form'));
    expect(read('components/arrive-by-introduction.tsx')).toContain("document.getElementById('arrive-by-planner')?.focus()");
    expect(planner).toContain('<form onSubmit={submit}');
  });

  it('retains the homepage destination and route CTA without navigation or footer expansion', () => {
    const homepage = read('components/homepage-v2/homepage-sections.tsx');
    expect(homepage).toContain("title: 'Need to be somewhere by a certain time?'");
    expect(homepage).toMatch(/href: '\/arrive-by',\s+linkLabel: 'Try Arrive By'/);
    expect(read('components/route/arrive-by-route-panel.tsx')).toContain('Plan with Arrive By');
    for (const path of ['components/layout/header.tsx', 'components/layout/footer.tsx']) expect(read(path)).not.toContain('/arrive-by');
  });
});
