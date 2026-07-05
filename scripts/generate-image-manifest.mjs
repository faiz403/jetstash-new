// Scans public/images/** and writes lib/image-manifest.json.
//
// This is what makes the image system zero-code: drop a correctly named file
// into public/images/{heroes,destinations,airports,guides}/ and the next
// build (prebuild hook) picks it up; lib/brand-images.ts resolves everything
// against this manifest at render time. Delete the file to fall back to the
// generated DestinationMark panel / standard hero gradient.
//
// See docs/visual-identity.md for the naming convention and art direction.

import { readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imagesDir = join(root, 'public', 'images');
const outFile = join(root, 'lib', 'image-manifest.json');

const FOLDERS = ['heroes', 'destinations', 'airports', 'guides'];
const EXTENSIONS = new Set(['avif', 'webp', 'jpg', 'jpeg', 'png']);

const images = [];
for (const folder of FOLDERS) {
  const dir = join(imagesDir, folder);
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir)) {
    const ext = file.split('.').pop()?.toLowerCase();
    if (ext && EXTENSIONS.has(ext)) images.push(`${folder}/${file}`);
  }
}
images.sort();

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify({ images }, null, 2)}\n`);
console.log(`image manifest: ${images.length} image(s) across ${FOLDERS.join(', ')}`);
