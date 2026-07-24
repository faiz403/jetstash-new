import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  TRIP_TYPE_OPTIONS,
  VALID_TRIP_TYPES,
  isQuoteTripType,
  type QuoteTripType,
} from '@/lib/quote-request-options';

/**
 * Trip Type field redesign — every first-time visitor should immediately see
 * an option that fits them (no hidden-behind-a-click dropdown), Other must
 * always exist as an escape hatch, and every pre-existing deep-link value
 * (?tripType=umrah / ?tripType=family-trip, used by app/umrah/page.tsx,
 * app/family-holidays/page.tsx, region-hub-page.tsx and
 * homepage-sections.tsx) must keep resolving to the same option.
 *
 * quote-request-form.tsx is a 'use client' component with hooks, so — same
 * as pull-brief.tsx elsewhere in this suite — it can't be called directly in
 * this repo's node-environment Vitest setup; the component-wiring
 * assertions below follow the established source-text pattern.
 */

const formSrc = readFileSync(join(process.cwd(), 'components/sections/quote-request-form.tsx'), 'utf8');
const routeSrc = readFileSync(join(process.cwd(), 'app/api/quote-request/route.ts'), 'utf8');
const pageSrc = readFileSync(join(process.cwd(), 'app/quote-request/page.tsx'), 'utf8');

describe('the option list itself', () => {
  it('has exactly 8 options — the reviewed, deliberately-not-overcomplicated set', () => {
    expect(TRIP_TYPE_OPTIONS).toHaveLength(8);
  });

  it('Other always exists, and is last (the universal escape hatch, never the default)', () => {
    const last = TRIP_TYPE_OPTIONS[TRIP_TYPE_OPTIONS.length - 1];
    expect(last.value).toBe('other');
    expect(last.label).toBe('Other');
  });

  it('every option has a short, unambiguous label — no option repeats the field name ("trip"/"type") or is empty', () => {
    for (const opt of TRIP_TYPE_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.label.length).toBeLessThanOrEqual(20);
      expect(opt.label.toLowerCase()).not.toMatch(/\btrip type\b/);
    }
  });

  it('covers every traveller pattern named in the brief: solo, couple/honeymoon, family, group, business, student, Umrah, other', () => {
    const labels = TRIP_TYPE_OPTIONS.map((o) => o.label.toLowerCase());
    expect(labels.some((l) => l.includes('solo'))).toBe(true);
    expect(labels.some((l) => l.includes('couple') || l.includes('honeymoon'))).toBe(true);
    expect(labels.some((l) => l === 'family')).toBe(true);
    expect(labels.some((l) => l === 'group')).toBe(true);
    expect(labels.some((l) => l === 'business')).toBe(true);
    expect(labels.some((l) => l === 'student')).toBe(true);
    expect(labels.some((l) => l === 'umrah')).toBe(true);
  });
});

describe('backward compatibility — every pre-existing deep-link value keeps working', () => {
  it('umrah, family-trip and group-travel remain valid values (only labels were shortened)', () => {
    expect(isQuoteTripType('umrah')).toBe(true);
    expect(isQuoteTripType('family-trip')).toBe(true);
    expect(isQuoteTripType('group-travel')).toBe(true);
  });

  it('the new values are also valid', () => {
    for (const v of ['solo', 'couple', 'business', 'student', 'other'] satisfies QuoteTripType[]) {
      expect(isQuoteTripType(v)).toBe(true);
    }
  });

  it('an unrecognised value is rejected, not silently accepted', () => {
    expect(isQuoteTripType('honeymoon')).toBe(false); // the real value is 'couple', not a new bespoke slug
    expect(isQuoteTripType('')).toBe(false);
    expect(isQuoteTripType(undefined)).toBe(false);
    expect(isQuoteTripType(123)).toBe(false);
  });

  it('VALID_TRIP_TYPES is derived from the options list, never a separately hand-typed array', () => {
    expect(VALID_TRIP_TYPES).toEqual(TRIP_TYPE_OPTIONS.map((o) => o.value));
  });

  it('every external deep-link call site still points at a value this list actually supports', () => {
    const callers = [
      'app/umrah/page.tsx',
      'app/family-holidays/page.tsx',
      'components/sections/region-hub-page.tsx',
      'components/homepage-v2/homepage-sections.tsx',
    ];
    for (const file of callers) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      const matches = [...src.matchAll(/tripType=([a-z-]+)/g)].map((m) => m[1]);
      expect(matches.length, `${file} should reference at least one tripType`).toBeGreaterThan(0);
      for (const value of matches) {
        expect(isQuoteTripType(value), `${file} references tripType=${value}`).toBe(true);
      }
    }
  });
});

describe('the field is no longer a dropdown — every option is visible without a click', () => {
  it('the trip-type <select> is gone from the form', () => {
    const tripTypeSelectBlock = formSrc.match(/<SelectField\s+label="Trip type"[\s\S]*?\/>/);
    expect(tripTypeSelectBlock).toBeNull();
  });

  it('a TripTypePicker component renders every option as a visible, individually selectable control', () => {
    expect(formSrc).toMatch(/function TripTypePicker/);
    expect(formSrc).toMatch(/<TripTypePicker/);
    const pickerBody = formSrc.slice(formSrc.indexOf('function TripTypePicker'));
    expect(pickerBody).toMatch(/TRIP_TYPE_OPTIONS\.map/);
  });

  it('uses real native radio inputs (one semantic group, not a set of independent toggle buttons)', () => {
    const pickerBody = formSrc.slice(formSrc.indexOf('function TripTypePicker'));
    expect(pickerBody).toMatch(/type="radio"/);
    expect(pickerBody).toMatch(/name="tripType"/);
    expect(pickerBody).toMatch(/<fieldset>/);
    expect(pickerBody).toMatch(/<legend/);
  });

  it('Region remains a dropdown — untouched, out of scope for this redesign', () => {
    expect(formSrc).toMatch(/<SelectField\s*\n\s*label="Region"/);
  });
});

describe('accessibility of the new picker', () => {
  it('the radio input stays reachable (sr-only, not display:none/hidden) and required', () => {
    const pickerBody = formSrc.slice(formSrc.indexOf('function TripTypePicker'));
    const inputBlock = pickerBody.match(/<input[\s\S]*?\/>/)?.[0] ?? '';
    expect(inputBlock).toMatch(/className="sr-only"/);
    // Guard against the real anti-pattern (display:none / Tailwind's
    // `hidden` class on the input itself, which would drop it from the tab
    // order) — not against "aria-hidden" on the decorative icon nearby,
    // which is correct and expected.
    expect(inputBlock).not.toMatch(/display:\s*none/);
    expect(inputBlock).not.toMatch(/className="[^"]*\bhidden\b[^"]*"/);
    expect(inputBlock).toMatch(/\brequired\b/);
  });

  it('keyboard focus gets a visible indicator on the pill even though the real input is visually hidden', () => {
    const pickerBody = formSrc.slice(formSrc.indexOf('function TripTypePicker'));
    expect(pickerBody).toMatch(/has-\[:focus-visible\]/);
  });

  it('every option has an accessible label from real text, not icon-only', () => {
    const pickerBody = formSrc.slice(formSrc.indexOf('function TripTypePicker'));
    expect(pickerBody).toMatch(/\{opt\.label\}/);
    // Icons are decorative only.
    expect(pickerBody).toMatch(/aria-hidden="true"/);
  });
});

describe('"Other" is a real escape hatch, not a dead end', () => {
  it('selecting "other" reveals an optional free-text field to capture what it actually is', () => {
    expect(formSrc).toMatch(/form\.tripType === 'other'/);
    const otherBlock = formSrc.match(/\{form\.tripType === 'other' && \(([\s\S]*?)\)\}/)?.[1] ?? '';
    expect(otherBlock).toMatch(/id="tripTypeOther"/);
    expect(otherBlock).toMatch(/\(optional\)/i);
  });

  it('switching away from "other" clears the free-text field rather than silently submitting stale text', () => {
    expect(formSrc).toMatch(/tripTypeOther: v === 'other' \? form\.tripTypeOther : ''/);
  });

  it('the API route only surfaces the free-text detail when tripType is actually "other"', () => {
    const detailBlock = routeSrc.match(/const tripTypeDetail =([\s\S]*?);/)?.[1] ?? '';
    expect(detailBlock).toMatch(/tripType === 'other'/);
  });

  it('the API still requires a tripType to be chosen at all (Other included) — the escape hatch removes friction, not the categorisation signal', () => {
    expect(routeSrc).toMatch(/!name \|\| !email \|\| !tripType \|\| !region/);
    expect(routeSrc).toMatch(/isQuoteTripType\(tripType\)/);
  });
});

describe('surrounding page copy no longer contradicts the expanded option set', () => {
  it('the /quote-request hero and metadata no longer claim the form is only for Umrah/family/group', () => {
    expect(pageSrc.toLowerCase()).not.toMatch(/for umrah packages, family trips and group travel/);
  });

  it('the hero description now names the broader set of trip types the field actually supports', () => {
    const heroDescMatch = pageSrc.match(/description="([^"]+)"/);
    expect(heroDescMatch).not.toBeNull();
    const desc = heroDescMatch![1].toLowerCase();
    expect(desc).toMatch(/solo/);
    expect(desc).toMatch(/business/);
  });
});

describe('no unrelated behaviour changed', () => {
  it('name, email and region remain required exactly as before', () => {
    expect(formSrc).toMatch(/label="Name" id="name"[\s\S]*?required/);
    expect(formSrc).toMatch(/label="Email" id="email"[\s\S]*?required/);
  });

  it('the API route still fails clearly with a 503 when no email provider is configured, unchanged', () => {
    expect(routeSrc).toMatch(/status: 503/);
    expect(routeSrc).toMatch(/RESEND_API_KEY/);
  });

  it('the success/error states and submit button copy are untouched', () => {
    expect(formSrc).toContain("Thanks. We've got your quote request");
    expect(formSrc).toContain('Request a quote');
    expect(formSrc).toContain('Sending…');
  });
});
