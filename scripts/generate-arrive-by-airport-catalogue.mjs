#!/usr/bin/env node
/**
 * Builds lib/arrive-by-shared/catalogue/airports.generated.json (and its
 * provenance sidecar) from an OurAirports airports.csv export.
 *
 *   node scripts/generate-arrive-by-airport-catalogue.mjs <path-to-airports.csv> [retrievedISODate]
 *
 * Source: https://davidmegginson.github.io/ourairports-data/airports.csv
 * Licence: OurAirports releases all data to the Public Domain (no guarantee
 * of accuracy) -- see docs/product/ARRIVE_BY_AIRPORT_CATALOGUE.md.
 *
 * IANA timezones are derived offline per airport coordinate with the
 * dev-only `tz-lookup` package (CC0; boundaries from timezone-boundary-builder,
 * ODbL -- attribution recorded in the provenance doc). Nothing here runs at
 * request time or ships to the browser: the generated JSON is the only artefact.
 *
 * Deterministic: same CSV in -> byte-identical output. Fails loudly (non-zero
 * exit) on a duplicate IATA code, an invalid coordinate or an unresolvable
 * timezone rather than silently dropping a row.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tzLookup = require('tz-lookup');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/generate-arrive-by-airport-catalogue.mjs <airports.csv> [retrievedISODate]');
  process.exit(1);
}
const retrieved = process.argv[3] ?? new Date().toISOString().slice(0, 10);

const raw = fs.readFileSync(csvPath);
const sha256 = crypto.createHash('sha256').update(raw).digest('hex');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCsv(raw.toString('utf8'));
const header = rows.shift();
const col = Object.fromEntries(header.map((name, i) => [name, i]));
for (const required of ['type', 'name', 'latitude_deg', 'longitude_deg', 'iso_country', 'municipality', 'scheduled_service', 'icao_code', 'iata_code', 'ident']) {
  if (!(required in col)) throw new Error(`Source CSV is missing column ${required}`);
}

const SIZE_CODE = { large_airport: 'L', medium_airport: 'M', small_airport: 'S' };
// Airport-shaped names that are military installations. A name that ALSO reads
// as a civil airport ("... Airport / ... Air Base", "... International ...") is a
// joint-use field and is kept; a bare military name is excluded.
const MILITARY_NAME = /\b(air ?base|afb|air force|naval|army|military|air station)\b/i;
const CIVIL_NAME = /\b(airport|international|aeropuerto|a[eé]roport|flughafen|aeroporto|civil)\b/i;
// Reviewed by hand against the source: a "Military City" airport that is not open to scheduled passengers.
const EXPLICIT_EXCLUDE = new Set(['KMC']);

const included = [];
const excluded = { notCommercialType: 0, notScheduled: 0, noIata: 0, military: [] };
for (const r of rows) {
  const type = r[col.type];
  const iata = r[col.iata_code];
  if (!SIZE_CODE[type]) { excluded.notCommercialType++; continue; }
  if (!iata) { excluded.noIata++; continue; }
  if (r[col.scheduled_service] !== 'yes') { excluded.notScheduled++; continue; }
  const name = r[col.name];
  if (EXPLICIT_EXCLUDE.has(iata) || (MILITARY_NAME.test(name) && !CIVIL_NAME.test(name))) {
    excluded.military.push(`${iata} ${name}`);
    continue;
  }
  if (!/^[A-Z]{3}$/.test(iata)) throw new Error(`Malformed IATA code ${iata}`);
  const lat = Number(r[col.latitude_deg]);
  const lng = Number(r[col.longitude_deg]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
    throw new Error(`Invalid coordinates for ${iata}: ${r[col.latitude_deg]}, ${r[col.longitude_deg]}`);
  }
  const tz = tzLookup(lat, lng);
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { throw new Error(`Unresolvable timezone ${tz} for ${iata}`); }
  const icao = r[col.icao_code] || (/^[A-Z]{4}$/.test(r[col.ident]) ? r[col.ident] : '');
  // "Manchester, Greater Manchester" -> "Manchester"; the primary municipality is what a traveller searches.
  const city = (r[col.municipality] || name).split(',')[0].trim();
  included.push({ iata, icao, name, city, cc: r[col.iso_country], lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, tz, size: SIZE_CODE[type] });
}

const seen = new Map();
for (const a of included) {
  if (seen.has(a.iata)) throw new Error(`Duplicate IATA ${a.iata}: ${seen.get(a.iata)} vs ${a.name}`);
  seen.set(a.iata, a.name);
}
included.sort((a, b) => a.iata.localeCompare(b.iata));

const tzs = [...new Set(included.map((a) => a.tz))].sort();
const tzIndex = new Map(tzs.map((tz, i) => [tz, i]));
const out = {
  // Column order documented once here and in airport-catalogue.ts.
  columns: ['iata', 'icao', 'name', 'city', 'countryCode', 'lat', 'lng', 'tzIndex', 'size'],
  timeZones: tzs,
  airports: included.map((a) => [a.iata, a.icao, a.name, a.city, a.cc, a.lat, a.lng, tzIndex.get(a.tz), a.size]),
};

const dir = path.join('lib', 'arrive-by-shared', 'catalogue');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'airports.generated.json'), JSON.stringify(out) + '\n');

const bySize = included.reduce((acc, a) => ({ ...acc, [a.size]: (acc[a.size] ?? 0) + 1 }), {});
const provenance = {
  source: 'OurAirports airports.csv',
  url: 'https://davidmegginson.github.io/ourairports-data/airports.csv',
  licence: 'Public Domain (OurAirports: "All data is released to the Public Domain, and comes with no guarantee of accuracy or fitness for use.")',
  retrievedDate: retrieved,
  sourceSha256: sha256,
  sourceRows: rows.length,
  included: included.length,
  includedBySize: bySize,
  timeZoneCount: tzs.length,
  excluded: { ...excluded, militaryCount: excluded.military.length }, // full list of military exclusions is kept here for review
  timeZoneDerivation: 'tz-lookup (CC0) over timezone-boundary-builder (ODbL) boundaries, offline, per airport coordinate',
};
fs.writeFileSync(path.join(dir, 'airports.provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(JSON.stringify({ ...provenance, excluded: { ...excluded, military: excluded.military.length } }, null, 2));
