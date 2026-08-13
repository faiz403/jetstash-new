import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const routePageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');

describe('route intelligence continuation cue', () => {
  it('places one restrained continuation cue immediately before the first Trip.com CTA', () => {
    const cue = 'More JetStash intelligence below, including journey context and things to check before you book. ↓';
    expect(routePageSrc.match(new RegExp(cue, 'g'))).toHaveLength(1);
    expect(routePageSrc.indexOf(cue)).toBeLessThan(routePageSrc.indexOf('Compare flights on Trip.com'));
    expect(routePageSrc).toMatch(/\{tripComUrl && \([\s\S]*?<p data-testid="route-intelligence-continuation-cue"/);
  });

  it('stays generic enough for sparse and evidence-pending routes', () => {
    expect(routePageSrc).not.toContain('Fare Signal, baggage or Smart Fare');
    expect(routePageSrc).toContain('journey context and things to check before you book');
    expect(routePageSrc).not.toContain('recommended');
    expect(routePageSrc).not.toContain('best fare');
  });

  it('does not change the existing CTA, disclosure or shared handoff wiring', () => {
    expect(routePageSrc).toContain('getTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug)');
    expect(routePageSrc).toContain('event="tripcom_click"');
    expect(routePageSrc).toContain('rel={PROVIDER_REL}');
    expect(routePageSrc).toContain('Check the itinerary, baggage allowance and booking terms before paying. Partner link, opens Trip.com in a new tab.');
  });
});
