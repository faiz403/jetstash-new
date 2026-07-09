'use client';

import { useState, FormEvent } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { airports } from '@/data/airports';
import { TRAVEL_INTEREST_OPTIONS } from '@/lib/travel-club-options';

export function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [nearestAirport, setNearestAirport] = useState('');
  const [interest, setInterest] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('submitting');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          nearestAirport: nearestAirport || undefined,
          interest: interest || undefined,
        }),
      });
      if (!res.ok) throw new Error('Request failed');
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="py-20">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <div className="rounded-lg border border-white/10 bg-gradient-to-br from-ink-800 to-ink-900 p-8 sm:p-12">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-brass-300">JetStash Travel Club</span>
              <h2 className="mt-3 font-display text-3xl leading-tight text-sand-50 sm:text-4xl">
                Tell us your route. We'll tell you when it's worth booking.
              </h2>
              <p className="mt-3 max-w-md text-ink-300">
                Free to join. Pick your nearest airport and what you're tracking, and that's what shapes what
                lands in your inbox, not a generic weekly digest. Unsubscribe in one click, any time.
              </p>
            </div>

            <div>
              {status === 'success' ? (
                <div className="rounded-sm border border-brass/30 bg-brass-50/10 p-5">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-brass-300" />
                    <p className="text-sm text-sand-100">You&apos;re on the list. Welcome to Travel Club.</p>
                  </div>
                  {(() => {
                    const selected = TRAVEL_INTEREST_OPTIONS.find((o) => o.value === interest);
                    if (!selected) return null;
                    return (
                      <p className="mt-3 text-xs text-ink-300">
                        We&apos;ll keep an eye out for {selected.shortLabel} fares worth flagging. In the meantime,{' '}
                        <a href={selected.href} className="font-semibold text-brass-300 underline underline-offset-2 hover:text-brass-200">
                          have a look at the {selected.shortLabel} hub
                        </a>
                        .
                      </p>
                    );
                  })()}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <label htmlFor="email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-12 flex-1 rounded-sm border border-white/15 bg-white/5 px-4 text-sand-50 placeholder:text-ink-400 focus-visible:border-brass"
                    />
                    <button
                      type="submit"
                      disabled={status === 'submitting'}
                      className="inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-brass px-6 font-semibold text-ink-900 transition-all hover:bg-brass-400 hover:shadow-brass-glow active:scale-[0.985] disabled:opacity-60"
                    >
                      {status === 'submitting' ? 'Joining…' : 'Join free'}
                      {status !== 'submitting' && <ArrowRight className="h-4 w-4" strokeWidth={2.25} />}
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="nearestAirport" className="text-xs text-ink-400">
                        Nearest airport <span className="text-ink-500">(optional)</span>
                      </label>
                      <select
                        id="nearestAirport"
                        value={nearestAirport}
                        onChange={(e) => setNearestAirport(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-sm border border-white/15 bg-white/5 px-3 text-sm text-sand-50 focus-visible:border-brass"
                      >
                        <option value="" className="bg-ink-900">Select airport</option>
                        {airports.map((a) => (
                          <option key={a.slug} value={a.slug} className="bg-ink-900">
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="interest" className="text-xs text-ink-400">
                        What you're tracking <span className="text-ink-500">(optional)</span>
                      </label>
                      <select
                        id="interest"
                        value={interest}
                        onChange={(e) => setInterest(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-sm border border-white/15 bg-white/5 px-3 text-sm text-sand-50 focus-visible:border-brass"
                      >
                        <option value="" className="bg-ink-900">Select region</option>
                        {TRAVEL_INTEREST_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-ink-900">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </form>
              )}
              {status === 'error' && (
                <p className="mt-2 text-sm text-terracotta-400">
                  Something went wrong. Please try again, or use our{' '}
                  <a href="/contact" className="underline underline-offset-2 hover:text-terracotta-300">
                    contact form
                  </a>
                  .
                </p>
              )}
              <p className="mt-3 text-xs text-ink-400">
                No spam. We never sell your details. See our{' '}
                <a href="/privacy-policy" className="underline underline-offset-2 hover:text-ink-300">
                  privacy policy
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
