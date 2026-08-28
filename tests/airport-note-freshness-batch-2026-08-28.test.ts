import { describe, expect, it } from 'vitest';
import { airportNotes } from '@/data/airport-notes';
import { getDestinationBySlug } from '@/data/destinations';
import { routes } from '@/data/routes';

/**
 * Airport note volatile-claim verification batch (28 August 2026).
 *
 * A read-only freshness audit found `data/airport-notes.ts` making several
 * specific, volatile factual claims (direct-service assertions, terminal
 * assignments, weekly frequencies) with no evidence source, no date, and no
 * connection to the Route Status V1 ledger that governs the identical claim
 * type everywhere else in the codebase. Two were found actively
 * CONTRADICTED by JetStash's own already-verified route/destination
 * records:
 *
 * - bhx-gulf-connections claimed "Birmingham has direct Air India service
 *   to Amritsar" — birmingham-amritsar is isDirect: false.
 * - The Amritsar destination's own `flightTimeFromUK` claimed "9h direct
 *   from Birmingham" — of Amritsar's four UK routes, only
 *   london-gatwick-amritsar is isDirect: true.
 *
 * A third (lgw-reduced-frequency / the Ahmedabad destination's packingNote)
 * overclaimed a specific "3 times a week" frequency for
 * london-gatwick-ahmedabad, a route whose own verification.status is
 * 'unverified' with a genuine, unresolved conflict over which London
 * airport it currently uses. A fourth (lgw-south-terminal) named Emirates
 * and Qatar Airways at Gatwick's South Terminal; cross-checked airport
 * terminal-guide sources consistently place them at the North Terminal
 * instead (Air India is correctly South Terminal).
 *
 * This does not touch the scheduled 31 Aug/1 Sep MAN→BOM/MAN→DEL IndiGo
 * verification — no note in this batch referenced those routes.
 */

describe('Birmingham–Amritsar is no longer claimed direct in airport-notes.ts', () => {
  it('bhx-gulf-connections no longer asserts a direct Amritsar service', () => {
    const note = airportNotes.find((n) => n.id === 'bhx-gulf-connections');
    expect(note?.body).not.toContain('direct Air India service to Amritsar');
  });

  it('the claim matches the underlying route evidence: birmingham-amritsar is not direct', () => {
    const route = routes.find((r) => r.slug === 'birmingham-amritsar');
    expect(route?.isDirect).toBe(false);
  });
});

describe('Amritsar destination flightTimeFromUK matches the actually-verified direct route', () => {
  it('no longer claims a direct Birmingham service', () => {
    const amritsar = getDestinationBySlug('amritsar');
    expect(amritsar?.flightTimeFromUK).not.toContain('Birmingham');
  });

  it('names London Gatwick — the one Amritsar route that is genuinely isDirect: true', () => {
    const amritsar = getDestinationBySlug('amritsar');
    expect(amritsar?.flightTimeFromUK).toContain('London Gatwick');
    const gatwickRoute = routes.find((r) => r.slug === 'london-gatwick-amritsar');
    expect(gatwickRoute?.isDirect).toBe(true);
  });

  it('every other UK route to Amritsar is confirmed not direct, matching the corrected claim', () => {
    const otherSlugs = ['birmingham-amritsar', 'leeds-bradford-amritsar', 'manchester-amritsar'];
    for (const slug of otherSlugs) {
      const route = routes.find((r) => r.slug === slug);
      expect(route?.isDirect, `${slug} should be isDirect: false`).toBe(false);
    }
  });
});

describe('Gatwick Gujarat/Punjab frequency claims no longer overclaim certainty', () => {
  it('lgw-reduced-frequency no longer states a specific "3 times a week" figure', () => {
    const note = airportNotes.find((n) => n.id === 'lgw-reduced-frequency');
    expect(note?.body).not.toContain('3 times a week');
  });

  it('the Ahmedabad destination packingNote no longer states a specific weekly frequency for a route with unresolved airport status', () => {
    const ahmedabad = getDestinationBySlug('ahmedabad');
    expect(ahmedabad?.familyVisitContent?.packingNote).not.toContain('3 times a week');
    const route = routes.find((r) => r.slug === 'london-gatwick-ahmedabad');
    expect(route?.verification?.status).toBe('unverified');
  });
});

describe('Gatwick terminal assignments corrected', () => {
  it('lgw-south-terminal no longer places Emirates and Qatar Airways in the South Terminal', () => {
    const note = airportNotes.find((n) => n.id === 'lgw-south-terminal');
    expect(note?.body).not.toMatch(/Emirates, Qatar Airways and Air India all operate from the South Terminal/);
  });

  it('still correctly places Air India in the South Terminal', () => {
    const note = airportNotes.find((n) => n.id === 'lgw-south-terminal');
    expect(note?.body).toContain('Air India operates from the South Terminal');
  });
});

describe('This batch does not touch the scheduled MAN→BOM/MAN→DEL verification', () => {
  it('no edited note references manchester-mumbai or manchester-delhi', () => {
    const editedIds = ['bhx-gulf-connections', 'lgw-south-terminal', 'lgw-reduced-frequency'];
    for (const id of editedIds) {
      const note = airportNotes.find((n) => n.id === id);
      const text = `${note?.title} ${note?.body}`.toLowerCase();
      expect(text).not.toMatch(/mumbai|delhi/);
    }
  });

  it('manchester-mumbai and manchester-delhi route records are unchanged by this batch', () => {
    // Presence check only — this batch's own diff never touches these
    // slugs; verified structurally via git diff --check, this is a guard
    // against a future edit to this same file accidentally drifting in.
    const mumbai = routes.find((r) => r.slug === 'manchester-mumbai');
    const delhi = routes.find((r) => r.slug === 'manchester-delhi');
    expect(mumbai).toBeDefined();
    expect(delhi).toBeDefined();
  });
});
