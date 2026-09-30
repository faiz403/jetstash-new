/**
 * OPERATOR-ONLY UK departure capability probe (F2). Not a public API, not
 * imported by the app. Run from the repo root with a server-side
 * GOOGLE_ROUTES_API_KEY already in the environment (never on the command
 * line, never committed):
 *
 *   npx tsx scripts/arrive-by-departure-probe.ts --sample [--write-evidence]
 *   npx tsx scripts/arrive-by-departure-probe.ts --airports MAN,LHR
 *
 * For each airport it runs the PRODUCTION origin search (start geocode +
 * bounded backward search, through a real call ledger) for realistic flights
 * at three times of day, records identity and the measured Google-call cost,
 * and prints a summary (median / worst calls). With --write-evidence a PASS
 * merges DEPARTURE evidence into
 * lib/arrive-by-journey/departure-capability-evidence.json. It never touches
 * arrival capability or the release table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { probeDepartureAirport, toDepartureEvidence, type DepartureProbeRecord, type DepartureProbeSpec } from '../lib/arrive-by-journey/departure-probe';

const SAMPLE: DepartureProbeSpec[] = [
  { iata: 'MAN', start: 'Preston, Lancashire', fallbackStarts: ['Preston'], purpose: 'founder control: Preston to MAN (explicit profile; arrival profile proves nothing here)' },
  { iata: 'LHR', start: 'Camden Town, London', fallbackStarts: ['Richmond, London', 'Reading'], purpose: 'London start to LHR' },
  { iata: 'LGW', start: 'Brighton' },
  { iata: 'STN', start: 'Cambridge' },
  { iata: 'LTN', start: 'Milton Keynes' },
  { iata: 'BHX', start: 'Coventry' },
  { iata: 'EDI', start: 'Falkirk' },
  { iata: 'GLA', start: 'Paisley' },
  { iata: 'BRS', start: 'Bath' },
  { iata: 'NCL', start: 'Durham' },
  { iata: 'LBA', start: 'York' },
  { iata: 'LPL', start: 'Chester' },
  { iata: 'EMA', start: 'Nottingham' },
  { iata: 'ABZ', start: 'Stonehaven' },
  { iata: 'BFS', start: 'Lisburn' },
  { iata: 'CWL', start: 'Newport, Wales' },
  // Study-only probes: they measure cost and behaviour, they never write evidence.
  { iata: 'MAN', start: 'Wilmslow', purpose: 'STUDY very close start (about 10 minutes from the airport)', writesEvidence: false },
  { iata: 'MAN', start: 'Edinburgh', purpose: 'STUDY long drive (about 3.5 hours)', writesEvidence: false, scenarios: [{ label: 'early 06:00', departureClock: '06:00', bufferMinutes: 120 }] },
  { iata: 'EDI', start: 'London', purpose: 'STUDY very long drive: the leave time falls on the previous day', writesEvidence: false, scenarios: [{ label: 'early 06:00', departureClock: '06:00', bufferMinutes: 120 }] },
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

async function main() {
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_ROUTES_API_KEY is not set in the environment. Nothing was called.');
    process.exit(2);
  }
  const wanted = arg('--airports')?.split(',').map((code) => code.trim().toUpperCase());
  const specs = process.argv.includes('--sample') ? SAMPLE : wanted ? SAMPLE.filter((spec) => wanted.includes(spec.iata)) : [];
  if (specs.length === 0) {
    console.error('Nothing to probe: pass --sample or --airports MAN,LHR');
    process.exit(2);
  }

  const records: DepartureProbeRecord[] = [];
  for (const spec of specs) {
    const record = await probeDepartureAirport(apiKey, spec);
    records.push(record);
    const line = record.scenarios.map((s) => `${s.label.split(' ')[0]}:${s.status === 'OK' ? `${s.driveMinutes}min/${s.calls}calls${s.converged ? '' : '*'}` : s.status}`).join('  ');
    console.log(`${record.iata.padEnd(4)} ${record.verdict.padEnd(12)} id=${record.identity.ok ? 'ok' : record.identity.failure} start="${record.start}"  ${line}${record.writesEvidence ? '' : '  [study]'}`);
  }

  const calls = records.flatMap((r) => r.scenarios.filter((s) => s.status === 'OK').map((s) => s.calls));
  const queries = records.flatMap((r) => r.scenarios.filter((s) => s.status === 'OK').map((s) => s.routeQueries));
  if (calls.length > 0) {
    console.log(`\nOrigin side, ${calls.length} successful scenarios: total calls median ${median(calls)}, worst ${Math.max(...calls)}; route queries median ${median(queries)}, worst ${Math.max(...queries)}`);
  }

  const out = arg('--out') ?? path.join('lib', 'arrive-by-journey', 'departure-live-results.json');
  fs.writeFileSync(out, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`Wrote ${records.length} records to ${out}`);

  if (process.argv.includes('--write-evidence')) {
    const evidencePath = path.join('lib', 'arrive-by-journey', 'departure-capability-evidence.json');
    const existing = JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as { generatedBy: string; records: Array<{ iata: string }> };
    const probed = new Set(records.filter((r) => r.writesEvidence).map((r) => r.iata));
    const fresh = records.map(toDepartureEvidence).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    const merged = [...existing.records.filter((entry) => !probed.has(entry.iata)), ...fresh].sort((a, b) => a.iata.localeCompare(b.iata));
    fs.writeFileSync(evidencePath, `${JSON.stringify({ generatedBy: existing.generatedBy, records: merged }, null, 2)}\n`);
    console.log(`Wrote ${fresh.length} departure evidence entries (arrival capability and the release table untouched).`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Probe failed.');
  process.exit(1);
});
