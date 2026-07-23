import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isValidElement } from 'react';
import { MAX_WATCHED_ROUTES, ROUTE_WATCH_INITIAL_COPY, ROUTE_WATCH_SUCCESS_COPY } from '@/lib/route-watch-config';
import { RouteWatchInvite } from '@/components/homepage-v2/homepage-sections';

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

/** Same traversal as collectStrings, but collects every `href` prop found on the way down. */
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

describe('Route Watch config — copy matches the real implementation (Brevo storage, human review, no automated engine)', () => {
  it('maximum watched routes is 3', () => {
    expect(MAX_WATCHED_ROUTES).toBe(3);
  });

  it('initial copy says the updates are human-reviewed', () => {
    expect(ROUTE_WATCH_INITIAL_COPY).toMatch(/human-reviewed/i);
  });

  it('initial copy says it is not an automatic price-drop alert', () => {
    expect(ROUTE_WATCH_INITIAL_COPY).toMatch(/not an automatic price-drop alert/i);
  });

  it('neither customer-facing string mentions booking timing, documents, Travel Ready Check, or an automated engine', () => {
    const unsupportedClaims = [
      /sensible time to book/i,
      /document to sort/i,
      /travel[- ]ready/i,
      /intelligence engine/i,
      /automated? (checks?|engine)/i,
    ];
    for (const copy of [ROUTE_WATCH_INITIAL_COPY, ROUTE_WATCH_SUCCESS_COPY]) {
      for (const pattern of unsupportedClaims) {
        expect(copy, `"${copy}" should not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('success copy makes no unsupported capability claim beyond "we review, then email if it matters"', () => {
    expect(ROUTE_WATCH_SUCCESS_COPY).toMatch(/watching this route/i);
    expect(ROUTE_WATCH_SUCCESS_COPY).toMatch(/review/i);
    expect(ROUTE_WATCH_SUCCESS_COPY).not.toMatch(/price|fare|book by|document/i);
  });
});

describe('Homepage Route Watch invitation — uses the shared config, cannot drift from the form', () => {
  it('renders ROUTE_WATCH_INITIAL_COPY verbatim as its supporting paragraph', () => {
    const element = RouteWatchInvite();
    const text = collectStrings(element).join(' ');
    expect(text).toContain(ROUTE_WATCH_INITIAL_COPY);
  });

  it('the old unsupported phrases can never reappear in the rendered output', () => {
    const element = RouteWatchInvite();
    const text = collectStrings(element).join(' ');
    expect(text).not.toMatch(/sensible time to book/i);
    expect(text).not.toMatch(/document to sort/i);
    expect(text).not.toMatch(/automated? (checks?|engine)/i);
  });

  it('uses the new honest heading, not a claim of automatic change detection', () => {
    const element = RouteWatchInvite();
    const text = collectStrings(element).join(' ');
    expect(text).toMatch(/Keep the route on your radar/i);
    expect(text).not.toMatch(/we'?ll tell you when something genuinely changes/i);
  });

  it('the "Watch a route" CTA anchors directly to the route-watch form, matching every other same-purpose CTA on the site', () => {
    const element = RouteWatchInvite();
    const hrefs = collectHrefs(element);
    expect(hrefs).toContain('/routes/manchester-mumbai#route-watch');
  });
});

describe('Route Watch API — still wired to the shared MAX_WATCHED_ROUTES, not a local redeclaration', () => {
  // Deliberately not importing the Next.js API route module (it depends on
  // next/server, which isn't meant to be exercised outside a Next runtime)
  // — a narrow source check is enough to confirm the wiring itself.
  const apiSource = readFileSync(join(__dirname, '..', 'app', 'api', 'route-watch', 'route.ts'), 'utf-8');

  it('imports MAX_WATCHED_ROUTES from the shared config module', () => {
    expect(apiSource).toMatch(/import\s*\{\s*MAX_WATCHED_ROUTES\s*\}\s*from\s*['"]@\/lib\/route-watch-config['"]/);
  });

  it('does not redeclare its own local MAX_WATCHED_ROUTES constant', () => {
    expect(apiSource).not.toMatch(/const\s+MAX_WATCHED_ROUTES\s*=/);
  });
});
