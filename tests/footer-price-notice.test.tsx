import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const hoisted = vi.hoisted(() => ({ path: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => hoisted.path }));

import { FooterPriceNotice } from '@/components/layout/footer-price-notice';

describe('footer "prices are indicative" sentence (10 October 2026 customer copy batch)', () => {
  it('still shows on pages that display fares, with the original wording', () => {
    for (const path of ['/', '/tracked-fares', '/routes/manchester-islamabad', '/deals']) {
      hoisted.path = path;
      const html = renderToStaticMarkup(<FooterPriceNotice />);
      expect(html, path).toContain('Prices shown across this site are indicative and subject to change.');
    }
  });

  it('is left out on Arrive By, which shows journey timing and no fares', () => {
    for (const path of ['/arrive-by', '/arrive-by/']) {
      hoisted.path = path;
      expect(renderToStaticMarkup(<FooterPriceNotice />), path).toBe('');
    }
  });
});
