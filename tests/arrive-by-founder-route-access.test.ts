import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Stage 2 founder preview — structural/access/privacy checks, the same
 * readFileSync + regex convention as tests/booking-providers.test.ts and
 * tests/arrive-by-integrity.test.ts (no DOM environment exists in this repo
 * — see vitest.config.ts — so JSX correctness is proven by scanning the
 * actual source, matching how every other founder/private-surface test in
 * this codebase already works).
 */

const pagePath = join(process.cwd(), 'app', 'founder', 'arrive-by', 'page.tsx');
const componentPath = join(process.cwd(), 'components', 'founder', 'arrive-by-preview.tsx');
const pageSrc = readFileSync(pagePath, 'utf8');
const componentSrc = readFileSync(componentPath, 'utf8');

/** Strips comments before a code-only scan — mirrors tests/arrive-by-integrity.test.ts's req-25 technique, so a doc comment describing a forbidden concept (e.g. explaining "no localStorage is used") never false-positives against itself. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const componentCode = codeOnly(componentSrc);

describe('private route metadata prevents indexing', () => {
  it('generateMetadata returns robots index:false, follow:false on both the disabled and enabled paths', () => {
    const matches = pageSrc.match(/robots:\s*{\s*index:\s*false,\s*follow:\s*false\s*}/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('uses the exact same founder access gate as app/founder/page.tsx and the Journey Brief preview', () => {
    expect(pageSrc).toContain("process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true'");
    expect(pageSrc).toContain('notFound()');
    expect(pageSrc).toContain("export const dynamic = 'force-dynamic'");
  });
});

describe('page is absent from sitemap/public navigation', () => {
  it('app/sitemap.ts never references arrive-by or this founder route', () => {
    const sitemapSrc = readFileSync(join(process.cwd(), 'app', 'sitemap.ts'), 'utf8');
    expect(sitemapSrc).not.toMatch(/arrive-by/);
  });

  it('app/robots.ts disallows /founder as a path prefix, which covers this route too', () => {
    const robotsSrc = readFileSync(join(process.cwd(), 'app', 'robots.ts'), 'utf8');
    expect(robotsSrc).toMatch(/disallow:\s*['"]\/founder['"]/);
  });

  it('no file under app/ or components/ (outside this route/component pair) links to /founder/arrive-by', () => {
    const offenders: string[] = [];
    function scan(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          if (full === pagePath || full === componentPath) continue;
          const content = readFileSync(full, 'utf8');
          if (content.includes('/founder/arrive-by')) offenders.push(full);
        }
      }
    }
    scan(join(process.cwd(), 'app'));
    scan(join(process.cwd(), 'components'));
    expect(offenders).toEqual([]);
  });

  it('is absent from the homepage, Routes, Deals and search UI specifically', () => {
    for (const file of ['app/page.tsx', 'app/routes/page.tsx', 'app/deals/page.tsx']) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      expect(src, file).not.toMatch(/arrive-by/);
    }
  });
});

describe('no analytics event is fired', () => {
  it('neither the page nor the component imports the analytics wrapper or calls track()', () => {
    for (const [label, src] of [['page', pageSrc], ['component', componentSrc]] as const) {
      expect(src, label).not.toMatch(/from ['"]@\/lib\/analytics['"]/);
      expect(src, label).not.toMatch(/\btrack\s*\(/);
      expect(src, label).not.toMatch(/data-analytics=/);
    }
  });
});

describe('no external request is made', () => {
  it('neither file calls fetch, XMLHttpRequest, or an HTTP client', () => {
    for (const [label, src] of [['page', pageSrc], ['component', componentSrc]] as const) {
      expect(src, label).not.toMatch(/\bfetch\s*\(/);
      expect(src, label).not.toMatch(/XMLHttpRequest/);
      expect(src, label).not.toMatch(/from ['"]axios['"]/);
    }
  });

  it('the component never persists input — no localStorage, no sessionStorage, no cookie write', () => {
    expect(componentCode).not.toMatch(/localStorage/);
    expect(componentCode).not.toMatch(/sessionStorage/);
    expect(componentCode).not.toMatch(/document\.cookie\s*=/);
  });
});

describe('no public booking CTA appears', () => {
  it('the component never renders a Trip.com link or the standard booking CTA copy', () => {
    expect(componentSrc).not.toMatch(/trip\.com/i);
    expect(componentSrc).not.toContain('Compare flights on Trip.com');
    expect(componentSrc).not.toMatch(/from ['"]@\/lib\/booking-providers['"]/);
  });

  it('never offers an email signup, newsletter, or Route Watch action', () => {
    expect(componentSrc).not.toMatch(/RouteWatchForm/);
    expect(componentSrc).not.toMatch(/newsletter/i);
    expect(componentSrc).not.toMatch(/type=['"]email['"]/);
  });
});

describe('unsupported routes cannot be submitted (UI level)', () => {
  it('the route field is a closed <select> populated only from FOUNDER_PREVIEW_ROUTE_OPTIONS — no free-text route input exists', () => {
    expect(componentSrc).toContain('FOUNDER_PREVIEW_ROUTE_OPTIONS.map');
    expect(componentSrc).toMatch(/<select[\s\S]*?id="ab-route"/);
    expect(componentSrc).not.toMatch(/type="text"[^>]*route/i);
  });
});

describe('warnings and withdrawal state are always rendered when the engine returns one', () => {
  it('the component unconditionally surfaces routeWarning and every planningWarnings entry, never conditionally hidden behind a flag', () => {
    expect(componentSrc).toContain('plan.routeWarning &&');
    expect(componentSrc).toContain('plan.planningWarnings.map');
    expect(componentSrc).toContain("result.state === 'route_verification_required'");
    expect(componentSrc).toContain('result.routeWarning');
  });
});

describe('does not imply a guarantee, live availability, or a bookable itinerary', () => {
  it('the component renders the engine\'s own disclaimer and never hardcodes a forbidden phrase', () => {
    expect(componentSrc).toMatch(/plan\.disclaimer|result\.disclaimer/);
    for (const forbidden of ['guaranteed arrival', 'you must book this flight', 'perfect departure time', 'live result', 'best flight']) {
      expect(componentSrc.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe('accessible form structure', () => {
  it('every input/select has an associated <label htmlFor>', () => {
    const ids = [...componentSrc.matchAll(/id="(ab-[a-z]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(componentSrc, id).toMatch(new RegExp(`htmlFor="${id}"`));
    }
  });

  it('the result region is announced via aria-live for screen readers', () => {
    expect(componentSrc).toMatch(/aria-live="polite"/);
  });
});
