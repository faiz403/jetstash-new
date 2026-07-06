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

/**
 * Hand-written alt text for each Signature Collection photo, checked against
 * the actual delivered image (not the original commissioning brief in
 * docs/visual-identity.md, which a couple of photos deviate from — e.g.
 * Agadir and Izmir render a generic coastal mosque rather than their planned
 * landmark). Only describes what a sighted visitor would actually see:
 * aircraft, landmark, setting, light. Add an entry here whenever a new
 * destination/airport photo is delivered; getDestinationImage/getAirportImage
 * fall back to a plain city/airport name if a slug has a photo but no
 * hand-written line yet, rather than ever inventing a description.
 */
const DESTINATION_ALT: Record<string, string> = {
  dubai: "Aircraft descending over Dubai's skyline, with the Burj Khalifa and Burj Al Arab at sunset",
  lahore: 'Aircraft flying over the red sandstone domes and minarets of Badshahi Mosque, Lahore, at sunset',
  islamabad: 'Aircraft descending over Islamabad, with Faisal Mosque and the Margalla Hills at sunset',
  karachi: "Aircraft flying along Karachi's coastline, with the Mazar-e-Quaid mausoleum dome at sunset",
  amritsar: 'Aircraft flying over the Golden Temple reflected in its sacred pool at sunrise, Amritsar',
  delhi: "Aircraft descending over Delhi's Mughal-era domes and minaret at sunset",
  mumbai: "Aircraft flying over Mumbai's Gateway of India and waterfront at sunset",
  ahmedabad: "Aircraft flying over Ahmedabad's riverside clock tower and bridge at sunset",
  istanbul: 'Aircraft descending over a grand domed mosque on the Bosphorus, Istanbul, at sunset',
  antalya: "Aircraft descending over Antalya's cliffside waterfalls and Mediterranean coastline at sunset",
  bodrum: "Aircraft flying over Bodrum Castle and its yacht harbour at sunset",
  dalaman: "Aircraft flying over a turquoise bay on Turkey's Turquoise Coast near Dalaman at sunset",
  izmir: "Aircraft descending over a domed mosque and harbour on Turkey's Aegean coast at sunset",
  marrakech: 'Aircraft flying over the Koutoubia minaret in Marrakech, with the Atlas Mountains behind at sunset',
  agadir: "Aircraft flying along Morocco's Atlantic coastline at sunset, a minaret rising above the shore",
  casablanca: "Aircraft flying over the Hassan II Mosque on Casablanca's Atlantic shoreline at sunset",
  tangier: "Aircraft flying over Tangier's whitewashed medina and harbour at sunset",
};

const AIRPORT_ALT: Record<string, string> = {
  manchester: "Aircraft taking off past Manchester Airport's control tower at sunset",
};

/** Destination photography — alt is hand-written per photo (see DESTINATION_ALT). */
export function getDestinationImage(slug: string): BrandImage | null {
  const src = resolve('destinations', slug);
  if (!src) return null;
  const dest = getDestinationBySlug(slug);
  const fallback = dest ? `${dest.city}, ${dest.country}` : slug;
  return { src, alt: DESTINATION_ALT[slug] ?? fallback };
}

/** UK airport photography — alt is hand-written per photo (see AIRPORT_ALT). */
export function getAirportImage(slug: string): BrandImage | null {
  const src = resolve('airports', slug);
  if (!src) return null;
  const airport = getAirportBySlug(slug);
  return { src, alt: AIRPORT_ALT[slug] ?? (airport ? airport.name : slug) };
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
