import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  getClientIdentifier,
  HONEYPOT_FIELD_NAME,
  isHoneypotTriggered,
  validateTextField,
} from '@/lib/form-security';
import { HoneypotField } from '@/components/forms/honeypot-field';
import { isValidElement } from 'react';

/**
 * Direct unit coverage for the shared abuse-reduction utilities behind the
 * four public submission endpoints (contact, quote-request, subscribe,
 * route-watch) — see tests/public-form-hardening.test.ts for the
 * integration-level coverage of the routes and forms that consume these.
 */

describe('checkRateLimit', () => {
  it('allows requests up to the limit, then blocks the next one within the same window', () => {
    const key = 'test:allows-up-to-limit';
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).limited).toBe(false);
    }
    expect(checkRateLimit(key, 3, 60_000).limited).toBe(true);
  });

  it('tracks separate keys independently', () => {
    expect(checkRateLimit('test:key-a', 1, 60_000).limited).toBe(false);
    expect(checkRateLimit('test:key-b', 1, 60_000).limited).toBe(false);
    // key-a is now at its limit, key-b should still have its own fresh count.
    expect(checkRateLimit('test:key-a', 1, 60_000).limited).toBe(true);
    expect(checkRateLimit('test:key-b', 1, 60_000).limited).toBe(true);
  });

  it('resets the count once the window has elapsed', () => {
    vi.useFakeTimers();
    try {
      const key = 'test:resets-after-window';
      expect(checkRateLimit(key, 1, 1_000).limited).toBe(false);
      expect(checkRateLimit(key, 1, 1_000).limited).toBe(true);
      vi.advanceTimersByTime(1_001);
      expect(checkRateLimit(key, 1, 1_000).limited).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('getClientIdentifier', () => {
  it('reads the first entry of x-forwarded-for', () => {
    const req = new NextRequest('https://jetstash.test/api/contact', {
      headers: { 'x-forwarded-for': '198.51.100.7, 10.0.0.1' },
    });
    expect(getClientIdentifier(req)).toBe('198.51.100.7');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = new NextRequest('https://jetstash.test/api/contact', {
      headers: { 'x-real-ip': '198.51.100.9' },
    });
    expect(getClientIdentifier(req)).toBe('198.51.100.9');
  });

  it('falls back to "unknown" when neither header is present, rather than throwing', () => {
    const req = new NextRequest('https://jetstash.test/api/contact');
    expect(getClientIdentifier(req)).toBe('unknown');
  });
});

describe('isHoneypotTriggered', () => {
  it('is false for an empty string, whitespace-only string, undefined, or missing value', () => {
    expect(isHoneypotTriggered('')).toBe(false);
    expect(isHoneypotTriggered('   ')).toBe(false);
    expect(isHoneypotTriggered(undefined)).toBe(false);
  });

  it('is true for any non-empty string a bot might have filled in', () => {
    expect(isHoneypotTriggered('http://spam.example')).toBe(true);
    expect(isHoneypotTriggered('x')).toBe(true);
  });

  it('is false for non-string values (never crashes on unexpected shapes)', () => {
    expect(isHoneypotTriggered(123)).toBe(false);
    expect(isHoneypotTriggered({})).toBe(false);
    expect(isHoneypotTriggered(null)).toBe(false);
  });
});

describe('validateTextField', () => {
  it('required field: missing, null or empty is rejected', () => {
    expect(validateTextField(undefined, { required: true, maxLength: 10, fieldName: 'Name' })).toMatch(/required/);
    expect(validateTextField(null, { required: true, maxLength: 10, fieldName: 'Name' })).toMatch(/required/);
    expect(validateTextField('', { required: true, maxLength: 10, fieldName: 'Name' })).toMatch(/required/);
    expect(validateTextField('   ', { required: true, maxLength: 10, fieldName: 'Name' })).toMatch(/required/);
  });

  it('optional field: missing, null or empty is accepted', () => {
    expect(validateTextField(undefined, { required: false, maxLength: 10, fieldName: 'Phone' })).toBeNull();
    expect(validateTextField(null, { required: false, maxLength: 10, fieldName: 'Phone' })).toBeNull();
    expect(validateTextField('', { required: false, maxLength: 10, fieldName: 'Phone' })).toBeNull();
  });

  it('a value within the length limit is accepted for both required and optional fields', () => {
    expect(validateTextField('Amina', { required: true, maxLength: 10, fieldName: 'Name' })).toBeNull();
    expect(validateTextField('Amina', { required: false, maxLength: 10, fieldName: 'Name' })).toBeNull();
  });

  it('a value over the length limit is rejected', () => {
    expect(validateTextField('a'.repeat(11), { required: true, maxLength: 10, fieldName: 'Name' })).toMatch(
      /too long/
    );
  });

  it('a value exactly at the length limit is accepted (boundary check)', () => {
    expect(validateTextField('a'.repeat(10), { required: true, maxLength: 10, fieldName: 'Name' })).toBeNull();
  });

  it('rejects non-string values outright — arrays, objects, numbers, booleans — even for optional fields', () => {
    expect(validateTextField(['a'], { required: false, maxLength: 10, fieldName: 'Note' })).toMatch(/invalid/);
    expect(validateTextField({ a: 1 }, { required: false, maxLength: 10, fieldName: 'Note' })).toMatch(/invalid/);
    expect(validateTextField(42, { required: false, maxLength: 10, fieldName: 'Note' })).toMatch(/invalid/);
    expect(validateTextField(true, { required: false, maxLength: 10, fieldName: 'Note' })).toMatch(/invalid/);
  });

  it('error messages never include the raw submitted value (safe to show a caller)', () => {
    const secretLookingValue = 'sk_live_should_never_appear_1234567890_extra';
    const error = validateTextField(secretLookingValue, { required: true, maxLength: 5, fieldName: 'Name' });
    expect(error).not.toContain(secretLookingValue);
  });
});

describe('HoneypotField', () => {
  it('renders an input named and identified by the shared HONEYPOT_FIELD_NAME constant', () => {
    const element = HoneypotField({ value: '', onChange: () => undefined });
    expect(isValidElement(element)).toBe(true);
    // Wrapper is aria-hidden (removed from the accessibility tree for real users/AT).
    expect((element.props as { 'aria-hidden'?: string })['aria-hidden']).toBe('true');
  });

  it('the input is excluded from the Tab order and from browser autofill', () => {
    const element = HoneypotField({ value: '', onChange: () => undefined });
    const wrapperChildren = (element.props as { children: unknown }).children as unknown[];
    const input = wrapperChildren.find(
      (child) => isValidElement(child) && (child.props as { type?: string }).type === 'text'
    ) as { props: { tabIndex?: number; autoComplete?: string; name?: string; id?: string; required?: boolean } };
    expect(input).toBeTruthy();
    expect(input.props.tabIndex).toBe(-1);
    expect(input.props.autoComplete).toBe('off');
    expect(input.props.name).toBe(HONEYPOT_FIELD_NAME);
    expect(input.props.id).toBe(HONEYPOT_FIELD_NAME);
    // Never required — a real visitor must never be blocked by this field.
    expect(input.props.required).toBeUndefined();
  });

  it('the field has a real label (defence in depth for any assistive tech that bypasses aria-hidden)', () => {
    const element = HoneypotField({ value: '', onChange: () => undefined });
    const wrapperChildren = (element.props as { children: unknown }).children as unknown[];
    const label = wrapperChildren.find(
      (child) => isValidElement(child) && (child.props as { htmlFor?: string }).htmlFor === HONEYPOT_FIELD_NAME
    );
    expect(label).toBeTruthy();
  });
});
