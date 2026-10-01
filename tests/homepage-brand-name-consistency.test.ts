import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClosingBand } from '@/components/homepage-v2/homepage-sections';

describe('Homepage closing band brand name', () => {
  it('exposes the registered brand as one contiguous word to crawlers', () => {
    const html = renderToStaticMarkup(ClosingBand());

    expect(html).toContain('>JetStash</span>');
    expect(html).not.toContain('>Jet</span><span');
  });
});
