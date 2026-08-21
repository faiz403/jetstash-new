import { describe, it, expect } from 'vitest';
import { bookingWindows, getBookingWindowsByRoute } from '@/data/booking-windows';

/**
 * Regression coverage for the 21 August 2026 stale-copy fix on the
 * `bhx-isb-eid-recommended` booking-window entry.
 *
 * COV-001 (PR #159) reclassified Birmingham→Islamabad from disputed-direct
 * to verified-connecting (via Istanbul), but the follow-up sentence living
 * in data/booking-windows.ts was missed by that PR and kept asserting
 * "Its direct service is not yet independently verified" — directly
 * contradicting the corrected, live Route Status copy on the same page.
 * This test locks in the fix and guards against the wording drifting back,
 * or the fix accidentally spilling into unrelated booking-window entries.
 */
describe('data/booking-windows.ts — bhx-isb-eid-recommended stale copy fix', () => {
  const bhxIsbWindows = getBookingWindowsByRoute('birmingham-islamabad');
  const entry = bhxIsbWindows.find((w) => w.id === 'bhx-isb-eid-recommended');

  it('sanity: the entry still exists', () => {
    expect(entry).toBeDefined();
  });

  it('no longer claims the direct service "is not yet independently verified"', () => {
    expect(entry!.guidance).not.toMatch(/direct service is not yet independently verified/i);
    expect(entry!.guidance).not.toMatch(/not yet independently verified/i);
  });

  it('does not re-hardcode Istanbul as a permanent route fact', () => {
    // The route-level note in data/routes.ts is allowed to name Istanbul
    // (it was confirmed on 6/6 sampled live results) — but this shorter
    // planning-guidance sentence should stay generic per founder guardrail,
    // matching the same "don't overclaim a fixed hub" standard applied to
    // manchester-karachi.
    expect(entry!.guidance).not.toMatch(/Istanbul/i);
  });

  it('reflects the corrected connecting-not-nonstop reality', () => {
    expect(entry!.guidance).toMatch(/connecting itinerar/i);
    expect(entry!.guidance).toMatch(/nonstop Birmingham–Islamabad service/i);
  });

  it('still keeps the 2 to 3 month Eid planning guidance (the useful part of the sentence, unchanged in substance)', () => {
    expect(entry!.guidance).toMatch(/2 to 3 months ahead of Eid/i);
  });

  it('the rest of the entry (id, label, weeksBeforeDeparture, role, appliesToPeriodIds) is untouched', () => {
    expect(entry!.id).toBe('bhx-isb-eid-recommended');
    expect(entry!.label).toBe('Recommended booking window ahead of Eid');
    expect(entry!.weeksBeforeDeparture).toEqual({ min: 8, max: 13 });
    expect(entry!.role).toBe('recommended');
    expect(entry!.appliesToPeriodIds).toEqual(['eid-al-fitr', 'eid-al-adha']);
  });

  it('exactly one bhx-isb-eid-recommended entry exists — no accidental duplication', () => {
    const matches = bookingWindows.filter((w) => w.id === 'bhx-isb-eid-recommended');
    expect(matches).toHaveLength(1);
  });

  it('no other booking-window entry was touched by this fix', () => {
    const others = bookingWindows.filter((w) => w.id !== 'bhx-isb-eid-recommended');
    const unexpected = others.filter((w) => /not yet independently verified/i.test(w.guidance));
    expect(unexpected).toEqual([]);

    // Spot-check the two entries most likely to have been touched by
    // accident (same file, adjacent, same PR/route family) are exactly the
    // pre-existing wording.
    const manIsb = bookingWindows.find((w) => w.id === 'man-isb-eid-recommended');
    expect(manIsb!.guidance).toBe(
      "This route's pattern is similar to Manchester–Lahore: for fixed Eid dates, planning to book 3+ months ahead is a reasonable approach. It also runs fewer weekly frequencies than Lahore, so seats can fill faster in peak weeks."
    );
    const manKhi = bookingWindows.find((w) => w.id === 'man-khi-eid-wedding-recommended');
    expect(manKhi!.guidance).toBe(
      "Planning guidance: aim to book 2 to 3 months ahead of Eid or wedding season, while PIA's expanded UK schedule is still settling."
    );
  });
});
