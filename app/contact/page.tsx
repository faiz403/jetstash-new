'use client';

import { useState, FormEvent } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
      setStatus('success');
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-xl px-5 sm:px-8">
        <h1 className="font-display text-4xl text-ink-900">Get in touch</h1>
        <p className="mt-3 text-ink-500">Questions about a route, a destination, or anything else — send us a message.</p>

        {status === 'success' ? (
          <div className="mt-8 flex items-center gap-3 rounded-md border border-brass/30 bg-brass-50 p-5">
            <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-brass-600" />
            <p className="text-sm text-ink-700">Thanks — we've got your message and will reply soon.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            {status === 'error' && (
              <div className="flex items-center gap-3 rounded-md border border-terracotta-200 bg-terracotta-50 p-4">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-terracotta-600" />
                <p className="text-sm text-terracotta-700">{errorMsg}</p>
              </div>
            )}
            <Field label="Name" id="name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Field
              label="Email"
              id="email"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              required
            />
            <div>
              <label htmlFor="message" className="text-sm font-semibold text-ink-700">
                Message
              </label>
              <textarea
                id="message"
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="mt-1.5 w-full rounded-sm border border-ink-200 px-4 py-3 text-ink-900 focus-visible:border-brass"
              />
            </div>
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="inline-flex h-12 items-center justify-center rounded-sm bg-ink-900 font-semibold text-sand-50 transition-colors hover:bg-ink-700 disabled:opacity-60"
            >
              {status === 'submitting' ? 'Sending…' : 'Send message'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-12 w-full rounded-sm border border-ink-200 px-4 text-ink-900 focus-visible:border-brass"
      />
    </div>
  );
}
