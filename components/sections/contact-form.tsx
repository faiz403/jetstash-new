'use client';

import { useState, FormEvent } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { HoneypotField } from '@/components/forms/honeypot-field';
import { HONEYPOT_FIELD_NAME } from '@/lib/form-security';
import { track } from '@/lib/analytics';

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5000;

export function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [honeypot, setHoneypot] = useState('');
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
        body: JSON.stringify({ ...form, [HONEYPOT_FIELD_NAME]: honeypot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
      setStatus('success');
      setForm({ name: '', email: '', message: '' });
      // The honeypot is only ever filled by a bot — a real visitor's own
      // submission always has it empty, so this check alone keeps a
      // silently-accepted bot submission (which the API also answers with
      // {success:true}, deliberately, so it can't tell it was caught) from
      // ever being counted as a real conversion.
      if (!honeypot) track('contact_submit_success');
      setHoneypot('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <div role="status" aria-live="polite" className="mt-8 flex items-center gap-3 rounded-md border border-brass/30 bg-brass-50 p-5">
        <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-brass-600" />
        <p className="text-sm text-ink-700">Thanks. We&apos;ve got your message and will reply soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
      {status === 'error' && (
        <div role="alert" aria-live="assertive" className="flex items-center gap-3 rounded-md border border-terracotta-200 bg-terracotta-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-terracotta-600" />
          <p className="text-sm text-terracotta-700">{errorMsg}</p>
        </div>
      )}
      <Field
        label="Name"
        id="name"
        value={form.name}
        onChange={(v) => setForm({ ...form, name: v })}
        required
        maxLength={MAX_NAME_LENGTH}
      />
      <Field
        label="Email"
        id="email"
        type="email"
        value={form.email}
        onChange={(v) => setForm({ ...form, email: v })}
        required
        maxLength={MAX_EMAIL_LENGTH}
      />
      <div>
        <label htmlFor="message" className="text-sm font-semibold text-ink-700">
          Message
        </label>
        <textarea
          id="message"
          required
          rows={5}
          maxLength={MAX_MESSAGE_LENGTH}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="mt-1.5 w-full rounded-sm border border-ink-200 px-4 py-3 text-ink-900 focus-visible:border-brass"
        />
      </div>
      <HoneypotField value={honeypot} onChange={setHoneypot} />
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="inline-flex h-12 items-center justify-center rounded-sm bg-ink-900 font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985] disabled:opacity-60"
      >
        {status === 'submitting' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = 'text',
  required,
  maxLength,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
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
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-12 w-full rounded-sm border border-ink-200 px-4 text-ink-900 focus-visible:border-brass"
      />
    </div>
  );
}
