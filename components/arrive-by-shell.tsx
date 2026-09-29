'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getPublicAirportProfiles, type AirportProfile } from '@/lib/arrive-by-shared/airport-registry';
import { resolveShellDispatch, type AirportLookup } from '@/lib/arrive-by-shared/shell-dispatch';
import { searchAirports, type SearchableAirport } from '@/lib/arrive-by-shared/airport-search';
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

/** A public registry profile in the shape the local search expects. Size is a ranking hint only; every public airport ranks equally. */
function toSearchable(profile: AirportProfile): SearchableAirport & { profile: AirportProfile } {
  return { iata: profile.code, icao: '', name: profile.displayName, city: profile.city, countryCode: profile.countryCode, size: 'L', profile };
}

function AirportSelector() {
  const profiles = useMemo(() => getPublicAirportProfiles(), []);
  const searchable = useMemo(() => profiles.map(toSearchable), [profiles]);
  const [query, setQuery] = useState('');
  const results = query.trim() ? searchAirports(query, searchable) : [];
  const visible = query.trim() && results.length > 0 ? results.map((result) => result.profile) : profiles;
  return <div className="mx-auto max-w-5xl bg-white px-4 py-8 text-ink-900 sm:px-8">
    <p className="text-xs font-semibold uppercase tracking-wide text-brass-600">Arrive By — Beta</p>
    <h1 className="mt-3 font-display text-3xl sm:text-4xl">Find out when you'll actually reach where you're going after you land.</h1>
    <label htmlFor="arrive-by-airport-search" className="mt-3 block max-w-2xl text-ink-600">Where are you landing?</label>
    <input
      id="arrive-by-airport-search"
      type="search"
      value={query}
      onChange={(event) => setQuery(event.target.value.slice(0, 64))}
      placeholder="Airport code, name or city"
      autoComplete="off"
      className="mt-2 w-full max-w-md rounded-md border border-ink-200 bg-white px-3 py-2 text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
    />
    {query.trim() && results.length === 0 && (
      <p className="mt-3 max-w-2xl text-sm text-ink-500" role="status">Arrive By can't calculate that airport journey yet. Choose one of the airports below.</p>
    )}
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {visible.map((profile) => (
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

function NotYetSupportedAirport({ code, name }: { code: string; name?: string }) {
  return <div className="mx-auto max-w-3xl bg-white px-4 py-16 text-center text-ink-900 sm:px-8">
    <p className="text-xs font-semibold uppercase tracking-wide text-brass-600">Arrive By — Beta</p>
    <h1 className="mt-3 font-display text-2xl">Arrive By can't calculate this airport journey yet.</h1>
    <p className="mt-3 text-ink-600">{name ? `${name} (${code})` : code} isn't available in this beta, so we won't guess an estimate.</p>
    <Link href="/arrive-by" className="mt-6 inline-block rounded-sm bg-ink-900 px-6 py-3 font-semibold text-white">Choose a supported airport</Link>
  </div>;
}

function ChangeAirportLink() {
  return <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-8">
    <Link href="/arrive-by" className="text-sm font-semibold text-brass-600 hover:text-brass-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass">← Change airport</Link>
  </div>;
}

export function ArriveByShell({ lookup }: { lookup?: AirportLookup }) {
  const searchParams = useSearchParams();
  const dispatch = resolveShellDispatch(searchParams.get('airport'), lookup);

  if (dispatch.kind === 'selector') return <AirportSelector />;
  if (dispatch.kind === 'unsupported') return <UnsupportedAirport code={dispatch.code} />;
  if (dispatch.kind === 'not_yet_supported') return <NotYetSupportedAirport code={dispatch.code} name={dispatch.name} />;

  const { profile } = dispatch;
  return <div>
    <ChangeAirportLink />
    <p className="mx-auto max-w-5xl px-4 pt-2 text-sm text-ink-500 sm:px-8">{scopeCaption(profile)}</p>
    {profile.journeyEngine === 'ROAD_PICKUP_FIRST'
      ? <ArriveByPakistanPublic initialAirportCode={profile.code as PakistanAirportCode} />
      : <ArriveByManchesterPublic />}
  </div>;
}
