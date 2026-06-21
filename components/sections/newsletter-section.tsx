'use client';

import { useState, FormEvent } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export function NewsletterSection({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('submitting');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Request failed');
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className={compact ? 'py-12' : 'py-20'}>
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <div className="rounded-lg border border-white/10 bg-gradient-to-br from-ink-800 to-ink-900 p-8 sm:p-12">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-brass-300">JetStash Travel Club</span>
              <h2 className="mt-3 font-display text-3xl leading-tight text-sand-50 sm:text-4xl">
                Fare drops to Pakistan, India and the Gulf — sent when they happen
              </h2>
              <p className="mt-3 max-w-md text-ink-300">
                Free to join. We send a short note when a route from your nearest airport drops in price.
                Unsubscribe in one click, any time.
              </p>
            </div>

            <div>
              {status === 'success' ? (
                <div className="flex items-center gap-3 rounded-sm border border-brass/30 bg-brass-50/10 p-5">
                  <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-brass-300" />
                  <p className="text-sm text-sand-100">
                    You&apos;re on the list. Check your inbox to confirm your subscription.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
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
                    className="inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-brass px-6 font-semibold text-ink-900 transition-colors hover:bg-brass-400 disabled:opacity-60"
                  >
                    {status === 'submitting' ? 'Joining…' : 'Join free'}
                    {status !== 'submitting' && <ArrowRight className="h-4 w-4" strokeWidth={2.25} />}
                  </button>
                </form>
              )}
              {status === 'error' && (
                <p className="mt-2 text-sm text-terracotta-400">
                  Something went wrong — please try again or email us at hello@jetstash.co.uk.
                </p>
              )}
              <p className="mt-3 text-xs text-ink-400">No spam. We never sell your details. See our privacy policy.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
