import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Standard Vercel Pro Web Analytics stores at most TWO custom properties per
 * event. A third is not an error — it is silently dropped, which is the worst
 * failure mode available: the call site looks instrumented, the dashboard
 * quietly never shows the data, and nobody notices until someone goes looking
 * for a number that was never collected.
 *
 * The Web Analytics Plus add-on would raise the ceiling to eight and is a
 * deliberate non-purchase (founder decision, August 2026), so two is a
 * permanent constraint rather than a temporary one. This file enforces it
 * mechanically across every call site instead of relying on review.
 *
 * It also enforces the privacy rule that sits alongside it: an analytics
 * property must never carry a URL, query string or affiliate identifier. The
 * page a click happened on is already carried by the pageview's own path, so
 * sending it again is redundant as well as leaky.
 */

const ROOTS = ['app', 'components', 'lib'];

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Splits the object literal starting at `openIdx` into its TOP-LEVEL entries.
 * Depth-aware on purpose: `{ route: `${a}-${b}`, source }` is two properties,
 * not four — the `${` inside a template literal opens a brace that must not be
 * mistaken for a nested object, and the comma inside it is not a separator.
 */
function topLevelProps(src: string, openIdx: number): { props: string[]; raw: string } | null {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const raw = src.slice(openIdx, i + 1);
        const inner = raw.slice(1, -1);
        const parts: string[] = [];
        let d = 0;
        let cur = '';
        for (const c of inner) {
          if (c === '{' || c === '[' || c === '(') d++;
          if (c === '}' || c === ']' || c === ')') d--;
          if (c === ',' && d === 0) {
            parts.push(cur);
            cur = '';
          } else {
            cur += c;
          }
        }
        parts.push(cur);
        return { props: parts.map((p) => p.trim()).filter(Boolean), raw };
      }
    }
  }
  return null;
}

interface Site {
  file: string;
  label: string;
  props: string[];
  raw: string;
}

function collectAnalyticsSites(): Site[] {
  const sites: Site[] = [];
  for (const root of ROOTS) {
    for (const file of collectSourceFiles(join(process.cwd(), root))) {
      if (file.includes('analytics-property-limit')) continue;
      const src = readFileSync(file, 'utf8');
      const rel = file.replace(process.cwd(), '').replace(/\\/g, '/');

      // track('event_name', { ... })
      const trackRe = /track\(\s*'([a-z_]+)'\s*,\s*\{/g;
      let m: RegExpExecArray | null;
      while ((m = trackRe.exec(src)) !== null) {
        const openIdx = src.indexOf('{', m.index + m[0].length - 1);
        const parsed = topLevelProps(src, openIdx);
        if (parsed) sites.push({ file: rel, label: `track('${m[1]}')`, ...parsed });
      }

      // <TrackedOutboundLink properties={{ ... }} />
      const propsRe = /properties=\{\s*\{/g;
      while ((m = propsRe.exec(src)) !== null) {
        const openIdx = src.indexOf('{', src.indexOf('{', m.index) + 1);
        const parsed = topLevelProps(src, openIdx);
        if (parsed) sites.push({ file: rel, label: 'properties={{...}}', ...parsed });
      }
    }
  }
  return sites;
}

const sites = collectAnalyticsSites();

describe('Vercel Pro two-property ceiling', () => {
  it('finds the real analytics call sites (guards against the scanner silently matching nothing)', () => {
    expect(sites.length).toBeGreaterThanOrEqual(15);
  });

  it('no analytics event sends more than two custom properties', () => {
    const offenders = sites
      .filter((s) => s.props.length > 2)
      .map((s) => `${s.file} ${s.label} → ${s.props.length} props: ${s.raw}`);
    expect(offenders, `these would be silently truncated by Vercel Pro:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no analytics property carries a URL, query string or affiliate identifier', () => {
    const forbidden = [/\burl\b/i, /\bhref\b/i, /Allianceid/i, /\bSID\b/, /trip_sub/, /https?:\/\//];
    const offenders: string[] = [];
    for (const s of sites) {
      for (const pattern of forbidden) {
        if (pattern.test(s.raw)) offenders.push(`${s.file} ${s.label} matched ${pattern} → ${s.raw}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no analytics property carries personal or document data', () => {
    const forbidden = [/email/i, /passport/i, /\bphone\b/i, /firstName/i, /lastName/i, /\bmessage\b/i];
    const offenders: string[] = [];
    for (const s of sites) {
      for (const pattern of forbidden) {
        if (pattern.test(s.raw)) offenders.push(`${s.file} ${s.label} matched ${pattern} → ${s.raw}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('the four reduced events keep exactly the right two properties', () => {
  const find = (needle: string) => sites.find((s) => s.raw.includes(needle));

  it('tripcom_click sends route + source at all call sites, never origin/destination', () => {
    const tripcomSites = sites.filter((s) => s.label === 'properties={{...}}');
    expect(tripcomSites.length).toBe(4);
    for (const s of tripcomSites) {
      expect(s.props.length, `${s.file}: ${s.raw}`).toBe(2);
      expect(s.raw).toMatch(/route:/);
      expect(s.raw).toMatch(/source:/);
      expect(s.raw).not.toMatch(/origin:/);
      expect(s.raw).not.toMatch(/destination:/);
    }
  });

  it('route_watch_signup sends a composite route slug plus intent', () => {
    const s = find('route_watch_signup') ?? sites.find((x) => x.label === "track('route_watch_signup')");
    expect(s).toBeDefined();
    expect(s!.props).toHaveLength(2);
    expect(s!.raw).toContain('${airportSlug}-${destinationSlug}');
    expect(s!.raw).toContain('intent');
  });

  it('journey_check_completed sends a composite route slug plus the safe result category', () => {
    const s = sites.find((x) => x.label === "track('journey_check_completed')");
    expect(s).toBeDefined();
    expect(s!.props).toHaveLength(2);
    expect(s!.raw).toContain('${fromSlug}-${toSlug}');
    expect(s!.raw).toContain('resultCategory');
  });

  it('whatsapp_share_click sends route + source, never the shared URL it used to leak', () => {
    const s = sites.find((x) => x.label === "track('whatsapp_share_click')");
    expect(s).toBeDefined();
    expect(s!.props).toHaveLength(2);
    expect(s!.props).toEqual(['route', 'source']);
  });
});

describe('the one dynamically-built property bag also respects the ceiling', () => {
  // newsletter-section.tsx builds its properties conditionally, so the static
  // scanner above cannot see it — assert its shape directly instead.
  const src = readFileSync(join(process.cwd(), 'components/sections/newsletter-section.tsx'), 'utf8');

  it('newsletter_subscribe_success can only ever assign two keys', () => {
    const block = src.slice(src.indexOf('const properties'), src.indexOf("track('newsletter_subscribe_success'"));
    const assignments = block.match(/properties\.\w+\s*=/g) ?? [];
    expect(assignments).toHaveLength(2);
    expect(assignments).toEqual(['properties.nearestAirport =', 'properties.interest =']);
  });
});
