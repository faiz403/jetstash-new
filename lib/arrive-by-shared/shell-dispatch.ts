import { getAirportProfile, canEnablePublicly, type AirportProfile } from './airport-registry';

/**
 * Pure logic behind the /arrive-by canonical shell's airport dispatch
 * (components/arrive-by-shell.tsx), extracted so it's directly unit-
 * testable in this codebase's node-environment test suite (no jsdom/React
 * Testing Library here — see vitest.config.ts) rather than only provable
 * by rendering the component.
 *
 * Client-safe on purpose: this module (and the shell) must not import the
 * worldwide airport catalogue, which is ~350 KB. The catalogue-aware facts
 * the shell needs are resolved on the server (the server-side capability module's
 * shell-lookup helper, called from app/arrive-by/page.tsx) and passed in
 * as a tiny `AirportLookup`.
 */

/** A raw `?airport=` query value normalised the same way for every lookup — trimmed, uppercased, or null if absent/blank. */
export function normalizeAirportCode(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

/** Longest code echoed back to the user; anything longer is truncated for display, never used for lookup. */
const MAX_DISPLAY_CODE_LENGTH = 8;

/**
 * What the server knows about the requested airport code from the worldwide
 * catalogue and the capability gate. Absent (or `known: false`) means the
 * code is not a catalogued airport at all.
 */
export interface AirportLookup {
  code: string;
  /** True when the code is in the worldwide catalogue or the override registry. */
  known: boolean;
  /** Catalogue display name, for the "can't calculate this airport yet" state. */
  name?: string;
  /** True when the capability gate has explicitly blocked this airport (`temporarily_unsupported`) -- beats a public profile. */
  blocked?: boolean;
}

export type ShellDispatch =
  | { kind: 'selector' }
  /** Not a catalogued airport (typo, unknown code). */
  | { kind: 'unsupported'; code: string }
  /** A real airport Arrive By cannot safely calculate a journey for (yet, or currently blocked). */
  | { kind: 'not_yet_supported'; code: string; name?: string }
  | { kind: 'journey'; profile: AirportProfile };

/**
 * Decides what the shell should render for a given raw `?airport=` value.
 * Never guesses: a missing code shows the selector, an unknown code shows
 * the unsupported state, a catalogued-but-not-eligible (or blocked) code
 * shows "can't calculate yet", and only a genuinely public_beta/public +
 * publiclyEnabled override profile reaches a journey flow — configured
 * and catalogue-only airports can never leak through here. (Generic
 * road_supported airports get their journey UI in a later phase; until
 * then they resolve to not_yet_supported.)
 */
export function resolveShellDispatch(rawCode: string | null | undefined, lookup?: AirportLookup): ShellDispatch {
  const code = normalizeAirportCode(rawCode);
  if (!code) return { kind: 'selector' };
  const displayCode = code.slice(0, MAX_DISPLAY_CODE_LENGTH);

  const profile = getAirportProfile(code);
  const isPubliclyUsable = Boolean(profile && profile.publiclyEnabled && canEnablePublicly(profile.validationStatus));
  const blocked = lookup?.code === code && lookup.blocked === true;
  if (profile && isPubliclyUsable && !blocked) return { kind: 'journey', profile };

  if (lookup?.code === code && lookup.known) return { kind: 'not_yet_supported', code: displayCode, name: lookup.name };
  return { kind: 'unsupported', code: displayCode };
}
