'use client';

import { HONEYPOT_FIELD_NAME } from '@/lib/form-security';

/**
 * Bot-only field shared by all four public forms (contact, quote request,
 * newsletter, Route Watch). Positioned off-screen rather than
 * display:none, since some simple bots skip inputs hidden that way — and
 * excluded from the Tab order and from screen readers, so no real visitor
 * can ever land on it or hear it announced. A populated value on submit
 * means the request almost certainly wasn't a human; see the same-named
 * check in lib/form-security.ts, which accepts it silently rather than
 * revealing to the caller that detection happened.
 */
export function HoneypotField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] top-[-9999px] h-px w-px overflow-hidden">
      <label htmlFor={HONEYPOT_FIELD_NAME}>Leave this field blank</label>
      <input
        type="text"
        id={HONEYPOT_FIELD_NAME}
        name={HONEYPOT_FIELD_NAME}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
      />
    </div>
  );
}
