import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Fragment, isValidElement } from 'react';
import { getDestinationBySlug } from '@/data/destinations';
import { getRouteBySlug } from '@/data/routes';
import IndiaHubPage from '@/app/india/page';
import UmrahHubPage from '@/app/umrah/page';

/**
 * Collects only the plain text that lives directly in a component's own
 * JSX — deliberately shallow. Recurses into plain DOM elements (string
 * `type`, e.g. 'p', 'div', 'a') and Fragments (UmrahHubPage's own top-level
 * return is a `<>...</>`) but never invokes a custom component function
 * (DealCard, LinkButton, HeroBackdrop, etc.), several of which are real
 * 'use client' components using hooks that throw "Invalid hook call"
 * outside an actual React render (this repo's Vitest environment is plain
 * Node, no @testing-library dispatcher — see the identical, already-
 * established caveat in tests/journey-choice.test.ts). This is sufficient
 * and safe for asserting on the Umrah visa panel's own literal paragraph
 * text, which sits directly in UmrahHubPage's JSX, not inside a
 * sub-component.
 */
function collectOwnText(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
  } else if (Array.isArray(node)) {
    node.forEach((child) => collectOwnText(child, out));
  } else if (isValidElement(node) && (typeof node.type === 'string' || node.type === Fragment)) {
    const children = (node.props as { children?: unknown } | null)?.children;
    if (children !== undefined) collectOwnText(children, out);
  }
  return out;
}

/**
 * Umrah + India cross-surface truth reconciliation (5 September 2026) —
 * independently reproduced and fixed two Astra-reported cross-surface
 * contradictions: a stronger claim surviving on a hub/specialist page after
 * the canonical route/specialist truth had already moved on.
 *
 * UMRAH: /umrah's "Visa requirements" panel stated flatly that "an Umrah
 * visa is required... separate from a standard tourist visa" — Saudi
 * Arabia's own official eVisa portal (visa.visitsaudi.com, reconfirmed live
 * 5 September 2026) states the tourist eVisa itself explicitly permits
 * "Umrah (excluding Hajj)" for eligible nationalities including the UK;
 * GOV.UK's foreign travel advice corroborates the same principle for its
 * ETA and electronic-visa-waiver categories, both of which explicitly list
 * "Umrah (outside the Hajj season)", and confirms Hajj always needs its own
 * separate Hajj visa regardless of which visa a traveller holds.
 *
 * INDIA: app/india/page.tsx's hardcoded "Travel notes" prose claimed "Air
 * India's only non-stop UK routes to Ahmedabad and Amritsar both depart
 * from Gatwick, alongside Birmingham's direct Amritsar service" —
 * contradicting two of the hub's own route cards: london-gatwick-ahmedabad
 * is verification.status: 'unverified' (a genuine, currently unresolved
 * conflict across Air India's own current pages over whether this service
 * flies from Gatwick or Heathrow at all), and birmingham-amritsar is
 * isDirect: false (connecting only). The same false "9h 40m direct from
 * London Gatwick" duration was independently duplicated on Ahmedabad's own
 * destination-hub summary card (data/destinations.ts's flightTimeFromUK
 * field) — a stale duplicate of the same underlying fact, not derived from
 * the canonical route record, and already inconsistent with this same
 * destination's own familyVisitContent.packingNote, which was already
 * worded honestly.
 */

describe('Umrah — visa copy no longer states a universal absolute', () => {
  // Deliberately walks only the ACTUAL RENDERED TEXT (see collectOwnText's
  // doc comment) — not the raw source file, which would also match this
  // fix's own explanatory comments quoting the old, wrong wording.
  const umrahText = collectOwnText(UmrahHubPage()).join(' ');

  // The official-source hrefs are on <a> elements collected as element
  // children, not text — read the raw source once, narrowly, only for
  // this structural href check.
  const umrahSrcForLinks = readFileSync(join(process.cwd(), 'app/umrah/page.tsx'), 'utf8');

  it('does not claim a separate Umrah visa is universally required', () => {
    expect(umrahText).not.toMatch(/an umrah visa is required/i);
    expect(umrahText).not.toMatch(/is separate from a standard tourist visa/i);
  });

  it('states the tourist eVisa can support Umrah, conditionally (not for every traveller)', () => {
    expect(umrahText).toMatch(/tourist evisa/i);
    expect(umrahText).toMatch(/available to\s+UK passport holders/i);
    expect(umrahText).not.toMatch(/every traveller/i);
  });

  it('keeps the Hajj exclusion explicit', () => {
    expect(umrahText).toMatch(/excluding hajj/i);
    expect(umrahText).toMatch(/separate hajj visa/i);
  });

  it('still names the operator/Nusuk-arranged visa as a legitimate alternative path, not the only path', () => {
    expect(umrahText).toMatch(/arranged by the operator|through nusuk/i);
  });

  it('does not overclaim eligibility for every tourist-eVisa traveller entering every religious site without conditions', () => {
    expect(umrahText).toMatch(/additional registration or permit requirements/i);
  });

  it('official-source links remain visible', () => {
    expect(umrahSrcForLinks).toContain('https://visa.visitsaudi.com/');
    expect(umrahSrcForLinks).toContain('https://umrah.nusuk.sa/');
  });

  it('still tells visitors requirements change and to confirm directly — no legal-advice framing added', () => {
    expect(umrahText).toMatch(/requirements change, so always confirm directly/i);
  });
});

describe('India hub — practicalNotes no longer contradict route-level truth', () => {
  const element = IndiaHubPage();
  const practicalNotes = (element.props as { practicalNotes: { title: string; body: string }[] }).practicalNotes;
  const gatewayNote = practicalNotes.find((n) => /gatwick/i.test(n.title));

  it('found the Gatwick gateway note (sanity check on the read itself)', () => {
    expect(gatewayNote).toBeDefined();
  });

  it('no longer claims Birmingham has a direct Amritsar service — birmingham-amritsar is connecting-only in data/routes.ts', () => {
    const route = getRouteBySlug('birmingham-amritsar');
    expect(route?.isDirect).toBe(false);
    expect(gatewayNote?.body).not.toMatch(/birmingham'?s?\s+direct\s+amritsar/i);
    expect(gatewayNote?.body).toMatch(/birmingham.{0,40}connection, not a direct flight/i);
  });

  it('no longer claims a confident non-stop Ahmedabad service — london-gatwick-ahmedabad is unverified in data/routes.ts', () => {
    const route = getRouteBySlug('london-gatwick-ahmedabad');
    expect(route?.verification?.status).toBe('unverified');
    expect(gatewayNote?.body).not.toMatch(/non-stop uk routes to ahmedabad/i);
    expect(gatewayNote?.body).toMatch(/genuine, unresolved conflict/i);
  });

  it('still correctly states the genuinely-confirmed Gatwick–Amritsar non-stop service', () => {
    const route = getRouteBySlug('london-gatwick-amritsar');
    expect(route?.isDirect).toBe(true);
    expect(route?.verification?.status).toBe('verified');
    expect(gatewayNote?.body).toMatch(/non-stop gatwick.{0,10}amritsar service/i);
  });

  it('narrow same-class scan: no other practicalNote on this hub pairs "Birmingham" with a live "direct" claim, and the one Manchester+"direct" pairing is explicitly past-tense (ended), not a live claim', () => {
    const otherNotes = practicalNotes.filter((n) => n !== gatewayNote);
    expect(otherNotes).toHaveLength(3);
    for (const note of otherNotes) {
      expect(note.body, note.title).not.toMatch(/birmingham.{0,60}\bdirect\b/i);
    }
    const manchesterDirectNote = otherNotes.find((n) => /manchester.{0,60}\bdirect\b/i.test(n.body));
    // The only Manchester+"direct" pairing on this hub must be the
    // service-ended note — a live/current direct claim for Manchester
    // would be the same defect class as the Birmingham/Ahmedabad ones.
    expect(manchesterDirectNote?.body).toMatch(/direct services have ended/i);
  });
});

describe('Ahmedabad destination card — flightTimeFromUK no longer duplicates the same false claim', () => {
  it('no longer states a confident direct duration — matches the route\'s own genuine uncertainty', () => {
    const ahmedabad = getDestinationBySlug('ahmedabad');
    expect(ahmedabad?.flightTimeFromUK).not.toContain('9h 40m direct from London Gatwick');
    expect(ahmedabad?.flightTimeFromUK?.toLowerCase()).not.toContain('direct');
    expect(ahmedabad?.flightTimeFromUK).toMatch(/genuine, unresolved conflict/i);
  });

  it('is now consistent with this same destination\'s own familyVisitContent.packingNote, which was already honest', () => {
    const ahmedabad = getDestinationBySlug('ahmedabad');
    expect(ahmedabad?.flightTimeFromUK).toMatch(/which london airport it uses/i);
    expect(ahmedabad?.familyVisitContent?.packingNote).toMatch(/which london airport it uses/i);
  });

  it('matches the route\'s own canonical unverified status', () => {
    const route = getRouteBySlug('london-gatwick-ahmedabad');
    expect(route?.verification?.status).toBe('unverified');
  });
});
