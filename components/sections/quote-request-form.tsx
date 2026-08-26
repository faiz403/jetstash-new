'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  User,
  Heart,
  Users,
  UsersRound,
  Briefcase,
  GraduationCap,
  Moon,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { TRIP_TYPE_OPTIONS, QUOTE_REGION_OPTIONS, QuoteTripType, QuoteRegion } from '@/lib/quote-request-options';
import { HoneypotField } from '@/components/forms/honeypot-field';
import { HONEYPOT_FIELD_NAME } from '@/lib/form-security';
import { track } from '@/lib/analytics';

interface QuoteRequestFormProps {
  initialTripType?: QuoteTripType;
  initialRegion?: QuoteRegion;
}

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 30;
const MAX_TRIP_TYPE_OTHER_LENGTH = 150;
const MAX_TRAVELLER_COUNT_LENGTH = 40;
const MAX_TRAVEL_WINDOW_LENGTH = 100;
const MAX_BUDGET_NOTE_LENGTH = 150;
const MAX_MESSAGE_LENGTH = 3000;

/** One glyph per trip type — purely a scanning aid (labels alone are always
 * sufficient; nothing here is communicated by icon shape alone). */
const TRIP_TYPE_ICONS: Record<QuoteTripType, LucideIcon> = {
  solo: User,
  couple: Heart,
  'family-trip': Users,
  'group-travel': UsersRound,
  business: Briefcase,
  student: GraduationCap,
  umrah: Moon,
  other: MoreHorizontal,
};

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  tripType: '' as QuoteTripType | '',
  tripTypeOther: '',
  region: '' as QuoteRegion | '',
  travellerCount: '',
  travelWindow: '',
  budgetNote: '',
  message: '',
};

export function QuoteRequestForm({ initialTripType, initialRegion }: QuoteRequestFormProps) {
  const [form, setForm] = useState<typeof emptyForm>({
    ...emptyForm,
    tripType: initialTripType ?? '',
    region: initialRegion ?? '',
  });
  const [honeypot, setHoneypot] = useState('');
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
        body: JSON.stringify({ ...form, [HONEYPOT_FIELD_NAME]: honeypot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
      setStatus('success');
      // Trip type and region are already-validated enum values, not free
      // text — safe product context, same category as a route/destination
      // slug. The honeypot check mirrors contact-form.tsx: only a bot ever
      // fills it, so this is what keeps a silently-accepted bot submission
      // from counting as a real conversion.
      if (!honeypot) track('quote_request_submit_success', { tripType: form.tripType, region: form.region });
      setForm(emptyForm);
      setHoneypot('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-md border border-brass/30 bg-brass-50 p-5">
        <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-brass-600" />
        <p className="text-sm text-ink-700">
          Thanks. We've got your quote request. A real person will research it and follow up by email with the
          options and reasoning — any booking is completed directly with the provider, not through JetStash.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {status === 'error' && (
        <div role="alert" aria-live="assertive" className="flex items-center gap-3 rounded-md border border-terracotta-200 bg-terracotta-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-terracotta-600" />
          <p className="text-sm text-terracotta-700">{errorMsg}</p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Name"
          id="name"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          required
          maxLength={MAX_NAME_LENGTH}
        />
        <TextField
          label="Email"
          id="email"
          type="email"
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
          required
          maxLength={MAX_EMAIL_LENGTH}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Phone (optional)"
          id="phone"
          type="tel"
          value={form.phone}
          onChange={(v) => setForm({ ...form, phone: v })}
          maxLength={MAX_PHONE_LENGTH}
        />
        <TextField
          label="Number of travellers (optional)"
          id="travellerCount"
          value={form.travellerCount}
          onChange={(v) => setForm({ ...form, travellerCount: v })}
          maxLength={MAX_TRAVELLER_COUNT_LENGTH}
        />
      </div>

      <TripTypePicker
        value={form.tripType}
        onChange={(v) =>
          setForm({ ...form, tripType: v, tripTypeOther: v === 'other' ? form.tripTypeOther : '' })
        }
      />

      {form.tripType === 'other' && (
        <TextField
          label="Tell us in a few words (optional)"
          id="tripTypeOther"
          value={form.tripTypeOther}
          onChange={(v) => setForm({ ...form, tripTypeOther: v })}
          placeholder="e.g. medical travel, visiting friends, a pilgrimage tour"
          maxLength={MAX_TRIP_TYPE_OTHER_LENGTH}
        />
      )}

      <SelectField
        label="Region"
        id="region"
        value={form.region}
        onChange={(v) => setForm({ ...form, region: v as QuoteRegion })}
        options={QUOTE_REGION_OPTIONS}
        required
      />

      <TextField
        label="Approximate travel dates (optional)"
        id="travelWindow"
        value={form.travelWindow}
        onChange={(v) => setForm({ ...form, travelWindow: v })}
        placeholder="e.g. Ramadan 2027, or flexible"
        maxLength={MAX_TRAVEL_WINDOW_LENGTH}
      />

      <TextField
        label="Budget note (optional)"
        id="budgetNote"
        value={form.budgetNote}
        onChange={(v) => setForm({ ...form, budgetNote: v })}
        placeholder="e.g. per person, or total for the group"
        maxLength={MAX_BUDGET_NOTE_LENGTH}
      />

      <div>
        <label htmlFor="message" className="text-sm font-semibold text-ink-700">
          Anything else that matters (optional)
        </label>
        <textarea
          id="message"
          rows={4}
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
        {status === 'submitting' ? 'Sending…' : 'Request a quote'}
      </button>
      <p className="text-xs text-ink-400">
        This is a request for a human to look into your journey and follow up with useful options, not an instant
        automated quote.
      </p>
      <p className="text-xs leading-relaxed text-ink-500">
        Read our{' '}
        <Link href="/privacy-policy" className="font-medium text-ink-700 underline underline-offset-2 hover:text-terracotta-600">
          Privacy Policy
        </Link>{' '}
        for information about how JetStash handles the details you provide.
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
  maxLength,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
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

/**
 * Every option is visible at once — no dropdown to open before a visitor can
 * confirm there's a fit for their own trip. Native <input type="radio">
 * under a visually-hidden (sr-only) label so the browser's own radio-group
 * semantics, keyboard nav (arrow keys) and required-group validation all
 * come free; the pill styling is purely a skin on top. The input stays
 * sr-only rather than display:none so it's still reachable by Tab —
 * has-[:focus-visible] then paints the visible ring on the label that
 * actually wraps it, since the real focus target is invisible.
 */
function TripTypePicker({
  value,
  onChange,
}: {
  value: QuoteTripType | '';
  onChange: (v: QuoteTripType) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink-700">Trip type</legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {TRIP_TYPE_OPTIONS.map((opt) => {
          const Icon = TRIP_TYPE_ICONS[opt.value];
          const checked = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brass ${
                checked
                  ? 'border-brass bg-brass text-ink-900'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-brass/50 hover:bg-sand-50'
              }`}
            >
              <input
                type="radio"
                name="tripType"
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                required
                className="sr-only"
              />
              <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
