import { getAirportProfile, canEnablePublicly, type AirportProfile } from './airport-registry';

/**
 * Pure logic behind the /arrive-by canonical shell's airport dispatch
 * (components/arrive-by-shell.tsx), extracted so it's directly unit-
 * testable in this codebase's node-environment test suite (no jsdom/React
 * Testing Library here — see vitest.config.ts) rather than only provable
 * by rendering the component.
 */

/** A raw `?airport=` query value normalised the same way for every lookup — trimmed, uppercased, or null if absent/blank. */
export function normalizeAirportCode(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export type ShellDispatch =
  | { kind: 'selector' }
  | { kind: 'unsupported'; code: string }
  | { kind: 'journey'; profile: AirportProfile };

/**
 * Decides what the shell should render for a given raw `?airport=` value.
 * Never guesses: a missing code shows the selector, an unknown or
 * not-currently-public code shows the safe recovery state, and only a
 * genuinely public_beta/public + publiclyEnabled profile reaches a journey
 * flow — configured/internal-only airports can never leak through here.
 */
export function resolveShellDispatch(rawCode: string | null | undefined): ShellDispatch {
  const code = normalizeAirportCode(rawCode);
  if (!code) return { kind: 'selector' };

  const profile = getAirportProfile(code);
  const isPubliclyUsable = Boolean(profile && profile.publiclyEnabled && canEnablePublicly(profile.validationStatus));
  if (!profile || !isPubliclyUsable) return { kind: 'unsupported', code };

  return { kind: 'journey', profile };
}
