import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Founder-only prototype access/privacy checks — same readFileSync + regex
 * convention as tests/arrive-by-founder-route-access.test.ts, adapted for
 * the fact that this prototype genuinely does call its own server-side API
 * route (Google-powered, like Manchester's own Google-powered version),
 * unlike the older client-only Manchester preview that test file covers.
 */

const pagePath = join(process.cwd(), 'app', 'founder', 'arrive-by-pakistan', 'page.tsx');
const componentPath = join(process.cwd(), 'components', 'founder', 'arrive-by-pakistan.tsx');
const apiRoutePath = join(process.cwd(), 'app', 'api', 'founder', 'arrive-by-pakistan', 'google', 'route.ts');
const pageSrc = readFileSync(pagePath, 'utf8');
const componentSrc = readFileSync(componentPath, 'utf8');
const apiRouteSrc = readFileSync(apiRoutePath, 'utf8');

describe('private route metadata prevents indexing', () => {
  it('generateMetadata returns robots index:false, follow:false on both the disabled and enabled paths', () => {
    const matches = pageSrc.match(/robots:\s*{\s*index:\s*false,\s*follow:\s*false\s*}/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('uses the exact same founder access gate as the rest of /founder', () => {
    expect(pageSrc).toContain("process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true'");
    expect(pageSrc).toContain('notFound()');
    expect(pageSrc).toContain("export const dynamic = 'force-dynamic'");
  });

  it('the API route 404s outside the same founder gate', () => {
    expect(apiRouteSrc).toContain("process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true'");
    expect(apiRouteSrc).toMatch(/status:\s*404/);
  });
});

describe('page is absent from sitemap/public navigation', () => {
  it('app/sitemap.ts never references arrive-by-pakistan', () => {
    const sitemapSrc = readFileSync(join(process.cwd(), 'app', 'sitemap.ts'), 'utf8');
    expect(sitemapSrc).not.toMatch(/arrive-by-pakistan/);
  });

  it('app/robots.ts disallows /founder as a path prefix, which covers this route too', () => {
    const robotsSrc = readFileSync(join(process.cwd(), 'app', 'robots.ts'), 'utf8');
    expect(robotsSrc).toMatch(/disallow:\s*['"]\/founder['"]/);
  });

  it('no file under app/ or components/ (outside this route/component pair) links to /founder/arrive-by-pakistan, and public site-config nav is untouched', () => {
    const offenders: string[] = [];
    function scan(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          if (full === pagePath || full === componentPath || full === apiRoutePath) continue;
          const content = readFileSync(full, 'utf8');
          if (content.includes('/founder/arrive-by-pakistan')) offenders.push(full);
        }
      }
    }
    scan(join(process.cwd(), 'app'));
    scan(join(process.cwd(), 'components'));
    expect(offenders).toEqual([]);

    const siteConfigSrc = readFileSync(join(process.cwd(), 'lib', 'site-config.ts'), 'utf8');
    expect(siteConfigSrc).not.toMatch(/arrive-by-pakistan/);
  });

  it('is absent from the homepage, Routes and Deals pages specifically', () => {
    for (const file of ['app/page.tsx', 'app/routes/page.tsx', 'app/deals/page.tsx']) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      expect(src, file).not.toMatch(/arrive-by-pakistan/);
    }
  });
});

describe('no Manchester Arrive By logic is imported or modified', () => {
  it('the Pakistan component/page/API route never import from lib/arrive-by (Manchester\'s separate, unmerged branch)', () => {
    for (const [label, src] of [['page', pageSrc], ['component', componentSrc], ['api route', apiRouteSrc]] as const) {
      expect(src, label).not.toMatch(/from ['"]@\/lib\/arrive-by['"]/);
      expect(src, label).not.toMatch(/from ['"]@\/lib\/arrive-by\//);
      expect(src, label).not.toMatch(/from ['"]@\/components\/founder\/arrive-by-google['"]/);
    }
  });
});

describe('no analytics event is fired (founder prototype, not yet needed)', () => {
  it('neither the page nor the component imports the analytics wrapper or calls track()', () => {
    for (const [label, src] of [['page', pageSrc], ['component', componentSrc]] as const) {
      expect(src, label).not.toMatch(/from ['"]@\/lib\/analytics['"]/);
      expect(src, label).not.toMatch(/\btrack\s*\(/);
    }
  });
});

describe('no public booking CTA appears', () => {
  it('the component never renders a Trip.com link or references booking providers', () => {
    expect(componentSrc).not.toMatch(/trip\.com/i);
    expect(componentSrc).not.toMatch(/from ['"]@\/lib\/booking-providers['"]/);
  });
});

describe('credential safety', () => {
  it('GOOGLE_ROUTES_API_KEY is only referenced server-side, in the API route, never in the component', () => {
    expect(apiRouteSrc).toContain('process.env.GOOGLE_ROUTES_API_KEY');
    expect(componentSrc).not.toMatch(/GOOGLE_ROUTES_API_KEY/);
    expect(pageSrc).not.toMatch(/GOOGLE_ROUTES_API_KEY/);
  });

  it('the component is a client component and never imports the google-routes adapter directly', () => {
    expect(componentSrc).toContain("'use client'");
    expect(componentSrc).not.toMatch(/from ['"]@\/lib\/arrive-by-pakistan\/google-routes['"]/);
  });
});

describe('does not overstate confidence in copy', () => {
  it('the component and outcome copy never use forbidden overstated wording', () => {
    const outcomesSrc = readFileSync(join(process.cwd(), 'lib', 'arrive-by-pakistan', 'outcomes.ts'), 'utf8');
    for (const [label, src] of [['component', componentSrc], ['outcomes', outcomesSrc]] as const) {
      const lower = src.toLowerCase();
      for (const forbidden of ['is guaranteed', 'guaranteed arrival', 'definitely', 'is impossible', 'perfectly safe']) {
        expect(lower, label).not.toContain(forbidden);
      }
    }
  });

  it('the estimate disclaimer is always rendered when a result exists', () => {
    expect(componentSrc).toContain('ESTIMATE_DISCLAIMER');
  });
});

describe('deadline is optional, never forced', () => {
  it('the deadline input has no required attribute, unlike landing time and destination', () => {
    expect(componentSrc).toMatch(/type="datetime-local"\s+value=\{deadline\}/);
    // The deadline field's own <input> must not carry `required` — the
    // landing-time field's does, so a simple absence check on the
    // deadline block specifically is meaningful here.
    const deadlineBlock = componentSrc.split('Need to arrive by')[1]?.split('</label>')[0] ?? '';
    expect(deadlineBlock).not.toMatch(/\brequired\b/);
  });
});

describe('accessible result region', () => {
  it('the result region is announced via aria-live for screen readers', () => {
    expect(componentSrc).toMatch(/aria-live="polite"/);
  });
});
