'use client';

import { useState, FormEvent } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { TRIP_TYPE_OPTIONS, QUOTE_REGION_OPTIONS, QuoteTripType, QuoteRegion } from '@/lib/quote-request-options';

interface QuoteRequestFormProps {
  initialTripType?: QuoteTripType;
  initialRegion?: QuoteRegion;
}

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  tripType: '' as QuoteTripType | '',
  region: '' as QuoteRegion | '',
  travellerCount: '',
  travelWindow: '',
  budgetNote: '',
  message: '',
};

export function QuoteRequestForm({ initialTripType, initialRegion }: QuoteRequestFormProps) {
  const [form, setForm] = useState({
    ...emptyForm,
    tripType: initialTripType ?? '',
    region: initialRegion ?? '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/quote-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
      setStatus('success');
      setForm(emptyForm);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex items-center gap-3 rounded-md border border-brass/30 bg-brass-50 p-5">
        <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-brass-600" />
        <p className="text-sm text-ink-700">
          Thanks — we've got your quote request and will follow up by email. This goes to a real person, not an
          automated pricing engine.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {status === 'error' && (
        <div className="flex items-center gap-3 rounded-md border border-terracotta-200 bg-terracotta-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-terracotta-600" />
          <p className="text-sm text-terracotta-700">{errorMsg}</p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Name" id="name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <TextField label="Email" id="email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Phone (optional)" id="phone" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <TextField label="Number of travellers (optional)" id="travellerCount" value={form.travellerCount} onChange={(v) => setForm({ ...form, travellerCount: v })} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Trip type"
          id="tripType"
          value={form.tripType}
          onChange={(v) => setForm({ ...form, tripType: v as QuoteTripType })}
          options={TRIP_TYPE_OPTIONS}
          required
        />
        <SelectField
          label="Region"
          id="region"
          value={form.region}
          onChange={(v) => setForm({ ...form, region: v as QuoteRegion })}
          options={QUOTE_REGION_OPTIONS}
          required
        />
      </div>

      <TextField
        label="Approximate travel dates (optional)"
        id="travelWindow"
        value={form.travelWindow}
        onChange={(v) => setForm({ ...form, travelWindow: v })}
        placeholder="e.g. Ramadan 2027, or flexible"
      />

      <TextField
        label="Budget note (optional)"
        id="budgetNote"
        value={form.budgetNote}
        onChange={(v) => setForm({ ...form, budgetNote: v })}
        placeholder="e.g. per person, or total for the group"
      />

      <div>
        <label htmlFor="message" className="text-sm font-semibold text-ink-700">
          Anything else that matters (optional)
        </label>
        <textarea
          id="message"
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="mt-1.5 w-full rounded-sm border border-ink-200 px-4 py-3 text-ink-900 focus-visible:border-brass"
        />
      </div>

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="inline-flex h-12 items-center justify-center rounded-sm bg-ink-900 font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985] disabled:opacity-60"
      >
        {status === 'submitting' ? 'Sending…' : 'Request a quote'}
      </button>
      <p className="text-xs text-ink-400">
        This is a request for a human to follow up with real pricing — not an instant automated quote.
      </p>
    </form>
  );
}

function TextField({
  label,
  id,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
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
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-12 w-full rounded-sm border border-ink-200 px-4 text-ink-900 focus-visible:border-brass"
      />
    </div>
  );
}

function SelectField({
  label,
  id,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink-700">
        {label}
      </label>
      <select
        id={id}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-12 w-full rounded-sm border border-ink-200 bg-white px-4 text-ink-900 focus-visible:border-brass"
      >
        <option value="">Select {label.toLowerCase().replace(' (optional)', '')}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
