import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { guides, getGuideBySlug, getRelatedGuides } from '@/data/guides';
import { Badge } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { JsonLd, breadcrumbSchema } from '@/components/seo/json-ld';
import { siteConfig } from '@/lib/site-config';

export async function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const guide = getGuideBySlug(params.slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.summary,
    alternates: { canonical: `${siteConfig.url}/guides/${guide.slug}` },
  };
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = getGuideBySlug(params.slug);
  if (!guide) {
    notFound();
    return null;
  }

  const related = getRelatedGuides(guide.slug);

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', href: '/' },
          { name: 'Travel Guides', href: '/guides' },
          { name: guide.title, href: `/guides/${guide.slug}` },
        ])}
      />
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs text-ink-400">
            <Link href="/" className="hover:text-brass-300">Home</Link>
            <span>/</span>
            <Link href="/guides" className="hover:text-brass-300">Travel Guides</Link>
          </nav>
          <Badge variant="dark">Travel guide</Badge>
          <h1 className="mt-4 max-w-2xl font-display text-3xl leading-[1.12] text-sand-50 sm:text-5xl">{guide.title}</h1>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-2xl px-5 sm:px-8">
          <article className="flex flex-col gap-5">
            {guide.paragraphs.map((p, i) => (
              <p
                key={p.slice(0, 40)}
                // Editorial lead: the opening paragraph is set larger, like a magazine standfirst.
                className={i === 0 ? 'text-xl leading-relaxed text-ink-700' : 'text-lg leading-relaxed text-ink-600'}
              >
                {p}
              </p>
            ))}
          </article>

          <div className="mt-10 flex flex-col gap-4 rounded-md border border-ink-100 bg-sand-50 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-lg text-ink-900">Planning this trip?</p>
              <p className="mt-1 text-sm text-ink-500">Every route we cover has its own booking-window and peak-period guide.</p>
            </div>
            <LinkButton href="/routes" variant="dark" size="md" className="shrink-0">
              Find your route
            </LinkButton>
          </div>
        </div>
      </section>

      <section className="border-t border-ink-100 bg-sand-50 py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900">More guides</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {related.map((g) => (
              <Link
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="group flex flex-col rounded-md border border-ink-100 bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
              >
                <h3 className="font-display text-lg leading-snug text-ink-900">{g.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-500">{g.summary}</p>
                <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                  Read guide
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.25} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
