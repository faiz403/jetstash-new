import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RoutePage from '@/app/routes/[slug]/page';

const norm = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

async function renderRoute(slug: string) {
  return norm(renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug }) })));
}

describe('decision-first route hierarchy', () => {
  const representativeRoutes = [
    'manchester-delhi',
    'manchester-islamabad',
    'manchester-dubai',
    'birmingham-antalya',
    'london-heathrow-delhi',
    'london-heathrow-dhaka',
    'london-gatwick-athens',
    'glasgow-antalya',
  ];

  for (const slug of representativeRoutes) {
    it(`${slug}: puts the fare decision before supporting route information`, async () => {
      const html = await renderRoute(slug);
      const title = html.indexOf('<h1');
      const fare = html.indexOf('Fare check');
      const more = html.indexOf('More route information');

      expect(title).toBeGreaterThan(-1);
      expect(fare).toBeGreaterThan(title);
      expect(more).toBeGreaterThan(fare);
    });
  }

  it('uses a compact answer in the hero instead of the full route narrative', async () => {
    const html = await renderRoute('manchester-dubai');
    const heroEnd = html.indexOf('</section>');
    const hero = html.slice(0, heroEnd);

    expect(hero).toContain('Direct flights available');
    expect(hero).toContain('Typical flight time:');
    expect(hero).not.toContain('More route information');
    expect(hero).not.toContain('Frequency');
    expect(hero).not.toContain('Airlines');
  });

  it('keeps service-ended truth concise above the action and full evidence below it', async () => {
    const html = await renderRoute('manchester-delhi');
    expect(html).toContain('Former direct service ended · connecting flights available');
    expect(html.indexOf('Flight time, frequency and airline facts from the previous direct service are no longer shown.'))
      .toBeGreaterThan(html.indexOf('More route information'));
  });

  it('keeps a safe next action on representative no-fare routes', async () => {
    for (const slug of ['manchester-delhi', 'london-heathrow-dhaka', 'london-gatwick-athens']) {
      const html = await renderRoute(slug);
      expect(html).toMatch(/Compare (?:current connecting )?flights on Trip\.com|Search current flights/);
    }
  });
});
