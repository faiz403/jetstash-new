'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getPublicAirportProfiles, type AirportProfile } from '@/lib/arrive-by-shared/airport-registry';
import { resolveShellDispatch } from '@/lib/arrive-by-shared/shell-dispatch';
import { ArriveByPakistanPublic } from '@/components/arrive-by-pakistan-public';
import { ArriveByManchesterPublic } from '@/components/arrive-by-manchester-public';
import type { PakistanAirportCode } from '@/lib/arrive-by-pakistan/types';

/**
 * The canonical Arrive By shell (Phase 4). Chooses an airport, loads its
 * AirportProfile from the shared registry, and dispatches to whichever
 * existing public engine component that profile's journeyEngine names --
 * it owns no transport logic itself and duplicates neither engine.
 *
 * The selector is driven entirely by getPublicAirportProfiles(): adding a
 * future validated, publicly-enabled airport to the registry makes it
 * appear here with no change to this file (see
 * tests/arrive-by-shell.test.ts's registry-scalability test).
 */

/** Per-airport beta-scope caption shown after selection -- market-specific limitations, not the top-level product identity. */
function scopeCaption(profile: AirportProfile): string {
  if (profile.journeyEngine === 'TRANSIT_FIRST') {
    return `${profile.displayName} beta — Terminal 2 only, UK destinations only.`;
  }
  return `${profile.displayName} beta — currently supported Pakistan airports: ${getPublicAirportProfiles().filter((p) => p.journeyEngine === 'ROAD_PICKUP_FIRST').map((p) => p.code).join(', ')}.`;
}

function AirportSelector() {
  const profiles = getPublicAirportProfiles();
  return <div className="mx-auto max-w-5xl bg-white px-4 py-8 text-ink-900 sm:px-8">
    <p className="text-xs font-semibold uppercase tracking-wide text-brass-600">Arrive By — Beta</p>
    <h1 className="mt-3 font-display text-3xl sm:text-4xl">Find out when you'll actually reach where you're going after you land.</h1>
    <p className="mt-3 max-w-2xl text-ink-600">Where are you landing?</p>
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {profiles.map((profile) => (
        <Link
          key={profile.code}
          href={`/arrive-by?airport=${profile.code}`}
          className="rounded-md border border-ink-200 bg-sand-50 p-4 transition hover:border-brass hover:bg-brass-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          <p className="font-display text-xl">{profile.city}</p>
          <p className="text-sm text-ink-500">{profile.displayName} · {profile.code}</p>
        </Link>
      ))}
    </div>
    <p className="mt-6 max-w-2xl text-sm text-ink-500">
      Arrive By currently supports only the airports shown above. This is an early beta, not a
      general flight-search tool — estimates, not guarantees.
    </p>
  </div>;
}

function UnsupportedAirport({ code }: { code: string }) {
  return <div className="mx-auto max-w-3xl bg-white px-4 py-16 text-center text-ink-900 sm:px-8">
    <p className="text-xs font-semibold uppercase tracking-wide text-brass-600">Arrive By — Beta</p>
    <h1 className="mt-3 font-display text-2xl">That airport isn't supported by Arrive By yet.</h1>
    <p className="mt-3 text-ink-600">"{code}" isn't one of the airports currently in this beta.</p>
    <Link href="/arrive-by" className="mt-6 inline-block rounded-sm bg-ink-900 px-6 py-3 font-semibold text-white">Choose a supported airport</Link>
  </div>;
}

function ChangeAirportLink() {
  return <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-8">
    <Link href="/arrive-by" className="text-sm font-semibold text-brass-600 hover:text-brass-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass">← Change airport</Link>
  </div>;
}

export function ArriveByShell() {
  const searchParams = useSearchParams();
  const dispatch = resolveShellDispatch(searchParams.get('airport'));

  if (dispatch.kind === 'selector') return <AirportSelector />;
  if (dispatch.kind === 'unsupported') return <UnsupportedAirport code={dispatch.code} />;

  const { profile } = dispatch;
  return <div>
    <ChangeAirportLink />
    <p className="mx-auto max-w-5xl px-4 pt-2 text-sm text-ink-500 sm:px-8">{scopeCaption(profile)}</p>
    {profile.journeyEngine === 'ROAD_PICKUP_FIRST'
      ? <ArriveByPakistanPublic initialAirportCode={profile.code as PakistanAirportCode} />
      : <ArriveByManchesterPublic />}
  </div>;
}
