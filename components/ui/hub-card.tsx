import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandImage } from '@/lib/brand-images';
import { DestinationMark } from './destination-mark';

export function HubCard({
  href,
  eyebrow,
  title,
  description,
  size = 'md',
  image,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  size?: 'md' | 'lg';
  /** Resolved brand photo (getHeroImage/getDestinationImage) — falls back to the generated panel when null/omitted. */
  image?: BrandImage | null;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-md border border-white/10 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brass/40 hover:shadow-card-hover',
        size === 'lg' ? 'min-h-[320px] p-8' : 'min-h-[240px]'
      )}
    >
      <div className="absolute inset-0">
        {image ? (
          <Image
            src={image.src}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            aria-hidden="true"
          />
        ) : (
          <DestinationMark seed={title} className="p-0" />
        )}
      </div>
      {/* Vignette rather than a single bottom-anchored gradient: this card's
          content sits at the TOP (eyebrow/title/description) with only the
          "Explore" CTA at the bottom, so both ends need protection — a photo
          can put bright sky exactly where the title/description sit. Dark at
          top and bottom, lighter only through the untexted middle band; the
          via stop is pushed past the halfway point so the dark zone actually
          reaches down past a two-line title and description, not just the
          eyebrow line. */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/90 via-ink-950/25 via-[65%] to-ink-950/75" />

      {/* Belt and braces: a drop-shadow on the text itself, independent of
          gradient timing, so legibility holds regardless of which photo a
          future file-drop puts here or how brightness falls within it. */}
      <div className="relative z-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
        <span className="text-xs font-semibold uppercase tracking-wide text-brass-300">{eyebrow}</span>
        <h3 className={cn('mt-2 font-display leading-tight text-sand-50', size === 'lg' ? 'text-3xl' : 'text-2xl')}>
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-sand-100">{description}</p>
      </div>
      <div className="relative z-10 mt-4 flex items-center gap-1.5 text-sm font-semibold text-brass-300">
        Explore
        <ArrowUpRight
          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          strokeWidth={2.25}
        />
      </div>
    </Link>
  );
}
