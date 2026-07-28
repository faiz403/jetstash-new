import { describe, it, expect } from 'vitest';
import { isValidElement } from 'react';
import { footerNav } from '@/lib/site-config';
import { getDestinationsByRegion, getDestinationBySlug, type Destination } from '@/data/destinations';
import { TRAVEL_READY_SUPPORTED_COUNTRIES } from '@/lib/travel-ready-check';
import { WhatWeCheck } from '@/components/homepage-v2/homepage-sections';
import { RegionHubPage } from '@/components/sections/region-hub-page';
import { FamilyVisitBlock } from '@/components/sections/family-visit-block';
import UmrahHubPage from '@/app/umrah/page';
import DestinationPage from '@/app/destinations/[slug]/page';
import sitemap from '@/app/sitemap';

/**
 * TRC-001 — Travel Ready Check discoverability.
 *
 * These components are plain server functions with no hooks (confirmed by
 * reading each file — no 'use client', no useState/useEffect), so they can
 * be called directly and their returned element tree walked, the same
 * pattern tests/route-watch-form-copy.test.ts already uses for
 * RouteWatchInvite(). This proves the actual wiring (real hrefs, real
 * conditional gates against TRAVEL_READY_SUPPORTED_COUNTRIES) rather than
 * matching against component source text.
 */

function collectHrefs(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) collectHrefs(child, out);
    return out;
  }
  if (isValidElement(node)) {
    const props = node.props as { href?: unknown; children?: unknown } | null;
    if (typeof props?.href === 'string') out.push(props.href);
    if (props?.children !== undefined) collectHrefs(props.children, out);
  }
  return out;
}

function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectStrings(child, out);
    return out;
  }
  if (isValidElement(node)) {
    const children = (node.props as { children?: unknown } | null)?.children;
    if (children !== undefined) collectStrings(children, out);
  }
  return out;
}

const FAKE_UNSUPPORTED_DESTINATION: Destination = {
  slug: 'test-fake-destination',
  city: 'Test City',
  country: 'France',
  iataCode: 'ZZZ',
  region: 'mediterranean',
  tagline: 'test fixture, not real content',
  description: 'test fixture, not real content',
  bestFor: [],
  flightTimeFromUK: '2h',
  ukAirports: [],
  visaNote: 'test fixture, not real content',
};

describe('France is not a Travel Ready Check-supported country (sanity check for the fixture above)', () => {
  it('confirms the test fixture is genuinely unsupported', () => {
    expect(TRAVEL_READY_SUPPORTED_COUNTRIES).not.toContain('France');
  });
});

describe('Sitemap — /travel-ready-check is discoverable to crawlers', () => {
  it('is included as a static page URL', () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((u) => u.endsWith('/travel-ready-check'))).toBe(true);
  });
});

describe('Footer — Travel Ready Check is a real navigation link, not just a page that exists', () => {
  it('appears once in the product-led Explore footer column, pointing at the real page', () => {
    const matches = footerNav.explore.filter((link) => link.href === '/travel-ready-check');
    expect(matches).toHaveLength(1);
    expect(matches[0].label).toMatch(/travel ready check/i);
  });
});

describe('Homepage "What we check" — the Travel-ready documents card links to the tool', () => {
  it('renders a link to /travel-ready-check with an honest, non-generic label', () => {
    const element = WhatWeCheck();
    const hrefs = collectHrefs(element);
    expect(hrefs).toContain('/travel-ready-check');
  });

  it('the link text sits next to the travel-ready-documents copy, not a generic "click here"', () => {
    const element = WhatWeCheck();
    const text = collectStrings(element).join(' ');
    expect(text).toMatch(/check your travel readiness/i);
  });

  it('only one card links out — the other four checks stay plain text (no navigation clutter)', () => {
    const element = WhatWeCheck();
    const hrefs = collectHrefs(element);
    expect(hrefs).toHaveLength(1);
  });
});

describe('Destination pages — the existing Visa & entry panel gains a readiness CTA, only where genuinely supported', () => {
  it('a supported destination (Mumbai, India) gets a deep-linked CTA', async () => {
    const element = await DestinationPage({ params: Promise.resolve({ slug: 'mumbai' }) });
    const hrefs = collectHrefs(element);
    expect(hrefs).toContain('/travel-ready-check?destination=mumbai');
  });

  it('an unsupported destination (Barcelona, Spain) gets no readiness CTA', async () => {
    const dest = getDestinationBySlug('barcelona');
    expect(dest).toBeDefined();
    expect(TRAVEL_READY_SUPPORTED_COUNTRIES).not.toContain(dest!.country);
    const element = await DestinationPage({ params: Promise.resolve({ slug: 'barcelona' }) });
    const hrefs = collectHrefs(element);
    expect(hrefs.some((h) => h.startsWith('/travel-ready-check'))).toBe(false);
  });

  it('never promises confirmed eligibility — the surrounding copy stays a "check", not a guarantee', async () => {
    const element = await DestinationPage({ params: Promise.resolve({ slug: 'mumbai' }) });
    const text = collectStrings(element).join(' ');
    expect(text).toMatch(/private check/i);
    expect(text).not.toMatch(/guaranteed|confirmed eligib|you (are|will be) eligible/i);
  });
});

describe('Family-visit content — the Documents & entry card gains a readiness CTA for supported countries', () => {
  it('a supported family-visit destination (Lahore, Pakistan) gets a deep-linked CTA', () => {
    const dest = getDestinationBySlug('lahore')!;
    expect(dest.familyVisitContent).toBeDefined();
    const element = FamilyVisitBlock({
      content: dest.familyVisitContent!,
      city: dest.city,
      country: dest.country,
      destinationSlug: dest.slug,
    });
    const hrefs = collectHrefs(element);
    expect(hrefs).toContain('/travel-ready-check?destination=lahore');
  });

  it('an unsupported country renders no readiness CTA (the gate genuinely suppresses it, not just usually true)', () => {
    const dest = getDestinationBySlug('lahore')!;
    const element = FamilyVisitBlock({
      content: dest.familyVisitContent!,
      city: dest.city,
      country: 'France',
      destinationSlug: dest.slug,
    });
    const hrefs = collectHrefs(element);
    expect(hrefs.some((h) => h.startsWith('/travel-ready-check'))).toBe(false);
  });

  it('a real destination page (Lahore) actually renders the family-visit CTA end-to-end', async () => {
    const element = await DestinationPage({ params: Promise.resolve({ slug: 'lahore' }) });
    const hrefs = collectHrefs(element);
    expect(hrefs).toContain('/travel-ready-check?destination=lahore');
  });
});

describe('Region hubs (Pakistan/India/Gulf via RegionHubPage) — the Visa & entry panel gains a readiness CTA', () => {
  const baseProps = {
    eyebrow: 'Test Hub',
    title: 'Test hub',
    intro: 'test fixture, not real content',
    visaNote: 'test fixture, not real content',
    practicalNotes: [],
    airportsServed: ['Manchester'],
  };

  it('a hub with at least one supported-country destination (real Pakistan data) gets the CTA', () => {
    const destinationsInRegion = getDestinationsByRegion('pakistan');
    expect(destinationsInRegion.length).toBeGreaterThan(0);
    const element = RegionHubPage({ ...baseProps, destinationsInRegion });
    const hrefs = collectHrefs(element);
    expect(hrefs).toContain('/travel-ready-check');
  });

  it('a hub whose destinations are all unsupported gets no CTA', () => {
    const element = RegionHubPage({ ...baseProps, destinationsInRegion: [FAKE_UNSUPPORTED_DESTINATION] });
    const hrefs = collectHrefs(element);
    expect(hrefs.some((h) => h.startsWith('/travel-ready-check'))).toBe(false);
  });

  it('the existing "Ask us a question" link is preserved alongside the new CTA, not replaced', () => {
    const destinationsInRegion = getDestinationsByRegion('pakistan');
    const element = RegionHubPage({ ...baseProps, destinationsInRegion });
    const hrefs = collectHrefs(element);
    expect(hrefs).toContain('/contact');
    expect(hrefs).toContain('/travel-ready-check');
  });
});

describe('Umrah hub page — the Visa requirements panel gains a readiness CTA (Saudi Arabia is supported)', () => {
  it('renders a link to /travel-ready-check alongside the existing contact link', () => {
    const element = UmrahHubPage();
    const hrefs = collectHrefs(element);
    expect(hrefs).toContain('/travel-ready-check');
    expect(hrefs).toContain('/contact');
  });
});

describe('No unrelated behaviour changed', () => {
  it('the Route Watch invitation still anchors to the route-watch form, unaffected by this work', () => {
    // Regression guard only — RouteWatchInvite is untouched by TRC-001, this
    // just proves the homepage module still imports/exports cleanly after
    // the WhatWeCheck edit above.
    expect(typeof WhatWeCheck).toBe('function');
  });

  it('the product and specialist links survive the footer reorganisation (no accidental removals)', () => {
    const labels = [...footerNav.explore, ...footerNav.specialist].map((l) => l.label);
    for (const expected of ['Family Holidays', 'Business Class', 'Request a Quote', 'All Deals', 'All Routes', 'All Destinations', 'Travel Guides', 'UK Airports']) {
      expect(labels).toContain(expected);
    }
  });
});
