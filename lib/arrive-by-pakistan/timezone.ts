/**
 * Small, self-contained local<->UTC conversion for a fixed IANA timezone.
 * Deliberately not imported from lib/arrive-by — Manchester's validated
 * Arrive By work lives only on its own still-unmerged branch, and the
 * brief asks for separate Pakistan modules rather than a shared import
 * across branches that don't actually share a merge history yet.
 *
 * Uses the general "guess, then correct against the zone's real offset at
 * that instant" technique so it stays correct for any IANA zone, even
 * though Pakistan Standard Time itself has no daylight saving and could,
 * in principle, have been hardcoded as a fixed +05:00 offset.
 */

export function localDateTimeToIso(value: string, timeZone: string): string {
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) throw new Error('Enter a valid date and time.');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if ([year, month, day, hour, minute].some((n) => !Number.isFinite(n))) {
    throw new Error('Enter a valid date and time.');
  }

  const targetMs = Date.UTC(year, month - 1, day, hour, minute);
  let guessMs = targetMs;

  // One correction pass is enough for any real-world zone: the offset
  // itself only changes between two nearby instants at a DST boundary,
  // which Pakistan doesn't have, but the same logic works if it ever did.
  for (let i = 0; i < 2; i += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(guessMs));
    const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
    const observedMs = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'));
    const diff = targetMs - observedMs;
    if (diff === 0) break;
    guessMs += diff;
  }

  return new Date(guessMs).toISOString();
}

export function isoToClock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso));
}
