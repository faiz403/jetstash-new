// Creates any missing custom Brevo contact attributes required by
// app/api/subscribe/route.ts and app/api/fare-watch/route.ts.
//
// Idempotent — safe to re-run any time (e.g. after adding a new attribute
// to lib/brevo-attributes.json, or when connecting a fresh Brevo account).
// Never overwrites or deletes an existing attribute; only creates ones that
// are missing. Reads the canonical attribute list from
// lib/brevo-attributes.json — the same file lib/brevo-attributes.ts wraps
// for the app's TypeScript code — so this script and the running app can
// never define the list differently.
//
// This is deliberately a manual, explicit step (not a predev/prebuild
// hook): it mutates a real third-party account, so it should never run
// silently as a side effect of `npm install` or `npm run dev`.
//
// Usage:
//   BREVO_API_KEY=xxxxx node scripts/setup-brevo-attributes.mjs
// or, with the key already in your shell / pulled via `vercel env pull`:
//   npm run brevo:setup

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const attributeList = JSON.parse(readFileSync(join(root, 'lib', 'brevo-attributes.json'), 'utf-8'));

const apiKey = process.env.BREVO_API_KEY;
if (!apiKey) {
  console.error(
    'BREVO_API_KEY is not set in this shell.\n' +
      'Run `vercel env pull .env.brevo` (or export it manually) and re-run:\n' +
      '  BREVO_API_KEY=$(grep BREVO_API_KEY .env.brevo | cut -d= -f2-) node scripts/setup-brevo-attributes.mjs'
  );
  process.exit(1);
}

async function getExistingAttributeNames() {
  const res = await fetch('https://api.brevo.com/v3/contacts/attributes', {
    headers: { 'api-key': apiKey, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to list existing Brevo attributes: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return new Set((body.attributes ?? []).map((a) => a.name));
}

async function createAttribute(attr) {
  const res = await fetch(`https://api.brevo.com/v3/contacts/attributes/normal/${encodeURIComponent(attr.name)}`, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: attr.type }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create attribute "${attr.name}": ${res.status} ${await res.text()}`);
  }
}

const existing = await getExistingAttributeNames();
const missing = attributeList.filter((a) => !existing.has(a.name));

console.log(`${attributeList.length} required attribute(s); ${attributeList.length - missing.length} already exist.`);

if (missing.length === 0) {
  console.log('Nothing to do — Brevo is already in sync with lib/brevo-attributes.json.');
  process.exit(0);
}

for (const attr of missing) {
  process.stdout.write(`Creating ${attr.name} (${attr.type}, used by ${attr.usedBy})... `);
  await createAttribute(attr);
  console.log('done.');
}

console.log(`\nCreated ${missing.length} attribute(s). Brevo is now in sync with lib/brevo-attributes.json.`);
