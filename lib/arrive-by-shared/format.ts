/**
 * Human-facing time formatting shared across every Arrive By engine.
 *
 * Why this exists: a founder journey (ISB -> Abbottabad) returned an exact
 * arrival like "15:04" — technically correct, but a single traffic-aware
 * Google estimate presented to minute precision reads as false confidence
 * for a road journey that can shift with traffic. This module rounds the
 * DISPLAY of Google-estimate-derived values only; it never changes any
 * underlying calculation, and deadline/margin arithmetic in each engine
 * stays exact internally — only how numbers are shown here changes.
 *
 * Deliberately NOT rounded by this module: any time that is exact
 * arithmetic on something the traveller themselves entered (a landing time,
 * a buffer, a deadline) rather than a variable Google estimate — showing
 * those exactly isn't false precision. Only a Google-estimate-derived
 * arrival time (and any margin derived from it) gets the "around"/"about"
 * treatment.
 *
 * Originally built for Pakistan (lib/arrive-by-pakistan/format.ts), which
 * now re-exports this module rather than duplicating it — nothing here was
 * ever Pakistan-specific.
 */

/** Rounds a clock time to the nearest 5-minute mark, wrapping correctly across midnight. Returns "HH:MM". */
export function roundClockToNearestFive(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const totalMinutes = hour * 60 + minute;
  const rounded = Math.round(totalMinutes / 5) * 5;
  const wrapped = ((rounded % 1440) + 1440) % 1440;
  const roundedHour = Math.floor(wrapped / 60);
  const roundedMinute = wrapped % 60;
  return `${String(roundedHour).padStart(2, '0')}:${String(roundedMinute).padStart(2, '0')}`;
}

/** "1 hr 49 min" / "49 min" / "2 hr" — whole-minute human duration, never seconds. */
export function formatMinutesHuman(totalMinutes: number): string {
  const abs = Math.round(Math.abs(totalMinutes));
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

export function formatSecondsHuman(totalSeconds: number): string {
  return formatMinutesHuman(totalSeconds / 60);
}

/**
 * A factual traffic-impact sentence built only from Google's own two
 * numbers (traffic-aware duration vs. traffic-free staticDuration) — never
 * an invented light/normal/heavy label. Returns undefined when Google
 * didn't return staticDuration for this route, since there is then nothing
 * honest to compare against.
 */
export function trafficContextSentence(durationSeconds: number, staticDurationSeconds: number | undefined): string | undefined {
  if (staticDurationSeconds === undefined) return undefined;
  const diffMinutes = Math.round((durationSeconds - staticDurationSeconds) / 60);
  if (diffMinutes < 2) return 'Traffic is currently adding little extra time.';
  return `Current traffic is adding about ${diffMinutes} minutes.`;
}
