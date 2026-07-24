import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { guides } from '@/data/guides';
import { getGuideImage } from '@/lib/brand-images';

const guidesHubSrc = readFileSync(join(process.cwd(), 'app/guides/page.tsx'), 'utf8');

describe('Guides hub visual discovery', () => {
  it('keeps the directory discovery-first: a compact hero without a secondary stats strip', () => {
    expect(guidesHubSrc).toMatch(/<PageHero[\s\S]*?size="compact"/);
    expect(guidesHubSrc).not.toMatch(/stats=\{\[\{ value: String\(guides\.length\)/);
    expect(guidesHubSrc).toContain('bg-white py-10 sm:py-12');
  });

  it('has a manifest-backed editorial image for every published guide', () => {
    expect(guides).toHaveLength(9);

    for (const guide of guides) {
      const image = getGuideImage(guide.slug);
      expect(image, guide.slug).not.toBeNull();
      expect(image?.src).toBe(`/images/guides/${guide.slug}.webp`);
      expect(image?.alt).toBe('');
    }
  });

  it('resolves guide imagery through the central brand-image system, never a hardcoded asset path', () => {
    expect(guidesHubSrc).toMatch(/import \{ getGuideImage \} from '@\/lib\/brand-images';/);
    expect(guidesHubSrc).toMatch(/const image = getGuideImage\(guide\.slug\);/);
    expect(guidesHubSrc).not.toMatch(/['"]\/images\/guides\//);
  });

  it('uses decorative images with responsive sizing, a crop-safe card frame, and a restrained hover treatment', () => {
    expect(guidesHubSrc).toMatch(/alt=""/);
    expect(guidesHubSrc).toMatch(/sizes="\(max-width: 640px\) 100vw, \(max-width: 1024px\) 50vw, 33vw"/);
    expect(guidesHubSrc).toMatch(/aspect-\[16\/10\]/);
    expect(guidesHubSrc).toMatch(/object-cover transition-transform duration-500 group-hover:scale-\[1\.03\]/);
  });

  it('preserves a complete clickable guide card and the readable title/summary/CTA hierarchy', () => {
    expect(guidesHubSrc).toMatch(/href=\{`\/guides\/\$\{guide\.slug\}`\}/);
    expect(guidesHubSrc).toMatch(/<h2[^>]*>\{guide\.title\}<\/h2>/);
    expect(guidesHubSrc).toMatch(/\{guide\.summary\}/);
    expect(guidesHubSrc).toContain('Read guide');
  });
});
