// Generates lib/route-map-geo.json from Natural Earth vector data.
//
// This is the "real geography" behind the homepage Manchester route map:
// rather than hand-drawn shapes, the landmasses and coastlines come from
// Natural Earth 1:110m (public domain, via the `world-atlas` package). We
// project that data once — cropped to the UK -> India corridor JetStash
// actually serves — and bake the result into a small static file the client
// renders as plain SVG paths. No map library ships to the browser.
//
// Run manually after changing the crop, the city list, or the styling
// resolution:  node scripts/generate-route-map.mjs
// The output (lib/route-map-geo.json) is committed; it is intentionally NOT a
// prebuild step, because the geography never changes between builds.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';

const require = createRequire(import.meta.url);
const world = require('world-atlas/countries-110m.json');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(root, 'lib', 'route-map-geo.json');

// Canvas resolution the projection is fitted into. The committed viewBox is
// cropped tighter than this from the projected region bounds.
const WIDTH = 1000;
const HEIGHT = 720;
const PAD = 12;

// Geographic crop: comfortably contains Ireland/Morocco in the west and Delhi
// in the east, UK in the north and Mumbai in the south, with breathing room.
const REGION = {
  type: 'Polygon',
  coordinates: [[[-13, 60], [82, 60], [82, 14], [-13, 14], [-13, 60]]],
};

// Manchester origin + every destination, by real (lat, lon). Slugs match
// data/destinations.ts so the component can resolve hrefs.
const ORIGIN = { slug: 'manchester', name: 'Manchester', lat: 53.354, lon: -2.275 };
const CITIES = [
  { slug: 'islamabad', name: 'Islamabad', lat: 33.61, lon: 73.05 },
  { slug: 'lahore', name: 'Lahore', lat: 31.55, lon: 74.34 },
  { slug: 'amritsar', name: 'Amritsar', lat: 31.63, lon: 74.87 },
  { slug: 'delhi', name: 'Delhi', lat: 28.61, lon: 77.21 },
  { slug: 'karachi', name: 'Karachi', lat: 24.86, lon: 67.01 },
  { slug: 'ahmedabad', name: 'Ahmedabad', lat: 23.03, lon: 72.58 },
  { slug: 'mumbai', name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { slug: 'dubai', name: 'Dubai', lat: 25.2, lon: 55.27 },
  { slug: 'abu-dhabi', name: 'Abu Dhabi', lat: 24.45, lon: 54.38 },
  { slug: 'doha', name: 'Doha', lat: 25.29, lon: 51.53 },
  { slug: 'jeddah', name: 'Jeddah', lat: 21.49, lon: 39.19 },
  { slug: 'istanbul', name: 'Istanbul', lat: 41.01, lon: 28.98 },
  { slug: 'marrakech', name: 'Marrakech', lat: 31.63, lon: -8.01 },
];

const land = feature(world, world.objects.countries);
const borders = mesh(world, world.objects.countries, (a, b) => a !== b);

const projection = geoEquirectangular().fitExtent(
  [[PAD, PAD], [WIDTH - PAD, HEIGHT - PAD]],
  REGION
);
const path = geoPath(projection);

// Tight crop: the projected bounds of the region rectangle become the viewBox,
// so the committed frame hugs the geography with no empty letterboxing.
const [[x0, y0], [x1, y1]] = path.bounds(REGION);
const vb = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };

// Clip generated geometry to just past the crop so path strings don't carry
// coastlines from far outside the frame.
projection.clipExtent([[x0 - 2, y0 - 2], [x1 + 2, y1 + 2]]);

// Round every coordinate in a path `d` string to 1 decimal — sub-pixel
// precision we don't need, and it cuts the file ~35%.
const round = (d) => d.replace(/-?\d+\.\d+/g, (n) => (+n).toFixed(1));

const project = ({ lat, lon, ...rest }) => {
  const [x, y] = projection([lon, lat]);
  return { ...rest, x: +x.toFixed(1), y: +y.toFixed(1) };
};

const data = {
  viewBox: `${+vb.x.toFixed(1)} ${+vb.y.toFixed(1)} ${+vb.w.toFixed(1)} ${+vb.h.toFixed(1)}`,
  land: round(path(land)),
  borders: round(path(borders)),
  origin: project(ORIGIN),
  cities: CITIES.map(project),
};

writeFileSync(outFile, `${JSON.stringify(data)}\n`);

const kb = (Buffer.byteLength(JSON.stringify(data)) / 1024).toFixed(1);
console.log(`route map geo: ${data.cities.length} cities, viewBox ${data.viewBox}, ${kb}KB`);
