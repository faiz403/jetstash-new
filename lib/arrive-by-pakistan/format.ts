/**
 * Pakistan's time-formatting helpers are now generic and shared across
 * every Arrive By engine — see lib/arrive-by-shared/format.ts for the
 * implementation and the full rationale (why only a Google-estimate-
 * derived time gets rounded). Nothing here was ever Pakistan-specific;
 * this file just re-exports under the original path so nothing importing
 * it needs to change.
 */
export {
  roundClockToNearestFive,
  formatMinutesHuman,
  formatSecondsHuman,
  trafficContextSentence,
} from '@/lib/arrive-by-shared/format';
