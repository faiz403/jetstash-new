import { buildIndexNowPayload, submitIndexNow } from '../lib/indexnow.ts';

const args = process.argv.slice(2);
const dryRun = args[0] === '--dry-run';
const urls = dryRun ? args.slice(1) : args;

try {
  const payload = buildIndexNowPayload(urls);
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, endpoint: 'https://api.indexnow.org/indexnow', payload }, null, 2));
    process.exit(0);
  }

  const result = await submitIndexNow(urls);
  if (result.ok) {
    console.log(`IndexNow accepted ${result.submitted} URL(s) with HTTP ${result.status}.`);
    process.exit(0);
  }

  console.error(`IndexNow submission failed (${result.reason}${result.status ? ` ${result.status}` : ''}): ${result.detail}`);
  process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
