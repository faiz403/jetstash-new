/**
 * The local<->UTC conversion is now shared by every road-first Arrive By
 * journey -- see lib/arrive-by-shared/timezone.ts. Re-exported here under
 * the original path so nothing importing it needs to change.
 */
export { localDateTimeToIso, isoToClock } from '@/lib/arrive-by-shared/timezone';
