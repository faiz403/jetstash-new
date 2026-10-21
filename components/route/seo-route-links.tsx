import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { SeoRouteLink } from '@/lib/seo-indexing-pilot';

/**
 * SEO indexing pilot (21 Oct 2026): plain, server-rendered links to route
 * guides that currently pass the pilot's eligibility gate (see
 * lib/seo-indexing-pilot.ts). Server-rendered on purpose — the homepage's
 * Atlas and journey finder navigate client-side, so before this a crawler
 * reading the homepage found a single route link. Renders nothing when no
 * target is eligible, rather than an empty heading. The heading is an h3:
 * both call sites sit inside a section that already has its own h2.
 */
export function SeoRouteLinks({ links, heading, intro, className = '' }: { links: SeoRouteLink[]; heading: string; intro?: string; className?: string }) {
  if (links.length === 0) return null;
  return (
    <div className={className}>
      <h3 className="text-sm font-semibold text-ink-900">{heading}</h3>
      {intro && <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{intro}</p>}
      <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {links.map((link) => (
          <li key={link.slug}>
            <Link
              href={link.href}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 underline decoration-brass-400 decoration-2 underline-offset-4 hover:text-terracotta-600"
            >
              {link.label} flights
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            </Link>
            <span className="ml-2 text-xs text-ink-500">
              {link.codes} · {link.statusLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
