import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { PageHero } from '@/components/sections/page-hero';
import { guides } from '@/data/guides';
import { getGuideImage } from '@/lib/brand-images';

export const metadata: Metadata = {
  alternates: { canonical: '/guides' },
  title: 'Travel Guides',
  description: 'Practical guides for UK travellers heading to Pakistan, India, the Gulf and beyond.',
};

export default function GuidesPage() {
  return (
    <>
      <PageHero
        heroKey="guides"
        eyebrow="Travel guides"
        title="The detail that actually affects your booking"
        description="Visa timing, festival pricing, direct-versus-connecting maths: the questions people on these routes actually ask, answered without filler."
        stats={[{ value: String(guides.length), label: 'Guides' }]}
      />

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((guide, i) => (
              <GuideCard key={guide.slug} guide={guide} index={i} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function GuideCard({
  guide,
  index,
}: {
  guide: (typeof guides)[number];
  index: number;
}) {
  const image = getGuideImage(guide.slug);

  return (
    <Link
      href={`/guides/${guide.slug}`}
      className="group flex flex-col overflow-hidden rounded-md border border-ink-100 bg-white shadow-card transition-all hover:-translate-y-1 hover:border-brass-200 hover:shadow-card-hover"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ink-900">
        {image ? (
          <Image
            src={image.src}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(200,147,46,0.18),transparent_65%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/55 via-ink-950/5 to-ink-950/20" />
        <div className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-sm bg-ink-950/75 text-brass-300 backdrop-blur-sm">
          <BookOpen className="h-4.5 w-4.5" strokeWidth={2} />
        </div>
        <span className="absolute right-4 top-4 font-display text-sm text-sand-50/75" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h2 className="font-display text-xl leading-snug text-ink-900">{guide.title}</h2>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-500">{guide.summary}</p>
        <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900 transition-colors group-hover:text-terracotta-600">
          Read guide
          <ArrowUpRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            strokeWidth={2.25}
          />
        </span>
      </div>
    </Link>
  );
}
