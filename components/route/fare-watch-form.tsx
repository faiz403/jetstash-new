'use client';

import { useState, FormEvent } from 'react';
import { BellRing, CheckCircle2 } from 'lucide-react';
import { airports } from '@/data/airports';
import { destinations } from '@/data/destinations';
import { FARE_WATCH_INTENT_OPTIONS } from '@/lib/fare-watch-options';

interface FareWatchFormProps {
  defaultAirportSlug?: string;
  defaultDestinationSlug?: string;
}

export function FareWatchForm({ defaultAirportSlug, defaultDestinationSlug }: FareWatchFormProps) {
  const [email, setEmail] = useState('');
  const [airportSlug, setAirportSlug] = useState(defaultAirportSlug ?? '');
  const [destinationSlug, setDestinationSlug] = useState(defaultDestinationSlug ?? '');
  const [intent, setIntent] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !airportSlug || !destinationSlug) return;
    setStatus('submitting');
    try {
      const res = await fetch('/api/fare-watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, airportSlug, destinationSlug, intent: intent || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
      setStatus('success');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <div className="rounded-md border border-ink-100 bg-white p-6">
      <div className="flex items-center gap-2.5">
        <BellRing className="h-4.5 w-4.5 text-terracotta-600" strokeWidth={2} />
        <h3 className="font-display text-lg text-ink-900">Watch this route</h3>
      </div>
      <p className="mt-1.5 text-sm text-ink-500">
        Tell us your airport and destination and we'll email you when a genuinely better fare is logged. This is
        a real check against the fare history above, not an automated live feed.
      </p>

      {status === 'success' ? (
        <div className="mt-5 flex items-center gap-3 rounded-sm border border-brass/30 bg-brass-50 p-4">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-brass-600" />
          <p className="text-sm text-ink-700">You're watching this route. We'll be in touch when it's worth booking.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="watch-airport" className="text-xs text-ink-400">Departure airport</label>
              <select
                id="watch-airport"
                required
                value={airportSlug}
                onChange={(e) => setAirportSlug(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-sm border border-ink-200 bg-white px-3 text-sm text-ink-900 focus-visible:border-brass"
              >
                <option value="">Select airport</option>
                {airports.map((a) => (
                  <option key={a.slug} value={a.slug}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="watch-destination" className="text-xs text-ink-400">Destination</label>
              <select
                id="watch-destination"
                required
                value={destinationSlug}
                onChange={(e) => setDestinationSlug(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-sm border border-ink-200 bg-white px-3 text-sm text-ink-900 focus-visible:border-brass"
              >
                <option value="">Select destination</option>
                {destinations.map((d) => (
                  <option key={d.slug} value={d.slug}>{d.city}, {d.country}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="watch-intent" className="text-xs text-ink-400">What's this trip for? (optional)</label>
            <select
              id="watch-intent"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-sm border border-ink-200 bg-white px-3 text-sm text-ink-900 focus-visible:border-brass"
            >
              <option value="">Prefer not to say</option>
              {FARE_WATCH_INTENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="watch-email" className="sr-only">Email address</label>
            <input
              id="watch-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 flex-1 rounded-sm border border-ink-200 px-4 text-sm text-ink-900 focus-visible:border-brass"
            />
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="inline-flex h-11 items-center justify-center rounded-sm bg-ink-900 px-5 text-sm font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985] disabled:opacity-60"
            >
              {status === 'submitting' ? 'Saving…' : 'Watch this route'}
            </button>
          </div>
          {status === 'error' && (
            <p className="text-xs text-terracotta-600">{errorMsg || 'Something went wrong. Please try again or use the contact page.'}</p>
          )}
          <p className="text-xs text-ink-400">
            No spam. Unsubscribe any time. See our{' '}
            <a href="/privacy-policy" className="underline underline-offset-2 hover:text-ink-600">
              privacy policy
            </a>
            .
          </p>
        </form>
      )}
    </div>
  );
}
