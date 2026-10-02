import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARRIVE_BY_RATE_LIMIT_WINDOW_MS } from '@/lib/arrive-by-shared/rate-limit';
import { BETA_METRIC_TTL_SECONDS } from '@/lib/arrive-by-journey/beta-metrics';

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const prose = read('app', 'privacy-policy', 'page.tsx').replace(/<[^>]*>/g, ' ').replace(/&apos;/g, "'").replace(/\s+/g, ' ');

/** The Arrive By section's own text, so a mention elsewhere cannot make these pass by accident. */
const section = (() => {
  const start = prose.indexOf("title: 'Arrive By (journey estimates)'");
  const end = prose.indexOf("title: 'Cookies and analytics'");
  return prose.slice(start, end);
})();

describe('privacy policy: the live Arrive By journey is described accurately', () => {
  it('has the Arrive By section and states what is sent to which Google service', () => {
    expect(section.length).toBeGreaterThan(500);
    expect(section).toMatch(/start location, destination, airports, flight times and buffers/);
    expect(section).toContain("Google's Geocoding service");
    expect(section).toContain("Google's Routes service");
    expect(section).toContain("Google's Places service");
    expect(section).toMatch(/departure time worked out from your flight times/);
  });

  it('names every Google endpoint the live journey path really calls', () => {
    const live = [
      read('lib', 'arrive-by-shared', 'destination-resolution.ts'),
      read('lib', 'arrive-by-journey', 'place-name.ts'),
      read('lib', 'arrive-by-shared', 'road-routes.ts'),
    ].join('\n');
    expect(live).toContain('maps.googleapis.com/maps/api/geocode');
    expect(live).toContain('places.googleapis.com');
    expect(live).toMatch(/routes\.googleapis\.com/);
    // The Time Zone API is only used by the offline capability probe, never on the live request path, so it is deliberately not described.
    const route = read('app', 'api', 'arrive-by', 'journey', 'route.ts');
    expect(route).not.toMatch(/timezone\/json/);
  });

  it('says what is and is not kept, using the real durations', () => {
    expect(ARRIVE_BY_RATE_LIMIT_WINDOW_MS).toBe(60 * 1000);
    expect(section).toMatch(/hashed form of your IP address for about a minute/);
    expect(BETA_METRIC_TTL_SECONDS).toBe(90 * 24 * 60 * 60);
    // 90 days is the real expiry; the policy says 'about three months' because the retention guard test forbids numeric day counts.
    expect(section).toMatch(/kept for about three months/);
    expect(section).toMatch(/JetStash does not store what you enter/);
    expect(section).toMatch(/none of it is sent to our analytics provider/);
  });

  it('keeps the claim "none of it is sent to analytics" true: the live journey component fires no analytics event', () => {
    const component = read('components', 'arrive-by-full-journey.tsx');
    expect(component).not.toMatch(/\btrack\(/);
    expect(component).not.toMatch(/@vercel\/analytics|lib\/analytics/);
  });

  it('lists Google and Upstash as service providers and as places data may be processed', () => {
    expect(prose).toMatch(/Google, only when you run an Arrive By check/);
    expect(prose).toMatch(/Upstash, a database service that holds Arrive By's short-lived rate-limit entries/);
    expect(prose).toMatch(/including Vercel, Resend, Brevo, Microsoft 365, Google and Upstash/);
  });

  it('no longer describes the old arrival-only flow or a deadline-reason field the journey does not have', () => {
    expect(prose).not.toContain('Manchester and Pakistan journey estimates');
    expect(section).not.toMatch(/deadline reason|stated reason/i);
  });

  it('shows a current Last updated date', () => {
    expect(prose).toContain('Last updated: 3 October 2026');
  });
});
