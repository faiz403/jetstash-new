/**
 * OPERATOR-ONLY worldwide Arrive By capability probe (Phase C). Not a public
 * API, not imported by the app. Run from the repo root with a server-side
 * GOOGLE_ROUTES_API_KEY already in the environment (never pass it on the
 * command line, never commit it):
 *
 *   npx tsx scripts/arrive-by-capability-probe.ts --sample [--write-evidence] [--out <file>]
 *   npx tsx scripts/arrive-by-capability-probe.ts --airports LHR,DXB
 *
 * For each airport it records identity / DRIVE / timezone facts
 * (lib/arrive-by-shared/capability-probe.ts) and prints a table. With
 * --write-evidence it merges the resulting CAPABILITY evidence into
 * lib/arrive-by-shared/catalogue/capability-evidence.json. It never writes to
 * the release table: a probe can prove an airport works, it can never
 * publish it (see lib/arrive-by-shared/airport-release.ts).
 *
 * It calls Google directly, so it uses no visitor's arrive-by:<client> rate
 * limit bucket and offers no public bypass -- there is no route to it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { probeAirport, serializeProbeRecords, toEvidenceEntry, type ProbeRecord, type ProbeSpec } from '../lib/arrive-by-shared/capability-probe';

const SAMPLE: ProbeSpec[] = [
  // UK / Europe
  { iata: 'LHR', region: 'UK/Europe', destination: 'Reading, UK', policyChecks: [{ destination: 'Paris, France', expected: 'REFUSE_WRONG_COUNTRY' }] },
  { iata: 'CDG', region: 'UK/Europe', destination: 'Versailles, France' },
  { iata: 'AMS', region: 'UK/Europe', destination: 'Utrecht, Netherlands' },
  { iata: 'FRA', region: 'UK/Europe', destination: 'Mainz, Germany' },
  { iata: 'MAD', region: 'UK/Europe', destination: 'Toledo, Spain' },
  { iata: 'GVA', region: 'UK/Europe', destination: 'Lausanne, Switzerland', purpose: 'cross-border', policyChecks: [{ destination: 'Annecy, France', expected: 'ROUTE' }, { destination: 'Milan, Italy', expected: 'REFUSE_WRONG_COUNTRY' }] },
  { iata: 'BSL', region: 'UK/Europe', destination: 'Basel, Switzerland', purpose: 'cross-border (airport is in France)', policyChecks: [{ destination: 'Mulhouse, France', expected: 'ROUTE' }, { destination: 'Freiburg im Breisgau, Germany', expected: 'ROUTE' }, { destination: 'Milan, Italy', expected: 'REFUSE_WRONG_COUNTRY' }] },
  { iata: 'LUX', region: 'UK/Europe', destination: 'Luxembourg City, Luxembourg', purpose: 'cross-border', policyChecks: [{ destination: 'Thionville, France', expected: 'ROUTE' }, { destination: 'Trier, Germany', expected: 'ROUTE' }, { destination: 'Arlon, Belgium', expected: 'ROUTE' }, { destination: 'Amsterdam, Netherlands', expected: 'REFUSE_WRONG_COUNTRY' }] },
  // North America
  { iata: 'JFK', region: 'North America', destination: 'Stamford, Connecticut, USA' },
  { iata: 'LAX', region: 'North America', destination: 'Santa Monica, California, USA' },
  { iata: 'YYZ', region: 'North America', destination: 'Hamilton, Ontario, Canada' },
  { iata: 'MEX', region: 'North America', destination: 'Puebla, Mexico' },
  // South America
  { iata: 'GRU', region: 'South America', destination: 'Campinas, Brazil', fallbackDestinations: ['Sao Jose dos Campos, Brazil', 'Santos, Brazil'] },
  // Middle East
  { iata: 'DXB', region: 'Middle East', destination: 'Sharjah, United Arab Emirates' },
  { iata: 'DOH', region: 'Middle East', destination: 'Al Khor, Qatar' },
  // South Asia
  { iata: 'DEL', region: 'South Asia', destination: 'Gurugram, India' },
  { iata: 'BOM', region: 'South Asia', destination: 'Pune, India' },
  { iata: 'AMD', region: 'South Asia', destination: 'Gandhinagar, India' },
  { iata: 'DAC', region: 'South Asia', destination: 'Narayanganj, Bangladesh' },
  // South-East / East Asia
  { iata: 'SIN', region: 'East/SE Asia', destination: 'Jurong East, Singapore', fallbackDestinations: ['Orchard Road, Singapore', 'Sentosa, Singapore'], purpose: 'city-state next to a border', policyChecks: [{ destination: 'Johor Bahru, Malaysia', expected: 'REFUSE_WRONG_COUNTRY' }] },
  { iata: 'BKK', region: 'East/SE Asia', destination: 'Ayutthaya, Thailand' },
  { iata: 'HKG', region: 'East/SE Asia', destination: 'Tuen Mun, Hong Kong', purpose: 'island airport, special region', policyChecks: [{ destination: 'Shenzhen, China', expected: 'REFUSE_WRONG_COUNTRY' }] },
  { iata: 'HND', region: 'East/SE Asia', destination: 'Yokohama, Japan' },
  // Oceania
  { iata: 'SYD', region: 'Oceania', destination: 'Parramatta, Australia' },
  { iata: 'AKL', region: 'Oceania', destination: 'Hamilton, New Zealand' },
  // Africa
  { iata: 'JNB', region: 'Africa', destination: 'Pretoria, South Africa' },
  // Existing controls (probed for comparison; never receive generic evidence)
  { iata: 'MAN', region: 'Control', destination: 'Sheffield, UK', purpose: 'control (special profile, transit-first; road probe only)' },
  { iata: 'ISB', region: 'Control', destination: 'Rawalpindi, Pakistan', purpose: 'control (special profile)' },
  { iata: 'LHE', region: 'Control', destination: 'Sheikhupura, Pakistan', purpose: 'control (special profile)' },
  { iata: 'KHI', region: 'Control', destination: 'Thatta, Pakistan', purpose: 'control (special profile)' },
  // Special geography
  { iata: 'MLE', region: 'Special', destination: 'Male, Maldives', purpose: 'island airport' },
  { iata: 'HNL', region: 'Special', destination: 'Kailua, Hawaii, USA', purpose: 'island airport' },
  { iata: 'KEF', region: 'Special', destination: 'Reykjavik, Iceland', fallbackDestinations: ['Grindavik, Iceland', 'Hafnarfjordur, Iceland'], purpose: 'remote / island, long transfer' },
  { iata: 'LYR', region: 'Special', destination: 'Longyearbyen, Svalbard', purpose: 'remote airport' },
  { iata: 'ASP', region: 'Special', destination: 'Alice Springs, Australia', purpose: 'remote airport' },
  { iata: 'IAD', region: 'Special', destination: 'Reston, Virginia, USA', purpose: 'similarly named airport pair (Washington Dulles vs Reagan)' },
  { iata: 'DCA', region: 'Special', destination: 'Alexandria, Virginia, USA', purpose: 'similarly named airport pair (Washington Dulles vs Reagan)' },
  { iata: 'ORY', region: 'Special', destination: 'Versailles, France', purpose: 'second airport serving one city (Paris)' },
  { iata: 'TIJ', region: 'Special', destination: 'Tijuana, Mexico', purpose: 'cross-border (US terminal)', policyChecks: [{ destination: 'San Diego, California, USA', expected: 'REFUSE_WRONG_COUNTRY' }] },
  { iata: 'YLL', region: 'Special', destination: 'Lloydminster, Alberta, Canada', purpose: 'timezone-boundary town (Alberta / Saskatchewan)' },
  { iata: 'IKO', region: 'Special', destination: 'Nikolski, Alaska, USA', purpose: 'catalogue decision: name reads military, has scheduled service' },
  { iata: 'BEK', region: 'Special', destination: 'Bareilly, India', purpose: 'catalogue decision: name reads military, civil enclave' },
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_ROUTES_API_KEY is not set in the environment. Nothing was called.');
    process.exit(2);
  }
  const wanted = arg('--airports')?.split(',').map((code) => code.trim().toUpperCase());
  const specs = process.argv.includes('--sample') ? SAMPLE : wanted ? wanted.map((iata) => SAMPLE.find((spec) => spec.iata === iata) ?? { iata, region: 'Ad hoc' }) : [];
  if (specs.length === 0) {
    console.error('Nothing to probe: pass --sample or --airports LHR,DXB');
    process.exit(2);
  }

  const records: ProbeRecord[] = [];
  for (const spec of specs) {
    const record = await probeAirport(apiKey, spec);
    records.push(record);
    console.log(`${record.iata.padEnd(4)} ${record.verdict.padEnd(12)} id=${record.identity.ok ? `ok ${record.identity.distanceKm}km` : record.identity.failure} drive=${record.drive.outcome}${record.drive.durationSeconds ? ` ${Math.round(record.drive.durationSeconds / 60)}min` : ''} tz=${record.timezone.status}${record.failureClass ? ` [${record.failureClass}]` : ''}`);
  }

  const out = arg('--out') ?? path.join('lib', 'arrive-by-shared', 'catalogue', 'phase-c-live-results.json');
  fs.writeFileSync(out, `${serializeProbeRecords(records, apiKey)}\n`);
  console.log(`\nWrote ${records.length} records to ${out}`);

  if (process.argv.includes('--write-evidence')) {
    const evidencePath = path.join('lib', 'arrive-by-shared', 'catalogue', 'capability-evidence.json');
    const existing = JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as { generatedBy: string; records: Array<{ iata: string; status: string }> };
    // Manual kill-switch entries are preserved; probe-derived entries for the probed airports are replaced.
    const probed = new Set(records.map((record) => record.iata));
    const kept = existing.records.filter((entry) => entry.status === 'temporarily_unsupported' || !probed.has(entry.iata));
    const fresh = records.map(toEvidenceEntry).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    const merged = [...kept, ...fresh].sort((a, b) => a.iata.localeCompare(b.iata));
    fs.writeFileSync(evidencePath, `${JSON.stringify({ generatedBy: existing.generatedBy, records: merged }, null, 2)}\n`);
    console.log(`Wrote ${fresh.length} capability evidence entries (release table untouched -- nothing is public).`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Probe failed.');
  process.exit(1);
});
