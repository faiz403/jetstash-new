import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { PageHero } from '@/components/sections/page-hero';
import { guides } from '@/data/guides';

export const metadata: Metadata = {
  alternates: { canonical: '/guides' },
  title: 'Travel Guides',
  description: 'Practical guides for UK travellers heading to Pakistan, India, the Gulf and beyond.',
};

export default function GuidesPage() {
  return (
    <>
      <PageHero
        eyebrow="Travel guides"
        title="The detail that actually affects your booking"
        description="Visa timing, festival pricing, direct-versus-connecting maths — the questions people on these routes actually ask, answered without filler."
        stats={[{ value: String(guides.length), label: 'Guides' }]}
      />

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((guide, i) => (
              <Link
                key={guide.slug}
                href={`/guides/${guide.slug}`}
                className="group flex flex-col rounded-md border border-ink-100 bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:border-brass-200 hover:shadow-card-hover"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-sand-100 text-brass-600 transition-colors group-hover:bg-brass-50">
                    <BookOpen className="h-4.5 w-4.5" strokeWidth={2} />
                  </span>
                  <span className="font-display text-sm text-ink-200" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h2 className="mt-4 font-display text-xl leading-snug text-ink-900">{guide.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-500">{guide.summary}</p>
                <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900 transition-colors group-hover:text-terracotta-600">
                  Read guide
                  <ArrowUpRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    strokeWidth={2.25}
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
