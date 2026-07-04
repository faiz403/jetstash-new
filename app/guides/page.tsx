import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { guides } from '@/data/guides';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  alternates: { canonical: '/guides' },
  title: 'Travel Guides',
  description: 'Practical guides for UK travellers heading to Pakistan, India, the Gulf and beyond.',
};

export default function GuidesPage() {
  return (
    <>
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <Badge variant="dark">Travel Guides</Badge>
          <h1 className="mt-4 font-display text-4xl text-sand-50 sm:text-5xl">Practical guides</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-300">
            The detail that actually affects your booking — not generic packing-list content.
          </p>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/guides/${guide.slug}`}
                className="group flex flex-col rounded-md border border-ink-100 bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
              >
                <h2 className="font-display text-xl leading-snug text-ink-900">{guide.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-500">{guide.summary}</p>
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
