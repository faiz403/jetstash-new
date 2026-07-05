import manifest from './image-manifest.json';
import { getDestinationBySlug } from '@/data/destinations';
import { getAirportBySlug } from '@/data/airports';

/**
 * Central brand-image resolver — the code half of docs/visual-identity.md.
 *
 * Real photography lives in public/images/{heroes,destinations,airports,guides}/
 * named by slug/key. scripts/generate-image-manifest.mjs (prebuild/predev)
 * scans those folders into lib/image-manifest.json; this module resolves
 * against that manifest, so adding or removing an image is a file-drop plus
 * deploy — never a code change. Every resolver returns null when no file
 * exists, and callers fall back to the generated <DestinationMark /> panel
 * or the standard hero gradient.
 *
 * Manifest-backed (rather than fs at request time) so the same lookups work
 * in client components — e.g. deal cards inside the client-side deals
 * explorer.
 */

export interface BrandImage {
  src: string;
  alt: string;
}

const files = new Set<string>(manifest.images);

// Priority order mirrors the generator's accepted extensions — an .avif
// beats a .jpg of the same name.
const EXTENSIONS = ['avif', 'webp', 'jpg', 'jpeg', 'png'];

function resolve(folder: string, name: string): string | null {
  for (const ext of EXTENSIONS) {
    const candidate = `${folder}/${name}.${ext}`;
    if (files.has(candidate)) return `/images/${candidate}`;
  }
  return null;
}

/** Destination photography — alt derives from the destination's own data. */
export function getDestinationImage(slug: string): BrandImage | null {
  const src = resolve('destinations', slug);
  if (!src) return null;
  const dest = getDestinationBySlug(slug);
  return { src, alt: dest ? `${dest.tagline} — ${dest.city}, ${dest.country}` : slug };
}

/** UK airport photography — alt is the airport's name. */
export function getAirportImage(slug: string): BrandImage | null {
  const src = resolve('airports', slug);
  if (!src) return null;
  const airport = getAirportBySlug(slug);
  return { src, alt: airport ? airport.name : slug };
}

/**
 * Page-hero backdrops (heroes/<key>.jpg). Decorative by design — they sit
 * dimmed behind the hero heading, so alt is empty and the heading carries
 * the meaning.
 */
export function getHeroImage(key: string): BrandImage | null {
  const src = resolve('heroes', key);
  return src ? { src, alt: '' } : null;
}

/** Guide backdrops — decorative, same rule as heroes. */
export function getGuideImage(slug: string): BrandImage | null {
  const src = resolve('guides', slug);
  return src ? { src, alt: '' } : null;
}

/** Coverage counts for the Founder Command Centre — derived, never estimated. */
export function imageCoverage() {
  const count = (folder: string) =>
    manifest.images.filter((f: string) => f.startsWith(`${folder}/`)).length;
  return {
    destinations: count('destinations'),
    airports: count('airports'),
    heroes: count('heroes'),
    guides: count('guides'),
    total: manifest.images.length,
  };
}
